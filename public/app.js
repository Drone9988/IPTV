/**
 * IPTV Web Player Engine (HLS.js + Dynamic Search & Channel Switching)
 */

let allChannels = [];
let filteredChannels = [];
let activeChannel = null;
let currentHls = null;

const videoPlayer = document.getElementById("videoPlayer");
const videoLoader = document.getElementById("videoLoader");
const videoError = document.getElementById("videoError");
const retryBtn = document.getElementById("retryBtn");
const channelsContainer = document.getElementById("channelsContainer");
const searchInput = document.getElementById("searchInput");
const categoryPills = document.querySelectorAll(".cat-pill");
const channelCountText = document.getElementById("channelCountText");
const copyM3uBtn = document.getElementById("copyM3uBtn");
const copyStreamUrlBtn = document.getElementById("copyStreamUrlBtn");

const currentTitle = document.getElementById("currentTitle");
const currentLogo = document.getElementById("currentLogo");
const currentCategory = document.getElementById("currentCategory");
const currentCountry = document.getElementById("currentCountry");

// Determine playlist URL based on hosting environment
function getPlaylistUrl() {
  const loc = window.location;
  if (loc.hostname.includes("workers.dev")) {
    return `${loc.origin}/playlist.m3u8`;
  }
  return `${loc.origin}/streams/playlist.m3u8`;
}

// Fetch channels JSON
async function loadChannels() {
  channelCountText.textContent = "Loading streams...";
  try {
    // Try local relative path first, then fallback
    let response = await fetch("streams/channels.json");
    if (!response.ok) {
      response = await fetch("/channels.json");
    }
    if (!response.ok) {
      throw new Error("Channels JSON not yet generated");
    }
    allChannels = await response.json();
    filteredChannels = [...allChannels];
    renderChannels();

    if (allChannels.length > 0) {
      playChannel(allChannels[0]);
    }
  } catch (err) {
    channelCountText.textContent = "0 channels loaded";
    channelsContainer.innerHTML = `
      <div class="p-6 text-center text-slate-400 text-sm">
        <p class="font-medium text-slate-300">Playlists are generating...</p>
        <p class="text-xs mt-2">Run the Python updater or trigger the GitHub Action to populate the latest verified streams.</p>
      </div>
    `;
  }
}

// Render channel list
function renderChannels() {
  channelsContainer.innerHTML = "";
  channelCountText.textContent = `${filteredChannels.length} Channels Available`;

  if (filteredChannels.length === 0) {
    channelsContainer.innerHTML = `
      <div class="p-6 text-center text-slate-500 text-xs">
        No matching channels found.
      </div>
    `;
    return;
  }

  filteredChannels.forEach((channel) => {
    const card = document.createElement("div");
    card.className = `channel-card p-2.5 rounded-xl flex items-center justify-between cursor-pointer border border-transparent ${
      activeChannel && activeChannel.url === channel.url ? "active" : ""
    }`;

    const logoUrl = channel.logo || "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=64&auto=format&fit=crop&q=60";

    card.innerHTML = `
      <div class="flex items-center gap-3 overflow-hidden">
        <img src="${logoUrl}" onerror="this.src='https://via.placeholder.com/40?text=TV'" class="w-9 h-9 rounded-lg bg-slate-800 object-contain p-1 border border-slate-700/80 flex-shrink-0">
        <div class="overflow-hidden">
          <h4 class="text-xs font-semibold text-white truncate">${channel.name}</h4>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span class="text-[10px] text-slate-400">${channel.category || "General"}</span>
            ${channel.country ? `<span class="text-[10px] px-1 bg-slate-800 rounded text-slate-400">${channel.country}</span>` : ""}
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

// Play Selected Channel
function playChannel(channel) {
  activeChannel = channel;
  currentTitle.textContent = channel.name;
  currentLogo.src = channel.logo || "https://via.placeholder.com/48?text=TV";
  currentCategory.textContent = channel.category || "General";
  currentCountry.textContent = channel.country || "Global";

  // Highlight card in list
  renderChannels();

  // Show loader
  videoLoader.classList.remove("hidden");
  videoError.classList.add("hidden");

  if (currentHls) {
    currentHls.destroy();
    currentHls = null;
  }

  const streamUrl = channel.url;

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
        videoLoader.classList.add("hidden");
        videoError.classList.remove("hidden");
      }
    });
  } else if (videoPlayer.canPlayType("application/vnd.apple.mpegurl")) {
    // Native Safari / iOS support
    videoPlayer.src = streamUrl;
    videoPlayer.addEventListener("loadedmetadata", () => {
      videoLoader.classList.add("hidden");
      videoPlayer.play().catch(() => {});
    });
  } else {
    videoLoader.classList.add("hidden");
    videoError.classList.remove("hidden");
  }
}

// Filter handling
function applyFilters() {
  const query = searchInput.value.toLowerCase().trim();
  const activePill = document.querySelector(".cat-pill.active");
  const selectedCat = activePill ? activePill.dataset.cat.toLowerCase() : "all";

  filteredChannels = allChannels.filter((c) => {
    const matchesName = (c.name || "").toLowerCase().includes(query);
    const matchesCat = selectedCat === "all" || (c.category || "").toLowerCase() === selectedCat;
    return matchesName && matchesCat;
  });

  renderChannels();
}

// Search input listener
searchInput.addEventListener("input", applyFilters);

// Category pill listener
categoryPills.forEach((pill) => {
  pill.addEventListener("click", () => {
    categoryPills.forEach((p) => p.classList.remove("active", "bg-cyan-600", "text-white"));
    categoryPills.forEach((p) => p.classList.add("bg-slate-900", "text-slate-300"));

    pill.classList.add("active", "bg-cyan-600", "text-white");
    pill.classList.remove("bg-slate-900", "text-slate-300");

    applyFilters();
  });
});

// Copy Master M3U URL
copyM3uBtn.addEventListener("click", () => {
  const url = getPlaylistUrl();
  navigator.clipboard.writeText(url).then(() => {
    const orig = copyM3uBtn.innerHTML;
    copyM3uBtn.innerHTML = `<span>Copied!</span>`;
    setTimeout(() => {
      copyM3uBtn.innerHTML = orig;
      lucide.createIcons();
    }, 2000);
  });
});

// Copy Direct Stream URL
copyStreamUrlBtn.addEventListener("click", () => {
  if (!activeChannel) return;
  navigator.clipboard.writeText(activeChannel.url).then(() => {
    const orig = copyStreamUrlBtn.innerHTML;
    copyStreamUrlBtn.innerHTML = `<span>Copied!</span>`;
    setTimeout(() => {
      copyStreamUrlBtn.innerHTML = orig;
      lucide.createIcons();
    }, 2000);
  });
});

// Retry button
retryBtn.addEventListener("click", () => {
  if (activeChannel) {
    playChannel(activeChannel);
  }
});

// Init
window.addEventListener("DOMContentLoaded", () => {
  loadChannels();
});
