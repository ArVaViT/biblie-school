"""Tests for the /api/v1/courses endpoints."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.content_translation import ContentTranslation
from app.services.translation.orchestrator import OrchestratorReport
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
    def test_enroll_in_published_course(self, student_client: TestClient, client: TestClient):
        course = _create_course(client)
        client.put(f"{PREFIX}/{course['id']}", json={"status": "published"})

        resp = student_client.post(f"{PREFIX}/{course['id']}/enroll")
        assert resp.status_code == 200
        body = resp.json()
        assert body["course_id"] == course["id"]
        assert body["progress"] == 0

    def test_enroll_is_idempotent(self, student_client: TestClient, client: TestClient):
        course = _create_course(client)
        client.put(f"{PREFIX}/{course['id']}", json={"status": "published"})

        resp1 = student_client.post(f"{PREFIX}/{course['id']}/enroll")
        resp2 = student_client.post(f"{PREFIX}/{course['id']}/enroll")
        assert resp1.json()["id"] == resp2.json()["id"]

    def test_enroll_nonexistent_course_returns_404(self, student_client: TestClient):
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

    def test_clone_copies_chapter_blocks_and_essay_questions(self, client: TestClient):
        """Regression: clone must propagate storage pointers and essay hints.

        Before the audit fix, ``clone_course`` still referenced the retired
        ``file_url`` column and silently dropped ``min_words``, so any course
        with file blocks or essay prompts came back incomplete.
        """
        course = _create_course(client, title="Has Files & Essay")
        mod_resp = client.post(
            f"{PREFIX}/{course['id']}/modules",
            json={"title": "M1", "order_index": 1},
        )
        assert mod_resp.status_code == 201
        module_id = mod_resp.json()["id"]

        ch_resp = client.post(
            f"{PREFIX}/{course['id']}/modules/{module_id}/chapters",
            json={"title": "Ch1", "chapter_type": "quiz", "order_index": 1},
        )
        assert ch_resp.status_code == 201
        chapter_id = ch_resp.json()["id"]

        quiz_resp = client.post(
            "/api/v1/quizzes",
            json={
                "chapter_id": chapter_id,
                "title": "Essay Quiz",
                "passing_score": 60,
                "questions": [
                    {
                        "question_text": "Write an essay on Acts 2.",
                        "question_type": "essay",
                        "order_index": 1,
                        "points": 10,
                        "min_words": 150,
                        "options": [],
                    }
                ],
            },
        )
        assert quiz_resp.status_code == 201, quiz_resp.text

        block_resp = client.post(
            f"/api/v1/blocks/chapter/{chapter_id}",
            json={
                "block_type": "file",
                "order_index": 0,
                "file_bucket": "course-materials",
                "file_path": f"{chapter_id}/lecture.pdf",
                "file_name": "lecture.pdf",
            },
        )
        assert block_resp.status_code == 201, block_resp.text

        clone_resp = client.post(f"{PREFIX}/{course['id']}/clone")
        assert clone_resp.status_code == 201, clone_resp.text
        clone = clone_resp.json()

        cloned_chapter_id = clone["modules"][0]["chapters"][0]["id"]

        cloned_blocks = client.get(f"/api/v1/blocks/chapter/{cloned_chapter_id}").json()
        assert len(cloned_blocks) == 1
        assert cloned_blocks[0]["file_bucket"] == "course-materials"
        assert cloned_blocks[0]["file_path"].endswith("/lecture.pdf")
        assert cloned_blocks[0]["file_name"] == "lecture.pdf"

        cloned_quiz_resp = client.get(f"/api/v1/quizzes/chapter/{cloned_chapter_id}")
        assert cloned_quiz_resp.status_code == 200
        cloned_quiz = cloned_quiz_resp.json()
        assert cloned_quiz["questions"][0]["question_type"] == "essay"
        assert cloned_quiz["questions"][0]["min_words"] == 150


# ---------------------------------------------------------------------------
# Localized catalog (content_translations read path)
# ---------------------------------------------------------------------------


class TestCatalogLocalizedMetadata:
    def _seed_en_translations(self, db: Session, course_id: str) -> None:
        db.add(
            ContentTranslation(
                entity_type="course",
                entity_id=course_id,
                field="title",
                locale="en",
                text="English catalog title",
                source_hash="testhash",
                status="ok",
                origin="mt",
            )
        )
        db.add(
            ContentTranslation(
                entity_type="course",
                entity_id=course_id,
                field="description",
                locale="en",
                text="English catalog description",
                source_hash="testhash2",
                status="ok",
                origin="mt",
            )
        )
        db.commit()

    def test_list_applies_translations_for_accept_language(
        self,
        client: TestClient,
        db: Session,
        anon_client: TestClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(
            "app.api.v1.courses.crud.translate_course_metadata",
            lambda *args, **kwargs: OrchestratorReport(),
        )
        course = _create_course(
            client,
            title="Заголовок RU",
            description="Описание RU",
        )
        cid = course["id"]
        client.put(
            f"{PREFIX}/{cid}",
            json={"status": "published"},
        )
        self._seed_en_translations(db, cid)

        r_ru = anon_client.get(PREFIX, headers={"Accept-Language": "ru"})
        assert r_ru.status_code == 200
        row = next(c for c in r_ru.json() if c["id"] == cid)
        assert row["title"] == "Заголовок RU"
        assert row["description"] == "Описание RU"

        r_en = anon_client.get(PREFIX, headers={"Accept-Language": "en"})
        assert r_en.status_code == 200
        row_en = next(c for c in r_en.json() if c["id"] == cid)
        assert row_en["title"] == "English catalog title"
        assert row_en["description"] == "English catalog description"

    def test_get_detail_owner_sees_source_when_ui_is_en(
        self,
        client: TestClient,
        db: Session,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        # Do not request ``anon_client`` in the same test: it shares
        # ``app.dependency_overrides`` and whichever fixture runs last would
        # clobber the other's ``get_optional_user`` override.
        monkeypatch.setattr(
            "app.api.v1.courses.crud.translate_course_metadata",
            lambda *args, **kwargs: OrchestratorReport(),
        )
        course = _create_course(
            client,
            title="Заголовок RU",
            description="Описание RU",
        )
        cid = course["id"]
        client.put(f"{PREFIX}/{cid}", json={"status": "published"})
        self._seed_en_translations(db, cid)

        owner = client.get(
            f"{PREFIX}/{cid}",
            headers={"Accept-Language": "en"},
        )
        assert owner.status_code == 200
        assert owner.json()["title"] == "Заголовок RU"

    def test_get_detail_anon_sees_translated_metadata_with_accept_language(
        self,
        client: TestClient,
        db: Session,
        anon_client: TestClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(
            "app.api.v1.courses.crud.translate_course_metadata",
            lambda *args, **kwargs: OrchestratorReport(),
        )
        course = _create_course(
            client,
            title="Заголовок RU",
            description="Описание RU",
        )
        cid = course["id"]
        client.put(f"{PREFIX}/{cid}", json={"status": "published"})
        self._seed_en_translations(db, cid)

        r = anon_client.get(
            f"{PREFIX}/{cid}",
            headers={"Accept-Language": "en"},
        )
        assert r.status_code == 200
        assert r.json()["title"] == "English catalog title"
