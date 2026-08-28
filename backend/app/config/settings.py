"""Application configuration, loaded from environment / .env."""
from __future__ import annotations

import tempfile
from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Core
    database_url: str = "sqlite:///./.data/transcriptai.db"
    jwt_secret: str = "dev-insecure-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440
    frontend_origin: str = "http://localhost:5173"

    # Run `alembic upgrade head` automatically on first request (Postgres only).
    # Handy for serverless where you can't run a deploy step. Safe: guarded by a
    # Postgres advisory lock and a per-process flag.
    auto_migrate: bool = True

    # Jobs
    #   thread = background ThreadPoolExecutor (default; local / long-running hosts)
    #   inline = run the pipeline synchronously inside the request (serverless)
    #   redis  = enqueue to an RQ worker
    job_queue: str = "thread"
    redis_url: str = "redis://localhost:6379/0"
    job_timeout_seconds: int = 1800
    max_jobs_per_user_per_month: int = 50

    # Transcription
    transcription_provider: str = "youtube_captions"
    transcription_fallback: bool = True
    enable_audio_fallback: bool = False
    whisper_model: str = "base"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"

    # Optional proxy for youtube-transcript-api. YouTube blocks caption requests
    # from datacenter IPs (Vercel/Render/etc.), so a residential proxy is what
    # makes hosted transcription reliable.
    #   Webshare: set both WEBSHARE_PROXY_USERNAME + WEBSHARE_PROXY_PASSWORD
    #   Generic : set HTTP_PROXY_URL (and optionally HTTPS_PROXY_URL)
    webshare_proxy_username: str = ""
    webshare_proxy_password: str = ""
    http_proxy_url: str = ""
    https_proxy_url: str = ""

    # AI formatting
    ai_provider: str = "rule_based"  # rule_based | claude
    ai_api_key: str = ""
    ai_model: str = "claude-sonnet-5"

    # Metadata / cloud STT
    youtube_api_key: str = ""
    deepgram_api_key: str = ""

    # Rate limits
    rate_limit_default: str = "120/minute"
    rate_limit_create: str = "10/minute"

    # Media working dir (audio downloads). Defaults to a temp dir so it also
    # works on read-only serverless filesystems.
    media_dir: Path = Path(tempfile.gettempdir()) / "transcriptai-media"

    @field_validator("frontend_origin")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origin.split(",") if o.strip()]

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def claude_enabled(self) -> bool:
        return self.ai_provider == "claude" and bool(self.ai_api_key)

    @property
    def has_proxy(self) -> bool:
        return bool(
            (self.webshare_proxy_username and self.webshare_proxy_password)
            or self.http_proxy_url
        )


def _absolutize_sqlite(url: str) -> str:
    """Make a relative sqlite path resolve against the backend dir, not the CWD."""
    prefix = "sqlite:///"
    if not url.startswith(prefix):
        return url
    raw = url[len(prefix) :]
    if raw.startswith(":memory:") or raw == "":
        return url
    path = Path(raw)
    if not path.is_absolute():
        path = (BACKEND_DIR / path).resolve()
    return f"{prefix}{path.as_posix()}"


def _safe_mkdir(path: Path) -> None:
    try:
        path.mkdir(parents=True, exist_ok=True)
    except OSError:  # read-only filesystem (serverless) — created lazily elsewhere
        pass


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.is_sqlite:
        s.database_url = _absolutize_sqlite(s.database_url)
        _safe_mkdir(Path(s.database_url[len("sqlite:///") :]).parent)
    _safe_mkdir(s.media_dir)
    return s


settings = get_settings()
