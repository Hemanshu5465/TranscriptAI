"""Deterministic, offline transcript formatter (no API key required).

Heuristic only — it never rewrites content. It capitalises sentence starts and
the pronoun "I", collapses whitespace, removes verbatim immediate word repeats
(readable mode), and adds a trailing period to sentence-like segments.
"""
from __future__ import annotations

import re

from app.services.ai.formatter import (
    ACCURACY_EXACT,
    ACCURACY_READABLE,
    FormatResult,
    TranscriptFormatter,
    rebuild_full_text,
)
from app.services.transcription.base import Segment

_SENTENCE_END = (".", "!", "?", "।", "…", ":", ";")
_ABBREV = {"mr", "mrs", "ms", "dr", "st", "vs", "etc", "inc", "e.g", "i.e"}


def _collapse_ws(text: str) -> str:
    return re.sub(r"\s+([,.!?;:])", r"\1", re.sub(r"\s+", " ", text)).strip()


def _dedupe_immediate(text: str) -> str:
    # "the the cat" -> "the cat"; keep intentional "very very".
    return re.sub(r"\b(\w+)(\s+\1\b)+", r"\1", text, flags=re.IGNORECASE)


def _capitalize_sentences(text: str) -> str:
    out = []
    capitalize_next = True
    for token in re.split(r"(\s+)", text):
        if not token.strip():
            out.append(token)
            continue
        word = token
        if capitalize_next and word[:1].isalpha():
            word = word[0].upper() + word[1:]
        out.append(word)
        stripped = word.rstrip('"\')')
        last = stripped[-1:] if stripped else ""
        base = re.sub(r"[^\w.]", "", stripped).lower().rstrip(".")
        capitalize_next = last in _SENTENCE_END and base not in _ABBREV
    result = "".join(out)
    result = re.sub(r"(?<!\w)i(?!\w)", "I", result)  # standalone "i" -> "I"
    result = re.sub(r"\bi'(m|ve|ll|d)\b", lambda m: "I'" + m.group(1), result)
    return result


class RuleBasedFormatter(TranscriptFormatter):
    name = "rule_based"

    def format(self, segments: list[Segment], *, mode: str, language: str | None) -> FormatResult:
        latinish = not language or language.split("-")[0] in {
            "en", "es", "fr", "de", "pt", "it", "nl",
        }
        out: list[Segment] = []
        for seg in segments:
            text = _collapse_ws(seg.text)
            raw = seg.text.strip()
            if mode != ACCURACY_EXACT:
                if mode == ACCURACY_READABLE:
                    text = _dedupe_immediate(text)
                if latinish:
                    text = _capitalize_sentences(text)
                if (
                    text
                    and text[-1] not in _SENTENCE_END
                    and text[-1].isalnum()
                    and len(text.split()) >= 4
                ):
                    text += "."
            out.append(
                Segment(
                    start=seg.start,
                    end=seg.end,
                    text=text,
                    raw_text=raw,
                    speaker=seg.speaker,
                    confidence=seg.confidence,
                    words=seg.words,
                )
            )
        full = rebuild_full_text(out) if mode != ACCURACY_EXACT else "\n\n".join(
            s.text for s in out if s.text
        )
        return FormatResult(segments=out, full_text=full)
