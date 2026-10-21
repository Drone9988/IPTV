"""
Asynchronous Stream Health Checker and Link Validator.
Tests stream endpoints, follows redirects, ensures active live manifests,
and filters out broken or dead IPTV streams.
"""

import asyncio
import time
import aiohttp
from typing import Dict, Any, Tuple, Optional

# Valid HLS or Video content-types
VALID_CONTENT_TYPES = (
    "application/vnd.apple.mpegurl",
    "application/x-mpegurl",
    "application/mpegurl",
    "audio/x-mpegurl",
    "audio/mpegurl",
    "video/mp2t",
    "video/mp4",
    "video/x-flv",
    "application/octet-stream"
)

async def validate_stream(session: aiohttp.ClientSession, channel: Dict[str, Any], timeout_seconds: int = 6) -> Tuple[bool, Optional[str], float]:
    """
    Validates a single channel stream URL.
    Returns: (is_alive, resolved_url, response_time_ms)
    """
    original_url = channel["url"]
    start_time = time.monotonic()
    
    headers = {
        "Range": "bytes=0-4096",
        "Accept": "*/*",
        "Connection": "close"
    }

    try:
        # We allow redirects so we capture the true current live stream endpoint
        async with session.get(original_url, headers=headers, timeout=aiohttp.ClientTimeout(total=timeout_seconds), allow_redirects=True) as resp:
            latency = round((time.monotonic() - start_time) * 1000, 2)
            
            # Status must be successful
            if resp.status not in (200, 206, 302, 307):
                return False, None, latency

            content_type = resp.headers.get("Content-Type", "").lower()
            resolved_url = str(resp.url)
            
            # Read first chunk to inspect payload
            chunk = await resp.content.read(2048)
            text_preview = ""
            try:
                text_preview = chunk.decode("utf-8", errors="ignore").strip()
            except Exception:
                pass

            # Detect HTML error/block pages disguised as 200 OK
            if "<html" in text_preview.lower() or "<!doctype html" in text_preview.lower():
                # Some web servers return HTML pages saying 'stream expired' or 'not found'
                return False, None, latency

            # Check for HLS manifest markers
            is_hls = (
                "#EXTM3U" in text_preview or
                "#EXT-X-" in text_preview or
                "#EXTINF" in text_preview or
                any(ct in content_type for ct in VALID_CONTENT_TYPES) or
                original_url.endswith(".m3u8")
            )

            # Check for MPEG-TS binary sync byte 0x47
            is_mpeg_ts = len(chunk) > 0 and chunk[0] == 0x47

            if is_hls or is_mpeg_ts:
                # Use resolved_url if it changed and is valid
                final_url = resolved_url if resolved_url.startswith("http") else original_url
                return True, final_url, latency

            return False, None, latency

    except (aiohttp.ClientError, asyncio.TimeoutError, ConnectionResetError, OSError):
        return False, None, 0.0
    except Exception:
        return False, None, 0.0

async def check_channel_batch(channels: list, concurrency: int = 40, timeout_seconds: int = 6, user_agent: str = "") -> list:
    """
    Checks a batch of channels concurrently using an aiohttp session and bounded semaphore.
    """
    semaphore = asyncio.Semaphore(concurrency)
    verified_channels = []

    client_headers = {
        "User-Agent": user_agent or (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        )
    }

    # Connector with disabled SSL verification option for broadcast streams with self-signed certs
    connector = aiohttp.TCPConnector(limit=concurrency, ssl=False)
    
    async with aiohttp.ClientSession(connector=connector, headers=client_headers) as session:
        async def worker(channel: Dict[str, Any]):
            async with semaphore:
                is_alive, resolved_url, latency = await validate_stream(session, channel, timeout_seconds=timeout_seconds)
                if is_alive:
                    updated_channel = channel.copy()
                    if resolved_url:
                        updated_channel["url"] = resolved_url
                    updated_channel["status"] = "online"
                    updated_channel["latency_ms"] = latency
                    verified_channels.append(updated_channel)

        tasks = [worker(ch) for ch in channels]
        await asyncio.gather(*tasks, return_exceptions=True)

    return verified_channels
