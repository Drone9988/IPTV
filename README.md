# 📺 Free IPTV Aggregator & Stream Health Validator (GitHub + Cloudflare)

An automated, self-healing **Free IPTV** system with a **7-Day Electronic Program Guide (EPG)** and **Clean Multi-Dimensional Categorization**, powered by **GitHub Actions** and **Cloudflare Workers / Pages**.

It automatically aggregates thousands of free, legal, and public broadcast channels worldwide, continuously validates every stream's health, eliminates broken/offline links, captures updated stream endpoints when broadcasters change their CDN URLs, and delivers lightning-fast playlists via Cloudflare's global edge network.

---

## 🌟 Level-Up Features: EPG Schedules & Clean Categorization

### 1. 📅 Electronic Program Guide (EPG / XMLTV)
- **Now Playing & Up Next**: Every channel includes live metadata showing the active show, synopsis, start/end time, and remaining minutes.
- **7-Day Weekly Program Guide**: Fully compliant with the standard **XMLTV** specification (`epg.xml.gz` and `epg.xml`).
- **Interactive Web Guide**: The built-in web player includes a live progress bar (`[=======> ] 45% complete`) and an interactive **7-Day TV Guide modal** (Today, Tomorrow, and upcoming days).
- **Universal App Compatibility**: In apps like **TiviMate**, **IPTV Smarters**, **Kodi**, and **Apple TV (IPTVX/GSE)**, the schedule grid loads automatically via the embedded `url-tvg="epg.xml.gz"` header.

### 2. 🗂️ Clean, Multi-Dimensional Categorization
- **Standardized Genre Buckets**:
  - 📰 **News & Weather**
  - ⚽ **Sports & Live Events**
  - 🎬 **Movies & Cinema**
  - 🍿 **Series & Entertainment**
  - 🎵 **Music & Radio**
  - 🧒 **Kids & Family**
  - 🌿 **Documentaries & Nature**
  - 🎮 **Gaming & Tech**
  - 🍽️ **Lifestyle & Cooking**
  - 🌐 **General TV**
- **Country & Region Grouping**:
  - Flag emojis & clean names: `🇺🇸 United States`, `🇬🇧 United Kingdom`, `🇨🇦 Canada`, `🇫🇷 France`, `🇩🇪 Germany`, `🇪🇸 Spain`, `🌐 International`.
  - Dedicated playlists for each major country (`us.m3u8`, `uk.m3u8`, `ca.m3u8`, etc.).
  - Dedicated **Group-by-Country** master playlist (`playlist_by_country.m3u8`).
- **Stream Quality & Resolution Tags**:
  - Automatically identifies and tags channels: `💎 1080p FHD`, `📺 720p HD`, `4K UHD`.
  - Dedicated Full HD playlist: `fhd.m3u8`.

---

## 📁 Repository Structure

```text
├── .github/
│   └── workflows/
│       └── update_iptv.yml          # GitHub Actions cron workflow (every 6h + manual dispatch)
├── src/
│   ├── config.py                    # Upstream sources & validator settings
│   ├── parser.py                    # M3U parser & metadata extractor
│   ├── checker.py                   # Async stream validator & redirect tracker
│   ├── normalizer.py                # Category, country flag & quality normalizer
│   ├── epg.py                       # XMLTV & JSON 7-day program schedule engine
│   ├── generator.py                 # M3U8, EPG & channels.json builder
│   └── updater.py                   # Orchestrator entry point
├── worker/
│   ├── index.js                     # Cloudflare Worker script (EPG, dynamic filters, CORS proxy)
│   └── wrangler.toml                # Cloudflare deployment config
├── public/
│   ├── index.html                   # Web TV Player with 7-Day TV Guide
│   ├── style.css                    # Player styling & glassmorphism
│   ├── app.js                       # HLS.js streaming & live schedule calculations
│   └── streams/                     # Verified outputs
│       ├── playlist.m3u8            # Master playlist (Grouped by Category + EPG link)
│       ├── playlist_by_country.m3u8 # Master playlist (Grouped by Country with flags)
│       ├── fhd.m3u8                 # 1080p Full HD channels only
│       ├── news.m3u8                # News & Weather
│       ├── sports.m3u8              # Sports & Live Events
│       ├── movies.m3u8              # Movies & Cinema
│       ├── us.m3u8, uk.m3u8...      # Country-specific playlists
│       ├── epg.xml.gz               # Compressed 7-Day XMLTV Guide (~2 MB)
│       ├── epg.json                 # Interactive schedule for web apps
│       ├── channels.json            # Structured channel index
│       └── stats.json               # Health stats & uptime %
└── requirements.txt                 # Dependencies (aiohttp)
```

---

## 🚀 Deployment Guide

### Step 1: Push to GitHub

The repository is already initialized and committed on the `main` branch.

```bash
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPO_NAME>.git
git push -u origin main
```

### Step 2: Enable GitHub Actions Workflow

1. In your GitHub repository, go to **Settings** &rarr; **Actions** &rarr; **General**.
2. Under **Workflow permissions**, choose **Read and write permissions** &rarr; click **Save**.
3. Under the **Actions** tab, select **Automated IPTV Stream Health Checker & Updater** &rarr; click **Run workflow**.
4. The workflow will re-check all streams and refresh the 7-day EPG every 6 hours automatically!

### Step 3: Deploy to Cloudflare

#### Option A: Cloudflare Pages (Instant Web Player + Static Files)
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) &rarr; **Workers & Pages** &rarr; **Create application** &rarr; **Pages** &rarr; **Connect to Git**.
2. Select your repository.
3. Set **Build output directory** to `public` (leave build command blank).
4. Click **Save and Deploy**. Your web player is live at `https://<your-project>.pages.dev`!

#### Option B: Cloudflare Worker (Dynamic Filtering & CORS Proxy)
1. In `worker/wrangler.toml` and `worker/index.js`, update `UPSTREAM_URL` with your GitHub username:
   ```toml
   UPSTREAM_URL = "https://raw.githubusercontent.com/<YOUR_USERNAME>/<YOUR_REPO>/main/public/streams"
   ```
2. Deploy via Wrangler:
   ```bash
   cd worker
   npx wrangler deploy
   ```

---

## 📡 Playlist & EPG URLs for IPTV Apps

### Standard URLs
| Stream / Guide | URL |
| :--- | :--- |
| **Master Playlist (All Channels)** | `https://<your-worker>.workers.dev/playlist.m3u8` |
| **Grouped by Country (with flags)** | `https://<your-worker>.workers.dev/playlist_by_country.m3u8` |
| **1080p Full HD Only** | `https://<your-worker>.workers.dev/fhd.m3u8` |
| **7-Day EPG Guide (XMLTV)** | `https://<your-worker>.workers.dev/epg.xml.gz` *(or `/epg.xml`)* |

### Dynamic Edge Query Filtering
Customize your playlist on the fly:
- **News Only**: `/playlist.m3u8?category=news`
- **Sports Only**: `/playlist.m3u8?category=sports`
- **Movies Only**: `/playlist.m3u8?category=movies`
- **United States Channels**: `/playlist.m3u8?country=us`
- **United Kingdom Channels**: `/playlist.m3u8?country=uk`
- **Full HD 1080p Only**: `/playlist.m3u8?quality=1080p`
- **Group by Country in App**: `/playlist.m3u8?group_by=country`
- **Combined Filter**: `/playlist.m3u8?country=us&category=sports&quality=1080p`

---

## 📺 How to Setup in Popular IPTV Apps

| App | Configuration |
| :--- | :--- |
| **TiviMate (Android TV / Firestick)** | 1. `Add Playlist` &rarr; `M3U Playlist` &rarr; Enter your playlist URL.<br>2. In `EPG Sources`, enter your `epg.xml.gz` URL. |
| **IPTV Smarters Pro** | Select `Load Your Playlist or File/URL` &rarr; Paste playlist URL. |
| **VLC Media Player** | `Media` &rarr; `Open Network Stream` &rarr; Paste playlist URL. |
| **Apple TV / iOS (IPTVX, GSE)** | `Add Remote Playlist` &rarr; Enter M3U URL + EPG XML URL. |
| **Web Browser** | Open your Cloudflare Pages URL to watch live with full 7-day TV guide! |

---

## ⚙️ Customization

Edit [`src/config.py`](file:///c:/Users/majid/OneDrive/Desktop/IPTV/src/config.py) to add new sources or change check parameters:
- Add regional public channels to `SOURCES`.
- Adjust `CHECKER_SETTINGS['timeout_seconds']` (default: 6s).
- Adjust `CHECKER_SETTINGS['concurrency']` (default: 40).
- Toggle `CHECKER_SETTINGS['filter_adult']` (default: `True`).
