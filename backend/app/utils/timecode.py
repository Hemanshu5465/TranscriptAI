"""Timestamp formatting helpers shared by exporters and schemas."""
from __future__ import annotations


def clamp(seconds: float) -> float:
    return max(0.0, float(seconds or 0.0))


def hhmmss(seconds: float) -> str:
    """``01:24`` for < 1h, ``1:02:03`` otherwise."""
    s = int(clamp(seconds))
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    if h:
        return f"{h}:{m:02d}:{sec:02d}"
    return f"{m:02d}:{sec:02d}"


def hhmmss_full(seconds: float) -> str:
    """Always ``HH:MM:SS``."""
    s = int(clamp(seconds))
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{sec:02d}"


def srt_timestamp(seconds: float) -> str:
    ms_total = int(round(clamp(seconds) * 1000))
    h, rem = divmod(ms_total, 3_600_000)
    m, rem = divmod(rem, 60_000)
    s, ms = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def vtt_timestamp(seconds: float) -> str:
    return srt_timestamp(seconds).replace(",", ".")
