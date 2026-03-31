"""Tests for the /api/v1/courses endpoints."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import TEACHER_ID

PREFIX = "/api/v1/courses"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_course(client: TestClient, **overrides) -> dict:
    payload = {"title": "Genesis Overview", "description": "An intro course"}
    payload.update(overrides)
    resp = client.post(PREFIX, json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


class TestCreateCourse:
    def test_create_returns_201(self, client: TestClient):
        data = _create_course(client)
        assert data["title"] == "Genesis Overview"
        assert data["status"] == "draft"
        assert data["created_by"] == str(TEACHER_ID)

    def test_create_without_title_returns_422(self, client: TestClient):
        resp = client.post(PREFIX, json={"description": "no title"})
        assert resp.status_code == 422


class TestListCourses:
    def test_empty_list(self, client: TestClient):
        resp = client.get(PREFIX)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_lists_published_courses(self, client: TestClient):
        course = _create_course(client)
        course_id = course["id"]

        client.put(
            f"{PREFIX}/{course_id}",
            json={"status": "published"},
        )

        resp = client.get(PREFIX)
        assert resp.status_code == 200
        ids = [c["id"] for c in resp.json()]
        assert course_id in ids

    def test_draft_courses_not_listed(self, client: TestClient):
        _create_course(client)
        resp = client.get(PREFIX)
        assert resp.status_code == 200
        assert resp.json() == []


class TestGetCourse:
    def test_get_existing_course(self, client: TestClient):
        course = _create_course(client)
        resp = client.get(f"{PREFIX}/{course['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == course["id"]

    def test_get_nonexistent_returns_404(self, client: TestClient):
        resp = client.get(f"{PREFIX}/nonexistent-id")
        assert resp.status_code == 404


class TestUpdateCourse:
    def test_update_title(self, client: TestClient):
        course = _create_course(client)
        resp = client.put(
            f"{PREFIX}/{course['id']}",
            json={"title": "Updated Title"},
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Title"

    def test_publish_course(self, client: TestClient):
        course = _create_course(client)
        resp = client.put(
            f"{PREFIX}/{course['id']}",
            json={"status": "published"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "published"

    def test_update_nonexistent_returns_404(self, client: TestClient):
        resp = client.put(
            f"{PREFIX}/nonexistent-id",
            json={"title": "Nope"},
        )
        assert resp.status_code == 404


class TestDeleteCourse:
    def test_delete_existing_course(self, client: TestClient):
        course = _create_course(client)
        resp = client.delete(f"{PREFIX}/{course['id']}")
        assert resp.status_code == 204

        resp = client.get(f"{PREFIX}/{course['id']}")
        assert resp.status_code == 404

    def test_delete_nonexistent_returns_404(self, client: TestClient):
        resp = client.delete(f"{PREFIX}/nonexistent-id")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Enrollment
# ---------------------------------------------------------------------------


class TestEnrollment:
    def test_enroll_in_published_course(
        self, student_client: TestClient, client: TestClient
    ):
        course = _create_course(client)
        client.put(f"{PREFIX}/{course['id']}", json={"status": "published"})

        resp = student_client.post(f"{PREFIX}/{course['id']}/enroll")
        assert resp.status_code == 200
        body = resp.json()
        assert body["course_id"] == course["id"]
        assert body["progress"] == 0

    def test_enroll_is_idempotent(
        self, student_client: TestClient, client: TestClient
    ):
        course = _create_course(client)
        client.put(f"{PREFIX}/{course['id']}", json={"status": "published"})

        resp1 = student_client.post(f"{PREFIX}/{course['id']}/enroll")
        resp2 = student_client.post(f"{PREFIX}/{course['id']}/enroll")
        assert resp1.json()["id"] == resp2.json()["id"]

    def test_enroll_nonexistent_course_returns_404(
        self, student_client: TestClient
    ):
        resp = student_client.post(f"{PREFIX}/nonexistent-id/enroll")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Clone
# ---------------------------------------------------------------------------


class TestCloneCourse:
    def test_clone_own_course(self, client: TestClient):
        course = _create_course(client, title="Original")
        resp = client.post(f"{PREFIX}/{course['id']}/clone")
        assert resp.status_code == 201
        clone = resp.json()
        assert clone["id"] != course["id"]
        assert "Copy" in clone["title"]
        assert clone["status"] == "draft"

    def test_clone_nonexistent_returns_404(self, client: TestClient):
        resp = client.post(f"{PREFIX}/nonexistent-id/clone")
        assert resp.status_code == 404
