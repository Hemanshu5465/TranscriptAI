"""Seed a demo user. Run from the backend/ directory:

    python -m database.seed.seed        (if database/ is on sys.path)
    python ../database/seed/seed.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from sqlalchemy import select  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db.session import session_scope  # noqa: E402
from app.models import User  # noqa: E402

DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "demopass123"


def main() -> None:
    with session_scope() as db:
        existing = db.scalar(select(User).where(User.email == DEMO_EMAIL))
        if existing:
            print(f"Demo user already exists: {DEMO_EMAIL}")
            return
        db.add(
            User(
                email=DEMO_EMAIL,
                password_hash=hash_password(DEMO_PASSWORD),
                full_name="Demo User",
                is_admin=True,
            )
        )
        print(f"Created demo user {DEMO_EMAIL} / {DEMO_PASSWORD} (admin)")


if __name__ == "__main__":
    main()
