"""Optional automatic schema setup on startup.

Useful where there is no deploy step to run ``alembic upgrade head`` (e.g. serverless).
No-op for SQLite and when ``AUTO_MIGRATE=false``. Safe under concurrent cold starts:
a transaction-level Postgres advisory lock serialises it (works through pgBouncer),
and a process flag runs it once.

Order of preference:
1. ``alembic upgrade head`` (keeps the version table) if the alembic files are present.
2. ``Base.metadata.create_all`` fallback (fresh DB, no migration history).
"""
from __future__ import annotations

import logging

from sqlalchemy import text

from app.config.settings import BACKEND_DIR, settings
from app.db.session import engine

logger = logging.getLogger("app.db")

_LOCK_KEY = 843177  # arbitrary, stable
_done = False


def ensure_schema() -> None:
    global _done
    if _done or settings.is_sqlite or not settings.auto_migrate:
        _done = True
        return

    try:
        alembic_ok = (BACKEND_DIR / "alembic.ini").exists() and (BACKEND_DIR / "alembic").exists()
        with engine.begin() as conn:
            conn.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _LOCK_KEY})
            if alembic_ok:
                _alembic_upgrade()
            else:
                _create_all(conn)
        _done = True
    except Exception:  # noqa: BLE001 - never let schema setup crash the app
        logger.exception("auto schema setup failed; run `alembic upgrade head` manually")


def _alembic_upgrade() -> None:
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", settings.database_url)
    command.upgrade(cfg, "head")
    logger.info("auto-migrate: schema at head (alembic)")


def _create_all(conn) -> None:
    import app.models  # noqa: F401  (register tables)
    from app.db.base import Base

    Base.metadata.create_all(bind=conn)
    logger.info("auto-migrate: schema created (create_all fallback)")
