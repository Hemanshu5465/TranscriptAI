"""slowapi limiter, keyed by authenticated user id when available else client IP."""
from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config.settings import settings
from app.core.security import decode_access_token


def _key(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        payload = decode_access_token(auth[7:])
        if payload and payload.get("sub"):
            return f"user:{payload['sub']}"
    return f"ip:{get_remote_address(request)}"


limiter = Limiter(key_func=_key, default_limits=[settings.rate_limit_default])
