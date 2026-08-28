"""Shared FastAPI dependencies: DB session + auth principals."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import User

DbSession = Annotated[Session, Depends(get_db)]

_bearer = HTTPBearer(auto_error=False)
_optional_bearer = HTTPBearer(auto_error=False)


def _user_from_token(
    creds: HTTPAuthorizationCredentials | None, db: Session
) -> User | None:
    if creds is None:
        return None
    payload = decode_access_token(creds.credentials)
    if not payload or payload.get("type") != "access":
        return None
    user = db.get(User, payload.get("sub"))
    if user is None or not user.is_active:
        return None
    return user


def get_current_user(
    db: DbSession,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    user = _user_from_token(creds, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_optional_user(
    db: DbSession,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_optional_bearer)],
) -> User | None:
    return _user_from_token(creds, db)


def get_current_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated["User | None", Depends(get_optional_user)]
AdminUser = Annotated[User, Depends(get_current_admin)]
