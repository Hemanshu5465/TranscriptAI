"""Engine + session factory. Sync SQLAlchemy, shared by API and workers."""
from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config.settings import settings

if settings.is_sqlite:
    _connect_args: dict = {"check_same_thread": False}
    _engine_kwargs: dict = {}
else:
    # psycopg 3 + a pgBouncer-fronted pool (Neon/Vercel): disable server-side
    # prepared statements, and don't hold our own pool on short-lived functions.
    _connect_args = {"prepare_threshold": None}
    _engine_kwargs = {"pool_recycle": 300, "pool_size": 5, "max_overflow": 5}

engine = create_engine(
    settings.database_url,
    echo=False,
    future=True,
    pool_pre_ping=True,
    connect_args=_connect_args,
    **_engine_kwargs,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, class_=Session)


def get_db() -> Iterator[Session]:
    """FastAPI dependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope() -> Iterator[Session]:
    """Standalone transactional scope for workers / scripts."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
