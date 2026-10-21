"""
Playlist and JSON Generator with EPG & Clean Categorization.
Produces standardized M3U8 playlists with embedded EPG tags,
categorized/country feeds, and TV guide data for apps and web players.
"""

import os
import json
from datetime import datetime, timezone
from typing import List, Dict, Any

from src.normalizer import enrich_channel_metadata
from src.epg import build_epg_files

def format_m3u_entry(channel: Dict[str, Any], group_mode: str = "category") -> str:
    """
    Formats a channel dictionary into a standard #EXTINF M3U line with EPG tags.
    group_mode can be 'category', 'country', or 'combined'.
    """
    tvg_id = channel.get("id") or ""
    tvg_name = channel.get("name") or ""
    tvg_logo = channel.get("logo") or ""
    category = channel.get("category") or "General"
    country_display = channel.get("country_display") or "🌐 International"
    country_code = channel.get("country_code") or ""
    quality = channel.get("quality") or "720p HD"
    title = channel.get("name") or "Channel"
    url = channel.get("url") or ""

    if group_mode == "country":
        group_title = country_display
    elif group_mode == "combined":
        group_title = f"{category} · {country_display}"
    else:
        group_title = category

    attrs = [
        f'tvg-id="{tvg_id}"',
        f'tvg-name="{tvg_name}"',
        f'tvg-logo="{tvg_logo}"',
        f'group-title="{group_title}"',
        f'tvg-country="{country_code}"',
        f'tvg-quality="{quality}"'
    ]

    attr_str = " ".join(attrs)
    return f'#EXTINF:-1 {attr_str},{title} [{quality}]\n#EXTGRP:{group_title}\n{url}'

def generate_m3u8(channels: List[Dict[str, Any]], playlist_title: str = "Free IPTV Collection", epg_url: str = "epg.xml.gz", group_mode: str = "category") -> str:
    """
    Generates a full M3U8 playlist string with embedded EPG directives.
    """
    lines = [
        f'#EXTM3U url-tvg="{epg_url}" x-tvg-url="{epg_url}" refresh="3600"',
        f'#PLAYLIST:{playlist_title}',
        '#EXT-X-VERSION:3',
        ''
    ]
    for ch in channels:
        lines.append(format_m3u_entry(ch, group_mode=group_mode))
    
    return "\n".join(lines) + "\n"

def deduplicate_channels(channels: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Deduplicates channels by URL and normalized name.
    """
    seen_urls = set()
    unique_by_name: Dict[str, Dict[str, Any]] = {}

    for ch in channels:
        url = ch.get("url", "").strip()
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)

        norm_key = f"{ch.get('name', '').strip().lower()}::{ch.get('category', '').strip().lower()}"
        if norm_key in unique_by_name:
            current_lat = ch.get("latency_ms", 99999)
            existing_lat = unique_by_name[norm_key].get("latency_ms", 99999)
            if current_lat < existing_lat:
                unique_by_name[norm_key] = ch
        else:
            unique_by_name[norm_key] = ch

    return list(unique_by_name.values())

def save_playlists_and_json(
    raw_channels: List[Dict[str, Any]],
    output_dir: str,
    categories: List[str],
    total_tested: int
) -> Dict[str, Any]:
    """
    Saves master playlist, categorized playlists, country playlists, EPG XML/JSON, and stats.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # Enrich and normalize all metadata
    channels = [enrich_channel_metadata(ch) for ch in raw_channels]
    channels.sort(key=lambda x: (x.get("category", ""), x.get("name", "").lower()))

    # 1. Master Playlists
    # Standard categorized grouping
    master_m3u = generate_m3u8(channels, playlist_title="Free Verified IPTV - Master", epg_url="epg.xml", group_mode="category")
    with open(os.path.join(output_dir, "playlist.m3u8"), "w", encoding="utf-8") as f:
        f.write(master_m3u)

    # By Country grouping (popular in TiviMate & Smarters for country browsing)
    country_grouped_m3u = generate_m3u8(channels, playlist_title="Free Verified IPTV - By Country", epg_url="epg.xml", group_mode="country")
    with open(os.path.join(output_dir, "playlist_by_country.m3u8"), "w", encoding="utf-8") as f:
        f.write(country_grouped_m3u)

    # 2. Categorized Feeds
    cat_counts = {}
    for cat in categories:
        cat_lower = cat.lower()
        cat_channels = [ch for ch in channels if ch.get("category", "").lower() == cat_lower]
        if cat_channels:
            cat_m3u = generate_m3u8(cat_channels, playlist_title=f"Free IPTV - {cat}", epg_url="epg.xml")
            cat_filename = f"{cat_lower.replace(' ', '_')}.m3u8"
            with open(os.path.join(output_dir, cat_filename), "w", encoding="utf-8") as f:
                f.write(cat_m3u)
            cat_counts[cat] = len(cat_channels)

    # 3. Country Feeds (US, UK, CA, FR, DE, etc.)
    country_counts = {}
    unique_countries = set(ch.get("country_code") for ch in channels if ch.get("country_code"))
    for code in unique_countries:
        c_channels = [ch for ch in channels if ch.get("country_code") == code]
        if len(c_channels) >= 5:  # Only export dedicated playlist if at least 5 channels exist
            c_m3u = generate_m3u8(c_channels, playlist_title=f"Free IPTV - {code}", epg_url="epg.xml")
            with open(os.path.join(output_dir, f"{code.lower()}.m3u8"), "w", encoding="utf-8") as f:
                f.write(c_m3u)
            country_counts[code] = len(c_channels)

    # 4. Quality Feeds (1080p FHD, 720p HD)
    fhd_channels = [ch for ch in channels if "1080" in ch.get("quality", "") or "4K" in ch.get("quality", "")]
    if fhd_channels:
        with open(os.path.join(output_dir, "fhd.m3u8"), "w", encoding="utf-8") as f:
            f.write(generate_m3u8(fhd_channels, playlist_title="Free IPTV - Full HD (1080p)", epg_url="epg.xml"))

    # 5. Build EPG Data (7-Day Program Guide XMLTV & JSON)
    build_epg_files(channels, output_dir=output_dir, days=7)

    # 6. Save JSON index for web players
    json_path = os.path.join(output_dir, "channels.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(channels, f, indent=2, ensure_ascii=False)

    # 7. Save Stats & Health Report
    now_iso = datetime.now(timezone.utc).isoformat()
    stats = {
        "updated_at": now_iso,
        "total_tested": total_tested,
        "online_channels": len(channels),
        "working_rate_percent": round((len(channels) / total_tested * 100), 1) if total_tested > 0 else 0,
        "categories": cat_counts,
        "countries": country_counts,
        "epg_available": True,
        "epg_days_coverage": 7
    }
    stats_path = os.path.join(output_dir, "stats.json")
    with open(stats_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2)

    return stats
