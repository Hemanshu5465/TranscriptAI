"""Transcript formatting abstraction.

A formatter turns raw STT segments into a lightly cleaned transcript **without
changing the speaker's wording or meaning**. Three accuracy modes:

* ``exact``    — preserve detected words; only whitespace normalisation.
* ``clean``    — + punctuation, capitalisation, paragraph breaks (default).
* ``readable`` — + fix obvious transcription slips (double words, spacing).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, replace

from app.models import ACCURACY_CLEAN, ACCURACY_EXACT, ACCURACY_READABLE
from app.services.transcription.base import Segment

FORMATTER_SYSTEM_PROMPT = (
    "You are a transcription formatter. Preserve the speaker's original wording as "
    "closely as possible. Do NOT summarize, paraphrase, add information, remove "
    "meaningful words, invent words, or change the speaker's intended meaning. Only "
    "restore punctuation, capitalization, and paragraph breaks, and fix obvious "
    "transcription errors. Return the text only."
)


@dataclass
class FormatResult:
    segments: list[Segment]
    full_text: str


class TranscriptFormatter(ABC):
    name = "base"

    @abstractmethod
    def format(self, segments: list[Segment], *, mode: str, language: str | None) -> FormatResult:
        ...


def _normalize_ws(text: str) -> str:
    return " ".join(text.split())


def rebuild_full_text(segments: list[Segment]) -> str:
    """Join segments into paragraphs on sentence-final punctuation / long gaps."""
    paragraphs: list[str] = []
    buffer: list[str] = []
    for i, seg in enumerate(segments):
        piece = seg.text.strip()
        if not piece:
            continue
        buffer.append(piece)
        gap_next = (
            segments[i + 1].start - seg.end if i + 1 < len(segments) else 0.0
        )
        ends_sentence = piece.endswith((".", "!", "?", "।", "…"))
        if (ends_sentence and len(" ".join(buffer)) > 180) or gap_next > 2.0:
            paragraphs.append(" ".join(buffer))
            buffer = []
    if buffer:
        paragraphs.append(" ".join(buffer))
    return "\n\n".join(paragraphs)


__all__ = [
    "TranscriptFormatter",
    "FormatResult",
    "FORMATTER_SYSTEM_PROMPT",
    "rebuild_full_text",
    "_normalize_ws",
    "ACCURACY_EXACT",
    "ACCURACY_CLEAN",
    "ACCURACY_READABLE",
    "replace",
]
