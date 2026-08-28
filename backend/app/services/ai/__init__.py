"""Formatter selection."""
from __future__ import annotations

from app.config.settings import settings
from app.services.ai.formatter import FormatResult, TranscriptFormatter
from app.services.ai.rule_based import RuleBasedFormatter


def get_formatter() -> TranscriptFormatter:
    if settings.claude_enabled:
        from app.services.ai.claude import ClaudeFormatter

        return ClaudeFormatter()
    return RuleBasedFormatter()


__all__ = ["get_formatter", "TranscriptFormatter", "FormatResult"]
