"""Tests for certificate, grade, and teacher-progress endpoints."""
import uuid

import sqlalchemy.types as _sa_types
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.certificate import Certificate
from app.models.chapter_progress import ChapterProgress
from app.models.course import Course, Module, Chapter
from app.models.enrollment import Enrollment
from app.models.student_grade import StudentGrade
from app.models.user import User, UserRole
from tests.conftest import TEACHER_ID, STUDENT_ID

# SQLite does not auto-cast str → UUID for bind parameters.  The grade
# endpoints receive ``student_id`` as a plain ``str`` from the URL and
# compare it directly against UUID columns, which works on Postgres but
# triggers ``'str' object has no attribute 'hex'`` on SQLite.  Patch the
# Uuid bind processor so it converts incoming strings to uuid.UUID first.
_orig_uuid_bp = _sa_types.Uuid.bind_processor


def _patched_uuid_bp(self, dialect):
    fn = _orig_uuid_bp(self, dialect)
    if fn is None:
        return None

    def _wrap(value):
        if isinstance(value, str):
            try:
                value = uuid.UUID(value)
            except (ValueError, AttributeError):
                pass
        return fn(value)

    return _wrap


_sa_types.Uuid.bind_processor = _patched_uuid_bp

# ── Seed helpers ─────────────────────────────────────────────────────

OTHER_TEACHER_ID = uuid.UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")


def _ensure_student(db: Session) -> User:
    existing = db.query(User).filter(User.id == STUDENT_ID).first()
    if existing:
        return existing
    user = User(
        id=STUDENT_ID, email="student@example.com",
        full_name="Test Student", role=UserRole.STUDENT.value,
    )
    db.add(user)
    db.flush()
    return user


def _ensure_other_teacher(db: Session) -> User:
    existing = db.query(User).filter(User.id == OTHER_TEACHER_ID).first()
    if existing:
        return existing
    user = User(
        id=OTHER_TEACHER_ID, email="other@example.com",
        full_name="Other Teacher", role=UserRole.TEACHER.value,
    )
    db.add(user)
    db.flush()
    return user


def _seed_course(
    db: Session,
    *,
    course_id: str = "course-1",
    chapter_type: str = "assignment",
    owner: uuid.UUID = TEACHER_ID,
) -> tuple[Course, Module, Chapter]:
    course = Course(
        id=course_id, title="Test Course", description="Test",
        status="published", created_by=owner,
        quiz_weight=30, assignment_weight=50, participation_weight=20,
    )
    module = Module(
        id=f"{course_id}-mod", course_id=course_id,
        title="Module 1", order_index=1,
    )
    chapter = Chapter(
        id=f"{course_id}-ch", module_id=module.id,
        title="Chapter 1", order_index=1, chapter_type=chapter_type,
    )
    db.add_all([course, module, chapter])
    db.commit()
    return course, module, chapter


def _seed_enrolled_course(
    db: Session,
    *,
    course_id: str = "course-1",
    chapter_type: str = "assignment",
    progress: int = 0,
) -> tuple[Course, Module, Chapter, Enrollment]:
    _ensure_student(db)
    course, module, chapter = _seed_course(
        db, course_id=course_id, chapter_type=chapter_type,
    )
    enrollment = Enrollment(
        id=f"enroll-{course_id}", user_id=STUDENT_ID,
        course_id=course_id, progress=progress,
    )
    db.add(enrollment)
    db.commit()
    return course, module, chapter, enrollment


def _seed_foreign_course(
    db: Session, course_id: str = "other-course",
) -> tuple[Course, Module, Chapter]:
    _ensure_other_teacher(db)
    return _seed_course(db, course_id=course_id, owner=OTHER_TEACHER_ID)


def _seed_certificate(
    db: Session, course_id: str, *, cert_status: str = "pending",
) -> Certificate:
    cert = Certificate(
        user_id=STUDENT_ID, course_id=course_id, status=cert_status,
    )
    db.add(cert)
    db.commit()
    db.refresh(cert)
    return cert


def _make_admin(db: Session) -> None:
    user = db.query(User).filter(User.id == TEACHER_ID).first()
    user.role = UserRole.ADMIN.value
    db.commit()


def _seed_grade(
    db: Session, course_id: str, *, grade: str = "A", comment: str = "Good work",
) -> StudentGrade:
    sg = StudentGrade(
        id=uuid.uuid4(), student_id=STUDENT_ID, course_id=course_id,
        grade=grade, comment=comment, graded_by=TEACHER_ID,
    )
    db.add(sg)
    db.commit()
    db.refresh(sg)
    return sg


# =====================================================================
# CERTIFICATES
# =====================================================================


class TestRequestCertificate:
    """POST /api/v1/certificates/course/{course_id}"""

    def test_happy_path(self, student_client: TestClient, db: Session):
        _seed_enrolled_course(db, progress=100)
        r = student_client.post("/api/v1/certificates/course/course-1")
        assert r.status_code == 201
        body = r.json()
        assert body["status"] == "pending"
        assert body["course_id"] == "course-1"
        assert body["user_id"] == str(STUDENT_ID)

    def test_not_enrolled(self, student_client: TestClient, db: Session):
        _seed_course(db)
        r = student_client.post("/api/v1/certificates/course/course-1")
        assert r.status_code == 400
        assert "Not enrolled" in r.json()["detail"]

    def test_progress_incomplete(self, student_client: TestClient, db: Session):
        _seed_enrolled_course(db, progress=50)
        r = student_client.post("/api/v1/certificates/course/course-1")
        assert r.status_code == 400
        assert "50%" in r.json()["detail"]

    def test_course_not_found(self, student_client: TestClient, db: Session):
        r = student_client.post("/api/v1/certificates/course/nonexistent")
        assert r.status_code == 404

    def test_idempotent_returns_existing(self, student_client: TestClient, db: Session):
        _seed_enrolled_course(db, progress=100)
        r1 = student_client.post("/api/v1/certificates/course/course-1")
        assert r1.status_code == 201
        r2 = student_client.post("/api/v1/certificates/course/course-1")
        assert r2.status_code == 201
        assert r1.json()["id"] == r2.json()["id"]

    def test_anon_unauthorized(self, anon_client: TestClient, db: Session):
        _seed_enrolled_course(db, progress=100)
        r = anon_client.post("/api/v1/certificates/course/course-1")
        assert r.status_code in (401, 403)


class TestGetCourseCertificate:
    """GET /api/v1/certificates/course/{course_id}"""

    def test_happy_path(self, student_client: TestClient, db: Session):
        _seed_enrolled_course(db, progress=100)
        cert = _seed_certificate(db, "course-1")
        r = student_client.get("/api/v1/certificates/course/course-1")
        assert r.status_code == 200
        assert r.json()["id"] == str(cert.id)

    def test_not_found(self, student_client: TestClient, db: Session):
        _seed_enrolled_course(db)
        r = student_client.get("/api/v1/certificates/course/course-1")
        assert r.status_code == 404


class TestListMyCertificates:
    """GET /api/v1/certificates/my"""

    def test_returns_own_certs(self, student_client: TestClient, db: Session):
        _seed_enrolled_course(db, progress=100)
        _seed_certificate(db, "course-1")
        r = student_client.get("/api/v1/certificates/my")
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_empty_list(self, student_client: TestClient, db: Session):
        r = student_client.get("/api/v1/certificates/my")
        assert r.status_code == 200
        assert r.json() == []


class TestListPendingCertificates:
    """GET /api/v1/certificates/pending (teacher)"""

    def test_happy_path(self, client: TestClient, db: Session):
        _seed_enrolled_course(db, progress=100)
        cert = _seed_certificate(db, "course-1")
        r = client.get("/api/v1/certificates/pending")
        assert r.status_code == 200
        body = r.json()
        assert len(body) == 1
        assert body[0]["id"] == str(cert.id)
        assert body[0]["status"] == "pending"

    def test_excludes_non_pending(self, client: TestClient, db: Session):
        _seed_enrolled_course(db, progress=100)
        _seed_certificate(db, "course-1", cert_status="teacher_approved")
        r = client.get("/api/v1/certificates/pending")
        assert r.status_code == 200
        assert r.json() == []

    def test_student_forbidden(self, student_client: TestClient, db: Session):
        r = student_client.get("/api/v1/certificates/pending")
        assert r.status_code == 403

    def test_empty_when_no_courses(self, client: TestClient, db: Session):
        r = client.get("/api/v1/certificates/pending")
        assert r.status_code == 200
        assert r.json() == []


class TestAdminPendingCertificates:
    """GET /api/v1/certificates/admin/pending"""

    def test_happy_path(self, client: TestClient, db: Session):
        _make_admin(db)
        _seed_enrolled_course(db, progress=100)
        _seed_certificate(db, "course-1", cert_status="teacher_approved")
        r = client.get("/api/v1/certificates/admin/pending")
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_teacher_forbidden(self, client: TestClient, db: Session):
        r = client.get("/api/v1/certificates/admin/pending")
        assert r.status_code == 403

    def test_student_forbidden(self, student_client: TestClient, db: Session):
        r = student_client.get("/api/v1/certificates/admin/pending")
        assert r.status_code == 403


class TestTeacherApproveCertificate:
    """PUT /api/v1/certificates/{cert_id}/teacher-approve"""

    def test_happy_path(self, client: TestClient, db: Session):
        _seed_enrolled_course(db, progress=100)
        cert = _seed_certificate(db, "course-1")
        r = client.put(f"/api/v1/certificates/{cert.id}/teacher-approve")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "teacher_approved"
        assert body["teacher_approved_by"] == str(TEACHER_ID)

    def test_not_pending(self, client: TestClient, db: Session):
        _seed_enrolled_course(db, progress=100)
        cert = _seed_certificate(db, "course-1", cert_status="teacher_approved")
        r = client.put(f"/api/v1/certificates/{cert.id}/teacher-approve")
        assert r.status_code == 400

    def test_not_course_owner(self, client: TestClient, db: Session):
        _ensure_student(db)
        _seed_foreign_course(db)
        db.add(Enrollment(
            id="enroll-other", user_id=STUDENT_ID,
            course_id="other-course", progress=100,
        ))
        db.commit()
        cert = _seed_certificate(db, "other-course")
        r = client.put(f"/api/v1/certificates/{cert.id}/teacher-approve")
        assert r.status_code == 403

    def test_not_found(self, client: TestClient, db: Session):
        r = client.put(f"/api/v1/certificates/{uuid.uuid4()}/teacher-approve")
        assert r.status_code == 404

    def test_student_forbidden(self, student_client: TestClient, db: Session):
        _seed_enrolled_course(db, progress=100)
        cert = _seed_certificate(db, "course-1")
        r = student_client.put(f"/api/v1/certificates/{cert.id}/teacher-approve")
        assert r.status_code == 403


class TestAdminApproveCertificate:
    """PUT /api/v1/certificates/{cert_id}/admin-approve"""

    def test_happy_path(self, client: TestClient, db: Session):
        _make_admin(db)
        _seed_enrolled_course(db, progress=100)
        cert = _seed_certificate(db, "course-1", cert_status="teacher_approved")
        r = client.put(f"/api/v1/certificates/{cert.id}/admin-approve")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "approved"
        assert body["certificate_number"] is not None
        assert body["certificate_number"].startswith("CERT-")
        assert body["admin_approved_by"] == str(TEACHER_ID)

    def test_not_teacher_approved(self, client: TestClient, db: Session):
        _make_admin(db)
        _seed_enrolled_course(db, progress=100)
        cert = _seed_certificate(db, "course-1")
        r = client.put(f"/api/v1/certificates/{cert.id}/admin-approve")
        assert r.status_code == 400

    def test_teacher_forbidden(self, client: TestClient, db: Session):
        _seed_enrolled_course(db, progress=100)
        cert = _seed_certificate(db, "course-1", cert_status="teacher_approved")
        r = client.put(f"/api/v1/certificates/{cert.id}/admin-approve")
        assert r.status_code == 403

    def test_not_found(self, client: TestClient, db: Session):
        _make_admin(db)
        r = client.put(f"/api/v1/certificates/{uuid.uuid4()}/admin-approve")
        assert r.status_code == 404


class TestRejectCertificate:
    """PUT /api/v1/certificates/{cert_id}/reject"""

    def test_reject_pending(self, client: TestClient, db: Session):
        _seed_enrolled_course(db, progress=100)
        cert = _seed_certificate(db, "course-1")
        r = client.put(f"/api/v1/certificates/{cert.id}/reject")
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"

    def test_reject_teacher_approved(self, client: TestClient, db: Session):
        _seed_enrolled_course(db, progress=100)
        cert = _seed_certificate(db, "course-1", cert_status="teacher_approved")
        r = client.put(f"/api/v1/certificates/{cert.id}/reject")
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"

    def test_cannot_reject_approved(self, client: TestClient, db: Session):
        _seed_enrolled_course(db, progress=100)
        cert = _seed_certificate(db, "course-1", cert_status="approved")
        r = client.put(f"/api/v1/certificates/{cert.id}/reject")
        assert r.status_code == 400

    def test_cannot_reject_already_rejected(self, client: TestClient, db: Session):
        _seed_enrolled_course(db, progress=100)
        cert = _seed_certificate(db, "course-1", cert_status="rejected")
        r = client.put(f"/api/v1/certificates/{cert.id}/reject")
        assert r.status_code == 400

    def test_not_course_owner(self, client: TestClient, db: Session):
        _ensure_student(db)
        _seed_foreign_course(db)
        db.add(Enrollment(
            id="enroll-other", user_id=STUDENT_ID,
            course_id="other-course", progress=100,
        ))
        db.commit()
        cert = _seed_certificate(db, "other-course")
        r = client.put(f"/api/v1/certificates/{cert.id}/reject")
        assert r.status_code == 403

    def test_not_found(self, client: TestClient, db: Session):
        r = client.put(f"/api/v1/certificates/{uuid.uuid4()}/reject")
        assert r.status_code == 404

    def test_student_forbidden(self, student_client: TestClient, db: Session):
        _seed_enrolled_course(db, progress=100)
        cert = _seed_certificate(db, "course-1")
        r = student_client.put(f"/api/v1/certificates/{cert.id}/reject")
        assert r.status_code == 403


class TestVerifyCertificate:
    """GET /api/v1/certificates/verify/{certificate_number}"""

    def test_valid_certificate(self, client: TestClient, db: Session):
        _seed_enrolled_course(db, progress=100)
        cert = _seed_certificate(db, "course-1", cert_status="approved")
        cert.certificate_number = "CERT-TESTVALID01"
        db.commit()
        r = client.get("/api/v1/certificates/verify/CERT-TESTVALID01")
        assert r.status_code == 200
        body = r.json()
        assert body["valid"] is True
        assert body["certificate_number"] == "CERT-TESTVALID01"
        assert body["course_title"] == "Test Course"
        assert body["user_name"] == "Test Student"

    def test_invalid_number(self, client: TestClient, db: Session):
        r = client.get("/api/v1/certificates/verify/CERT-FAKE")
        assert r.status_code == 200
        assert r.json()["valid"] is False

    def test_accessible_without_auth(self, anon_client: TestClient, db: Session):
        r = anon_client.get("/api/v1/certificates/verify/CERT-NOPE")
        assert r.status_code == 200
        assert r.json()["valid"] is False


class TestFullCertificateLifecycle:
    """Integration: seed → teacher-approve → admin-approve → verify."""

    def test_lifecycle(self, client: TestClient, db: Session):
        _seed_enrolled_course(db, progress=100)
        cert = _seed_certificate(db, "course-1")

        r = client.put(f"/api/v1/certificates/{cert.id}/teacher-approve")
        assert r.status_code == 200
        assert r.json()["status"] == "teacher_approved"

        _make_admin(db)

        r = client.put(f"/api/v1/certificates/{cert.id}/admin-approve")
        assert r.status_code == 200
        cert_number = r.json()["certificate_number"]
        assert cert_number.startswith("CERT-")

        r = client.get(f"/api/v1/certificates/verify/{cert_number}")
        assert r.status_code == 200
        assert r.json()["valid"] is True


# =====================================================================
# GRADES
# =====================================================================


class TestGradingConfig:
    """GET/PUT /api/v1/grades/course/{course_id}/config"""

    def test_get_config(self, client: TestClient, db: Session):
        _seed_course(db)
        r = client.get("/api/v1/grades/course/course-1/config")
        assert r.status_code == 200
        body = r.json()
        assert body == {
            "quiz_weight": 30,
            "assignment_weight": 50,
            "participation_weight": 20,
        }

    def test_get_config_course_not_found(self, client: TestClient, db: Session):
        r = client.get("/api/v1/grades/course/nonexistent/config")
        assert r.status_code == 404

    def test_update_config(self, client: TestClient, db: Session):
        _seed_course(db)
        r = client.put(
            "/api/v1/grades/course/course-1/config",
            json={"quiz_weight": 40, "assignment_weight": 40, "participation_weight": 20},
        )
        assert r.status_code == 200
        assert r.json()["quiz_weight"] == 40
        assert r.json()["assignment_weight"] == 40

    def test_update_weights_not_100(self, client: TestClient, db: Session):
        _seed_course(db)
        r = client.put(
            "/api/v1/grades/course/course-1/config",
            json={"quiz_weight": 50, "assignment_weight": 50, "participation_weight": 50},
        )
        assert r.status_code == 422

    def test_update_not_owner(self, client: TestClient, db: Session):
        _seed_foreign_course(db)
        r = client.put(
            "/api/v1/grades/course/other-course/config",
            json={"quiz_weight": 40, "assignment_weight": 40, "participation_weight": 20},
        )
        assert r.status_code == 403

    def test_update_student_forbidden(self, student_client: TestClient, db: Session):
        _seed_course(db)
        r = student_client.put(
            "/api/v1/grades/course/course-1/config",
            json={"quiz_weight": 40, "assignment_weight": 40, "participation_weight": 20},
        )
        assert r.status_code == 403


class TestCalculatedGrade:
    """GET /api/v1/grades/course/{cid}/student/{sid}/calculated"""

    def test_happy_path(self, client: TestClient, db: Session):
        _seed_enrolled_course(db, progress=0)
        r = client.get(
            f"/api/v1/grades/course/course-1/student/{STUDENT_ID}/calculated",
        )
        assert r.status_code == 200
        body = r.json()
        assert body["student_id"] == str(STUDENT_ID)
        assert "breakdown" in body
        assert "final_score" in body["breakdown"]
        assert "letter_grade" in body["breakdown"]

    def test_student_not_enrolled(self, client: TestClient, db: Session):
        _seed_course(db)
        _ensure_student(db)
        r = client.get(
            f"/api/v1/grades/course/course-1/student/{STUDENT_ID}/calculated",
        )
        assert r.status_code == 404

    def test_course_not_found(self, client: TestClient, db: Session):
        r = client.get(
            f"/api/v1/grades/course/nonexistent/student/{STUDENT_ID}/calculated",
        )
        assert r.status_code == 404

    def test_student_forbidden(self, student_client: TestClient, db: Session):
        _seed_enrolled_course(db)
        r = student_client.get(
            f"/api/v1/grades/course/course-1/student/{STUDENT_ID}/calculated",
        )
        assert r.status_code == 403


class TestGradeSummary:
    """GET /api/v1/grades/course/{course_id}/summary"""

    def test_happy_path(self, client: TestClient, db: Session):
        _seed_enrolled_course(db, progress=50)
        r = client.get("/api/v1/grades/course/course-1/summary")
        assert r.status_code == 200
        body = r.json()
        assert body["course_id"] == "course-1"
        assert len(body["students"]) == 1
        assert "class_average" in body

    def test_no_students(self, client: TestClient, db: Session):
        _seed_course(db)
        r = client.get("/api/v1/grades/course/course-1/summary")
        assert r.status_code == 200
        assert r.json()["students"] == []
        assert r.json()["class_average"] == 0.0

    def test_not_owner(self, client: TestClient, db: Session):
        _seed_foreign_course(db)
        r = client.get("/api/v1/grades/course/other-course/summary")
        assert r.status_code == 403

    def test_student_forbidden(self, student_client: TestClient, db: Session):
        _seed_enrolled_course(db)
        r = student_client.get("/api/v1/grades/course/course-1/summary")
        assert r.status_code == 403


class TestMyGrades:
    """GET /api/v1/grades/my"""

    def test_returns_own_grades(self, student_client: TestClient, db: Session):
        _seed_enrolled_course(db)
        _seed_grade(db, "course-1")
        r = student_client.get("/api/v1/grades/my")
        assert r.status_code == 200
        body = r.json()
        assert len(body) == 1
        assert body[0]["grade"] == "A"

    def test_empty(self, student_client: TestClient, db: Session):
        r = student_client.get("/api/v1/grades/my")
        assert r.status_code == 200
        assert r.json() == []


class TestMyGradeForCourse:
    """GET /api/v1/grades/my/{course_id}"""

    def test_happy_path(self, student_client: TestClient, db: Session):
        _seed_enrolled_course(db)
        _seed_grade(db, "course-1")
        r = student_client.get("/api/v1/grades/my/course-1")
        assert r.status_code == 200
        assert r.json()["grade"] == "A"

    def test_not_found(self, student_client: TestClient, db: Session):
        r = student_client.get("/api/v1/grades/my/nonexistent")
        assert r.status_code == 404


class TestListCourseGrades:
    """GET /api/v1/grades/course/{course_id} (teacher)"""

    def test_happy_path(self, client: TestClient, db: Session):
        _seed_enrolled_course(db)
        _seed_grade(db, "course-1")
        r = client.get("/api/v1/grades/course/course-1")
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_empty(self, client: TestClient, db: Session):
        _seed_course(db)
        r = client.get("/api/v1/grades/course/course-1")
        assert r.status_code == 200
        assert r.json() == []

    def test_not_owner(self, client: TestClient, db: Session):
        _seed_foreign_course(db)
        r = client.get("/api/v1/grades/course/other-course")
        assert r.status_code == 403

    def test_student_forbidden(self, student_client: TestClient, db: Session):
        _seed_enrolled_course(db)
        r = student_client.get("/api/v1/grades/course/course-1")
        assert r.status_code == 403


class TestGetStudentGrade:
    """GET /api/v1/grades/course/{cid}/student/{sid}"""

    def test_happy_path(self, client: TestClient, db: Session):
        _seed_enrolled_course(db)
        _seed_grade(db, "course-1")
        r = client.get(f"/api/v1/grades/course/course-1/student/{STUDENT_ID}")
        assert r.status_code == 200
        assert r.json()["grade"] == "A"

    def test_not_found(self, client: TestClient, db: Session):
        _seed_course(db)
        r = client.get(f"/api/v1/grades/course/course-1/student/{STUDENT_ID}")
        assert r.status_code == 404


class TestUpsertStudentGrade:
    """PUT /api/v1/grades/course/{cid}/student/{sid}"""

    def test_create(self, client: TestClient, db: Session):
        _seed_course(db)
        r = client.put(
            f"/api/v1/grades/course/course-1/student/{STUDENT_ID}",
            json={"grade": "B+", "comment": "Nice work"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["grade"] == "B+"
        assert body["comment"] == "Nice work"
        assert body["graded_by"] == str(TEACHER_ID)

    def test_update_existing(self, client: TestClient, db: Session):
        _seed_enrolled_course(db)
        _seed_grade(db, "course-1", grade="C")
        r = client.put(
            f"/api/v1/grades/course/course-1/student/{STUDENT_ID}",
            json={"grade": "A", "comment": "Improved"},
        )
        assert r.status_code == 200
        assert r.json()["grade"] == "A"
        assert r.json()["comment"] == "Improved"

    def test_not_owner(self, client: TestClient, db: Session):
        _seed_foreign_course(db)
        r = client.put(
            f"/api/v1/grades/course/other-course/student/{STUDENT_ID}",
            json={"grade": "F"},
        )
        assert r.status_code == 403

    def test_student_forbidden(self, student_client: TestClient, db: Session):
        _seed_enrolled_course(db)
        r = student_client.put(
            f"/api/v1/grades/course/course-1/student/{STUDENT_ID}",
            json={"grade": "A"},
        )
        assert r.status_code == 403


# =====================================================================
# PROGRESS — Teacher endpoints
# =====================================================================


class TestTeacherCompleteChapter:
    """PUT /api/v1/progress/chapter/{chapter_id}/student/{student_id}/complete"""

    def test_happy_path(self, client: TestClient, db: Session):
        _seed_enrolled_course(db)
        r = client.put(
            f"/api/v1/progress/chapter/course-1-ch/student/{STUDENT_ID}/complete",
        )
        assert r.status_code == 200
        assert "complete" in r.json()["message"].lower()
        progress = (
            db.query(ChapterProgress)
            .filter(
                ChapterProgress.user_id == STUDENT_ID,
                ChapterProgress.chapter_id == "course-1-ch",
            )
            .first()
        )
        assert progress is not None
        assert progress.completed is True
        assert progress.completion_type == "teacher"

    def test_already_completed(self, client: TestClient, db: Session):
        _seed_enrolled_course(db)
        db.add(ChapterProgress(
            user_id=STUDENT_ID, chapter_id="course-1-ch",
            completed=True, completion_type="self",
        ))
        db.commit()
        r = client.put(
            f"/api/v1/progress/chapter/course-1-ch/student/{STUDENT_ID}/complete",
        )
        assert r.status_code == 200
        assert "already" in r.json()["message"].lower()

    def test_student_not_enrolled(self, client: TestClient, db: Session):
        _seed_course(db)
        _ensure_student(db)
        db.commit()
        r = client.put(
            f"/api/v1/progress/chapter/course-1-ch/student/{STUDENT_ID}/complete",
        )
        assert r.status_code == 403

    def test_chapter_not_found(self, client: TestClient, db: Session):
        r = client.put(
            f"/api/v1/progress/chapter/fake-ch/student/{STUDENT_ID}/complete",
        )
        assert r.status_code == 404

    def test_student_role_forbidden(self, student_client: TestClient, db: Session):
        _seed_enrolled_course(db)
        r = student_client.put(
            f"/api/v1/progress/chapter/course-1-ch/student/{STUDENT_ID}/complete",
        )
        assert r.status_code == 403


class TestTeacherIncompleteChapter:
    """PUT /api/v1/progress/chapter/{chapter_id}/student/{student_id}/incomplete"""

    def test_happy_path(self, client: TestClient, db: Session):
        _seed_enrolled_course(db)
        db.add(ChapterProgress(
            user_id=STUDENT_ID, chapter_id="course-1-ch",
            completed=True, completion_type="teacher",
        ))
        db.commit()
        r = client.put(
            f"/api/v1/progress/chapter/course-1-ch/student/{STUDENT_ID}/incomplete",
        )
        assert r.status_code == 200
        assert "removed" in r.json()["message"].lower()

    def test_not_completed(self, client: TestClient, db: Session):
        _seed_enrolled_course(db)
        r = client.put(
            f"/api/v1/progress/chapter/course-1-ch/student/{STUDENT_ID}/incomplete",
        )
        assert r.status_code == 400

    def test_student_not_enrolled(self, client: TestClient, db: Session):
        _seed_course(db)
        _ensure_student(db)
        db.commit()
        r = client.put(
            f"/api/v1/progress/chapter/course-1-ch/student/{STUDENT_ID}/incomplete",
        )
        assert r.status_code == 403

    def test_chapter_not_found(self, client: TestClient, db: Session):
        r = client.put(
            f"/api/v1/progress/chapter/fake-ch/student/{STUDENT_ID}/incomplete",
        )
        assert r.status_code == 404

    def test_student_role_forbidden(self, student_client: TestClient, db: Session):
        _seed_enrolled_course(db)
        r = student_client.put(
            f"/api/v1/progress/chapter/course-1-ch/student/{STUDENT_ID}/incomplete",
        )
        assert r.status_code == 403
