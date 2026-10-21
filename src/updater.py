"""
Main Orchestrator for the Free IPTV Aggregator.
Fetches upstream sources, validates stream health, eliminates broken links,
and exports clean playlists.
"""

import os
import sys
import asyncio
import logging
import aiohttp
from typing import List, Dict, Any

from src.config import SOURCES, CHECKER_SETTINGS, CATEGORIES, OUTPUT_DIR
from src.parser import parse_m3u_content
from src.checker import check_channel_batch
from src.generator import deduplicate_channels, save_playlists_and_json

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("IPTV-Updater")

async def fetch_playlist(session: aiohttp.ClientSession, source: Dict[str, str]) -> List[Dict[str, Any]]:
    """
    Downloads and parses an upstream M3U playlist.
    """
    name = source.get("name", "Unknown Source")
    url = source.get("url", "")
    default_cat = source.get("category", "General")
    default_country = source.get("country", "")

    logger.info(f"Fetching source: {name} ({url})")
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200:
                logger.warning(f"Failed to fetch {name}: HTTP {resp.status}")
                return []
            text = await resp.text(encoding="utf-8", errors="ignore")
            channels = parse_m3u_content(text, default_category=default_cat, default_country=default_country)
            logger.info(f"Extracted {len(channels)} channels from {name}")
            return channels
    except Exception as e:
        logger.error(f"Error downloading {name}: {e}")
        return []

def filter_candidates(channels: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Applies initial sanity filters (adult filter, valid URL scheme).
    """
    filtered = []
    seen_urls = set()
    filter_adult = CHECKER_SETTINGS.get("filter_adult", True)

    adult_keywords = ["xxx", "adult", "porn", "erotic", "nsfw", "18+"]

    for ch in channels:
        url = ch.get("url", "").strip()
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)

        name = ch.get("name", "").lower()
        cat = ch.get("category", "").lower()

        if filter_adult:
            if any(k in name or k in cat for k in adult_keywords):
                continue

        filtered.append(ch)

    return filtered

async def main():
    logger.info("=== Starting Free IPTV Aggregator & Health Verification ===")
    
    # 1. Download all upstream sources concurrently
    all_raw_channels: List[Dict[str, Any]] = []
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_playlist(session, src) for src in SOURCES]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for res in results:
            if isinstance(res, list):
                all_raw_channels.extend(res)

    logger.info(f"Total raw channels collected across all sources: {len(all_raw_channels)}")

    # 2. Sanitize and filter
    candidate_channels = filter_candidates(all_raw_channels)
    total_candidates = len(candidate_channels)
    logger.info(f"Unique candidates ready for stream health check: {total_candidates}")

    # Optional cap per category to ensure fast verification in GitHub Actions
    max_per_cat = CHECKER_SETTINGS.get("max_channels_per_category", 0)
    if max_per_cat > 0:
        capped_candidates = []
        cat_counts = {}
        for ch in candidate_channels:
            cat = ch.get("category", "General")
            if cat == "Farsi / Iranian" or ch.get("country") == "IR" or ch.get("language") in ("fas", "per"):
                capped_candidates.append(ch)
            else:
                cat_counts[cat] = cat_counts.get(cat, 0) + 1
                if cat_counts[cat] <= max_per_cat:
                    capped_candidates.append(ch)
        candidate_channels = capped_candidates
        logger.info(f"Channels capped to {max_per_cat}/category (Farsi fully preserved): {len(candidate_channels)} testing")

    # 3. Asynchronously test every stream for live availability
    concurrency = CHECKER_SETTINGS.get("concurrency", 40)
    timeout = CHECKER_SETTINGS.get("timeout_seconds", 6)
    user_agent = CHECKER_SETTINGS.get("user_agent", "")

    logger.info(f"Validating streams with concurrency={concurrency}, timeout={timeout}s...")
    verified = await check_channel_batch(
        candidate_channels,
        concurrency=concurrency,
        timeout_seconds=timeout,
        user_agent=user_agent
    )
    logger.info(f"Verification complete: {len(verified)} working live streams found")

    # 4. Deduplicate and select best streams
    clean_channels = deduplicate_channels(verified)
    logger.info(f"Final clean channels after deduplication: {len(clean_channels)}")

    # 5. Save all output playlists & stats
    stats = save_playlists_and_json(
        clean_channels,
        output_dir=OUTPUT_DIR,
        categories=CATEGORIES,
        total_tested=len(candidate_channels)
    )

    logger.info(f"Playlists successfully saved to '{OUTPUT_DIR}'")
    logger.info(f"Health Summary: {stats['online_channels']}/{stats['total_tested']} channels online ({stats['working_rate_percent']}%)")
    logger.info("=== Process Finished Successfully ===")

if __name__ == "__main__":
    asyncio.run(main())
