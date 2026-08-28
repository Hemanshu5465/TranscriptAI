"""YouTube URL validation & video-id extraction.

Mirrors ``frontend/src/utils/youtube.ts`` — keep the two in sync.
Supported forms:
    https://www.youtube.com/watch?v=VIDEO_ID
    https://youtu.be/VIDEO_ID
    https://www.youtube.com/embed/VIDEO_ID
    https://www.youtube.com/shorts/VIDEO_ID
    https://www.youtube.com/live/VIDEO_ID
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import parse_qs, urlparse

_VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
_ALLOWED_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "www.youtu.be",
}
_PATH_PREFIXES = ("embed", "shorts", "live", "v")


class InvalidYouTubeURL(ValueError):
    """Raised when a string is not a usable YouTube video URL."""


@dataclass(frozen=True)
class ParsedURL:
    video_id: str
    canonical_url: str


def extract_video_id(raw: str) -> str:
    """Return the 11-char video id or raise :class:`InvalidYouTubeURL`."""
    if not raw or not raw.strip():
        raise InvalidYouTubeURL("empty")

    candidate = raw.strip()
    if _VIDEO_ID_RE.match(candidate):
        return candidate

    if "://" not in candidate:
        candidate = "https://" + candidate

    parsed = urlparse(candidate)
    host = (parsed.hostname or "").lower()
    if host not in _ALLOWED_HOSTS:
        raise InvalidYouTubeURL("unsupported host")

    # youtu.be/<id>
    if host in {"youtu.be", "www.youtu.be"}:
        vid = parsed.path.lstrip("/").split("/")[0]
        return _validated(vid)

    # youtube.com/watch?v=<id>
    if parsed.path == "/watch":
        qs = parse_qs(parsed.query)
        if "v" in qs and qs["v"]:
            return _validated(qs["v"][0])
        raise InvalidYouTubeURL("missing v parameter")

    # youtube.com/{embed,shorts,live,v}/<id>
    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) >= 2 and parts[0] in _PATH_PREFIXES:
        return _validated(parts[1])

    raise InvalidYouTubeURL("unrecognised URL shape")


def _validated(vid: str) -> str:
    vid = vid.strip()
    if not _VIDEO_ID_RE.match(vid):
        raise InvalidYouTubeURL("malformed video id")
    return vid


def parse_youtube_url(raw: str) -> ParsedURL:
    vid = extract_video_id(raw)
    return ParsedURL(video_id=vid, canonical_url=f"https://www.youtube.com/watch?v={vid}")


def is_valid_youtube_url(raw: str) -> bool:
    try:
        extract_video_id(raw)
        return True
    except InvalidYouTubeURL:
        return False
