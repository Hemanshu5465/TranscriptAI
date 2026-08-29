"""Best-effort deletion of an uploaded file from Vercel Blob.

Delegates to ``api/blob.js`` (which holds the Blob OIDC credentials). A failure
here never blocks deleting the transcript — the blob is just left orphaned.
"""
from __future__ import annotations

import logging

import httpx

from app.config.settings import settings

logger = logging.getLogger("app.blob")


def delete_blob(url: str) -> bool:
    if not url or not settings.can_delete_blobs:
        return False
    try:
        resp = httpx.request(
            "DELETE",
            f"{settings.self_base_url}/api/blob",
            headers={
                "x-blob-secret": settings.blob_admin_secret,
                "content-type": "application/json",
            },
            json={"action": "delete", "url": url},
            timeout=20.0,
        )
        if resp.status_code == 200:
            return True
        logger.warning("blob delete failed (%s): %s", resp.status_code, resp.text[:200])
    except httpx.HTTPError as exc:
        logger.warning("blob delete request failed: %s", exc)
    return False
