from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app.config.settings import settings
from app.core.deps import DbSession
from app.services.transcription.factory import resolve_provider_order
from app.workers import queue_health

router = APIRouter(tags=["health"])


@router.get("/healthz")
def healthz(db: DbSession) -> dict:
    from app.db.bootstrap import ensure_schema

    ensure_schema()  # cheap no-op after the first call
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:  # noqa: BLE001
        db_ok = False
    return {
        "status": "ok" if db_ok else "degraded",
        "database": "ok" if db_ok else "unreachable",
        "queue": queue_health(),
        "transcription_providers": resolve_provider_order(),
        "ai_provider": "claude" if settings.claude_enabled else "rule_based",
        "youtube_data_api": bool(settings.youtube_api_key),
        "youtube_proxy": settings.has_proxy,
    }
