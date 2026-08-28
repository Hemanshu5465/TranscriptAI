"""FastAPI application factory for TranscriptAI."""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.api.v1 import api_router
from app.config.settings import settings
from app.core.rate_limit import limiter
from app.utils.youtube_url import InvalidYouTubeURL

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)

app = FastAPI(
    title="TranscriptAI API",
    description="Turn YouTube videos into accurate, editable scripts.",
    version="1.0.0",
)

app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RateLimitExceeded)
async def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "You've reached the current processing limit. Please try again later."},
    )


@app.exception_handler(RequestValidationError)
async def _validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = jsonable_encoder(exc.errors())
    first_msg = errors[0].get("msg", "Invalid request.") if errors else "Invalid request."
    return JSONResponse(status_code=422, content={"detail": first_msg, "errors": errors})


@app.exception_handler(InvalidYouTubeURL)
async def _bad_url_handler(request: Request, exc: InvalidYouTubeURL) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": "Please enter a valid YouTube URL."})


@app.get("/", tags=["health"])
def root() -> dict:
    return {"name": "TranscriptAI API", "docs": "/docs", "health": "/api/v1/healthz"}


app.include_router(api_router, prefix="/api/v1")


@app.on_event("startup")
def _startup() -> None:
    from app.db.bootstrap import ensure_schema

    ensure_schema()
    logging.getLogger("app").info(
        "TranscriptAI up — queue=%s provider=%s ai=%s proxy=%s",
        settings.job_queue,
        settings.transcription_provider,
        "claude" if settings.claude_enabled else "rule_based",
        settings.has_proxy,
    )
