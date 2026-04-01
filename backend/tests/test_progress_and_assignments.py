import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.chapter_progress import ChapterProgress
from app.models.course import Chapter, Course, Module
from app.models.enrollment import Enrollment
from tests.conftest import STUDENT_ID, TEACHER_ID


def _seed_course_graph(db: Session) -> tuple[Course, Module, Chapter]:
    course = Course(
        id="course-progress",
        title="Progress Course",
        description="Regression test course",
        status="published",
        created_by=TEACHER_ID,
    )
    module = Module(
        id="module-progress",
        course_id=course.id,
        title="Module 1",
        order_index=1,
    )
    chapter = Chapter(
        id="chapter-progress",
        module_id=module.id,
        title="Chapter 1",
        order_index=1,
        chapter_type="assignment",
    )
    enrollment = Enrollment(
        id="enroll-progress",
        user_id=STUDENT_ID,
        course_id=course.id,
        progress=0,
    )
    db.add_all([course, module, chapter, enrollment])
    db.commit()
    return course, module, chapter


def test_my_progress_returns_only_completed_course_chapters(student_client: TestClient, db: Session):
    course, _module, chapter = _seed_course_graph(db)
    other_course = Course(
        id="other-course",
        title="Other Course",
        description="Should not leak into progress response",
        status="published",
        created_by=TEACHER_ID,
    )
    other_module = Module(
        id="other-module",
        course_id=other_course.id,
        title="Other Module",
        order_index=1,
    )
    other_chapter = Chapter(
        id="other-chapter",
        module_id=other_module.id,
        title="Other Chapter",
        order_index=1,
    )
    db.add_all([other_course, other_module, other_chapter])
    db.commit()
    db.add_all(
        [
            ChapterProgress(user_id=STUDENT_ID, chapter_id=chapter.id, completed=True, completion_type="self"),
            ChapterProgress(user_id=STUDENT_ID, chapter_id=other_chapter.id, completed=True, completion_type="self"),
        ]
    )
    db.commit()

    response = student_client.get(f"/api/v1/progress/course/{course.id}/my-progress")

    assert response.status_code == 200, response.text
    assert response.json() == [chapter.id]


def test_student_can_fetch_own_assignment_submissions(student_client: TestClient, db: Session):
    course, _module, chapter = _seed_course_graph(db)
    assignment = Assignment(
        id=uuid.uuid4(),
        chapter_id=chapter.id,
        title="Reflection",
        description="Write a reflection",
        max_score=10,
    )
    db.add(assignment)
    db.commit()

    submit_response = student_client.post(
        f"/api/v1/assignments/{assignment.id}/submit",
        json={"content": "My submission"},
    )
    assert submit_response.status_code == 201, submit_response.text

    my_submissions_response = student_client.get(
        f"/api/v1/assignments/{assignment.id}/my-submissions"
    )

    assert my_submissions_response.status_code == 200, my_submissions_response.text
    body = my_submissions_response.json()
    assert len(body) == 1
    assert body[0]["content"] == "My submission"
    assert body[0]["student_id"] == str(STUDENT_ID)

    progress = (
        db.query(ChapterProgress)
        .filter(
            ChapterProgress.user_id == STUDENT_ID,
            ChapterProgress.chapter_id == chapter.id,
        )
        .first()
    )
    assert progress is not None
    assert progress.completed is True

    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == STUDENT_ID, Enrollment.course_id == course.id)
        .first()
    )
    assert enrollment is not None
    assert enrollment.progress == 100


def test_content_chapter_does_not_affect_progress(student_client: TestClient, db: Session):
    """Content-only chapters (reading, video, etc.) should not count toward progress."""
    course, _module, _chapter = _seed_course_graph(db)

    content_chapter = Chapter(
        id="chapter-content",
        module_id=_module.id,
        title="Reading Material",
        order_index=2,
        chapter_type="reading",
    )
    db.add(content_chapter)
    db.commit()

    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == STUDENT_ID, Enrollment.course_id == course.id)
        .first()
    )
    assert enrollment is not None
    assert enrollment.progress == 0

    db.add(ChapterProgress(
        user_id=STUDENT_ID,
        chapter_id=_chapter.id,
        completed=True,
        completion_type="quiz",
    ))
    db.commit()

    from app.services.course_service import sync_enrollment_progress
    sync_enrollment_progress(db, STUDENT_ID, course.id)
    db.refresh(enrollment)
    assert enrollment.progress == 100
