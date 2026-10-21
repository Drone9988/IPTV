#!/usr/bin/env python3
"""
Build script to compile public/ assets into Cloudflare Worker scripts (worker/index.js and worker.js)
"""
import os
import json

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
WORKER_INDEX = os.path.join(ROOT_DIR, "worker", "index.js")
ROOT_WORKER = os.path.join(ROOT_DIR, "worker.js")

with open(os.path.join(PUBLIC_DIR, "index.html"), "r", encoding="utf-8") as f:
    html_content = f.read()

with open(os.path.join(PUBLIC_DIR, "style.css"), "r", encoding="utf-8") as f:
    css_content = f.read()

with open(os.path.join(PUBLIC_DIR, "app.js"), "r", encoding="utf-8") as f:
    js_content = f.read()

worker_template = f'''/**
 * Cloudflare Worker: Free IPTV Web Player & Edge Gateway
 * Embedded single-file worker with high-performance M3U8 rewriting proxy.
 */

const HTML_CONTENT = {json.dumps(html_content)};
const CSS_CONTENT = {json.dumps(css_content)};
const JS_CONTENT = {json.dumps(js_content)};

const DEFAULT_UPSTREAM_BASE = "https://raw.githubusercontent.com/Drone9988/IPTV/main/public/streams";

export default {{
  async fetch(request, env, ctx) {{
    const url = new URL(request.url);
    const upstreamBase = env.UPSTREAM_URL || DEFAULT_UPSTREAM_BASE;

    const corsHeaders = {{
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type, Authorization, User-Agent",
      "Access-Control-Expose-Headers": "Content-Length, Content-Range, Content-Type"
    }};

    if (request.method === "OPTIONS") {{
      return new Response(null, {{ headers: corsHeaders }});
    }}

    const path = url.pathname;

    // 1. Web Player UI Assets
    if (path === "/" || path === "/index.html") {{
      return new Response(HTML_CONTENT, {{
        headers: {{ ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }}
      }});
    }}

    if (path === "/style.css") {{
      return new Response(CSS_CONTENT, {{
        headers: {{ ...corsHeaders, "Content-Type": "text/css; charset=utf-8" }}
      }});
    }}

    if (path === "/app.js") {{
      return new Response(JS_CONTENT, {{
        headers: {{ ...corsHeaders, "Content-Type": "application/javascript; charset=utf-8" }}
      }});
    }}

    // 2. High-Performance CORS & M3U8 Manifest Rewriting Proxy (/proxy?url=...)
    if (path === "/proxy") {{
      const targetUrl = url.searchParams.get("url");
      if (!targetUrl) {{
        return new Response("Missing 'url' query parameter", {{ status: 400, headers: corsHeaders }});
      }}

      try {{
        const clientHeaders = new Headers();
        if (request.headers.has("range")) {{
          clientHeaders.set("range", request.headers.get("range"));
        }}
        clientHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
        clientHeaders.set("Accept", "*/*");

        const upstreamResponse = await fetch(targetUrl, {{
          method: request.method,
          headers: clientHeaders,
          redirect: "follow"
        }});

        const newHeaders = new Headers(upstreamResponse.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
        newHeaders.delete("content-security-policy");
        newHeaders.delete("content-encoding");
        newHeaders.delete("content-length");

        const contentType = (upstreamResponse.headers.get("content-type") || "").toLowerCase();
        const isM3u8 = targetUrl.includes(".m3u8") || targetUrl.includes(".m3u") || contentType.includes("mpegurl") || contentType.includes("application/x-mpegurl");

        if (isM3u8) {{
          const text = await upstreamResponse.text();
          if (text.includes("#EXTM3U") || text.includes("#EXTINF")) {{
            const lines = text.split("\\n");
            const rewritten = lines.map(line => {{
              const trimmed = line.trim();
              if (!trimmed) return line;

              // Rewrite URI inside #EXT-X-KEY or #EXT-X-MAP
              if (trimmed.startsWith("#EXT-X-KEY:") || trimmed.startsWith("#EXT-X-MAP:")) {{
                return line.replace(/URI="([^"]+)"/, (match, p1) => {{
                  try {{
                    const absUri = new URL(p1, targetUrl).href;
                    return `URI="${{url.origin}}/proxy?url=${{encodeURIComponent(absUri)}}"`;
                  }} catch (e) {{
                    return match;
                  }}
                }});
              }}

              // Skip comment lines
              if (trimmed.startsWith("#")) {{
                return line;
              }}

              // Segment or variant stream URL -> rewrite to proxy
              try {{
                const absUrl = new URL(trimmed, targetUrl).href;
                return `${{url.origin}}/proxy?url=${{encodeURIComponent(absUrl)}}`;
              }} catch (e) {{
                return line;
              }}
            }}).join("\\n");

            newHeaders.set("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
            return new Response(rewritten, {{
              status: upstreamResponse.status,
              statusText: upstreamResponse.statusText,
              headers: newHeaders
            }});
          }} else {{
            return new Response(text, {{
              status: upstreamResponse.status,
              statusText: upstreamResponse.statusText,
              headers: newHeaders
            }});
          }}
        }}

        // Stream TS binary video/audio chunks
        return new Response(upstreamResponse.body, {{
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          headers: newHeaders
        }});
      }} catch (err) {{
        return new Response(`Proxy Error: ${{err.message}}`, {{ status: 502, headers: corsHeaders }});
      }}
    }}

    async function fetchStreamAsset(filename) {{
      return await fetch(`${{upstreamBase}}/${{filename}}`);
    }}

    // 3. EPG XMLTV Endpoints (/epg.xml.gz and /epg.xml)
    if (path === "/epg.xml.gz" || path === "/epg.gz" || path === "/streams/epg.xml.gz") {{
      const epgRes = await fetchStreamAsset("epg.xml.gz");
      if (epgRes.ok) {{
        return new Response(epgRes.body, {{
          headers: {{
            ...corsHeaders,
            "Content-Type": "application/gzip",
            "Content-Disposition": 'inline; filename="epg.xml.gz"',
            "Cache-Control": "public, max-age=43200"
          }}
        }});
      }}
    }}

    if (path === "/epg.xml" || path === "/epg" || path === "/streams/epg.xml") {{
      const epgRes = await fetchStreamAsset("epg.xml.gz");
      if (epgRes.ok) {{
        try {{
          const ds = new DecompressionStream("gzip");
          const decompressed = epgRes.body.pipeThrough(ds);
          return new Response(decompressed, {{
            headers: {{
              ...corsHeaders,
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=43200"
            }}
          }});
        }} catch (e) {{
          return new Response(epgRes.body, {{
            headers: {{
              ...corsHeaders,
              "Content-Type": "application/xml; charset=utf-8",
              "Content-Encoding": "gzip",
              "Cache-Control": "public, max-age=43200"
            }}
          }});
        }}
      }}
      return new Response('<?xml version="1.0" encoding="UTF-8"?><tv></tv>', {{
        headers: {{ ...corsHeaders, "Content-Type": "application/xml" }}
      }});
    }}

    // 4. EPG JSON Endpoint (/epg.json)
    if (path === "/epg.json" || path === "/streams/epg.json") {{
      const res = await fetchStreamAsset("epg.json");
      if (res.ok) {{
        const data = await res.text();
        return new Response(data, {{
          headers: {{
            ...corsHeaders,
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=43200"
          }}
        }});
      }}
      return new Response("{{}}", {{ headers: {{ ...corsHeaders, "Content-Type": "application/json" }} }});
    }}

    // 5. Health & Stats endpoint (/stats)
    if (path === "/stats" || path === "/stats.json" || path === "/streams/stats.json") {{
      const res = await fetchStreamAsset("stats.json");
      if (res.ok) {{
        const data = await res.text();
        return new Response(data, {{
          headers: {{ ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }}
        }});
      }}
      return new Response(JSON.stringify({{ status: "online", timestamp: new Date().toISOString() }}), {{
        headers: {{ ...corsHeaders, "Content-Type": "application/json" }}
      }});
    }}

    // 6. Channels JSON API (/channels.json)
    if (path === "/channels.json" || path === "/streams/channels.json") {{
      const res = await fetchStreamAsset("channels.json");
      if (res.ok) {{
        const data = await res.text();
        return new Response(data, {{
          headers: {{
            ...corsHeaders,
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=3600"
          }}
        }});
      }}
      return new Response("[]", {{ headers: {{ ...corsHeaders, "Content-Type": "application/json" }} }});
    }}

    // 7. Dynamic M3U8 Playlist Router
    if (path.endsWith(".m3u") || path.endsWith(".m3u8")) {{
      const categoryParam = url.searchParams.get("category");
      const countryParam = url.searchParams.get("country");
      const qualityParam = url.searchParams.get("quality");
      const searchParam = url.searchParams.get("search");
      const groupByParam = url.searchParams.get("group_by") || "category";

      let targetFile = path.replace("/streams/", "").replace("/", "");
      if (!targetFile || targetFile === "playlist.m3u8" || targetFile === "live.m3u8") {{
        targetFile = "playlist.m3u8";
      }}

      // Dedicated Farsi shortcut /farsi.m3u8
      if (targetFile === "farsi.m3u8" || path === "/farsi" || path === "/farsi.m3u") {{
        const farsiRes = await fetchStreamAsset("farsi.m3u8");
        if (farsiRes.ok) {{
          let content = await farsiRes.text();
          content = content.replace(/url-tvg="epg.xml.gz"/g, `url-tvg="${{url.origin}}/epg.xml.gz"`);
          return new Response(content, {{
            headers: {{
              ...corsHeaders,
              "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
              "Content-Disposition": 'inline; filename="farsi.m3u8"',
              "Cache-Control": "public, max-age=1800"
            }}
          }});
        }}
      }}

      // Dynamic filtering if query params present
      if (categoryParam || countryParam || qualityParam || searchParam || groupByParam !== "category") {{
        const jsonRes = await fetchStreamAsset("channels.json");
        if (jsonRes.ok) {{
          let channels = await jsonRes.json();

          if (categoryParam) {{
            const catLower = categoryParam.toLowerCase();
            channels = channels.filter(c => {{
              const cat = (c.category || "").toLowerCase();
              if (catLower === "farsi") return cat.includes("farsi") || cat.includes("iran") || (c.country_code || "").toUpperCase() === "IR";
              return cat.includes(catLower);
            }});
          }}
          if (countryParam) {{
            channels = channels.filter(c => (c.country_code || c.country || "").toUpperCase() === countryParam.toUpperCase());
          }}
          if (qualityParam) {{
            channels = channels.filter(c => (c.quality || "").toLowerCase().includes(qualityParam.toLowerCase()));
          }}
          if (searchParam) {{
            const q = searchParam.toLowerCase();
            channels = channels.filter(c => (c.name || "").toLowerCase().includes(q));
          }}

          const epgLink = `${{url.origin}}/epg.xml.gz`;
          let m3u = `#EXTM3U url-tvg="${{epgLink}}" x-tvg-url="${{epgLink}}" refresh="3600"\\n#PLAYLIST:Free IPTV (Filtered)\\n#EXT-X-VERSION:3\\n\\n`;

          channels.forEach(ch => {{
            const tvgId = ch.id || "";
            const tvgName = ch.name || "";
            const tvgLogo = ch.logo || "";
            const country = ch.country_code || "";
            const countryDisplay = ch.country_display || "🌐 International";
            const quality = ch.quality || "720p HD";

            let group = ch.category || "General";
            if (groupByParam === "country") {{
              group = countryDisplay;
            }} else if (groupByParam === "combined") {{
              group = `${{ch.category || "General"}} · ${{countryDisplay}}`;
            }}

            m3u += `#EXTINF:-1 tvg-id="${{tvgId}}" tvg-name="${{tvgName}}" tvg-logo="${{tvgLogo}}" group-title="${{group}}" tvg-country="${{country}}" tvg-quality="${{quality}}",${{ch.name}} [${{quality}}]\\n#EXTGRP:${{group}}\\n${{ch.url}}\\n`;
          }});

          return new Response(m3u, {{
            headers: {{
              ...corsHeaders,
              "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
              "Content-Disposition": 'inline; filename="playlist.m3u8"',
              "Cache-Control": "public, max-age=1800"
            }}
          }});
        }}
      }}

      const playlistRes = await fetchStreamAsset(targetFile);
      if (playlistRes.ok) {{
        let content = await playlistRes.text();
        content = content.replace(/url-tvg="epg.xml.gz"/g, `url-tvg="${{url.origin}}/epg.xml.gz"`);
        return new Response(content, {{
          headers: {{
            ...corsHeaders,
            "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
            "Content-Disposition": `inline; filename="${{targetFile}}"`,
            "Cache-Control": "public, max-age=3600"
          }}
        }});
      }}

      return new Response("#EXTM3U\\n# Playlist compiling...\\n", {{
        headers: {{ ...corsHeaders, "Content-Type": "application/vnd.apple.mpegurl" }}
      }});
    }}

    return new Response(HTML_CONTENT, {{
      headers: {{ ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }}
    }});
  }}
}};
'''

os.makedirs(os.path.dirname(WORKER_INDEX), exist_ok=True)
with open(WORKER_INDEX, "w", encoding="utf-8") as f:
    f.write(worker_template)
print(f"Updated {WORKER_INDEX} ({len(worker_template)} bytes)")

with open(ROOT_WORKER, "w", encoding="utf-8") as f:
    f.write(worker_template)
print(f"Updated {ROOT_WORKER} ({len(worker_template)} bytes)")
