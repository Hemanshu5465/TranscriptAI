def test_register_login_me(client):
    r = client.post(
        "/api/v1/auth/register",
        json={"email": "Alice@Example.com", "password": "hunter2hunter"},
    )
    assert r.status_code == 201
    token = r.json()["access_token"]
    assert r.json()["user"]["email"] == "alice@example.com"

    dup = client.post(
        "/api/v1/auth/register",
        json={"email": "alice@example.com", "password": "hunter2hunter"},
    )
    assert dup.status_code == 409

    bad = client.post(
        "/api/v1/auth/login", json={"email": "alice@example.com", "password": "wrong"}
    )
    assert bad.status_code == 401

    ok = client.post(
        "/api/v1/auth/login", json={"email": "alice@example.com", "password": "hunter2hunter"}
    )
    assert ok.status_code == 200

    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "alice@example.com"


def test_me_requires_auth(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_short_password_rejected(client):
    r = client.post("/api/v1/auth/register", json={"email": "b@e.com", "password": "short"})
    assert r.status_code == 422
