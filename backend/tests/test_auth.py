"""Tests for authentication and the /api/v1/auth endpoints."""

from fastapi.testclient import TestClient

from tests.conftest import TEACHER_ID


class TestAuthMe:
    def test_me_returns_user_info(self, client: TestClient):
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == str(TEACHER_ID)
        assert body["email"] == "teacher@example.com"
        assert body["role"] == "teacher"

    def test_me_without_token_returns_401(self, anon_client: TestClient):
        resp = anon_client.get("/api/v1/auth/me")
        assert resp.status_code == 401
