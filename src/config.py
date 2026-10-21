"""
Configuration settings for the Free IPTV Aggregator and Stream Health Validator.
"""

from typing import List, Dict, Any

# Primary upstream playlist sources (legal, free-to-air, community-maintained)
SOURCES: List[Dict[str, str]] = [
    # iptv-org categorized feeds (high quality FTA channels)
    {
        "name": "IPTV-org News",
        "url": "https://iptv-org.github.io/iptv/categories/news.m3u",
        "category": "News"
    },
    {
        "name": "IPTV-org Sports",
        "url": "https://iptv-org.github.io/iptv/categories/sports.m3u",
        "category": "Sports"
    },
    {
        "name": "IPTV-org Movies",
        "url": "https://iptv-org.github.io/iptv/categories/movies.m3u",
        "category": "Movies"
    },
    {
        "name": "IPTV-org Entertainment",
        "url": "https://iptv-org.github.io/iptv/categories/entertainment.m3u",
        "category": "Entertainment"
    },
    {
        "name": "IPTV-org Music",
        "url": "https://iptv-org.github.io/iptv/categories/music.m3u",
        "category": "Music"
    },
    {
        "name": "IPTV-org Kids & Animation",
        "url": "https://iptv-org.github.io/iptv/categories/kids.m3u",
        "category": "Kids"
    },
    {
        "name": "IPTV-org Documentary",
        "url": "https://iptv-org.github.io/iptv/categories/documentary.m3u",
        "category": "Documentary"
    },
    # Popular country feeds
    {
        "name": "IPTV-org United States",
        "url": "https://iptv-org.github.io/iptv/countries/us.m3u",
        "country": "US"
    },
    {
        "name": "IPTV-org United Kingdom",
        "url": "https://iptv-org.github.io/iptv/countries/uk.m3u",
        "country": "UK"
    },
    {
        "name": "IPTV-org Canada",
        "url": "https://iptv-org.github.io/iptv/countries/ca.m3u",
        "country": "CA"
    },
    # English Global Curated Feed
    {
        "name": "IPTV-org English Worldwide",
        "url": "https://iptv-org.github.io/iptv/languages/eng.m3u",
        "category": "General"
    },
    # Iranian & Persian Worldwide Feeds
    {
        "name": "IPTV-org Persian Worldwide",
        "url": "https://iptv-org.github.io/iptv/languages/fas.m3u",
        "category": "Farsi / Iranian",
        "country": "IR"
    },
    {
        "name": "IPTV-org Iran National",
        "url": "https://iptv-org.github.io/iptv/countries/ir.m3u",
        "category": "Farsi / Iranian",
        "country": "IR"
    }
]

# Validation parameters
CHECKER_SETTINGS: Dict[str, Any] = {
    # Maximum concurrent HTTP requests during health checking
    "concurrency": 40,
    
    # Request timeout per stream in seconds
    "timeout_seconds": 6,
    
    # Number of retry attempts for transient network glitches
    "retries": 1,
    
    # HTTP User-Agent to emulate standard IPTV clients and modern browsers
    "user_agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36 (IPTV-Health-Checker)"
    ),
    
    # Exclude adult/NSFW content from the public aggregation
    "filter_adult": True,
    
    # Maximum channels to keep per category (0 = unlimited)
    "max_channels_per_category": 150,
}

# Categories to generate dedicated M3U playlists for
CATEGORIES = [
    "Farsi / Iranian",
    "News",
    "Sports",
    "Movies",
    "Entertainment",
    "Music",
    "Kids",
    "Documentary",
    "General"
]

# Target output directories
OUTPUT_DIR = "public/streams"
PLAYLIST_NAME = "playlist.m3u8"
JSON_NAME = "channels.json"
STATS_NAME = "stats.json"
