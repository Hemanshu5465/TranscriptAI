"""Claude-backed formatter. Active only when AI_PROVIDER=claude and AI_API_KEY set.

Falls back to the rule-based formatter on any API error so the pipeline never
fails because of the optional AI step.
"""
from __future__ import annotations

import json
import logging

from app.config.settings import settings
from app.services.ai.formatter import (
    FORMATTER_SYSTEM_PROMPT,
    FormatResult,
    TranscriptFormatter,
    rebuild_full_text,
)
from app.services.ai.rule_based import RuleBasedFormatter
from app.services.transcription.base import Segment

logger = logging.getLogger(__name__)

_MODE_INSTRUCTIONS = {
    "exact": "Only normalise whitespace. Do not add or change punctuation or casing.",
    "clean": "Restore punctuation, capitalisation and sentence boundaries. Keep every word.",
    "readable": (
        "Restore punctuation and capitalisation, fix obvious transcription errors "
        "(duplicated words, split words), and keep paragraphing sensible. Keep the wording."
    ),
}
_BATCH = 40


class ClaudeFormatter(TranscriptFormatter):
    name = "claude"

    def __init__(self) -> None:
        self._fallback = RuleBasedFormatter()

    def format(self, segments: list[Segment], *, mode: str, language: str | None) -> FormatResult:
        try:
            import anthropic
        except ImportError:
            logger.warning("anthropic SDK missing; using rule-based formatter")
            return self._fallback.format(segments, mode=mode, language=language)

        client = anthropic.Anthropic(api_key=settings.ai_api_key)
        formatted: list[Segment] = []

        for i in range(0, len(segments), _BATCH):
            chunk = segments[i : i + _BATCH]
            try:
                cleaned_texts = self._format_chunk(client, chunk, mode=mode, language=language)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Claude formatting failed (%s); falling back for this chunk", exc)
                cleaned_texts = [
                    self._fallback.format([s], mode=mode, language=language).segments[0].text
                    for s in chunk
                ]
            for seg, new_text in zip(chunk, cleaned_texts, strict=False):
                formatted.append(
                    Segment(
                        start=seg.start,
                        end=seg.end,
                        text=new_text.strip() or seg.text,
                        raw_text=seg.text.strip(),
                        speaker=seg.speaker,
                        confidence=seg.confidence,
                        words=seg.words,
                    )
                )

        return FormatResult(segments=formatted, full_text=rebuild_full_text(formatted))

    def _format_chunk(self, client, chunk, *, mode: str, language: str | None) -> list[str]:
        numbered = [{"i": idx, "text": s.text} for idx, s in enumerate(chunk)]
        user = (
            f"Language: {language or 'unknown'}. Mode: {mode}. "
            f"{_MODE_INSTRUCTIONS.get(mode, _MODE_INSTRUCTIONS['clean'])}\n\n"
            "Return a JSON array of objects {\"i\": <index>, \"text\": <formatted text>} "
            "with exactly one entry per input segment, same indices, same order.\n\n"
            f"Segments:\n{json.dumps(numbered, ensure_ascii=False)}"
        )
        resp = client.messages.create(
            model=settings.ai_model,
            max_tokens=4096,
            system=FORMATTER_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(block.text for block in resp.content if block.type == "text")
        start, end = text.find("["), text.rfind("]")
        data = json.loads(text[start : end + 1])
        by_index = {int(item["i"]): str(item["text"]) for item in data}
        return [by_index.get(idx, seg.text) for idx, seg in enumerate(chunk)]
