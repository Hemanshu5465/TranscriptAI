"""Transcript statistics."""
from __future__ import annotations

import re

from app.services.transcription.base import Segment

_WORD_RE = re.compile(r"[^\s.,!?;:—–\-\"'()\[\]…।]+")
_SENTENCE_RE = re.compile(r"[.!?।…]+")
_WPM_READING = 225.0


def count_words(text: str) -> int:
    return len(_WORD_RE.findall(text or ""))


def compute_stats(segments: list[Segment], full_text: str, duration_seconds: float | None) -> dict:
    words = count_words(full_text)
    characters = len(full_text or "")
    characters_no_spaces = len(re.sub(r"\s", "", full_text or ""))
    sentences = max(1, len([p for p in _SENTENCE_RE.split(full_text or "") if p.strip()])) if full_text else 0
    paragraphs = len([p for p in (full_text or "").split("\n\n") if p.strip()])

    speaking_time = sum(max(0.0, s.end - s.start) for s in segments)
    speakers = sorted({s.speaker for s in segments if s.speaker})

    reading_minutes = round(words / _WPM_READING, 1) if words else 0.0
    wpm = round(words / (speaking_time / 60), 1) if speaking_time > 0 and words else None

    return {
        "words": words,
        "characters": characters,
        "characters_no_spaces": characters_no_spaces,
        "sentences": sentences,
        "paragraphs": paragraphs,
        "segments": len(segments),
        "duration_seconds": round(duration_seconds, 2) if duration_seconds else None,
        "speaking_time_seconds": round(speaking_time, 2),
        "speaking_pace_wpm": wpm,
        "reading_time_minutes": reading_minutes,
        "speakers": speakers,
        "speaker_count": len(speakers),
    }
