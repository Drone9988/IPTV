/**
 * Cloudflare Worker: Free IPTV Edge Gateway & Dynamic Router
 * 
 * Features:
 * - Serves master, categorized, and filtered M3U8 playlists directly from the edge.
 * - Dynamic query filtering: ?category=news, ?country=us, ?search=bbc
 * - CORS proxy for web players and strict IPTV clients: /proxy?url=...
 * - Edge caching for ultra-fast worldwide delivery (sub-30ms)
 * - Automatic fallback and health stats
 */

// Replace with your GitHub raw content URL or Cloudflare Pages URL
// Example: "https://raw.githubusercontent.com/<YOUR_GITHUB_USER>/<REPO>/main/public/streams"
const DEFAULT_UPSTREAM_BASE = "https://raw.githubusercontent.com/username/IPTV/main/public/streams";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const upstreamBase = env.UPSTREAM_URL || DEFAULT_UPSTREAM_BASE;

    // CORS Headers for global access (VLC, Web Players, TiviMate, etc.)
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
        // Forward Range header for video streaming
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

    // 2. Health & Statistics endpoint
    if (path === "/stats" || path === "/stats.json") {
      const res = await fetch(`${upstreamBase}/stats.json`);
      if (res.ok) {
        const data = await res.text();
        return new Response(data, {
          headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
        });
      }
      return new Response(JSON.stringify({ status: "loading", message: "Initial playlist build in progress" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Channels JSON API (for web players)
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

    // 4. EPG XML Proxy
    if (path === "/epg.xml" || path === "/epg") {
      const epgUrl = "https://iptv-org.github.io/epg/guides/us.xml";
      const epgRes = await fetch(epgUrl);
      return new Response(epgRes.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=86400"
        }
      });
    }

    // 5. Dynamic M3U8 Playlist Router (supports ?category=..., ?country=..., ?search=...)
    if (path === "/playlist.m3u8" || path === "/" || path.endsWith(".m3u") || path.endsWith(".m3u8")) {
      const categoryParam = url.searchParams.get("category");
      const countryParam = url.searchParams.get("country");
      const searchParam = url.searchParams.get("search");

      // Check if user requested a specific pre-built category or country directly via path:
      // e.g. /news.m3u8 or /sports.m3u8 or /us.m3u8
      let targetFile = "playlist.m3u8";
      const cleanPath = path.replace("/", "");
      if (cleanPath.endsWith(".m3u8") && cleanPath !== "playlist.m3u8") {
        targetFile = cleanPath;
      }

      // Fetch master channels JSON to do dynamic filtering if query params are present
      if (categoryParam || countryParam || searchParam) {
        const jsonRes = await fetch(`${upstreamBase}/channels.json`);
        if (jsonRes.ok) {
          let channels = await jsonRes.json();

          if (categoryParam) {
            channels = channels.filter(c => (c.category || "").toLowerCase() === categoryParam.toLowerCase());
          }
          if (countryParam) {
            channels = channels.filter(c => (c.country || "").toUpperCase() === countryParam.toUpperCase());
          }
          if (searchParam) {
            const q = searchParam.toLowerCase();
            channels = channels.filter(c => (c.name || "").toLowerCase().includes(q));
          }

          // Build dynamic M3U
          let m3u = "#EXTM3U\n#EXT-X-VERSION:3\n";
          channels.forEach(ch => {
            const tvgId = ch.id || "";
            const tvgName = ch.name || "";
            const tvgLogo = ch.logo || "";
            const group = ch.category || "General";
            const country = ch.country || "";
            m3u += `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${tvgName}" tvg-logo="${tvgLogo}" group-title="${group}" tvg-country="${country}",${ch.name}\n${ch.url}\n`;
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

      // Default: fetch pre-generated playlist from upstream
      const playlistRes = await fetch(`${upstreamBase}/${targetFile}`);
      if (playlistRes.ok) {
        const playlistContent = await playlistRes.text();
        return new Response(playlistContent, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
            "Content-Disposition": `inline; filename="${targetFile}"`,
            "Cache-Control": "public, max-age=3600"
          }
        });
      }

      return new Response("#EXTM3U\n# Playlist is being generated by GitHub Actions. Please check back in a few minutes.\n", {
        headers: { ...corsHeaders, "Content-Type": "application/vnd.apple.mpegurl" }
      });
    }

    return new Response("Free IPTV Edge Worker Active. Visit /playlist.m3u8", {
      headers: corsHeaders
    });
  }
};
