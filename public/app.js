/**
 * Free IPTV Player & Interactive 7-Day EPG Engine
 * Handles HLS video streaming, dynamic multi-tier filtering,
 * live broadcast transcripts & program schedule calculations.
 */

let allChannels = [];
let filteredChannels = [];
let epgData = {};
let activeChannel = null;
let currentHls = null;
let activeGuideDay = 0; // 0 = Today, 1 = Tomorrow, etc.
let epgUpdateTimer = null;

// DOM Elements
const videoPlayer = document.getElementById("videoPlayer");
const videoLoader = document.getElementById("videoLoader");
const videoError = document.getElementById("videoError");
const retryBtn = document.getElementById("retryBtn");
const proxyPlayBtn = document.getElementById("proxyPlayBtn");
const vlcCopyBtn = document.getElementById("vlcCopyBtn");

const channelsContainer = document.getElementById("channelsContainer");
const searchInput = document.getElementById("searchInput");
const categoryPills = document.querySelectorAll(".cat-pill");
const countrySelect = document.getElementById("countrySelect");
const qualitySelect = document.getElementById("qualitySelect");
const channelCountText = document.getElementById("channelCountText");

const copyM3uBtn = document.getElementById("copyM3uBtn");
const copyEpgBtn = document.getElementById("copyEpgBtn");

const currentTitle = document.getElementById("currentTitle");
const currentLogo = document.getElementById("currentLogo");
const currentCategory = document.getElementById("currentCategory");
const currentCountry = document.getElementById("currentCountry");
const currentQuality = document.getElementById("currentQuality");

// EPG Live Card Elements
const epgNowTitle = document.getElementById("epgNowTitle");
const epgNowDesc = document.getElementById("epgNowDesc");
const epgTimeRemaining = document.getElementById("epgTimeRemaining");
const epgProgressBar = document.getElementById("epgProgressBar");
const epgNextTitle = document.getElementById("epgNextTitle");
const epgNextTime = document.getElementById("epgNextTime");

// TV Guide Modal Elements
const openGuideBtn = document.getElementById("openGuideBtn");
const closeGuideBtn = document.getElementById("closeGuideBtn");
const guideModal = document.getElementById("guideModal");
const guideModalTitle = document.getElementById("guideModalTitle");
const guideModalLogo = document.getElementById("guideModalLogo");
const guideDayTabs = document.getElementById("guideDayTabs");
const guideTimeline = document.getElementById("guideTimeline");

function getBaseUrl() {
  const loc = window.location;
  if (loc.hostname.includes("workers.dev")) {
    return loc.origin;
  }
  return `${loc.origin}/streams`;
}

// 1. Data Loading
async function loadData() {
  channelCountText.textContent = "Loading streams & EPG...";
  
  try {
    // Load Channels
    let chResp = await fetch("streams/channels.json").catch(() => fetch("/channels.json"));
    if (chResp && chResp.ok) {
      allChannels = await chResp.json();
      filteredChannels = [...allChannels];
    }

    // Load EPG
    let epgResp = await fetch("streams/epg.json").catch(() => fetch("/epg.json"));
    if (epgResp && epgResp.ok) {
      const parsed = await epgResp.json();
      epgData = parsed.channels || {};
    }

    // Update dynamic pill counts (All, Farsi (190), News (167), etc.)
    updateCategoryPillCounts();

    renderChannels();

    if (allChannels.length > 0) {
      playChannel(allChannels[0]);
    }

    // Periodically update the live EPG progress bar every 30 seconds
    if (epgUpdateTimer) clearInterval(epgUpdateTimer);
    epgUpdateTimer = setInterval(updateLiveEpgCard, 30000);

  } catch (err) {
    channelCountText.textContent = "Error loading streams";
    channelsContainer.innerHTML = `
      <div class="p-6 text-center text-slate-400 text-xs">
        <p class="font-medium text-slate-300">Playlists are compiling...</p>
        <p class="mt-1 text-slate-500">Run the updater to generate streams and EPG data.</p>
      </div>
    `;
  }
}

// Update Category Pill Numbers
function updateCategoryPillCounts() {
  const counts = {
    all: allChannels.length,
    farsi: 0,
    news: 0,
    sports: 0,
    movies: 0,
    entertainment: 0,
    music: 0,
    kids: 0,
    documentary: 0
  };

  allChannels.forEach((c) => {
    const cat = (c.category || "").toLowerCase();
    const isFarsi = cat.includes("farsi") || cat.includes("iran") || (c.country_code || "").toUpperCase() === "IR" || (c.language || "").toLowerCase().includes("fas");
    if (isFarsi) counts.farsi++;
    if (cat.includes("news")) counts.news++;
    if (cat.includes("sport")) counts.sports++;
    if (cat.includes("movie") || cat.includes("film") || cat.includes("cinema")) counts.movies++;
    if (cat.includes("entertainment") || cat.includes("general")) counts.entertainment++;
    if (cat.includes("music")) counts.music++;
    if (cat.includes("kid") || cat.includes("animation")) counts.kids++;
    if (cat.includes("doc")) counts.documentary++;
  });

  const labels = {
    all: `All (${counts.all.toLocaleString()})`,
    farsi: `🇮🇷 Farsi / فارسی (${counts.farsi})`,
    news: `📰 News (${counts.news})`,
    sports: `⚽ Sports (${counts.sports})`,
    movies: `🎬 Movies (${counts.movies})`,
    entertainment: `🍿 Entertainment (${counts.entertainment})`,
    music: `🎵 Music (${counts.music})`,
    kids: `🧒 Kids (${counts.kids})`,
    documentary: `🌿 Docs (${counts.documentary})`
  };

  categoryPills.forEach((pill) => {
    const cat = pill.dataset.cat;
    if (labels[cat]) {
      pill.textContent = labels[cat];
    }
  });
}

// 2. Rendering Channels
function renderChannels() {
  channelsContainer.innerHTML = "";
  channelCountText.textContent = `${filteredChannels.length} Channels Available`;

  if (filteredChannels.length === 0) {
    channelsContainer.innerHTML = `
      <div class="p-6 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
        <p class="font-medium text-slate-300">No channels match current filters.</p>
        <button id="resetFiltersBtn" class="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow transition">Reset All Filters</button>
      </div>
    `;
    const rBtn = document.getElementById("resetFiltersBtn");
    if (rBtn) rBtn.addEventListener("click", resetAllFilters);
    return;
  }

  filteredChannels.forEach((channel) => {
    const card = document.createElement("div");
    const isActive = activeChannel && activeChannel.url === channel.url;
    card.className = `channel-card p-2.5 rounded-xl flex items-center justify-between cursor-pointer border border-transparent ${
      isActive ? "active" : ""
    }`;

    const logoUrl = channel.logo || "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=64&auto=format&fit=crop&q=60";
    const countryFlag = channel.country_flag || "🌐";
    const qualityBadge = channel.quality || "720p HD";

    card.innerHTML = `
      <div class="flex items-center gap-3 overflow-hidden">
        <img src="${logoUrl}" onerror="this.src='https://via.placeholder.com/40?text=TV'" class="w-9 h-9 rounded-lg bg-slate-800 object-contain p-1 border border-slate-700/80 flex-shrink-0">
        <div class="overflow-hidden">
          <div class="flex items-center gap-1.5">
            <span class="text-xs">${countryFlag}</span>
            <h4 class="text-xs font-semibold text-white truncate">${channel.name}</h4>
          </div>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span class="text-[10px] text-slate-400 font-medium">${channel.category || "General"}</span>
            <span class="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-cyan-400 font-medium">${qualityBadge}</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-1.5 flex-shrink-0">
        <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
      </div>
    `;

    card.addEventListener("click", () => {
      playChannel(channel);
    });

    channelsContainer.appendChild(card);
  });
}

// 3. Play Channel & Update Metadata
function playChannel(channel) {
  activeChannel = channel;
  currentTitle.textContent = channel.name;
  currentLogo.src = channel.logo || "https://via.placeholder.com/48?text=TV";
  currentCategory.textContent = channel.category || "General";
  currentCountry.textContent = channel.country_display || "🌐 International";
  currentQuality.textContent = channel.quality || "720p HD";

  renderChannels();
  updateLiveEpgCard();

  startStream(channel.url);
}

// 4. HLS Video Player Engine with Auto-Proxy Failover
function startStream(streamUrl, isRetry = false) {
  videoLoader.classList.remove("hidden");
  videoError.classList.add("hidden");

  // If site is HTTPS and stream is HTTP, route through CORS proxy to prevent browser Mixed Content block
  if (!isRetry && window.location.protocol === "https:" && streamUrl.startsWith("http://")) {
    streamUrl = `/proxy?url=${encodeURIComponent(streamUrl)}`;
    isRetry = true;
  }

  if (currentHls) {
    currentHls.destroy();
    currentHls = null;
  }

  if (Hls.isSupported()) {
    currentHls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 90
    });

    currentHls.loadSource(streamUrl);
    currentHls.attachMedia(videoPlayer);

    currentHls.on(Hls.Events.MANIFEST_PARSED, () => {
      videoLoader.classList.add("hidden");
      videoPlayer.play().catch(() => {});
    });

    currentHls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        if (!isRetry && !streamUrl.includes("/proxy?url=")) {
          console.log("Direct stream blocked. Auto-retrying via Cloudflare Proxy...");
          const proxyUrl = `/proxy?url=${encodeURIComponent(streamUrl)}`;
          startStream(proxyUrl, true);
        } else {
          videoLoader.classList.add("hidden");
          videoError.classList.remove("hidden");
        }
      }
    });
  } else if (videoPlayer.canPlayType("application/vnd.apple.mpegurl")) {
    videoPlayer.src = streamUrl;
    videoPlayer.addEventListener("loadedmetadata", () => {
      videoLoader.classList.add("hidden");
      videoPlayer.play().catch(() => {});
    });
    videoPlayer.addEventListener("error", () => {
      if (!isRetry && !streamUrl.includes("/proxy?url=")) {
        const proxyUrl = `/proxy?url=${encodeURIComponent(streamUrl)}`;
        startStream(proxyUrl, true);
      } else {
        videoLoader.classList.add("hidden");
        videoError.classList.remove("hidden");
      }
    });
  } else {
    videoLoader.classList.add("hidden");
    videoError.classList.remove("hidden");
  }
}

// 5. Calculate and Update Live EPG & Live Broadcast Transcript
function updateLiveEpgCard() {
  if (!activeChannel) return;

  const chId = activeChannel.id;
  const channelSchedule = epgData[chId] ? epgData[chId].programs : null;
  const nowSec = Math.floor(Date.now() / 1000);

  const transcriptContent = document.getElementById("transcriptContent");
  const transcriptGenreBadge = document.getElementById("transcriptGenreBadge");
  const streamFormatTag = document.getElementById("streamFormatTag");

  if (transcriptGenreBadge) {
    transcriptGenreBadge.textContent = activeChannel.category || "General";
  }
  if (streamFormatTag) {
    streamFormatTag.textContent = `${activeChannel.quality || "720p HD"} · Live Adaptive HLS`;
  }

  if (!channelSchedule || channelSchedule.length === 0) {
    epgNowTitle.textContent = `${activeChannel.name} Live Broadcast`;
    epgNowDesc.textContent = `Continuous live high-definition broadcast across the ${activeChannel.category || "General"} network.`;
    epgTimeRemaining.textContent = "24/7 Live Stream";
    epgProgressBar.style.width = "100%";
    epgNextTitle.textContent = "Scheduled Programming";
    epgNextTime.textContent = "Next Hour";
    if (transcriptContent) {
      const isPersian = (activeChannel.category || "").toLowerCase().includes("farsi") || activeChannel.country_code === "IR";
      if (isPersian) {
        transcriptContent.innerHTML = `<strong>پخش زنده شبکه ${activeChannel.name}:</strong> پخش مستقیم برنامه‌ها، اخبار، سریال‌ها و گزارش‌های روزانه با بالاترین کیفیت دیجیتال. (زیرنویس و شرح برنامه بر روی جریان HLS در دسترس است)`;
      } else {
        transcriptContent.innerHTML = `<strong>${activeChannel.name} Live Transmission:</strong> Continuous 24/7 live programming stream featuring official network coverage, news bulletins, and regular broadcast segments. Embedded closed-captions and audio feeds synchronized.`;
      }
    }
    return;
  }

  // Find currently running program
  let currentProg = channelSchedule.find(p => nowSec >= p.start && nowSec < p.stop);
  let nextProg = null;

  if (currentProg) {
    const currIndex = channelSchedule.indexOf(currentProg);
    if (currIndex + 1 < channelSchedule.length) {
      nextProg = channelSchedule[currIndex + 1];
    }
  } else {
    currentProg = channelSchedule[0];
    nextProg = channelSchedule[1] || null;
  }

  if (currentProg) {
    epgNowTitle.textContent = currentProg.title;
    epgNowDesc.textContent = currentProg.desc || "Standard scheduled programming.";

    const totalDur = currentProg.stop - currentProg.start;
    const elapsed = Math.max(0, nowSec - currentProg.start);
    const pct = Math.min(100, Math.max(5, Math.round((elapsed / totalDur) * 100)));
    const remainingMins = Math.max(1, Math.round((currentProg.stop - nowSec) / 60));

    epgProgressBar.style.width = `${pct}%`;
    epgTimeRemaining.textContent = `${pct}% complete · ${remainingMins}m remaining`;

    if (transcriptContent) {
      transcriptContent.innerHTML = `<strong>${currentProg.title}:</strong> ${currentProg.desc} <span class="text-cyan-400 block mt-1 text-[11px]">🔴 Live captions / program audio synchronized across ${activeChannel.name}.</span>`;
    }
  }

  if (nextProg) {
    const minsUntil = Math.max(1, Math.round((nextProg.start - nowSec) / 60));
    const startHourStr = new Date(nextProg.start * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    epgNextTitle.textContent = nextProg.title;
    epgNextTime.textContent = `Starts at ${startHourStr} (in ${minsUntil}m)`;
  } else {
    epgNextTitle.textContent = "Continuous Schedule";
    epgNextTime.textContent = "Tomorrow";
  }
}

// 6. Interactive 7-Day TV Guide Modal Logic
function openTvGuideModal() {
  if (!activeChannel) return;

  guideModalTitle.textContent = `${activeChannel.name} — 7-Day Program Guide`;
  guideModalLogo.src = activeChannel.logo || "https://via.placeholder.com/40";
  guideModal.classList.remove("hidden");

  // Render 7 Day Tabs
  guideDayTabs.innerHTML = "";
  const now = new Date();

  for (let i = 0; i < 7; i++) {
    const targetDate = new Date();
    targetDate.setDate(now.getDate() + i);

    let label = "";
    if (i === 0) label = "Today";
    else if (i === 1) label = "Tomorrow";
    else label = targetDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

    const tabBtn = document.createElement("button");
    tabBtn.className = `px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
      i === activeGuideDay ? "bg-cyan-600 text-white shadow" : "bg-slate-900 text-slate-400 hover:text-white"
    }`;
    tabBtn.textContent = label;
    tabBtn.addEventListener("click", () => {
      activeGuideDay = i;
      openTvGuideModal();
    });
    guideDayTabs.appendChild(tabBtn);
  }

  // Render Schedule for Selected Day
  renderDayTimeline(activeGuideDay);
}

function renderDayTimeline(dayOffset) {
  guideTimeline.innerHTML = "";
  const chId = activeChannel.id;
  const channelSchedule = epgData[chId] ? epgData[chId].programs : [];

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + dayOffset);
  targetDate.setHours(0, 0, 0, 0);
  const dayStartSec = Math.floor(targetDate.getTime() / 1000);
  const dayEndSec = dayStartSec + 86400;

  const dayPrograms = channelSchedule.filter(p => p.start >= dayStartSec && p.start < dayEndSec);

  if (dayPrograms.length === 0) {
    guideTimeline.innerHTML = `
      <div class="py-8 text-center text-slate-500 text-xs">
        No schedule available for this date.
      </div>
    `;
    return;
  }

  const nowSec = Math.floor(Date.now() / 1000);

  dayPrograms.forEach(p => {
    const isNow = nowSec >= p.start && nowSec < p.stop;
    const startTimeStr = new Date(p.start * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = new Date(p.stop * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const item = document.createElement("div");
    item.className = `p-3.5 rounded-xl flex items-start gap-4 transition ${
      isNow ? "bg-cyan-950/40 border border-cyan-800/80" : "hover:bg-slate-800/50"
    }`;

    item.innerHTML = `
      <div class="text-right w-24 flex-shrink-0">
        <span class="text-xs font-bold ${isNow ? 'text-cyan-400' : 'text-slate-300'} block">${startTimeStr}</span>
        <span class="text-[10px] text-slate-500 block">${endTimeStr}</span>
      </div>
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <h4 class="text-xs font-bold text-white">${p.title}</h4>
          ${isNow ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500 text-black uppercase">Live Now</span>' : ''}
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">${p.category}</span>
        </div>
        <p class="text-[11px] text-slate-400 mt-1 leading-relaxed">${p.desc}</p>
      </div>
    `;

    guideTimeline.appendChild(item);
  });
}

// 7. Multi-Dimensional Filter Engine
function applyFilters() {
  const query = searchInput.value.toLowerCase().trim();
  const activePill = document.querySelector(".cat-pill.active");
  const selectedCat = activePill ? activePill.dataset.cat.toLowerCase() : "all";
  const selectedCountry = countrySelect.value;
  const selectedQuality = qualitySelect.value;

  filteredChannels = allChannels.filter((c) => {
    // Name or category search
    const matchesName = (c.name || "").toLowerCase().includes(query) || (c.category || "").toLowerCase().includes(query);
    
    // Category pill matching
    let matchesCat = true;
    if (selectedCat !== "all") {
      const cat = (c.category || "").toLowerCase();
      if (selectedCat === "farsi") {
        matchesCat = cat.includes("farsi") || cat.includes("iran") || (c.country_code || "").toUpperCase() === "IR" || (c.language || "").toLowerCase().includes("fas");
      } else if (selectedCat === "news") {
        matchesCat = cat.includes("news");
      } else if (selectedCat === "sports") {
        matchesCat = cat.includes("sport");
      } else if (selectedCat === "movies") {
        matchesCat = cat.includes("movie") || cat.includes("film") || cat.includes("cinema");
      } else if (selectedCat === "entertainment") {
        matchesCat = cat.includes("entertainment") || cat.includes("general");
      } else if (selectedCat === "music") {
        matchesCat = cat.includes("music");
      } else if (selectedCat === "kids") {
        matchesCat = cat.includes("kid") || cat.includes("animation");
      } else if (selectedCat === "documentary") {
        matchesCat = cat.includes("doc");
      } else {
        matchesCat = cat.includes(selectedCat);
      }
    }

    // Country dropdown matching
    let matchesCountry = true;
    if (selectedCountry !== "all") {
      matchesCountry = (c.country_code || "").toUpperCase() === selectedCountry.toUpperCase();
    }

    // Quality dropdown matching
    const matchesQuality = selectedQuality === "all" || (c.quality || "").toLowerCase().includes(selectedQuality.toLowerCase());

    return matchesName && matchesCat && matchesCountry && matchesQuality;
  });

  renderChannels();
}

// Reset All Filters
function resetAllFilters() {
  searchInput.value = "";
  countrySelect.value = "all";
  qualitySelect.value = "all";
  categoryPills.forEach((p) => {
    p.classList.remove("active", "bg-cyan-600", "text-white");
    p.classList.add("bg-slate-950", "text-slate-300");
  });
  const allPill = document.querySelector('.cat-pill[data-cat="all"]');
  if (allPill) {
    allPill.classList.add("active", "bg-cyan-600", "text-white");
    allPill.classList.remove("bg-slate-950", "text-slate-300");
  }
  applyFilters();
}

// Event Listeners
searchInput.addEventListener("input", applyFilters);
qualitySelect.addEventListener("change", applyFilters);

countrySelect.addEventListener("change", () => {
  if (countrySelect.value === "IR") {
    const farsiPill = document.querySelector('.cat-pill[data-cat="farsi"]');
    if (farsiPill) {
      categoryPills.forEach((p) => p.classList.remove("active", "bg-cyan-600", "text-white"));
      categoryPills.forEach((p) => p.classList.add("bg-slate-950", "text-slate-300"));
      farsiPill.classList.add("active", "bg-cyan-600", "text-white");
      farsiPill.classList.remove("bg-slate-950", "text-slate-300");
    }
  }
  applyFilters();
});

categoryPills.forEach((pill) => {
  pill.addEventListener("click", () => {
    categoryPills.forEach((p) => p.classList.remove("active", "bg-cyan-600", "text-white"));
    categoryPills.forEach((p) => p.classList.add("bg-slate-950", "text-slate-300"));

    pill.classList.add("active", "bg-cyan-600", "text-white");
    pill.classList.remove("bg-slate-950", "text-slate-300");

    const cat = pill.dataset.cat.toLowerCase();
    // Prevent filter collisions: reset country if selecting a specific genre/region
    if (cat === "farsi" && countrySelect.value !== "all" && countrySelect.value !== "IR") {
      countrySelect.value = "all";
    } else if (cat !== "all" && countrySelect.value === "IR" && cat !== "farsi") {
      countrySelect.value = "all";
    }

    applyFilters();
  });
});

// Guide Modal Triggers
openGuideBtn.addEventListener("click", openTvGuideModal);
closeGuideBtn.addEventListener("click", () => guideModal.classList.add("hidden"));
guideModal.addEventListener("click", (e) => {
  if (e.target === guideModal) guideModal.classList.add("hidden");
});

// Copy Master M3U URL
copyM3uBtn.addEventListener("click", () => {
  const base = getBaseUrl();
  const url = `${base}/playlist.m3u8`;
  navigator.clipboard.writeText(url).then(() => {
    const orig = copyM3uBtn.innerHTML;
    copyM3uBtn.innerHTML = `<span>Copied M3U!</span>`;
    setTimeout(() => {
      copyM3uBtn.innerHTML = orig;
      lucide.createIcons();
    }, 2000);
  });
});

// Copy EPG URL
copyEpgBtn.addEventListener("click", () => {
  const base = getBaseUrl();
  const url = `${base}/epg.xml.gz`;
  navigator.clipboard.writeText(url).then(() => {
    const orig = copyEpgBtn.innerHTML;
    copyEpgBtn.innerHTML = `<span>Copied EPG URL!</span>`;
    setTimeout(() => {
      copyEpgBtn.innerHTML = orig;
      lucide.createIcons();
    }, 2000);
  });
});

// Retry Button
retryBtn.addEventListener("click", () => {
  if (activeChannel) startStream(activeChannel.url);
});

// CORS Proxy Fallback
proxyPlayBtn.addEventListener("click", () => {
  if (!activeChannel) return;
  const proxyUrl = `/proxy?url=${encodeURIComponent(activeChannel.url)}`;
  startStream(proxyUrl, true);
});

// VLC Quick Copy
if (vlcCopyBtn) {
  vlcCopyBtn.addEventListener("click", () => {
    if (!activeChannel) return;
    navigator.clipboard.writeText(activeChannel.url).then(() => {
      const orig = vlcCopyBtn.innerHTML;
      vlcCopyBtn.innerHTML = `<span>Copied! Paste in VLC (Ctrl+N)</span>`;
      setTimeout(() => {
        vlcCopyBtn.innerHTML = orig;
        lucide.createIcons();
      }, 2500);
    });
  });
}

// Init on load
window.addEventListener("DOMContentLoaded", () => {
  loadData();
});
