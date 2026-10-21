/**
 * Cloudflare Worker: Free IPTV Web Player & Edge Gateway
 */

const HTML_CONTENT = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>Free IPTV - Live Television & EPG Program Guide</title>\n  <!-- Tailwind CSS CDN -->\n  <script src=\"https://cdn.tailwindcss.com\"></script>\n  <!-- Hls.js for HLS video playback -->\n  <script src=\"https://cdn.jsdelivr.net/npm/hls.js@latest\"></script>\n  <!-- Lucide Icons -->\n  <script src=\"https://unpkg.com/lucide@latest\"></script>\n  <link rel=\"stylesheet\" href=\"style.css\">\n</head>\n<body class=\"bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans selection:bg-cyan-500 selection:text-white\">\n\n  <!-- Header -->\n  <header class=\"border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40\">\n    <div class=\"max-w-7xl mx-auto px-4 py-3 flex items-center justify-between\">\n      <div class=\"flex items-center gap-3\">\n        <div class=\"w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20\">\n          <i data-lucide=\"tv\" class=\"w-5 h-5 text-white\"></i>\n        </div>\n        <div>\n          <div class=\"flex items-center gap-2\">\n            <h1 class=\"text-base sm:text-lg font-bold bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent\">Free IPTV Edge</h1>\n            <span class=\"text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30\">EPG 7-Day Guide</span>\n          </div>\n          <p class=\"text-xs text-slate-400\">Automated GitHub & Cloudflare Stream Validator</p>\n        </div>\n      </div>\n\n      <!-- Actions & Export Dropdown -->\n      <div class=\"flex items-center gap-2 sm:gap-3\">\n        <!-- EPG XML Link -->\n        <button id=\"copyEpgBtn\" title=\"Copy XMLTV EPG URL for TiviMate / Smarters\" class=\"hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition\">\n          <i data-lucide=\"calendar\" class=\"w-3.5 h-3.5 text-cyan-400\"></i>\n          <span>Copy EPG URL</span>\n        </button>\n\n        <!-- Master M3U Copy Button -->\n        <button id=\"copyM3uBtn\" class=\"flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-900/40 transition\">\n          <i data-lucide=\"copy\" class=\"w-4 h-4\"></i>\n          <span>Copy M3U Playlist</span>\n        </button>\n      </div>\n    </div>\n  </header>\n\n  <!-- Main Grid -->\n  <main class=\"max-w-7xl mx-auto px-4 py-6 flex-1 w-full flex flex-col lg:flex-row gap-6\">\n\n    <!-- Left Column: Video Player, Live EPG Banner & Platform Compatibility -->\n    <div class=\"lg:w-7/12 xl:w-2/3 flex flex-col gap-4\">\n      \n      <!-- Video Player Container -->\n      <div class=\"relative aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center group\">\n        <video id=\"videoPlayer\" class=\"w-full h-full object-contain\" controls autoplay playsinline></video>\n        \n        <!-- Loading Overlay -->\n        <div id=\"videoLoader\" class=\"absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3 pointer-events-none hidden\">\n          <div class=\"w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin\"></div>\n          <span class=\"text-xs font-medium text-cyan-300\">Connecting to live stream...</span>\n        </div>\n\n        <!-- Error Overlay -->\n        <div id=\"videoError\" class=\"absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center gap-3 p-6 text-center hidden\">\n          <i data-lucide=\"alert-triangle\" class=\"w-10 h-10 text-amber-400\"></i>\n          <p class=\"text-sm font-medium text-slate-200\">Unable to load direct browser stream</p>\n          <p class=\"text-xs text-slate-400 max-w-sm\">This stream may enforce strict CORS. You can play it using our Cloudflare Proxy or directly inside VLC / TiviMate.</p>\n          <div class=\"flex gap-2 mt-2\">\n            <button id=\"retryBtn\" class=\"px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium transition\">Retry Stream</button>\n            <button id=\"proxyPlayBtn\" class=\"px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-medium transition\">Try via CORS Proxy</button>\n          </div>\n        </div>\n      </div>\n\n      <!-- Channel & Live EPG Info Bar -->\n      <div class=\"p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col gap-4\">\n        \n        <!-- Channel Header -->\n        <div class=\"flex items-center justify-between gap-3\">\n          <div class=\"flex items-center gap-3\">\n            <img id=\"currentLogo\" src=\"https://via.placeholder.com/48?text=TV\" alt=\"Logo\" class=\"w-12 h-12 rounded-xl bg-slate-800 object-contain p-1 border border-slate-700\">\n            <div>\n              <div class=\"flex items-center gap-2\">\n                <h2 id=\"currentTitle\" class=\"text-base font-bold text-white\">Select a Channel</h2>\n                <span id=\"currentQuality\" class=\"text-[10px] font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800\">1080p FHD</span>\n              </div>\n              <div class=\"flex items-center gap-2 mt-1\">\n                <span id=\"currentCategory\" class=\"px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300\">Category</span>\n                <span id=\"currentCountry\" class=\"px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400\">\ud83c\uddfa\ud83c\uddf8 United States</span>\n                <span class=\"inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium\">\n                  <span class=\"w-2 h-2 rounded-full bg-emerald-400 animate-pulse\"></span>\n                  <span>Live Stream Verified</span>\n                </span>\n              </div>\n            </div>\n          </div>\n\n          <!-- Open TV Guide Button -->\n          <button id=\"openGuideBtn\" class=\"flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-cyan-300 shadow transition\">\n            <i data-lucide=\"calendar\" class=\"w-4 h-4\"></i>\n            <span>7-Day TV Guide</span>\n          </button>\n        </div>\n\n        <!-- EPG \"Now Playing\" & \"Up Next\" Dynamic Card -->\n        <div class=\"p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col gap-2.5\">\n          <div class=\"flex items-center justify-between text-xs\">\n            <div class=\"flex items-center gap-1.5 font-semibold text-cyan-400\">\n              <span class=\"w-2 h-2 rounded-full bg-cyan-400 animate-ping\"></span>\n              <span>NOW PLAYING</span>\n            </div>\n            <span id=\"epgTimeRemaining\" class=\"text-slate-400 text-[11px]\">Calculating schedule...</span>\n          </div>\n\n          <div>\n            <h3 id=\"epgNowTitle\" class=\"text-sm font-bold text-white\">Loading Program...</h3>\n            <p id=\"epgNowDesc\" class=\"text-xs text-slate-400 mt-0.5 line-clamp-2\">Program details and live timeline will appear here.</p>\n          </div>\n\n          <!-- Live Progress Bar -->\n          <div class=\"w-full bg-slate-800 h-1.5 rounded-full overflow-hidden\">\n            <div id=\"epgProgressBar\" class=\"bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-500\" style=\"width: 45%;\"></div>\n          </div>\n\n          <!-- Up Next Preview -->\n          <div class=\"pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400\">\n            <div class=\"flex items-center gap-1.5\">\n              <span class=\"text-slate-500 font-medium uppercase text-[10px]\">Up Next:</span>\n              <span id=\"epgNextTitle\" class=\"text-slate-300 font-medium truncate max-w-[280px]\">Upcoming Broadcast</span>\n            </div>\n            <span id=\"epgNextTime\" class=\"text-[11px] text-slate-500\">In 35 mins</span>\n          </div>\n        </div>\n\n      </div>\n\n      <!-- Quick Platform Integration Guides -->\n      <div class=\"grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs\">\n        <div class=\"p-3 rounded-xl bg-slate-900/60 border border-slate-800\">\n          <span class=\"font-semibold text-slate-200 block mb-1\">\ud83d\udda5\ufe0f VLC Media Player</span>\n          <span class=\"text-slate-500 text-[11px]\">Media &rarr; Open Network Stream &rarr; Paste M3U link</span>\n        </div>\n        <div class=\"p-3 rounded-xl bg-slate-900/60 border border-slate-800\">\n          <span class=\"font-semibold text-slate-200 block mb-1\">\ud83d\udcfa TiviMate / Fire TV</span>\n          <span class=\"text-slate-500 text-[11px]\">Add M3U Playlist + Enter EPG XML URL for full grid guide</span>\n        </div>\n        <div class=\"p-3 rounded-xl bg-slate-900/60 border border-slate-800\">\n          <span class=\"font-semibold text-slate-200 block mb-1\">\ud83d\udcf1 Apple TV & iOS</span>\n          <span class=\"text-slate-500 text-[11px]\">Compatible with IPTVX, GSE Smart IPTV & UHF app</span>\n        </div>\n        <div class=\"p-3 rounded-xl bg-slate-900/60 border border-slate-800\">\n          <span class=\"font-semibold text-slate-200 block mb-1\">\u26a1 Cloudflare Edge</span>\n          <span class=\"text-slate-500 text-[11px]\">Cached across 300+ edge nodes with dynamic query filters</span>\n        </div>\n      </div>\n\n    </div>\n\n    <!-- Right Column: Clean Filtering Controls & Channel Navigation -->\n    <div class=\"lg:w-5/12 xl:w-1/3 flex flex-col gap-3.5\">\n      \n      <!-- Multi-Tiered Filter Controls -->\n      <div class=\"p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-3\">\n        \n        <!-- Search Input -->\n        <div class=\"relative\">\n          <i data-lucide=\"search\" class=\"w-4 h-4 text-slate-400 absolute left-3 top-2.5\"></i>\n          <input type=\"text\" id=\"searchInput\" placeholder=\"Search channels (BBC, CNN, Sports)...\" class=\"w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition\">\n        </div>\n\n        <!-- Country & Quality Dropdowns -->\n        <div class=\"grid grid-cols-2 gap-2\">\n          <!-- Country Filter -->\n          <div>\n            <label class=\"text-[10px] text-slate-400 font-semibold uppercase mb-1 block\">Country</label>\n            <select id=\"countrySelect\" class=\"w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500\">\n              <option value=\"all\">\ud83c\udf0d All Countries</option>\n              <option value=\"IR\">\ud83c\uddee\ud83c\uddf7 Iran / Farsi (\u0641\u0627\u0631\u0633\u06cc)</option>\n              <option value=\"US\">\ud83c\uddfa\ud83c\uddf8 United States</option>\n              <option value=\"UK\">\ud83c\uddec\ud83c\udde7 United Kingdom</option>\n              <option value=\"CA\">\ud83c\udde8\ud83c\udde6 Canada</option>\n              <option value=\"FR\">\ud83c\uddeb\ud83c\uddf7 France</option>\n              <option value=\"DE\">\ud83c\udde9\ud83c\uddea Germany</option>\n              <option value=\"ES\">\ud83c\uddea\ud83c\uddf8 Spain</option>\n              <option value=\"INT\">\ud83c\udf10 International</option>\n            </select>\n          </div>\n\n          <!-- Quality Filter -->\n          <div>\n            <label class=\"text-[10px] text-slate-400 font-semibold uppercase mb-1 block\">Resolution</label>\n            <select id=\"qualitySelect\" class=\"w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500\">\n              <option value=\"all\">\u2728 All Qualities</option>\n              <option value=\"1080p\">\ud83d\udc8e 1080p FHD Only</option>\n              <option value=\"720p\">\ud83d\udcfa 720p HD Only</option>\n            </select>\n          </div>\n        </div>\n\n        <!-- Clean Genre Category Pills -->\n        <div>\n          <label class=\"text-[10px] text-slate-400 font-semibold uppercase mb-1 block\">Genre Category</label>\n          <div id=\"categoryPills\" class=\"flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar\">\n            <button data-cat=\"all\" class=\"cat-pill active px-3 py-1.5 rounded-lg bg-cyan-600 text-white font-medium whitespace-nowrap\">All</button>\n            <button data-cat=\"farsi\" class=\"cat-pill px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 whitespace-nowrap\">\ud83c\uddee\ud83c\uddf7 Farsi / \u0641\u0627\u0631\u0633\u06cc</button>\n            <button data-cat=\"news\" class=\"cat-pill px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 whitespace-nowrap\">\ud83d\udcf0 News</button>\n            <button data-cat=\"sports\" class=\"cat-pill px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 whitespace-nowrap\">\u26bd Sports</button>\n            <button data-cat=\"movies\" class=\"cat-pill px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 whitespace-nowrap\">\ud83c\udfac Movies</button>\n            <button data-cat=\"entertainment\" class=\"cat-pill px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 whitespace-nowrap\">\ud83c\udf7f Entertainment</button>\n            <button data-cat=\"music\" class=\"cat-pill px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 whitespace-nowrap\">\ud83c\udfb5 Music</button>\n            <button data-cat=\"kids\" class=\"cat-pill px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 whitespace-nowrap\">\ud83e\uddd2 Kids</button>\n            <button data-cat=\"documentary\" class=\"cat-pill px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 whitespace-nowrap\">\ud83c\udf3f Docs</button>\n          </div>\n        </div>\n\n      </div>\n\n      <!-- Channel List View -->\n      <div class=\"flex-1 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col overflow-hidden max-h-[580px]\">\n        <!-- List Header -->\n        <div class=\"px-4 py-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400\">\n          <span id=\"channelCountText\" class=\"font-medium text-slate-300\">Loading channels...</span>\n          <span class=\"flex items-center gap-1.5 text-emerald-400 text-[11px] font-medium\">\n            <span class=\"w-1.5 h-1.5 rounded-full bg-emerald-400\"></span>\n            <span>All Streams Online</span>\n          </span>\n        </div>\n\n        <!-- Scrollable Channel Items -->\n        <div id=\"channelsContainer\" class=\"flex-1 overflow-y-auto divide-y divide-slate-800/50 p-2 space-y-1\">\n          <!-- Populated dynamically -->\n        </div>\n      </div>\n\n    </div>\n\n  </main>\n\n  <!-- Interactive 7-Day TV Guide Modal / Drawer -->\n  <div id=\"guideModal\" class=\"fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden\">\n    <div class=\"bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden\">\n      \n      <!-- Modal Header -->\n      <div class=\"px-6 py-4 border-b border-slate-800 flex items-center justify-between\">\n        <div class=\"flex items-center gap-3\">\n          <img id=\"guideModalLogo\" src=\"https://via.placeholder.com/40\" class=\"w-9 h-9 rounded-lg bg-slate-800 object-contain p-1 border border-slate-700\">\n          <div>\n            <h3 id=\"guideModalTitle\" class=\"text-sm font-bold text-white\">Channel Schedule</h3>\n            <p class=\"text-xs text-slate-400\">Full Daily & Weekly Electronic Program Guide (EPG)</p>\n          </div>\n        </div>\n        <button id=\"closeGuideBtn\" class=\"p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition\">\n          <i data-lucide=\"x\" class=\"w-5 h-5\"></i>\n        </button>\n      </div>\n\n      <!-- Day Tabs Bar -->\n      <div id=\"guideDayTabs\" class=\"px-6 py-2 border-b border-slate-800 flex gap-2 overflow-x-auto bg-slate-950/60 no-scrollbar text-xs\">\n        <!-- Dynamically populated with 7 days (Today, Tomorrow, ...) -->\n      </div>\n\n      <!-- Schedule Timeline Container -->\n      <div id=\"guideTimeline\" class=\"flex-1 overflow-y-auto p-6 divide-y divide-slate-800/60 space-y-3\">\n        <!-- Program slots -->\n      </div>\n\n    </div>\n  </div>\n\n  <!-- Footer -->\n  <footer class=\"border-t border-slate-800/80 py-4 text-center text-xs text-slate-500\">\n    <p>Automated Free IPTV Aggregator \u00b7 7-Day XMLTV EPG Support \u00b7 Powered by GitHub Actions & Cloudflare Edge</p>\n  </footer>\n\n  <script src=\"app.js\"></script>\n  <script>\n    lucide.createIcons();\n  </script>\n</body>\n</html>\n";
const CSS_CONTENT = "/* Custom Scrollbars & Animations */\n::-webkit-scrollbar {\n  width: 6px;\n  height: 6px;\n}\n::-webkit-scrollbar-track {\n  background: rgba(15, 23, 42, 0.6);\n}\n::-webkit-scrollbar-thumb {\n  background: rgba(51, 65, 85, 0.8);\n  border-radius: 4px;\n}\n::-webkit-scrollbar-thumb:hover {\n  background: rgba(100, 116, 139, 1);\n}\n\n.no-scrollbar::-webkit-scrollbar {\n  display: none;\n}\n.no-scrollbar {\n  -ms-overflow-style: none;\n  scrollbar-width: none;\n}\n\n.channel-card {\n  transition: all 0.15s ease-in-out;\n}\n.channel-card:hover {\n  background-color: rgba(30, 41, 59, 0.7);\n}\n.channel-card.active {\n  background-color: rgba(8, 145, 178, 0.2);\n  border: 1px solid rgba(6, 182, 212, 0.4);\n}\n";
const JS_CONTENT = "/**\n * Free IPTV Player & Interactive 7-Day EPG Engine\n * Handles HLS video streaming, dynamic multi-tier filtering,\n * and live program schedule timeline calculations.\n */\n\nlet allChannels = [];\nlet filteredChannels = [];\nlet epgData = {};\nlet activeChannel = null;\nlet currentHls = null;\nlet activeGuideDay = 0; // 0 = Today, 1 = Tomorrow, etc.\nlet epgUpdateTimer = null;\n\n// DOM Elements\nconst videoPlayer = document.getElementById(\"videoPlayer\");\nconst videoLoader = document.getElementById(\"videoLoader\");\nconst videoError = document.getElementById(\"videoError\");\nconst retryBtn = document.getElementById(\"retryBtn\");\nconst proxyPlayBtn = document.getElementById(\"proxyPlayBtn\");\n\nconst channelsContainer = document.getElementById(\"channelsContainer\");\nconst searchInput = document.getElementById(\"searchInput\");\nconst categoryPills = document.querySelectorAll(\".cat-pill\");\nconst countrySelect = document.getElementById(\"countrySelect\");\nconst qualitySelect = document.getElementById(\"qualitySelect\");\nconst channelCountText = document.getElementById(\"channelCountText\");\n\nconst copyM3uBtn = document.getElementById(\"copyM3uBtn\");\nconst copyEpgBtn = document.getElementById(\"copyEpgBtn\");\n\nconst currentTitle = document.getElementById(\"currentTitle\");\nconst currentLogo = document.getElementById(\"currentLogo\");\nconst currentCategory = document.getElementById(\"currentCategory\");\nconst currentCountry = document.getElementById(\"currentCountry\");\nconst currentQuality = document.getElementById(\"currentQuality\");\n\n// EPG Live Card Elements\nconst epgNowTitle = document.getElementById(\"epgNowTitle\");\nconst epgNowDesc = document.getElementById(\"epgNowDesc\");\nconst epgTimeRemaining = document.getElementById(\"epgTimeRemaining\");\nconst epgProgressBar = document.getElementById(\"epgProgressBar\");\nconst epgNextTitle = document.getElementById(\"epgNextTitle\");\nconst epgNextTime = document.getElementById(\"epgNextTime\");\n\n// TV Guide Modal Elements\nconst openGuideBtn = document.getElementById(\"openGuideBtn\");\nconst closeGuideBtn = document.getElementById(\"closeGuideBtn\");\nconst guideModal = document.getElementById(\"guideModal\");\nconst guideModalTitle = document.getElementById(\"guideModalTitle\");\nconst guideModalLogo = document.getElementById(\"guideModalLogo\");\nconst guideDayTabs = document.getElementById(\"guideDayTabs\");\nconst guideTimeline = document.getElementById(\"guideTimeline\");\n\nfunction getBaseUrl() {\n  const loc = window.location;\n  if (loc.hostname.includes(\"workers.dev\")) {\n    return loc.origin;\n  }\n  return `${loc.origin}/streams`;\n}\n\n// 1. Data Loading\nasync function loadData() {\n  channelCountText.textContent = \"Loading streams & EPG...\";\n  \n  try {\n    // Load Channels\n    let chResp = await fetch(\"streams/channels.json\").catch(() => fetch(\"/channels.json\"));\n    if (chResp && chResp.ok) {\n      allChannels = await chResp.json();\n      filteredChannels = [...allChannels];\n    }\n\n    // Load EPG\n    let epgResp = await fetch(\"streams/epg.json\").catch(() => fetch(\"/epg.json\"));\n    if (epgResp && epgResp.ok) {\n      const parsed = await epgResp.json();\n      epgData = parsed.channels || {};\n    }\n\n    renderChannels();\n\n    if (allChannels.length > 0) {\n      playChannel(allChannels[0]);\n    }\n\n    // Periodically update the live EPG progress bar every 30 seconds\n    if (epgUpdateTimer) clearInterval(epgUpdateTimer);\n    epgUpdateTimer = setInterval(updateLiveEpgCard, 30000);\n\n  } catch (err) {\n    channelCountText.textContent = \"Error loading streams\";\n    channelsContainer.innerHTML = `\n      <div class=\"p-6 text-center text-slate-400 text-xs\">\n        <p class=\"font-medium text-slate-300\">Playlists are compiling...</p>\n        <p class=\"mt-1 text-slate-500\">Run the updater to generate streams and EPG data.</p>\n      </div>\n    `;\n  }\n}\n\n// 2. Rendering Channels\nfunction renderChannels() {\n  channelsContainer.innerHTML = \"\";\n  channelCountText.textContent = `${filteredChannels.length} Channels Available`;\n\n  if (filteredChannels.length === 0) {\n    channelsContainer.innerHTML = `\n      <div class=\"p-6 text-center text-slate-500 text-xs\">\n        No channels match your current filters.\n      </div>\n    `;\n    return;\n  }\n\n  filteredChannels.forEach((channel) => {\n    const card = document.createElement(\"div\");\n    const isActive = activeChannel && activeChannel.url === channel.url;\n    card.className = `channel-card p-2.5 rounded-xl flex items-center justify-between cursor-pointer border border-transparent ${\n      isActive ? \"active\" : \"\"\n    }`;\n\n    const logoUrl = channel.logo || \"https://images.unsplash.com/photo-1593784991095-a205069470b6?w=64&auto=format&fit=crop&q=60\";\n    const countryFlag = channel.country_flag || \"\ud83c\udf10\";\n    const qualityBadge = channel.quality || \"720p HD\";\n\n    card.innerHTML = `\n      <div class=\"flex items-center gap-3 overflow-hidden\">\n        <img src=\"${logoUrl}\" onerror=\"this.src='https://via.placeholder.com/40?text=TV'\" class=\"w-9 h-9 rounded-lg bg-slate-800 object-contain p-1 border border-slate-700/80 flex-shrink-0\">\n        <div class=\"overflow-hidden\">\n          <div class=\"flex items-center gap-1.5\">\n            <span class=\"text-xs\">${countryFlag}</span>\n            <h4 class=\"text-xs font-semibold text-white truncate\">${channel.name}</h4>\n          </div>\n          <div class=\"flex items-center gap-1.5 mt-0.5\">\n            <span class=\"text-[10px] text-slate-400 font-medium\">${channel.category || \"General\"}</span>\n            <span class=\"text-[9px] px-1 py-0.2 rounded bg-slate-800 text-cyan-400 font-medium\">${qualityBadge}</span>\n          </div>\n        </div>\n      </div>\n      <div class=\"flex items-center gap-1.5 flex-shrink-0\">\n        <span class=\"w-2 h-2 rounded-full bg-emerald-400\"></span>\n      </div>\n    `;\n\n    card.addEventListener(\"click\", () => {\n      playChannel(channel);\n    });\n\n    channelsContainer.appendChild(card);\n  });\n}\n\n// 3. Play Channel & Update Metadata\nfunction playChannel(channel) {\n  activeChannel = channel;\n  currentTitle.textContent = channel.name;\n  currentLogo.src = channel.logo || \"https://via.placeholder.com/48?text=TV\";\n  currentCategory.textContent = channel.category || \"General\";\n  currentCountry.textContent = channel.country_display || \"\ud83c\udf10 International\";\n  currentQuality.textContent = channel.quality || \"720p HD\";\n\n  renderChannels();\n  updateLiveEpgCard();\n\n  startStream(channel.url);\n}\n\n// 4. HLS Video Player Engine\nfunction startStream(streamUrl) {\n  videoLoader.classList.remove(\"hidden\");\n  videoError.classList.add(\"hidden\");\n\n  if (currentHls) {\n    currentHls.destroy();\n    currentHls = null;\n  }\n\n  if (Hls.isSupported()) {\n    currentHls = new Hls({\n      enableWorker: true,\n      lowLatencyMode: true,\n      backBufferLength: 90\n    });\n\n    currentHls.loadSource(streamUrl);\n    currentHls.attachMedia(videoPlayer);\n\n    currentHls.on(Hls.Events.MANIFEST_PARSED, () => {\n      videoLoader.classList.add(\"hidden\");\n      videoPlayer.play().catch(() => {});\n    });\n\n    currentHls.on(Hls.Events.ERROR, (event, data) => {\n      if (data.fatal) {\n        videoLoader.classList.add(\"hidden\");\n        videoError.classList.remove(\"hidden\");\n      }\n    });\n  } else if (videoPlayer.canPlayType(\"application/vnd.apple.mpegurl\")) {\n    videoPlayer.src = streamUrl;\n    videoPlayer.addEventListener(\"loadedmetadata\", () => {\n      videoLoader.classList.add(\"hidden\");\n      videoPlayer.play().catch(() => {});\n    });\n  } else {\n    videoLoader.classList.add(\"hidden\");\n    videoError.classList.remove(\"hidden\");\n  }\n}\n\n// 5. Calculate and Update Live EPG Now / Next Schedule Card\nfunction updateLiveEpgCard() {\n  if (!activeChannel) return;\n\n  const chId = activeChannel.id;\n  const channelSchedule = epgData[chId] ? epgData[chId].programs : null;\n\n  const nowSec = Math.floor(Date.now() / 1000);\n\n  if (!channelSchedule || channelSchedule.length === 0) {\n    epgNowTitle.textContent = `${activeChannel.name} Live Broadcast`;\n    epgNowDesc.textContent = `Continuous live high-definition broadcast across the ${activeChannel.category || \"General\"} network.`;\n    epgTimeRemaining.textContent = \"24/7 Live Stream\";\n    epgProgressBar.style.width = \"100%\";\n    epgNextTitle.textContent = \"Scheduled Programming\";\n    epgNextTime.textContent = \"Next Hour\";\n    return;\n  }\n\n  // Find currently running program\n  let currentProg = channelSchedule.find(p => nowSec >= p.start && nowSec < p.stop);\n  let nextProg = null;\n\n  if (currentProg) {\n    const currIndex = channelSchedule.indexOf(currentProg);\n    if (currIndex + 1 < channelSchedule.length) {\n      nextProg = channelSchedule[currIndex + 1];\n    }\n  } else {\n    // If exact boundary matches, pick first upcoming program\n    currentProg = channelSchedule[0];\n    nextProg = channelSchedule[1] || null;\n  }\n\n  if (currentProg) {\n    epgNowTitle.textContent = currentProg.title;\n    epgNowDesc.textContent = currentProg.desc || \"Standard scheduled programming.\";\n\n    const totalDur = currentProg.stop - currentProg.start;\n    const elapsed = Math.max(0, nowSec - currentProg.start);\n    const pct = Math.min(100, Math.max(5, Math.round((elapsed / totalDur) * 100)));\n    const remainingMins = Math.max(1, Math.round((currentProg.stop - nowSec) / 60));\n\n    epgProgressBar.style.width = `${pct}%`;\n    epgTimeRemaining.textContent = `${pct}% complete \u00b7 ${remainingMins}m remaining`;\n  }\n\n  if (nextProg) {\n    const minsUntil = Math.max(1, Math.round((nextProg.start - nowSec) / 60));\n    const startHourStr = new Date(nextProg.start * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });\n    epgNextTitle.textContent = nextProg.title;\n    epgNextTime.textContent = `Starts at ${startHourStr} (in ${minsUntil}m)`;\n  } else {\n    epgNextTitle.textContent = \"Continuous Schedule\";\n    epgNextTime.textContent = \"Tomorrow\";\n  }\n}\n\n// 6. Interactive 7-Day TV Guide Modal Logic\nfunction openTvGuideModal() {\n  if (!activeChannel) return;\n\n  guideModalTitle.textContent = `${activeChannel.name} \u2014 7-Day Program Guide`;\n  guideModalLogo.src = activeChannel.logo || \"https://via.placeholder.com/40\";\n  guideModal.classList.remove(\"hidden\");\n\n  // Render 7 Day Tabs\n  guideDayTabs.innerHTML = \"\";\n  const dayNames = [\"Today\", \"Tomorrow\"];\n  const now = new Date();\n\n  for (let i = 0; i < 7; i++) {\n    const targetDate = new Date();\n    targetDate.setDate(now.getDate() + i);\n\n    let label = \"\";\n    if (i === 0) label = \"Today\";\n    else if (i === 1) label = \"Tomorrow\";\n    else label = targetDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });\n\n    const tabBtn = document.createElement(\"button\");\n    tabBtn.className = `px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${\n      i === activeGuideDay ? \"bg-cyan-600 text-white shadow\" : \"bg-slate-900 text-slate-400 hover:text-white\"\n    }`;\n    tabBtn.textContent = label;\n    tabBtn.addEventListener(\"click\", () => {\n      activeGuideDay = i;\n      openTvGuideModal();\n    });\n    guideDayTabs.appendChild(tabBtn);\n  }\n\n  // Render Schedule for Selected Day\n  renderDayTimeline(activeGuideDay);\n}\n\nfunction renderDayTimeline(dayOffset) {\n  guideTimeline.innerHTML = \"\";\n  const chId = activeChannel.id;\n  const channelSchedule = epgData[chId] ? epgData[chId].programs : [];\n\n  const targetDate = new Date();\n  targetDate.setDate(targetDate.getDate() + dayOffset);\n  targetDate.setHours(0, 0, 0, 0);\n  const dayStartSec = Math.floor(targetDate.getTime() / 1000);\n  const dayEndSec = dayStartSec + 86400;\n\n  const dayPrograms = channelSchedule.filter(p => p.start >= dayStartSec && p.start < dayEndSec);\n\n  if (dayPrograms.length === 0) {\n    guideTimeline.innerHTML = `\n      <div class=\"py-8 text-center text-slate-500 text-xs\">\n        No schedule available for this date.\n      </div>\n    `;\n    return;\n  }\n\n  const nowSec = Math.floor(Date.now() / 1000);\n\n  dayPrograms.forEach(p => {\n    const isNow = nowSec >= p.start && nowSec < p.stop;\n    const startTimeStr = new Date(p.start * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });\n    const endTimeStr = new Date(p.stop * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });\n\n    const item = document.createElement(\"div\");\n    item.className = `p-3.5 rounded-xl flex items-start gap-4 transition ${\n      isNow ? \"bg-cyan-950/40 border border-cyan-800/80\" : \"hover:bg-slate-800/50\"\n    }`;\n\n    item.innerHTML = `\n      <div class=\"text-right w-24 flex-shrink-0\">\n        <span class=\"text-xs font-bold ${isNow ? 'text-cyan-400' : 'text-slate-300'} block\">${startTimeStr}</span>\n        <span class=\"text-[10px] text-slate-500 block\">${endTimeStr}</span>\n      </div>\n      <div class=\"flex-1\">\n        <div class=\"flex items-center gap-2\">\n          <h4 class=\"text-xs font-bold text-white\">${p.title}</h4>\n          ${isNow ? '<span class=\"px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500 text-black uppercase\">Live Now</span>' : ''}\n          <span class=\"text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium\">${p.category}</span>\n        </div>\n        <p class=\"text-[11px] text-slate-400 mt-1 leading-relaxed\">${p.desc}</p>\n      </div>\n    `;\n\n    guideTimeline.appendChild(item);\n  });\n}\n\n// 7. Multi-Dimensional Filter Engine\nfunction applyFilters() {\n  const query = searchInput.value.toLowerCase().trim();\n  const activePill = document.querySelector(\".cat-pill.active\");\n  const selectedCat = activePill ? activePill.dataset.cat.toLowerCase() : \"all\";\n  const selectedCountry = countrySelect.value;\n  const selectedQuality = qualitySelect.value;\n\n  filteredChannels = allChannels.filter((c) => {\n    // Name or category search\n    const matchesName = (c.name || \"\").toLowerCase().includes(query) || (c.category || \"\").toLowerCase().includes(query);\n    // Category pill\n    const matchesCat = selectedCat === \"all\" || (c.category || \"\").toLowerCase().includes(selectedCat);\n    // Country dropdown\n    const matchesCountry = selectedCountry === \"all\" || (c.country_code || \"\").toUpperCase() === selectedCountry.toUpperCase();\n    // Quality dropdown\n    const matchesQuality = selectedQuality === \"all\" || (c.quality || \"\").toLowerCase().includes(selectedQuality.toLowerCase());\n\n    return matchesName && matchesCat && matchesCountry && matchesQuality;\n  });\n\n  renderChannels();\n}\n\n// Event Listeners\nsearchInput.addEventListener(\"input\", applyFilters);\ncountrySelect.addEventListener(\"change\", applyFilters);\nqualitySelect.addEventListener(\"change\", applyFilters);\n\ncategoryPills.forEach((pill) => {\n  pill.addEventListener(\"click\", () => {\n    categoryPills.forEach((p) => p.classList.remove(\"active\", \"bg-cyan-600\", \"text-white\"));\n    categoryPills.forEach((p) => p.classList.add(\"bg-slate-950\", \"text-slate-300\"));\n\n    pill.classList.add(\"active\", \"bg-cyan-600\", \"text-white\");\n    pill.classList.remove(\"bg-slate-950\", \"text-slate-300\");\n\n    applyFilters();\n  });\n});\n\n// Guide Modal Triggers\nopenGuideBtn.addEventListener(\"click\", openTvGuideModal);\ncloseGuideBtn.addEventListener(\"click\", () => guideModal.classList.add(\"hidden\"));\nguideModal.addEventListener(\"click\", (e) => {\n  if (e.target === guideModal) guideModal.classList.add(\"hidden\");\n});\n\n// Copy Master M3U URL\ncopyM3uBtn.addEventListener(\"click\", () => {\n  const base = getBaseUrl();\n  const url = base.endsWith(\"/streams\") ? `${base}/playlist.m3u8` : `${base}/playlist.m3u8`;\n  navigator.clipboard.writeText(url).then(() => {\n    const orig = copyM3uBtn.innerHTML;\n    copyM3uBtn.innerHTML = `<span>Copied M3U!</span>`;\n    setTimeout(() => {\n      copyM3uBtn.innerHTML = orig;\n      lucide.createIcons();\n    }, 2000);\n  });\n});\n\n// Copy EPG URL\ncopyEpgBtn.addEventListener(\"click\", () => {\n  const base = getBaseUrl();\n  const url = base.endsWith(\"/streams\") ? `${base}/epg.xml` : `${base}/epg.xml`;\n  navigator.clipboard.writeText(url).then(() => {\n    const orig = copyEpgBtn.innerHTML;\n    copyEpgBtn.innerHTML = `<span>Copied EPG URL!</span>`;\n    setTimeout(() => {\n      copyEpgBtn.innerHTML = orig;\n      lucide.createIcons();\n    }, 2000);\n  });\n});\n\n// Retry Button\nretryBtn.addEventListener(\"click\", () => {\n  if (activeChannel) startStream(activeChannel.url);\n});\n\n// CORS Proxy Fallback\nproxyPlayBtn.addEventListener(\"click\", () => {\n  if (!activeChannel) return;\n  const proxyUrl = `/proxy?url=${encodeURIComponent(activeChannel.url)}`;\n  startStream(proxyUrl);\n});\n\n// Init on load\nwindow.addEventListener(\"DOMContentLoaded\", () => {\n  loadData();\n});\n";

const DEFAULT_UPSTREAM_BASE = "https://raw.githubusercontent.com/Drone9988/IPTV/main/public/streams";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const upstreamBase = env.UPSTREAM_URL || `${url.origin}/streams`;

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

    // 1. Web Player UI Assets (Loads beautiful UI on /)
    if (path === "/" || path === "/index.html") {
      return new Response(HTML_CONTENT, {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }
      });
    }

    if (path === "/style.css") {
      return new Response(CSS_CONTENT, {
        headers: { ...corsHeaders, "Content-Type": "text/css; charset=utf-8" }
      });
    }

    if (path === "/app.js") {
      return new Response(JS_CONTENT, {
        headers: { ...corsHeaders, "Content-Type": "application/javascript; charset=utf-8" }
      });
    }

    // 2. Transparent CORS Streaming Proxy (/proxy?url=...)
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

    async function fetchStreamAsset(filename) {
      let res = await fetch(`${upstreamBase}/${filename}`);
      if (!res.ok) {
        res = await fetch(`${url.origin}/streams/${filename}`);
      }
      return res;
    }

    // 3. EPG XMLTV Endpoints (/epg.xml.gz and /epg.xml)
    if (path === "/epg.xml.gz" || path === "/epg.gz" || path === "/streams/epg.xml.gz") {
      const epgRes = await fetchStreamAsset("epg.xml.gz");
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

    if (path === "/epg.xml" || path === "/epg" || path === "/streams/epg.xml") {
      const epgRes = await fetchStreamAsset("epg.xml.gz");
      if (epgRes.ok) {
        try {
          const ds = new DecompressionStream("gzip");
          const decompressed = epgRes.body.pipeThrough(ds);
          return new Response(decompressed, {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=43200"
            }
          });
        } catch (e) {
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

    // 4. EPG JSON Endpoint (/epg.json)
    if (path === "/epg.json" || path === "/streams/epg.json") {
      const res = await fetchStreamAsset("epg.json");
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

    // 5. Health & Stats endpoint (/stats)
    if (path === "/stats" || path === "/stats.json" || path === "/streams/stats.json") {
      const res = await fetchStreamAsset("stats.json");
      if (res.ok) {
        const data = await res.text();
        return new Response(data, {
          headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
        });
      }
      return new Response(JSON.stringify({ status: "online", timestamp: new Date().toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 6. Channels JSON API (/channels.json)
    if (path === "/channels.json" || path === "/streams/channels.json") {
      const res = await fetchStreamAsset("channels.json");
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

    // 7. Dynamic M3U8 Playlist Router
    if (path.endsWith(".m3u") || path.endsWith(".m3u8")) {
      const categoryParam = url.searchParams.get("category");
      const countryParam = url.searchParams.get("country");
      const qualityParam = url.searchParams.get("quality");
      const searchParam = url.searchParams.get("search");
      const groupByParam = url.searchParams.get("group_by") || "category";

      let targetFile = path.replace("/streams/", "").replace("/", "");
      if (!targetFile || targetFile === "playlist.m3u8" || targetFile === "live.m3u8") {
        targetFile = "playlist.m3u8";
      }

      if (categoryParam || countryParam || qualityParam || searchParam || groupByParam !== "category") {
        const jsonRes = await fetchStreamAsset("channels.json");
        if (jsonRes.ok) {
          let channels = await jsonRes.json();

          if (categoryParam) {
            channels = channels.filter(c => (c.category || "").toLowerCase().includes(categoryParam.toLowerCase()));
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

          const epgLink = `${url.origin}/epg.xml.gz`;
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

      const playlistRes = await fetchStreamAsset(targetFile);
      if (playlistRes.ok) {
        let content = await playlistRes.text();
        content = content.replace('url-tvg="epg.xml.gz"', `url-tvg="${url.origin}/epg.xml.gz"`);
        return new Response(content, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
            "Content-Disposition": `inline; filename="${targetFile}"`,
            "Cache-Control": "public, max-age=3600"
          }
        });
      }

      return new Response("#EXTM3U\n# Playlist compiling...\n", {
        headers: { ...corsHeaders, "Content-Type": "application/vnd.apple.mpegurl" }
      });
    }

    return new Response(HTML_CONTENT, {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }
    });
  }
};
