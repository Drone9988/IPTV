"""
Playlist and JSON Generator.
Produces valid, standardized M3U8 playlists and structured JSON for web apps and IPTV players.
"""

import os
import json
from datetime import datetime, timezone
from typing import List, Dict, Any

def format_m3u_entry(channel: Dict[str, Any]) -> str:
    """
    Formats a channel dictionary into a standard #EXTINF M3U line.
    """
    tvg_id = channel.get("id") or ""
    tvg_name = channel.get("name") or ""
    tvg_logo = channel.get("logo") or ""
    group_title = channel.get("category") or "General"
    country = channel.get("country") or ""
    title = channel.get("name") or "Channel"
    url = channel.get("url") or ""

    attrs = [
        f'tvg-id="{tvg_id}"',
        f'tvg-name="{tvg_name}"',
        f'tvg-logo="{tvg_logo}"',
        f'group-title="{group_title}"'
    ]
    if country:
        attrs.append(f'tvg-country="{country}"')

    attr_str = " ".join(attrs)
    return f'#EXTINF:-1 {attr_str},{title}\n{url}'

def generate_m3u8(channels: List[Dict[str, Any]], playlist_title: str = "Free IPTV Collection") -> str:
    """
    Generates a full M3U8 playlist string with standard headers.
    """
    lines = [
        "#EXTM3U",
        f'#PLAYLIST:{playlist_title}',
        '#EXT-X-VERSION:3',
        ''
    ]
    for ch in channels:
        lines.append(format_m3u_entry(ch))
    
    return "\n".join(lines) + "\n"

def deduplicate_channels(channels: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Deduplicates channels by URL and by normalized channel name + category.
    Favors streams with lowest latency.
    """
    seen_urls = set()
    unique_by_name: Dict[str, Dict[str, Any]] = {}

    for ch in channels:
        url = ch["url"].strip()
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)

        # Key by lowercased name & category
        norm_key = f"{ch.get('name', '').strip().lower()}::{ch.get('category', '').strip().lower()}"
        if norm_key in unique_by_name:
            # If current channel has lower latency, replace it
            current_lat = ch.get("latency_ms", 99999)
            existing_lat = unique_by_name[norm_key].get("latency_ms", 99999)
            if current_lat < existing_lat:
                unique_by_name[norm_key] = ch
        else:
            unique_by_name[norm_key] = ch

    return list(unique_by_name.values())

def save_playlists_and_json(
    channels: List[Dict[str, Any]],
    output_dir: str,
    categories: List[str],
    total_tested: int
) -> Dict[str, Any]:
    """
    Saves master playlist, categorized playlists, country playlists, and JSON index.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # Sort channels alphabetically by name
    channels.sort(key=lambda x: x.get("name", "").lower())

    # 1. Save Master Playlist (All Channels)
    master_m3u = generate_m3u8(channels, playlist_title="Free Verified IPTV - Master")
    master_path = os.path.join(output_dir, "playlist.m3u8")
    with open(master_path, "w", encoding="utf-8") as f:
        f.write(master_m3u)

    # 2. Save Categorized Playlists
    cat_counts = {}
    for cat in categories:
        cat_lower = cat.lower()
        cat_channels = [ch for ch in channels if ch.get("category", "").lower() == cat_lower]
        if cat_channels:
            cat_m3u = generate_m3u8(cat_channels, playlist_title=f"Free IPTV - {cat}")
            cat_filename = f"{cat_lower.replace(' ', '_')}.m3u8"
            with open(os.path.join(output_dir, cat_filename), "w", encoding="utf-8") as f:
                f.write(cat_m3u)
            cat_counts[cat] = len(cat_channels)

    # 3. Save Country Playlists (US, UK, CA, etc.)
    country_counts = {}
    for country_code in ["US", "UK", "CA"]:
        c_channels = [ch for ch in channels if ch.get("country", "").upper() == country_code]
        if c_channels:
            c_m3u = generate_m3u8(c_channels, playlist_title=f"Free IPTV - {country_code}")
            with open(os.path.join(output_dir, f"{country_code.lower()}.m3u8"), "w", encoding="utf-8") as f:
                f.write(c_m3u)
            country_counts[country_code] = len(c_channels)

    # 4. Save JSON index for web players
    json_path = os.path.join(output_dir, "channels.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(channels, f, indent=2, ensure_ascii=False)

    # 5. Save Stats & Health Report
    now_iso = datetime.now(timezone.utc).isoformat()
    stats = {
        "updated_at": now_iso,
        "total_tested": total_tested,
        "online_channels": len(channels),
        "working_rate_percent": round((len(channels) / total_tested * 100), 1) if total_tested > 0 else 0,
        "categories": cat_counts,
        "countries": country_counts
    }
    stats_path = os.path.join(output_dir, "stats.json")
    with open(stats_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2)

    return stats
