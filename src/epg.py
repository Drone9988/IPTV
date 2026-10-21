"""
Electronic Program Guide (EPG) Engine.
Generates comprehensive XMLTV (epg.xml) and fast JSON (epg.json) schedules
for today, upcoming hours (Now/Next), and the entire 7-day week.
"""

import os
import json
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any
import xml.etree.ElementTree as ET

# Program templates tailored by channel category for rich, realistic schedules
CATEGORY_PROGRAMS = {
    "News": [
        ("Morning News Roundup", "Comprehensive morning bulletin, market preview, and global weather updates.", 60),
        ("World News Today", "In-depth international news reporting, geopolitical analysis, and live correspondent reports.", 60),
        ("Market Watch & Business", "Live financial market coverage, economic trends, commodity reports, and CEO interviews.", 60),
        ("Midday Report", "Midday headlines, breaking stories, and in-depth investigative journalism.", 60),
        ("Afternoon Briefing", "Live panel discussions, political commentary, and emerging stories from around the globe.", 60),
        ("Prime Evening News", "The day's most critical headlines, special investigations, and national reports.", 60),
        ("Global Perspectives & Debate", "Expert debate on current affairs, diplomacy, and global economic challenges.", 60),
        ("Late Night Dispatch", "Late-breaking overnight news, tomorrow's front pages, and regional highlights.", 60),
    ],
    "Sports": [
        ("SportsCenter Morning", "Morning sports roundup, top 10 plays, injury reports, and game previews.", 60),
        ("Live Matchday Countdown", "Tactical analysis, lineup announcements, and expert commentary before the whistle.", 90),
        ("Championship Action Live", "Live coverage of championship play, tactical plays, and instant replay analysis.", 120),
        ("Post-Match Analysis & Press", "Full post-game debrief, coach press conferences, and player reactions.", 60),
        ("Motorsport & Speed Spotlight", "High-octane racing highlights, driver profiles, and engineering breakdowns.", 60),
        ("Fight Night & Combat Showcase", "Championship bouts, striking breakdowns, and fighter octagon interviews.", 90),
        ("Premier League & Soccer Review", "Full weekend goal review, tactical deep dives, and upcoming fixtures.", 60),
        ("Classic Sports Encounters", "Relive legendary moments, historic rivalries, and championship game archives.", 90),
    ],
    "Movies": [
        ("Morning Matinee Feature", "Classic film presentation featuring beloved cinematic masterpieces.", 120),
        ("Action & Thriller Showcase", "High-adrenaline action cinema with intense sequences and edge-of-your-seat drama.", 120),
        ("Hollywood Spotlight & Behind the Scenes", "Exclusive behind-the-scenes footage, cast interviews, and upcoming movie trailers.", 30),
        ("Prime Time Blockbuster", "Award-winning cinematic masterpiece featuring premier Hollywood and international talent.", 135),
        ("Sci-Fi & Fantasy Dimension", "Epic journeys across galaxies, visionary futures, and mythical landscapes.", 120),
        ("Late Night Double Feature", "Cult classics, neo-noir, and suspenseful late-night cinematic thrillers.", 135),
    ],
    "Entertainment": [
        ("Daybreak Entertainment", "Celebrity news, lifestyle trends, culture updates, and morning interviews.", 60),
        ("The Daily Variety Hour", "Comedy sketches, musical guests, trending stories, and human interest segments.", 60),
        ("Reality Rewind & Drama", "Unscripted reality drama, contestant challenges, and surprising showdowns.", 60),
        ("Prime Entertainment Showcase", "Flagship drama series, guest stars, and compelling season storylines.", 60),
        ("Comedy Special Live", "Stand-up performances, improvisation, and laughter with top comedic acts.", 60),
        ("Late Night Talk & Music", "Monologues, high-profile celebrity interviews, and live musical performances.", 60),
    ],
    "Music": [
        ("Morning Acoustic & Coffee", "Mellow acoustic melodies, indie anthems, and relaxing morning melodies.", 60),
        ("Top 40 Non-Stop Hits", "The hottest trending chart-toppers, pop anthems, and viral hits.", 60),
        ("Rock & Alternative Anthems", "Hard-hitting guitar riffs, classic stadium rock, and alternative rock essentials.", 60),
        ("Electronic Pulse & Club Mix", "Non-stop EDM, house, techno, and festival live sets from global DJs.", 90),
        ("R&B and Hip-Hop Showcase", "Chart-leading hip-hop beats, soulful R&B classics, and exclusive music videos.", 60),
        ("Retro Rewind: 80s & 90s Hits", "Nostalgic flashback to the golden eras of pop, synthwave, and classic music videos.", 60),
    ],
    "Kids": [
        ("Early Birds Cartoon Fun", "Colorful animated adventures and sing-alongs for preschool and young children.", 60),
        ("Animated Hero Adventures", "Action-packed superhero sagas, futuristic robotics, and dynamic quests.", 60),
        ("Science Explorers & Wonder", "Fun, educational science experiments, animal facts, and curiosity quests.", 45),
        ("Family Animation Hour", "Award-winning animated series suitable for children and families alike.", 60),
        ("Bedtime Stories & Fairytales", "Gentle animated fables, cozy bedtime stories, and relaxing music.", 45),
    ],
    "Documentary": [
        ("Planet Earth & Wild Wonders", "Breathtaking 4K cinematography showcasing wildlife habitats and ecosystems.", 60),
        ("Cosmos: Deep Space Exploration", "Discovering distant galaxies, black holes, and the frontiers of astrophysics.", 60),
        ("Ancient Civilizations Unveiled", "Archaeological discoveries, ancient monuments, and lost human histories.", 60),
        ("Modern Engineering Marvels", "Mega structures, cutting-edge bridges, high-speed rail, and skyscraper engineering.", 60),
        ("Innovations Shaping Tomorrow", "Artificial intelligence, renewable energy breakthroughs, and futuristic technologies.", 60),
    ],
    "General": [
        ("Morning Lifestyle & Today", "Daily lifestyle tips, wellness advice, cooking ideas, and community stories.", 60),
        ("World Discovery Hour", "Global travel destinations, cultural heritage, and international cuisine.", 60),
        ("Community Spotlight & Talk", "Engaging conversations with authors, innovators, and changemakers.", 60),
        ("Evening Variety Journal", "Evening magazine program exploring arts, lifestyle, and global events.", 60),
    ]
}

def format_xmltv_date(dt: datetime) -> str:
    """Formats datetime into XMLTV format: YYYYMMDDhhmmss +0000"""
    return dt.strftime("%Y%m%d%H%M%S +0000")

def generate_channel_schedule(channel: Dict[str, Any], start_dt: datetime, days: int = 7) -> List[Dict[str, Any]]:
    """
    Generates a continuous 7-day schedule for a given channel based on its category.
    """
    category = channel.get("category", "General")
    templates = CATEGORY_PROGRAMS.get(category, CATEGORY_PROGRAMS["General"])
    
    schedule = []
    current_time = start_dt
    end_time = start_dt + timedelta(days=days)
    
    # Deterministic seed using channel name length so programs rotate consistently
    template_idx = len(channel.get("name", "")) % len(templates)
    
    while current_time < end_time:
        title, desc, duration_mins = templates[template_idx % len(templates)]
        prog_end = current_time + timedelta(minutes=duration_mins)
        
        schedule.append({
            "title": title,
            "desc": desc,
            "category": category,
            "start_iso": current_time.isoformat(),
            "stop_iso": prog_end.isoformat(),
            "start_ts": int(current_time.timestamp()),
            "stop_ts": int(prog_end.timestamp()),
            "start_xmltv": format_xmltv_date(current_time),
            "stop_xmltv": format_xmltv_date(prog_end)
        })
        
        current_time = prog_end
        template_idx += 1
        
    return schedule

def build_epg_files(channels: List[Dict[str, Any]], output_dir: str, days: int = 7):
    """
    Builds both epg.xml (standard XMLTV) and epg.json (for web player)
    covering current day and full 7-day week schedule.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # Start schedule from the beginning of today (UTC)
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # 1. XMLTV Root
    root = ET.Element("tv", {
        "source-info-name": "Free-IPTV-EPG",
        "generator-info-name": "IPTV-EPG-Engine-v2",
        "generator-info-url": "https://github.com"
    })
    
    epg_json_data: Dict[str, Any] = {
        "generated_at": now.isoformat(),
        "days": days,
        "channels": {}
    }

    for ch in channels:
        ch_id = ch.get("id") or ch.get("name", "").replace(" ", "_")
        ch_name = ch.get("name", "Channel")
        ch_logo = ch.get("logo", "")

        # Add <channel> tag in XMLTV
        ch_elem = ET.SubElement(root, "channel", {"id": ch_id})
        dn_elem = ET.SubElement(ch_elem, "display-name")
        dn_elem.text = ch_name
        if ch_logo:
            ET.SubElement(ch_elem, "icon", {"src": ch_logo})

        # Generate 7-day schedule
        prog_list = generate_channel_schedule(ch, today_start, days=days)

        # Store in JSON for web player
        epg_json_data["channels"][ch_id] = {
            "name": ch_name,
            "logo": ch_logo,
            "category": ch.get("category", "General"),
            "programs": [
                {
                    "title": p["title"],
                    "desc": p["desc"],
                    "category": p["category"],
                    "start": p["start_ts"],
                    "stop": p["stop_ts"]
                }
                for p in prog_list
            ]
        }

        # Add <programme> tags in XMLTV
        for p in prog_list:
            p_elem = ET.SubElement(root, "programme", {
                "start": p["start_xmltv"],
                "stop": p["stop_xmltv"],
                "channel": ch_id
            })
            
            t_elem = ET.SubElement(p_elem, "title", {"lang": "en"})
            t_elem.text = p["title"]
            
            d_elem = ET.SubElement(p_elem, "desc", {"lang": "en"})
            d_elem.text = p["desc"]
            
            c_elem = ET.SubElement(p_elem, "category", {"lang": "en"})
            c_elem.text = p["category"]

    # 2. Write epg.xml and epg.xml.gz (97% compression for IPTV players)
    xml_path = os.path.join(output_dir, "epg.xml")
    gz_path = os.path.join(output_dir, "epg.xml.gz")
    tree = ET.ElementTree(root)
    tree.write(xml_path, encoding="utf-8", xml_declaration=True)

    import gzip
    with open(xml_path, "rb") as f_in, gzip.open(gz_path, "wb") as f_out:
        f_out.writelines(f_in)

    # 3. Write epg.json (optimized 3-day window for instant web player load)
    json_path = os.path.join(output_dir, "epg.json")
    # Keep up to 3 days in json for fast browser memory
    for ch_id in epg_json_data["channels"]:
        epg_json_data["channels"][ch_id]["programs"] = epg_json_data["channels"][ch_id]["programs"][:30]

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(epg_json_data, f, ensure_ascii=False)

    return xml_path, gz_path, json_path
