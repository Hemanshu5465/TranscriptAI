from fastapi import APIRouter

from app.api.v1 import admin, auth, health, transcripts, videos

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(videos.router)
api_router.include_router(transcripts.router)
api_router.include_router(admin.router)

__all__ = ["api_router"]
