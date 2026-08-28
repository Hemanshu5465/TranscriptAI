from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.schemas.video import VideoValidateOut
from app.services.youtube_service import validate_url

router = APIRouter(prefix="/videos", tags=["videos"])


@router.get("/validate", response_model=VideoValidateOut)
def validate(url: Annotated[str, Query(min_length=1, max_length=500)]) -> VideoValidateOut:
    return VideoValidateOut(**validate_url(url))
