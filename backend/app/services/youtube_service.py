"""YouTube metadata retrieval via legitimate APIs only.

Primary: public oEmbed endpoint (no key) — title, author, thumbnail.
Optional: YouTube Data API v3 (if ``YOUTUBE_API_KEY`` set) — duration, channel,
publish date, description. No scraping, no fallback that bypasses restrictions.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass

import httpx

from app.config.settings import settings
from app.utils.youtube_url import InvalidYouTubeURL, extract_video_id, parse_youtube_url

logger = logging.getLogger(__name__)

_OEMBED = "https://www.youtube.com/oembed"
_DATA_API = "https://www.googleapis.com/youtube/v3/videos"
_ISO8601_DUR = re.compile(
    r"P(?:(?P<days>\d+)D)?T(?:(?P<hours>\d+)H)?(?:(?P<minutes>\d+)M)?(?:(?P<seconds>\d+)S)?"
)


class VideoUnavailable(RuntimeError):
    """The video does not exist or cannot be accessed."""


@dataclass
class VideoMetadata:
    video_id: str
    url: str
    title: str | None = None
    channel: str | None = None
    thumbnail_url: str | None = None
    duration_seconds: int | None = None
    published_at: str | None = None
    description: str | None = None


def validate_url(raw: str) -> dict:
    try:
        parsed = parse_youtube_url(raw)
    except InvalidYouTubeURL as exc:
        return {"valid": False, "reason": str(exc)}
    return {"valid": True, "video_id": parsed.video_id, "canonical_url": parsed.canonical_url}


def _parse_iso8601_duration(value: str | None) -> int | None:
    if not value:
        return None
    m = _ISO8601_DUR.match(value)
    if not m:
        return None
    parts = {k: int(v) for k, v in m.groupdict(default="0").items()}
    return parts["days"] * 86400 + parts["hours"] * 3600 + parts["minutes"] * 60 + parts["seconds"]


def _fetch_oembed(video_id: str, url: str) -> VideoMetadata:
    try:
        resp = httpx.get(
            _OEMBED,
            params={"url": f"https://www.youtube.com/watch?v={video_id}", "format": "json"},
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        logger.warning("oEmbed request failed: %s", exc)
        return VideoMetadata(video_id=video_id, url=url)

    if resp.status_code == 404:
        raise VideoUnavailable("This video is unavailable or cannot be accessed.")
    if resp.status_code != 200:
        return VideoMetadata(video_id=video_id, url=url)

    data = resp.json()
    return VideoMetadata(
        video_id=video_id,
        url=url,
        title=data.get("title"),
        channel=data.get("author_name"),
        thumbnail_url=data.get("thumbnail_url")
        or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
    )


def _enrich_with_data_api(meta: VideoMetadata) -> VideoMetadata:
    if not settings.youtube_api_key:
        return meta
    try:
        resp = httpx.get(
            _DATA_API,
            params={
                "part": "snippet,contentDetails",
                "id": meta.video_id,
                "key": settings.youtube_api_key,
            },
            timeout=10.0,
        )
        resp.raise_for_status()
        items = resp.json().get("items", [])
    except httpx.HTTPError as exc:
        logger.warning("YouTube Data API failed: %s", exc)
        return meta
    if not items:
        raise VideoUnavailable("This video is unavailable or cannot be accessed.")

    snippet = items[0].get("snippet", {})
    details = items[0].get("contentDetails", {})
    thumbs = snippet.get("thumbnails", {})
    best = thumbs.get("maxres") or thumbs.get("high") or thumbs.get("medium") or {}
    return VideoMetadata(
        video_id=meta.video_id,
        url=meta.url,
        title=snippet.get("title") or meta.title,
        channel=snippet.get("channelTitle") or meta.channel,
        thumbnail_url=best.get("url") or meta.thumbnail_url,
        duration_seconds=_parse_iso8601_duration(details.get("duration")),
        published_at=snippet.get("publishedAt"),
        description=(snippet.get("description") or "")[:2000] or None,
    )


def get_video_metadata(raw_url: str) -> VideoMetadata:
    video_id = extract_video_id(raw_url)
    url = f"https://www.youtube.com/watch?v={video_id}"
    meta = _fetch_oembed(video_id, url)
    return _enrich_with_data_api(meta)
