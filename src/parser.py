"""
Parser for M3U and M3U8 playlists.
Extracts channel metadata, stream URLs, and attributes accurately.
"""

import re
from typing import List, Dict, Any, Optional

# Regular expression to extract key="value" or key=value attributes from #EXTINF lines
ATTR_PATTERN = re.compile(r'([a-zA-Z0-9_-]+)=["\']?([^"\',]+)["\']?')

def parse_extinf_line(line: str) -> Dict[str, str]:
    """
    Extracts all attributes and the channel name from an #EXTINF line.
    Example: #EXTINF:-1 tvg-id="abc" tvg-name="ABC" group-title="News",ABC News
    """
    data = {
        "tvg_id": "",
        "tvg_name": "",
        "tvg_logo": "",
        "group_title": "",
        "country": "",
        "language": "",
        "title": ""
    }

    # Extract name (everything after the last comma)
    if "," in line:
        parts = line.split(",", 1)
        tag_part = parts[0]
        data["title"] = parts[1].strip()
    else:
        tag_part = line

    # Find attributes
    matches = ATTR_PATTERN.findall(tag_part)
    for key, value in matches:
        key_lower = key.lower()
        if key_lower == "tvg-id":
            data["tvg_id"] = value.strip()
        elif key_lower == "tvg-name":
            data["tvg_name"] = value.strip()
        elif key_lower == "tvg-logo":
            data["tvg_logo"] = value.strip()
        elif key_lower in ("group-title", "group"):
            data["group_title"] = value.strip()
        elif key_lower in ("tvg-country", "country"):
            data["country"] = value.strip().upper()
        elif key_lower in ("tvg-language", "language"):
            data["language"] = value.strip().lower()

    if not data["title"] and data["tvg_name"]:
        data["title"] = data["tvg_name"]

    return data

def parse_m3u_content(content: str, default_category: str = "General", default_country: str = "") -> List[Dict[str, Any]]:
    """
    Parses full M3U content string into a list of structured channel dictionaries.
    """
    channels = []
    lines = content.strip().splitlines()
    
    current_meta: Optional[Dict[str, str]] = None
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        if line.startswith("#EXTINF"):
            current_meta = parse_extinf_line(line)
        elif line.startswith("#"):
            # Other M3U directive (#EXTVLCOPT, #EXTGRP, etc.)
            if current_meta and line.startswith("#EXTGRP:"):
                current_meta["group_title"] = line.replace("#EXTGRP:", "").strip()
            continue
        elif current_meta is not None:
            # This is the stream URL
            url = line
            if url.startswith("http://") or url.startswith("https://") or url.startswith("rtmp://"):
                category = current_meta.get("group_title") or default_category
                country = current_meta.get("country") or default_country
                
                channel_dict = {
                    "id": current_meta.get("tvg_id") or "",
                    "name": current_meta.get("title") or current_meta.get("tvg_name") or "Unnamed Channel",
                    "logo": current_meta.get("tvg_logo") or "",
                    "category": category.strip(),
                    "country": country.strip(),
                    "language": current_meta.get("language") or "",
                    "url": url,
                    "status": "untested"
                }
                channels.append(channel_dict)
            current_meta = None

    return channels
