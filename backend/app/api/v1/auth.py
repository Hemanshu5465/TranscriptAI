from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DbSession
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.schemas import AuthResponse, LoginRequest, RegisterRequest, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: DbSession) -> AuthResponse:
    email = payload.email.lower().strip()
    exists = db.scalar(select(User).where(func.lower(User.email) == email))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")

    is_first = db.scalar(select(func.count()).select_from(User)) == 0
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        is_admin=is_first,  # bootstrap: first registered user is an admin
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthResponse(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: DbSession) -> AuthResponse:
    user = db.scalar(select(User).where(func.lower(User.email) == payload.email.lower().strip()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is disabled.")
    return AuthResponse(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(user: CurrentUser) -> None:
    # Stateless JWT: the client discards the token. Endpoint exists for symmetry
    # and future refresh-token revocation.
    return None


@router.post("/forgot-password", status_code=status.HTTP_501_NOT_IMPLEMENTED)
def forgot_password() -> None:
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Password reset is not enabled yet.")
