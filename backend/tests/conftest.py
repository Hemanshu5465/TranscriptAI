from __future__ import annotations

import os
import tempfile
from collections.abc import Iterator

import pytest

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("AI_PROVIDER", "rule_based")
os.environ.setdefault("TRANSCRIPTION_FALLBACK", "false")

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"

from fastapi.testclient import TestClient  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _create_schema() -> Iterator[None]:
    import app.models  # noqa: F401

    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth_client(client: TestClient) -> TestClient:
    import uuid

    email = f"user-{uuid.uuid4().hex[:8]}@example.com"
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret1", "full_name": "Test"},
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client
