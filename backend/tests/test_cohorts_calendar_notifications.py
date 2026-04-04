"""Tests for Cohorts, Calendar Events, Notifications, and Announcements endpoints."""

import uuid
from datetime import datetime, timezone, timedelta

import pytest
import sqlalchemy.types as _sa_types
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import TEACHER_ID, STUDENT_ID
from app.models.course import Course, Module, Chapter
from app.models.enrollment import Enrollment
from app.models.cohort import Cohort
from app.models.course_event import CourseEvent
from app.models.notification import Notification
from app.models.announcement import Announcement

# ---------------------------------------------------------------------------
# SQLite compatibility: Uuid.bind_processor expects uuid.UUID objects but
# routers pass plain strings for UUID path parameters.  PostgreSQL casts
# implicitly; SQLite does not.  Patch once at import time.
# ---------------------------------------------------------------------------
_orig_uuid_bp = _sa_types.Uuid.bind_processor

def _uuid_bp_accepting_strings(self, dialect):
    processor = _orig_uuid_bp(self, dialect)
    if processor is None:
        return None
    def _process(value):
        if isinstance(value, str):
            try:
                value = uuid.UUID(value)
            except ValueError:
                pass
        return processor(value)
    return _process

_sa_types.Uuid.bind_processor = _uuid_bp_accepting_strings

COHORT_PREFIX = "/api/v1/cohorts"
CALENDAR_PREFIX = "/api/v1/calendar"
COURSES_PREFIX = "/api/v1/courses"
NOTIFICATION_PREFIX = "/api/v1/notifications"
ANNOUNCEMENT_PREFIX = "/api/v1/announcements"

NOW = datetime.now(timezone.utc)
TOMORROW = NOW + timedelta(days=1)
NEXT_WEEK = NOW + timedelta(weeks=1)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _seed_course(db: Session, *, course_id: str = "test-course-1", owner_id=TEACHER_ID) -> Course:
    course = Course(
        id=course_id,
        title="Test Course",
        description="A test course",
        status="published",
        created_by=owner_id,
        quiz_weight=30,
        assignment_weight=50,
        participation_weight=20,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def _seed_enrollment(db: Session, *, user_id=STUDENT_ID, course_id: str = "test-course-1",
                     cohort_id=None) -> Enrollment:
    enrollment = Enrollment(
        id=f"enroll-{uuid.uuid4().hex[:8]}",
        user_id=user_id,
        course_id=course_id,
        cohort_id=cohort_id,
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment


def _create_course_via_api(client: TestClient) -> dict:
    resp = client.post(COURSES_PREFIX, json={"title": "API Course", "description": "via API"})
    assert resp.status_code == 201, resp.text
    return resp.json()


def _cohort_payload(**overrides) -> dict:
    data = {
        "name": "Spring 2026",
        "start_date": NOW.isoformat(),
        "end_date": NEXT_WEEK.isoformat(),
    }
    data.update(overrides)
    return data


def _event_payload(**overrides) -> dict:
    data = {
        "title": "Midterm Exam",
        "description": "Covers chapters 1-5",
        "event_type": "exam",
        "event_date": TOMORROW.isoformat(),
    }
    data.update(overrides)
    return data


def _announcement_payload(**overrides) -> dict:
    data = {
        "title": "Welcome everyone!",
        "content": "We are glad to have you in this course.",
    }
    data.update(overrides)
    return data


# ===========================================================================
# COHORT TESTS
# ===========================================================================


class TestListCohorts:
    def test_empty_list(self, client: TestClient, db: Session):
        _seed_course(db)
        resp = client.get(f"{COHORT_PREFIX}/course/test-course-1")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_cohorts_for_course(self, client: TestClient, db: Session):
        course = _create_course_via_api(client)
        cid = course["id"]
        client.post(f"{COHORT_PREFIX}/course/{cid}", json=_cohort_payload(name="Cohort A"))
        client.post(f"{COHORT_PREFIX}/course/{cid}", json=_cohort_payload(name="Cohort B"))

        resp = client.get(f"{COHORT_PREFIX}/course/{cid}")
        assert resp.status_code == 200
        names = {c["name"] for c in resp.json()}
        assert names == {"Cohort A", "Cohort B"}

    def test_does_not_return_cohorts_from_other_courses(self, client: TestClient, db: Session):
        c1 = _create_course_via_api(client)
        c2_resp = client.post(COURSES_PREFIX, json={"title": "Other", "description": "other"})
        c2 = c2_resp.json()

        client.post(f"{COHORT_PREFIX}/course/{c1['id']}", json=_cohort_payload(name="C1 Cohort"))
        client.post(f"{COHORT_PREFIX}/course/{c2['id']}", json=_cohort_payload(name="C2 Cohort"))

        resp = client.get(f"{COHORT_PREFIX}/course/{c1['id']}")
        names = [c["name"] for c in resp.json()]
        assert names == ["C1 Cohort"]


class TestCreateCohort:
    def test_create_returns_201(self, client: TestClient):
        course = _create_course_via_api(client)
        resp = client.post(
            f"{COHORT_PREFIX}/course/{course['id']}",
            json=_cohort_payload(),
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "Spring 2026"
        assert body["status"] == "upcoming"
        assert body["course_id"] == course["id"]
        assert body["student_count"] == 0

    def test_create_with_optional_fields(self, client: TestClient):
        course = _create_course_via_api(client)
        payload = _cohort_payload(
            enrollment_start=NOW.isoformat(),
            enrollment_end=TOMORROW.isoformat(),
            max_students=30,
        )
        resp = client.post(f"{COHORT_PREFIX}/course/{course['id']}", json=payload)
        assert resp.status_code == 201
        body = resp.json()
        assert body["max_students"] == 30
        assert body["enrollment_start"] is not None

    def test_student_cannot_create_cohort(self, student_client: TestClient, db: Session):
        _seed_course(db)
        resp = student_client.post(
            f"{COHORT_PREFIX}/course/test-course-1",
            json=_cohort_payload(),
        )
        assert resp.status_code == 403

    def test_create_for_nonexistent_course_returns_404(self, client: TestClient):
        resp = client.post(
            f"{COHORT_PREFIX}/course/no-such-course",
            json=_cohort_payload(),
        )
        assert resp.status_code == 404

    def test_create_missing_name_returns_422(self, client: TestClient):
        course = _create_course_via_api(client)
        resp = client.post(
            f"{COHORT_PREFIX}/course/{course['id']}",
            json={"start_date": NOW.isoformat(), "end_date": NEXT_WEEK.isoformat()},
        )
        assert resp.status_code == 422


class TestUpdateCohort:
    def _create_cohort(self, client, course_id):
        resp = client.post(f"{COHORT_PREFIX}/course/{course_id}", json=_cohort_payload())
        assert resp.status_code == 201
        return resp.json()

    def test_update_name(self, client: TestClient):
        course = _create_course_via_api(client)
        cohort = self._create_cohort(client, course["id"])
        resp = client.put(
            f"{COHORT_PREFIX}/{cohort['id']}",
            json={"name": "Fall 2026"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Fall 2026"

    def test_update_status(self, client: TestClient):
        course = _create_course_via_api(client)
        cohort = self._create_cohort(client, course["id"])
        resp = client.put(
            f"{COHORT_PREFIX}/{cohort['id']}",
            json={"status": "active"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"

    def test_update_nonexistent_returns_404(self, client: TestClient):
        resp = client.put(
            f"{COHORT_PREFIX}/{uuid.uuid4()}",
            json={"name": "Nope"},
        )
        assert resp.status_code == 404

    def test_student_cannot_update(self, student_client: TestClient, db: Session):
        _seed_course(db)
        cohort = Cohort(
            course_id="test-course-1", name="X",
            start_date=NOW, end_date=NEXT_WEEK,
        )
        db.add(cohort)
        db.commit()
        db.refresh(cohort)

        resp = student_client.put(
            f"{COHORT_PREFIX}/{cohort.id}",
            json={"name": "Hacked"},
        )
        assert resp.status_code == 403


class TestDeleteCohort:
    def test_delete_returns_204(self, client: TestClient):
        course = _create_course_via_api(client)
        resp = client.post(f"{COHORT_PREFIX}/course/{course['id']}", json=_cohort_payload())
        cohort_id = resp.json()["id"]

        resp = client.delete(f"{COHORT_PREFIX}/{cohort_id}")
        assert resp.status_code == 204

        resp = client.get(f"{COHORT_PREFIX}/course/{course['id']}")
        assert resp.json() == []

    def test_delete_nonexistent_returns_404(self, client: TestClient):
        resp = client.delete(f"{COHORT_PREFIX}/{uuid.uuid4()}")
        assert resp.status_code == 404

    def test_student_cannot_delete(self, student_client: TestClient, db: Session):
        _seed_course(db)
        cohort = Cohort(
            course_id="test-course-1", name="X",
            start_date=NOW, end_date=NEXT_WEEK,
        )
        db.add(cohort)
        db.commit()
        db.refresh(cohort)

        resp = student_client.delete(f"{COHORT_PREFIX}/{cohort.id}")
        assert resp.status_code == 403


class TestCohortStudents:
    def test_empty_roster(self, client: TestClient):
        course = _create_course_via_api(client)
        resp = client.post(f"{COHORT_PREFIX}/course/{course['id']}", json=_cohort_payload())
        cohort_id = resp.json()["id"]

        resp = client.get(f"{COHORT_PREFIX}/{cohort_id}/students")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_roster_includes_enrolled_student(self, client: TestClient, db: Session, student):
        course = _create_course_via_api(client)
        cid = course["id"]
        resp = client.post(f"{COHORT_PREFIX}/course/{cid}", json=_cohort_payload())
        cohort_id = resp.json()["id"]

        _seed_enrollment(db, course_id=cid, cohort_id=cohort_id)

        resp = client.get(f"{COHORT_PREFIX}/{cohort_id}/students")
        assert resp.status_code == 200
        students = resp.json()
        assert len(students) == 1
        assert students[0]["user_id"] == str(STUDENT_ID)

    def test_nonexistent_cohort_returns_404(self, client: TestClient):
        resp = client.get(f"{COHORT_PREFIX}/{uuid.uuid4()}/students")
        assert resp.status_code == 404

    def test_student_cannot_view_roster(self, student_client: TestClient, db: Session):
        _seed_course(db)
        cohort = Cohort(
            course_id="test-course-1", name="X",
            start_date=NOW, end_date=NEXT_WEEK,
        )
        db.add(cohort)
        db.commit()
        db.refresh(cohort)

        resp = student_client.get(f"{COHORT_PREFIX}/{cohort.id}/students")
        assert resp.status_code == 403


class TestCompleteCohort:
    def test_complete_sets_status(self, client: TestClient):
        course = _create_course_via_api(client)
        resp = client.post(f"{COHORT_PREFIX}/course/{course['id']}", json=_cohort_payload())
        cohort_id = resp.json()["id"]

        resp = client.post(f"{COHORT_PREFIX}/{cohort_id}/complete")
        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"

    def test_complete_already_completed_returns_400(self, client: TestClient):
        course = _create_course_via_api(client)
        resp = client.post(f"{COHORT_PREFIX}/course/{course['id']}", json=_cohort_payload())
        cohort_id = resp.json()["id"]

        client.post(f"{COHORT_PREFIX}/{cohort_id}/complete")
        resp = client.post(f"{COHORT_PREFIX}/{cohort_id}/complete")
        assert resp.status_code == 400
        assert "already completed" in resp.json()["detail"].lower()

    def test_complete_nonexistent_returns_404(self, client: TestClient):
        resp = client.post(f"{COHORT_PREFIX}/{uuid.uuid4()}/complete")
        assert resp.status_code == 404

    def test_student_cannot_complete(self, student_client: TestClient, db: Session):
        _seed_course(db)
        cohort = Cohort(
            course_id="test-course-1", name="X",
            start_date=NOW, end_date=NEXT_WEEK,
        )
        db.add(cohort)
        db.commit()
        db.refresh(cohort)

        resp = student_client.post(f"{COHORT_PREFIX}/{cohort.id}/complete")
        assert resp.status_code == 403


# ===========================================================================
# CALENDAR / COURSE EVENT TESTS
# ===========================================================================


class TestCalendarAggregatedEvents:
    def test_no_enrollments_returns_empty(self, client: TestClient):
        resp = client.get(f"{CALENDAR_PREFIX}/events")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_course_events_for_enrolled_user(self, client: TestClient, db: Session):
        course = _create_course_via_api(client)
        cid = course["id"]
        _seed_enrollment(db, user_id=TEACHER_ID, course_id=cid)

        client.post(f"{COURSES_PREFIX}/{cid}/events", json=_event_payload())

        resp = client.get(f"{CALENDAR_PREFIX}/events")
        assert resp.status_code == 200
        events = resp.json()
        assert len(events) >= 1
        sources = {e["source"] for e in events}
        assert "course_event" in sources

    def test_filter_by_course_id(self, client: TestClient, db: Session):
        c1 = _create_course_via_api(client)
        c2_resp = client.post(COURSES_PREFIX, json={"title": "Other", "description": "x"})
        c2 = c2_resp.json()

        _seed_enrollment(db, user_id=TEACHER_ID, course_id=c1["id"])
        _seed_enrollment(db, user_id=TEACHER_ID, course_id=c2["id"])

        client.post(f"{COURSES_PREFIX}/{c1['id']}/events", json=_event_payload(title="E1"))
        client.post(f"{COURSES_PREFIX}/{c2['id']}/events", json=_event_payload(title="E2"))

        resp = client.get(f"{CALENDAR_PREFIX}/events", params={"course_id": c1["id"]})
        assert resp.status_code == 200
        titles = [e["title"] for e in resp.json()]
        assert "E1" in titles
        assert "E2" not in titles

    def test_includes_module_deadlines(self, client: TestClient, db: Session):
        course = _create_course_via_api(client)
        cid = course["id"]
        _seed_enrollment(db, user_id=TEACHER_ID, course_id=cid)

        mod = Module(id="mod-1", course_id=cid, title="Module 1", order_index=0, due_date=TOMORROW)
        db.add(mod)
        db.commit()

        resp = client.get(f"{CALENDAR_PREFIX}/events")
        assert resp.status_code == 200
        sources = [e["source"] for e in resp.json()]
        assert "module_deadline" in sources


class TestCreateCourseEvent:
    def test_create_returns_201(self, client: TestClient):
        course = _create_course_via_api(client)
        resp = client.post(
            f"{COURSES_PREFIX}/{course['id']}/events",
            json=_event_payload(),
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["title"] == "Midterm Exam"
        assert body["event_type"] == "exam"
        assert body["course_id"] == course["id"]
        assert body["created_by"] == str(TEACHER_ID)

    def test_student_cannot_create_event(self, student_client: TestClient, db: Session):
        _seed_course(db)
        resp = student_client.post(
            f"{COURSES_PREFIX}/test-course-1/events",
            json=_event_payload(),
        )
        assert resp.status_code == 403

    def test_create_for_nonexistent_course(self, client: TestClient):
        resp = client.post(
            f"{COURSES_PREFIX}/no-such-course/events",
            json=_event_payload(),
        )
        assert resp.status_code == 404

    def test_create_missing_title_returns_422(self, client: TestClient):
        course = _create_course_via_api(client)
        resp = client.post(
            f"{COURSES_PREFIX}/{course['id']}/events",
            json={"event_date": TOMORROW.isoformat()},
        )
        assert resp.status_code == 422


class TestListCourseEvents:
    def test_owner_can_list(self, client: TestClient):
        course = _create_course_via_api(client)
        client.post(f"{COURSES_PREFIX}/{course['id']}/events", json=_event_payload(title="E1"))
        client.post(f"{COURSES_PREFIX}/{course['id']}/events", json=_event_payload(title="E2"))

        resp = client.get(f"{COURSES_PREFIX}/{course['id']}/events")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_enrolled_student_can_list(self, student_client: TestClient, db: Session):
        _seed_course(db)
        _seed_enrollment(db, user_id=STUDENT_ID, course_id="test-course-1")

        ev = CourseEvent(
            course_id="test-course-1", title="Lecture",
            event_type="live_session", event_date=TOMORROW,
            created_by=TEACHER_ID,
        )
        db.add(ev)
        db.commit()

        resp = student_client.get(f"{COURSES_PREFIX}/test-course-1/events")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_unenrolled_student_gets_403(self, student_client: TestClient, db: Session):
        _seed_course(db)
        resp = student_client.get(f"{COURSES_PREFIX}/test-course-1/events")
        assert resp.status_code == 403

    def test_nonexistent_course_returns_404(self, client: TestClient):
        resp = client.get(f"{COURSES_PREFIX}/no-such-course/events")
        assert resp.status_code == 404

    def test_empty_events_list(self, client: TestClient):
        course = _create_course_via_api(client)
        resp = client.get(f"{COURSES_PREFIX}/{course['id']}/events")
        assert resp.status_code == 200
        assert resp.json() == []


class TestUpdateCourseEvent:
    def _setup(self, client):
        course = _create_course_via_api(client)
        resp = client.post(
            f"{COURSES_PREFIX}/{course['id']}/events",
            json=_event_payload(),
        )
        event = resp.json()
        return course["id"], event["id"]

    def test_update_title(self, client: TestClient):
        course_id, event_id = self._setup(client)
        resp = client.put(
            f"{COURSES_PREFIX}/{course_id}/events/{event_id}",
            json={"title": "Final Exam"},
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Final Exam"

    def test_update_event_type(self, client: TestClient):
        course_id, event_id = self._setup(client)
        resp = client.put(
            f"{COURSES_PREFIX}/{course_id}/events/{event_id}",
            json={"event_type": "live_session"},
        )
        assert resp.status_code == 200
        assert resp.json()["event_type"] == "live_session"

    def test_update_nonexistent_event_returns_404(self, client: TestClient):
        course = _create_course_via_api(client)
        resp = client.put(
            f"{COURSES_PREFIX}/{course['id']}/events/{uuid.uuid4()}",
            json={"title": "Nope"},
        )
        assert resp.status_code == 404

    def test_student_cannot_update(self, student_client: TestClient, db: Session):
        _seed_course(db)
        ev = CourseEvent(
            course_id="test-course-1", title="Lecture",
            event_type="other", event_date=TOMORROW,
            created_by=TEACHER_ID,
        )
        db.add(ev)
        db.commit()
        db.refresh(ev)

        resp = student_client.put(
            f"{COURSES_PREFIX}/test-course-1/events/{ev.id}",
            json={"title": "Hacked"},
        )
        assert resp.status_code == 403


class TestDeleteCourseEvent:
    def test_delete_returns_204(self, client: TestClient):
        course = _create_course_via_api(client)
        resp = client.post(
            f"{COURSES_PREFIX}/{course['id']}/events",
            json=_event_payload(),
        )
        event_id = resp.json()["id"]

        resp = client.delete(f"{COURSES_PREFIX}/{course['id']}/events/{event_id}")
        assert resp.status_code == 204

        resp = client.get(f"{COURSES_PREFIX}/{course['id']}/events")
        assert resp.json() == []

    def test_delete_nonexistent_returns_404(self, client: TestClient):
        course = _create_course_via_api(client)
        resp = client.delete(f"{COURSES_PREFIX}/{course['id']}/events/{uuid.uuid4()}")
        assert resp.status_code == 404

    def test_student_cannot_delete(self, student_client: TestClient, db: Session):
        _seed_course(db)
        ev = CourseEvent(
            course_id="test-course-1", title="Lecture",
            event_type="other", event_date=TOMORROW,
            created_by=TEACHER_ID,
        )
        db.add(ev)
        db.commit()
        db.refresh(ev)

        resp = student_client.delete(f"{COURSES_PREFIX}/test-course-1/events/{ev.id}")
        assert resp.status_code == 403


# ===========================================================================
# NOTIFICATION TESTS
# ===========================================================================


def _seed_notification(db: Session, *, user_id=TEACHER_ID, is_read=False,
                       title="Test Notification") -> Notification:
    n = Notification(
        user_id=user_id,
        type="info",
        title=title,
        message="Test message body",
        is_read=is_read,
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


class TestListNotifications:
    def test_empty_list(self, client: TestClient):
        resp = client.get(NOTIFICATION_PREFIX)
        assert resp.status_code == 200
        body = resp.json()
        assert body["items"] == []
        assert body["total"] == 0

    def test_returns_user_notifications(self, client: TestClient, db: Session):
        _seed_notification(db, user_id=TEACHER_ID, title="N1")
        _seed_notification(db, user_id=TEACHER_ID, title="N2")

        resp = client.get(NOTIFICATION_PREFIX)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 2
        assert len(body["items"]) == 2

    def test_does_not_return_other_users_notifications(self, client: TestClient, db: Session, student):
        _seed_notification(db, user_id=TEACHER_ID, title="Mine")
        _seed_notification(db, user_id=STUDENT_ID, title="Theirs")

        resp = client.get(NOTIFICATION_PREFIX)
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["title"] == "Mine"

    def test_pagination(self, client: TestClient, db: Session):
        for i in range(5):
            _seed_notification(db, user_id=TEACHER_ID, title=f"N{i}")

        resp = client.get(NOTIFICATION_PREFIX, params={"page": 1, "page_size": 2})
        body = resp.json()
        assert body["total"] == 5
        assert len(body["items"]) == 2
        assert body["page"] == 1
        assert body["page_size"] == 2

        resp = client.get(NOTIFICATION_PREFIX, params={"page": 3, "page_size": 2})
        body = resp.json()
        assert len(body["items"]) == 1


class TestUnreadCount:
    def test_zero_when_none(self, client: TestClient):
        resp = client.get(f"{NOTIFICATION_PREFIX}/unread-count")
        assert resp.status_code == 200
        assert resp.json()["count"] == 0

    def test_counts_only_unread(self, client: TestClient, db: Session):
        _seed_notification(db, user_id=TEACHER_ID, is_read=False)
        _seed_notification(db, user_id=TEACHER_ID, is_read=False)
        _seed_notification(db, user_id=TEACHER_ID, is_read=True)

        resp = client.get(f"{NOTIFICATION_PREFIX}/unread-count")
        assert resp.json()["count"] == 2

    def test_ignores_other_users(self, client: TestClient, db: Session, student):
        _seed_notification(db, user_id=TEACHER_ID, is_read=False)
        _seed_notification(db, user_id=STUDENT_ID, is_read=False)

        resp = client.get(f"{NOTIFICATION_PREFIX}/unread-count")
        assert resp.json()["count"] == 1


class TestMarkOneRead:
    def test_marks_as_read(self, client: TestClient, db: Session):
        n = _seed_notification(db, user_id=TEACHER_ID, is_read=False)

        resp = client.patch(f"{NOTIFICATION_PREFIX}/{n.id}/read")
        assert resp.status_code == 200
        assert resp.json()["is_read"] is True

    def test_already_read_stays_read(self, client: TestClient, db: Session):
        n = _seed_notification(db, user_id=TEACHER_ID, is_read=True)

        resp = client.patch(f"{NOTIFICATION_PREFIX}/{n.id}/read")
        assert resp.status_code == 200
        assert resp.json()["is_read"] is True

    def test_nonexistent_returns_404(self, client: TestClient):
        resp = client.patch(f"{NOTIFICATION_PREFIX}/{uuid.uuid4()}/read")
        assert resp.status_code == 404

    def test_cannot_mark_other_users_notification(self, client: TestClient, db: Session, student):
        n = _seed_notification(db, user_id=STUDENT_ID, is_read=False)

        resp = client.patch(f"{NOTIFICATION_PREFIX}/{n.id}/read")
        assert resp.status_code == 404


class TestMarkAllRead:
    def test_marks_all_read(self, client: TestClient, db: Session):
        _seed_notification(db, user_id=TEACHER_ID, is_read=False)
        _seed_notification(db, user_id=TEACHER_ID, is_read=False)

        resp = client.post(f"{NOTIFICATION_PREFIX}/read-all")
        assert resp.status_code == 200

        resp = client.get(f"{NOTIFICATION_PREFIX}/unread-count")
        assert resp.json()["count"] == 0

    def test_does_not_affect_other_users(self, client: TestClient, db: Session, student):
        _seed_notification(db, user_id=TEACHER_ID, is_read=False)
        _seed_notification(db, user_id=STUDENT_ID, is_read=False)

        client.post(f"{NOTIFICATION_PREFIX}/read-all")

        still_unread = db.query(Notification).filter(
            Notification.user_id == STUDENT_ID,
            Notification.is_read == False,
        ).count()
        assert still_unread == 1

    def test_idempotent_when_already_read(self, client: TestClient, db: Session):
        _seed_notification(db, user_id=TEACHER_ID, is_read=True)
        resp = client.post(f"{NOTIFICATION_PREFIX}/read-all")
        assert resp.status_code == 200


class TestDeleteNotification:
    def test_delete_returns_204(self, client: TestClient, db: Session):
        n = _seed_notification(db, user_id=TEACHER_ID)

        resp = client.delete(f"{NOTIFICATION_PREFIX}/{n.id}")
        assert resp.status_code == 204

        resp = client.get(NOTIFICATION_PREFIX)
        assert resp.json()["total"] == 0

    def test_delete_nonexistent_returns_404(self, client: TestClient):
        resp = client.delete(f"{NOTIFICATION_PREFIX}/{uuid.uuid4()}")
        assert resp.status_code == 404

    def test_cannot_delete_other_users_notification(self, client: TestClient, db: Session, student):
        n = _seed_notification(db, user_id=STUDENT_ID)

        resp = client.delete(f"{NOTIFICATION_PREFIX}/{n.id}")
        assert resp.status_code == 404


# ===========================================================================
# ANNOUNCEMENT TESTS
# ===========================================================================


class TestListAnnouncements:
    def test_empty_list(self, client: TestClient):
        resp = client.get(ANNOUNCEMENT_PREFIX)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_all_announcements(self, client: TestClient):
        client.post(ANNOUNCEMENT_PREFIX, json=_announcement_payload(title="A1"))
        client.post(ANNOUNCEMENT_PREFIX, json=_announcement_payload(title="A2"))

        resp = client.get(ANNOUNCEMENT_PREFIX)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_filter_by_course_id(self, client: TestClient):
        course = _create_course_via_api(client)
        cid = course["id"]

        client.post(ANNOUNCEMENT_PREFIX, json=_announcement_payload(title="Global", course_id=None))
        client.post(ANNOUNCEMENT_PREFIX, json=_announcement_payload(title="Course-specific", course_id=cid))

        resp = client.get(ANNOUNCEMENT_PREFIX, params={"course_id": cid})
        assert resp.status_code == 200
        titles = [a["title"] for a in resp.json()]
        assert "Course-specific" in titles
        assert "Global" not in titles

    def test_no_filter_returns_all(self, client: TestClient):
        course = _create_course_via_api(client)
        client.post(ANNOUNCEMENT_PREFIX, json=_announcement_payload(title="Global"))
        client.post(ANNOUNCEMENT_PREFIX, json=_announcement_payload(title="Specific", course_id=course["id"]))

        resp = client.get(ANNOUNCEMENT_PREFIX)
        assert len(resp.json()) == 2


class TestCreateAnnouncement:
    def test_create_global_returns_201(self, client: TestClient):
        resp = client.post(ANNOUNCEMENT_PREFIX, json=_announcement_payload())
        assert resp.status_code == 201
        body = resp.json()
        assert body["title"] == "Welcome everyone!"
        assert body["created_by"] == str(TEACHER_ID)
        assert body["course_id"] is None

    def test_create_course_specific(self, client: TestClient):
        course = _create_course_via_api(client)
        resp = client.post(
            ANNOUNCEMENT_PREFIX,
            json=_announcement_payload(course_id=course["id"]),
        )
        assert resp.status_code == 201
        assert resp.json()["course_id"] == course["id"]

    def test_student_cannot_create(self, student_client: TestClient):
        resp = student_client.post(ANNOUNCEMENT_PREFIX, json=_announcement_payload())
        assert resp.status_code == 403

    def test_create_for_nonexistent_course_returns_404(self, client: TestClient):
        resp = client.post(
            ANNOUNCEMENT_PREFIX,
            json=_announcement_payload(course_id="nonexistent-course"),
        )
        assert resp.status_code == 404

    def test_create_missing_title_returns_422(self, client: TestClient):
        resp = client.post(
            ANNOUNCEMENT_PREFIX,
            json={"content": "no title here"},
        )
        assert resp.status_code == 422

    def test_create_missing_content_returns_422(self, client: TestClient):
        resp = client.post(
            ANNOUNCEMENT_PREFIX,
            json={"title": "no content here"},
        )
        assert resp.status_code == 422

    def test_creates_notification_for_enrolled_students(self, client: TestClient, db: Session, student):
        course = _create_course_via_api(client)
        _seed_enrollment(db, user_id=STUDENT_ID, course_id=course["id"])

        client.post(
            ANNOUNCEMENT_PREFIX,
            json=_announcement_payload(course_id=course["id"]),
        )

        notifs = db.query(Notification).filter(
            Notification.user_id == STUDENT_ID,
            Notification.type == "new_announcement",
        ).all()
        assert len(notifs) == 1


class TestUpdateAnnouncement:
    def _create_announcement(self, client):
        resp = client.post(ANNOUNCEMENT_PREFIX, json=_announcement_payload())
        assert resp.status_code == 201
        return resp.json()

    def test_update_title(self, client: TestClient):
        ann = self._create_announcement(client)
        resp = client.put(
            f"{ANNOUNCEMENT_PREFIX}/{ann['id']}",
            json={"title": "Updated Title"},
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Title"

    def test_update_content(self, client: TestClient):
        ann = self._create_announcement(client)
        resp = client.put(
            f"{ANNOUNCEMENT_PREFIX}/{ann['id']}",
            json={"content": "Updated content"},
        )
        assert resp.status_code == 200
        assert resp.json()["content"] == "Updated content"

    def test_update_nonexistent_returns_404(self, client: TestClient):
        resp = client.put(
            f"{ANNOUNCEMENT_PREFIX}/{uuid.uuid4()}",
            json={"title": "Nope"},
        )
        assert resp.status_code == 404

    def test_student_cannot_update(self, student_client: TestClient, db: Session):
        ann = Announcement(
            id=uuid.uuid4(),
            title="Teacher Ann",
            content="Some content",
            created_by=TEACHER_ID,
        )
        db.add(ann)
        db.commit()
        db.refresh(ann)

        resp = student_client.put(
            f"{ANNOUNCEMENT_PREFIX}/{ann.id}",
            json={"title": "Hacked"},
        )
        assert resp.status_code == 403


class TestDeleteAnnouncement:
    def test_delete_returns_204(self, client: TestClient):
        resp = client.post(ANNOUNCEMENT_PREFIX, json=_announcement_payload())
        ann_id = resp.json()["id"]

        resp = client.delete(f"{ANNOUNCEMENT_PREFIX}/{ann_id}")
        assert resp.status_code == 204

        resp = client.get(ANNOUNCEMENT_PREFIX)
        assert resp.json() == []

    def test_delete_nonexistent_returns_404(self, client: TestClient):
        resp = client.delete(f"{ANNOUNCEMENT_PREFIX}/{uuid.uuid4()}")
        assert resp.status_code == 404

    def test_student_cannot_delete(self, student_client: TestClient, db: Session):
        ann = Announcement(
            id=uuid.uuid4(),
            title="Teacher Ann",
            content="Some content",
            created_by=TEACHER_ID,
        )
        db.add(ann)
        db.commit()
        db.refresh(ann)

        resp = student_client.delete(f"{ANNOUNCEMENT_PREFIX}/{ann.id}")
        assert resp.status_code == 403

    def test_teacher_cannot_delete_others_announcement(self, client: TestClient, db: Session):
        other_teacher_id = uuid.uuid4()
        from app.models.user import User, UserRole
        other = User(
            id=other_teacher_id,
            email="other-teacher@example.com",
            full_name="Other Teacher",
            role=UserRole.TEACHER.value,
        )
        db.add(other)
        db.commit()

        ann = Announcement(
            id=uuid.uuid4(),
            title="Other's Announcement",
            content="Other content",
            created_by=other_teacher_id,
        )
        db.add(ann)
        db.commit()
        db.refresh(ann)

        resp = client.delete(f"{ANNOUNCEMENT_PREFIX}/{ann.id}")
        assert resp.status_code == 403
