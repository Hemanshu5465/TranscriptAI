"""Vercel serverless entrypoint for the FastAPI backend.

Vercel's @vercel/python runtime serves the ASGI ``app`` object exported here.
All routes are under ``/api`` (see ``vercel.json``), so the FastAPI app —
which already prefixes its router with ``/api/v1`` — is mounted as-is.
"""
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent.parent / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from app.main import app  # noqa: E402,F401  (exported for Vercel)
