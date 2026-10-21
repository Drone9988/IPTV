"""
Channel Normalizer & Categorization Engine.
Cleans channel names, standardizes genres into clean categories,
extracts stream quality resolution tags, and pairs country flags.
"""

import re
from typing import Dict, Any, Tuple

# Country code to Emoji Flag and Full Name mapping
COUNTRY_MAP = {
    "US": ("🇺🇸", "United States"),
    "UK": ("🇬🇧", "United Kingdom"),
    "GB": ("🇬🇧", "United Kingdom"),
    "CA": ("🇨🇦", "Canada"),
    "AU": ("🇦🇺", "Australia"),
    "FR": ("🇫🇷", "France"),
    "DE": ("🇩🇪", "Germany"),
    "ES": ("🇪🇸", "Spain"),
    "IT": ("🇮🇹", "Italy"),
    "MX": ("🇲🇽", "Mexico"),
    "BR": ("🇧🇷", "Brazil"),
    "IN": ("🇮🇳", "India"),
    "JP": ("🇯🇵", "Japan"),
    "KR": ("🇰🇷", "South Korea"),
    "AE": ("🇦🇪", "United Arab Emirates"),
    "SA": ("🇸🇦", "Saudi Arabia"),
    "TR": ("🇹🇷", "Turkey"),
    "NL": ("🇳🇱", "Netherlands"),
    "SE": ("🇸🇪", "Sweden"),
    "PL": ("🇵🇱", "Poland"),
    "UA": ("🇺🇦", "Ukraine"),
    "INT": ("🌐", "International")
}

# Mapping messy raw tags to clean standardized categories
CATEGORY_MAP = {
    "news": "News",
    "weather": "News",
    "business": "News",
    "sports": "Sports",
    "sport": "Sports",
    "movies": "Movies",
    "movie": "Movies",
    "cinema": "Movies",
    "series": "Entertainment",
    "entertainment": "Entertainment",
    "comedy": "Entertainment",
    "variety": "Entertainment",
    "music": "Music",
    "radio": "Music",
    "kids": "Kids",
    "animation": "Kids",
    "family": "Kids",
    "documentary": "Documentary",
    "science": "Documentary",
    "nature": "Documentary",
    "lifestyle": "Lifestyle",
    "cooking": "Lifestyle",
    "travel": "Lifestyle",
    "education": "Education",
    "culture": "Education",
    "gaming": "Gaming",
    "tech": "Gaming",
    "general": "General",
    "farsi": "Farsi / Iranian",
    "iran": "Farsi / Iranian",
    "persian": "Farsi / Iranian",
    "farsi / iranian": "Farsi / Iranian"
}

RESOLUTION_PATTERNS = [
    (re.compile(r'\b(4k|uhd|2160p)\b', re.IGNORECASE), "4K UHD"),
    (re.compile(r'\b(1080p|fhd|full\s*hd)\b', re.IGNORECASE), "1080p FHD"),
    (re.compile(r'\b(720p|hd)\b', re.IGNORECASE), "720p HD"),
    (re.compile(r'\b(576p|480p|sd)\b', re.IGNORECASE), "SD")
]

def detect_quality(name: str, url: str) -> str:
    """Detects video quality/resolution from title or stream URL."""
    target = f"{name} {url}"
    for pattern, label in RESOLUTION_PATTERNS:
        if pattern.search(target):
            return label
    return "720p HD"  # sensible default for digital HLS streams

def clean_channel_name(raw_name: str) -> str:
    """Removes messy suffixes while preserving readability."""
    clean = raw_name.strip()
    # Normalize common bracket anomalies
    clean = re.sub(r'\[Not\s*24/7\]', '', clean, flags=re.IGNORECASE)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean

def normalize_country(code: str) -> Tuple[str, str, str]:
    """Returns (code, flag_emoji, full_name)"""
    code_upper = (code or "").strip().upper()
    if code_upper in COUNTRY_MAP:
        flag, name = COUNTRY_MAP[code_upper]
        return code_upper, flag, name
    return code_upper or "INT", "🌐", "International"

def normalize_category(raw_category: str) -> str:
    """Maps arbitrary or multi-tag categories to clean standard genres."""
    if not raw_category:
        return "General"
    
    first_tag = raw_category.split(";")[0].split(",")[0].strip().lower()
    return CATEGORY_MAP.get(first_tag, "General")

def enrich_channel_metadata(channel: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enriches and standardizes all channel metadata.
    """
    name = clean_channel_name(channel.get("name", "Channel"))
    raw_cat = channel.get("category", "")
    category = normalize_category(raw_cat)
    country_code, flag, country_name = normalize_country(channel.get("country", ""))
    quality = detect_quality(name, channel.get("url", ""))
    language = (channel.get("language") or "").lower()

    # Specific Iranian & Farsi classification
    is_farsi = (
        language in ("fas", "per", "fa") or
        country_code == "IR" or
        "farsi" in raw_cat.lower() or
        "iran" in raw_cat.lower() or
        "persian" in raw_cat.lower()
    )

    if is_farsi:
        category = "Farsi / Iranian"
        if country_code in ("", "INT"):
            country_code, flag, country_name = "IR", "🇮🇷", "Iran"

    enriched = channel.copy()
    enriched["name"] = name
    enriched["category"] = category
    enriched["country_code"] = country_code
    enriched["country_flag"] = flag
    enriched["country_name"] = country_name
    enriched["country_display"] = f"{flag} {country_name}"
    enriched["quality"] = quality
    
    # Standardize tvg-id if missing
    if not enriched.get("id"):
        safe_id = re.sub(r'[^a-zA-Z0-9]', '', name)
        enriched["id"] = f"{safe_id}.{country_code.lower()}"

    return enriched
