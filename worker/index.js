/**
 * Cloudflare Worker: Free IPTV Edge Gateway with EPG & Clean Categorization
 * 
 * Features:
 * - Dynamic filtering: ?category=news, ?country=us, ?quality=1080p, ?search=bbc
 * - Dynamic grouping: ?group_by=category | country | combined
 * - XMLTV EPG Server: /epg.xml and /epg.json
 * - CORS streaming proxy: /proxy?url=...
 * - Edge caching for sub-30ms global performance
 */

const DEFAULT_UPSTREAM_BASE = "https://raw.githubusercontent.com/username/IPTV/main/public/streams";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const upstreamBase = env.UPSTREAM_URL || DEFAULT_UPSTREAM_BASE;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type, Authorization, User-Agent",
      "Access-Control-Expose-Headers": "Content-Length, Content-Range, Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const path = url.pathname;

    // 1. Transparent CORS / Stream Proxy (/proxy?url=...)
    if (path === "/proxy") {
      const targetUrl = url.searchParams.get("url");
      if (!targetUrl) {
        return new Response("Missing 'url' query parameter", { status: 400, headers: corsHeaders });
      }

      try {
        const clientHeaders = new Headers();
        if (request.headers.has("range")) {
          clientHeaders.set("range", request.headers.get("range"));
        }
        clientHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

        const upstreamResponse = await fetch(targetUrl, {
          method: request.method,
          headers: clientHeaders,
          redirect: "follow"
        });

        const newHeaders = new Headers(upstreamResponse.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
        newHeaders.delete("content-security-policy");

        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          headers: newHeaders
        });
      } catch (err) {
        return new Response(`Proxy Error: ${err.message}`, { status: 502, headers: corsHeaders });
      }
    }

    // 2. Electronic Program Guide (EPG) XMLTV Endpoints (/epg.xml.gz and /epg.xml)
    if (path === "/epg.xml.gz" || path === "/epg.gz") {
      const epgRes = await fetch(`${upstreamBase}/epg.xml.gz`);
      if (epgRes.ok) {
        return new Response(epgRes.body, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/gzip",
            "Content-Disposition": 'inline; filename="epg.xml.gz"',
            "Cache-Control": "public, max-age=43200"
          }
        });
      }
    }

    if (path === "/epg.xml" || path === "/epg") {
      const epgRes = await fetch(`${upstreamBase}/epg.xml.gz`);
      if (epgRes.ok) {
        // Decompress on the fly using native Web Stream DecompressionStream
        try {
          const ds = new DecompressionStream("gzip");
          const decompressedStream = epgRes.body.pipeThrough(ds);
          return new Response(decompressedStream, {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=43200"
            }
          });
        } catch (e) {
          // Fallback if decompression stream is not supported in environment
          return new Response(epgRes.body, {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/xml; charset=utf-8",
              "Content-Encoding": "gzip",
              "Cache-Control": "public, max-age=43200"
            }
          });
        }
      }
      return new Response('<?xml version="1.0" encoding="UTF-8"?><tv></tv>', {
        headers: { ...corsHeaders, "Content-Type": "application/xml" }
      });
    }

    // 3. EPG JSON Endpoint (/epg.json)
    if (path === "/epg.json") {
      const res = await fetch(`${upstreamBase}/epg.json`);
      if (res.ok) {
        const data = await res.text();
        return new Response(data, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=43200"
          }
        });
      }
      return new Response("{}", { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4. Health & Statistics endpoint (/stats)
    if (path === "/stats" || path === "/stats.json") {
      const res = await fetch(`${upstreamBase}/stats.json`);
      if (res.ok) {
        const data = await res.text();
        return new Response(data, {
          headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
        });
      }
      return new Response(JSON.stringify({ status: "loading" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 5. Channels JSON API (for web players)
    if (path === "/channels.json") {
      const res = await fetch(`${upstreamBase}/channels.json`);
      if (res.ok) {
        const data = await res.text();
        return new Response(data, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=3600"
          }
        });
      }
      return new Response("[]", { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 6. Dynamic M3U8 Playlist Router
    if (path === "/playlist.m3u8" || path === "/" || path.endsWith(".m3u") || path.endsWith(".m3u8")) {
      const categoryParam = url.searchParams.get("category");
      const countryParam = url.searchParams.get("country");
      const qualityParam = url.searchParams.get("quality");
      const searchParam = url.searchParams.get("search");
      const groupByParam = url.searchParams.get("group_by") || "category"; // category, country, combined

      // Direct file match if requested without query params
      let targetFile = "playlist.m3u8";
      const cleanPath = path.replace("/", "");
      if (cleanPath.endsWith(".m3u8") && cleanPath !== "playlist.m3u8") {
        targetFile = cleanPath;
      }

      // If user provided filters or custom grouping, generate playlist on the fly
      if (categoryParam || countryParam || qualityParam || searchParam || groupByParam !== "category") {
        const jsonRes = await fetch(`${upstreamBase}/channels.json`);
        if (jsonRes.ok) {
          let channels = await jsonRes.json();

          if (categoryParam) {
            channels = channels.filter(c => (c.category || "").toLowerCase() === categoryParam.toLowerCase());
          }
          if (countryParam) {
            channels = channels.filter(c => (c.country_code || c.country || "").toUpperCase() === countryParam.toUpperCase());
          }
          if (qualityParam) {
            channels = channels.filter(c => (c.quality || "").toLowerCase().includes(qualityParam.toLowerCase()));
          }
          if (searchParam) {
            const q = searchParam.toLowerCase();
            channels = channels.filter(c => (c.name || "").toLowerCase().includes(q));
          }

          const epgLink = `${url.origin}/epg.xml`;
          let m3u = `#EXTM3U url-tvg="${epgLink}" x-tvg-url="${epgLink}" refresh="3600"\n#PLAYLIST:Free IPTV (Filtered)\n#EXT-X-VERSION:3\n\n`;

          channels.forEach(ch => {
            const tvgId = ch.id || "";
            const tvgName = ch.name || "";
            const tvgLogo = ch.logo || "";
            const country = ch.country_code || "";
            const countryDisplay = ch.country_display || "🌐 International";
            const quality = ch.quality || "720p HD";

            let group = ch.category || "General";
            if (groupByParam === "country") {
              group = countryDisplay;
            } else if (groupByParam === "combined") {
              group = `${ch.category || "General"} · ${countryDisplay}`;
            }

            m3u += `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${tvgName}" tvg-logo="${tvgLogo}" group-title="${group}" tvg-country="${country}" tvg-quality="${quality}",${ch.name} [${quality}]\n#EXTGRP:${group}\n${ch.url}\n`;
          });

          return new Response(m3u, {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
              "Content-Disposition": 'inline; filename="playlist.m3u8"',
              "Cache-Control": "public, max-age=1800"
            }
          });
        }
      }

      // Default: fetch master playlist with injected EPG link
      const playlistRes = await fetch(`${upstreamBase}/${targetFile}`);
      if (playlistRes.ok) {
        let playlistContent = await playlistRes.text();
        // Replace relative epg.xml with absolute worker URL
        playlistContent = playlistContent.replace('url-tvg="epg.xml"', `url-tvg="${url.origin}/epg.xml"`);
        
        return new Response(playlistContent, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
            "Content-Disposition": `inline; filename="${targetFile}"`,
            "Cache-Control": "public, max-age=3600"
          }
        });
      }

      return new Response("#EXTM3U\n# Playlist is compiling. Please check back shortly.\n", {
        headers: { ...corsHeaders, "Content-Type": "application/vnd.apple.mpegurl" }
      });
    }

    return new Response("Free IPTV Edge Worker Active. Visit /playlist.m3u8 or /epg.xml", {
      headers: corsHeaders
    });
  }
};
