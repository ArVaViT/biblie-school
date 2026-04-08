"""Comprehensive tests for Quiz and Block endpoints."""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.chapter_block import ChapterBlock
from app.models.course import Chapter, Course, Module
from app.models.enrollment import Enrollment
from app.models.quiz import Quiz, QuizAttempt, QuizOption, QuizQuestion
from app.models.user import User, UserRole
from tests.conftest import STUDENT_ID, TEACHER_ID

# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------


def _seed_course(db: Session):
    """Create a published course -> module -> chapter graph (no enrollment)."""
    course = Course(
        id="course-1",
        title="Test Course",
        created_by=TEACHER_ID,
        status="published",
    )
    module = Module(
        id="mod-1",
        course_id="course-1",
        title="Module 1",
        order_index=0,
    )
    chapter = Chapter(
        id="ch-1",
        module_id="mod-1",
        title="Chapter 1",
        order_index=0,
        chapter_type="quiz",
    )
    db.add_all([course, module, chapter])
    db.commit()
    return course, module, chapter


def _seed_course_with_enrollment(db: Session):
    """Create a published course -> module -> chapter with student enrollment."""
    course, module, chapter = _seed_course(db)
    existing = db.query(User).filter(User.id == STUDENT_ID).first()
    if not existing:
        db.add(User(id=STUDENT_ID, email="student@example.com", full_name="Test Student", role=UserRole.STUDENT.value))
        db.commit()
    enrollment = Enrollment(
        id="enroll-1",
        user_id=STUDENT_ID,
        course_id="course-1",
        progress=0,
    )
    db.add(enrollment)
    db.commit()
    return course, module, chapter


def _seed_quiz_with_questions(db: Session, chapter_id: str = "ch-1"):
    """Create a quiz with two MC questions, each with two options (one correct)."""
    quiz_id = uuid.uuid4()
    quiz = Quiz(
        id=quiz_id,
        chapter_id=chapter_id,
        title="Test Quiz",
        description="A quiz for testing",
        quiz_type="quiz",
        max_attempts=3,
        passing_score=50,
    )
    db.add(quiz)
    db.flush()

    q1_id, q2_id = uuid.uuid4(), uuid.uuid4()
    q1 = QuizQuestion(
        id=q1_id,
        quiz_id=quiz_id,
        question_text="What is 2+2?",
        question_type="multiple_choice",
        order_index=0,
        points=1,
    )
    q2 = QuizQuestion(
        id=q2_id,
        quiz_id=quiz_id,
        question_text="Capital of France?",
        question_type="multiple_choice",
        order_index=1,
        points=1,
    )
    db.add_all([q1, q2])
    db.flush()

    o1_wrong, o1_right = uuid.uuid4(), uuid.uuid4()
    o2_wrong, o2_right = uuid.uuid4(), uuid.uuid4()
    db.add_all(
        [
            QuizOption(id=o1_wrong, question_id=q1_id, option_text="3", is_correct=False, order_index=0),
            QuizOption(id=o1_right, question_id=q1_id, option_text="4", is_correct=True, order_index=1),
            QuizOption(id=o2_wrong, question_id=q2_id, option_text="London", is_correct=False, order_index=0),
            QuizOption(id=o2_right, question_id=q2_id, option_text="Paris", is_correct=True, order_index=1),
        ]
    )
    db.commit()

    opts = {
        "q1_correct": o1_right,
        "q1_wrong": o1_wrong,
        "q2_correct": o2_right,
        "q2_wrong": o2_wrong,
    }
    return quiz, [q1, q2], opts


# ═══════════════════════════════════════════════════════════════════════════
#  BLOCK TESTS
# ═══════════════════════════════════════════════════════════════════════════


# ── GET /api/v1/blocks/chapter/{chapter_id} ──────────────────────────────


def test_list_blocks_teacher_success(client: TestClient, db: Session):
    _seed_course(db)
    db.add(ChapterBlock(chapter_id="ch-1", block_type="text", order_index=0, content="Hello"))
    db.commit()

    resp = client.get("/api/v1/blocks/chapter/ch-1")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["content"] == "Hello"
    assert data[0]["block_type"] == "text"


def test_list_blocks_enrolled_student(student_client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    db.add(ChapterBlock(chapter_id="ch-1", block_type="text", order_index=0, content="Lesson"))
    db.commit()

    resp = student_client.get("/api/v1/blocks/chapter/ch-1")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_list_blocks_returns_ordered(client: TestClient, db: Session):
    _seed_course(db)
    db.add_all(
        [
            ChapterBlock(chapter_id="ch-1", block_type="text", order_index=2, content="Second"),
            ChapterBlock(chapter_id="ch-1", block_type="text", order_index=0, content="First"),
        ]
    )
    db.commit()

    data = client.get("/api/v1/blocks/chapter/ch-1").json()
    assert data[0]["content"] == "First"
    assert data[1]["content"] == "Second"


def test_list_blocks_empty(client: TestClient, db: Session):
    _seed_course(db)
    resp = client.get("/api/v1/blocks/chapter/ch-1")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_blocks_chapter_not_found(client: TestClient, db: Session):
    resp = client.get("/api/v1/blocks/chapter/nonexistent")
    assert resp.status_code == 404


def test_list_blocks_anon_unauthorized(anon_client: TestClient):
    resp = anon_client.get("/api/v1/blocks/chapter/ch-1")
    assert resp.status_code == 401


# ── POST /api/v1/blocks/chapter/{chapter_id} ─────────────────────────────


def test_create_block_text(client: TestClient, db: Session):
    _seed_course(db)
    resp = client.post(
        "/api/v1/blocks/chapter/ch-1",
        json={
            "block_type": "text",
            "order_index": 0,
            "content": "New block content",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["block_type"] == "text"
    assert body["content"] == "New block content"
    assert body["chapter_id"] == "ch-1"


def test_create_block_video(client: TestClient, db: Session):
    _seed_course(db)
    resp = client.post(
        "/api/v1/blocks/chapter/ch-1",
        json={
            "block_type": "video",
            "order_index": 1,
            "video_url": "https://example.com/vid.mp4",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["video_url"] == "https://example.com/vid.mp4"


def test_create_block_student_forbidden(student_client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    resp = student_client.post(
        "/api/v1/blocks/chapter/ch-1",
        json={
            "block_type": "text",
            "order_index": 0,
            "content": "nope",
        },
    )
    assert resp.status_code == 403


def test_create_block_anon_unauthorized(anon_client: TestClient):
    resp = anon_client.post(
        "/api/v1/blocks/chapter/ch-1",
        json={
            "block_type": "text",
            "order_index": 0,
        },
    )
    assert resp.status_code == 401


def test_create_block_chapter_not_found(client: TestClient, db: Session):
    resp = client.post(
        "/api/v1/blocks/chapter/nonexistent",
        json={
            "block_type": "text",
            "order_index": 0,
        },
    )
    assert resp.status_code == 404


# ── PUT /api/v1/blocks/{block_id} ────────────────────────────────────────


def test_update_block_success(client: TestClient, db: Session):
    _seed_course(db)
    block = ChapterBlock(chapter_id="ch-1", block_type="text", order_index=0, content="Old")
    db.add(block)
    db.commit()
    db.refresh(block)

    resp = client.put(f"/api/v1/blocks/{block.id}", json={"content": "Updated"})
    assert resp.status_code == 200
    assert resp.json()["content"] == "Updated"


def test_update_block_partial(client: TestClient, db: Session):
    _seed_course(db)
    block = ChapterBlock(chapter_id="ch-1", block_type="text", order_index=0, content="Keep")
    db.add(block)
    db.commit()
    db.refresh(block)

    resp = client.put(f"/api/v1/blocks/{block.id}", json={"order_index": 5})
    assert resp.status_code == 200
    body = resp.json()
    assert body["order_index"] == 5
    assert body["content"] == "Keep"


def test_update_block_student_forbidden(student_client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    block = ChapterBlock(chapter_id="ch-1", block_type="text", order_index=0)
    db.add(block)
    db.commit()
    db.refresh(block)

    resp = student_client.put(f"/api/v1/blocks/{block.id}", json={"content": "hack"})
    assert resp.status_code == 403


def test_update_block_not_found(client: TestClient, db: Session):
    resp = client.put(f"/api/v1/blocks/{uuid.uuid4()}", json={"content": "nope"})
    assert resp.status_code == 404


def test_update_block_anon_unauthorized(anon_client: TestClient):
    resp = anon_client.put(f"/api/v1/blocks/{uuid.uuid4()}", json={"content": "x"})
    assert resp.status_code == 401


# ── DELETE /api/v1/blocks/{block_id} ──────────────────────────────────────


def test_delete_block_success(client: TestClient, db: Session):
    _seed_course(db)
    block = ChapterBlock(chapter_id="ch-1", block_type="text", order_index=0, content="Bye")
    db.add(block)
    db.commit()
    db.refresh(block)

    resp = client.delete(f"/api/v1/blocks/{block.id}")
    assert resp.status_code == 204
    assert db.query(ChapterBlock).filter(ChapterBlock.id == block.id).first() is None


def test_delete_block_student_forbidden(student_client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    block = ChapterBlock(chapter_id="ch-1", block_type="text", order_index=0)
    db.add(block)
    db.commit()
    db.refresh(block)

    resp = student_client.delete(f"/api/v1/blocks/{block.id}")
    assert resp.status_code == 403


def test_delete_block_not_found(client: TestClient, db: Session):
    resp = client.delete(f"/api/v1/blocks/{uuid.uuid4()}")
    assert resp.status_code == 404


def test_delete_block_anon_unauthorized(anon_client: TestClient):
    resp = anon_client.delete(f"/api/v1/blocks/{uuid.uuid4()}")
    assert resp.status_code == 401


# ── PUT /api/v1/blocks/chapter/{chapter_id}/reorder ───────────────────────


def test_reorder_blocks_success(client: TestClient, db: Session):
    _seed_course(db)
    b1 = ChapterBlock(chapter_id="ch-1", block_type="text", order_index=0, content="A")
    b2 = ChapterBlock(chapter_id="ch-1", block_type="text", order_index=1, content="B")
    db.add_all([b1, b2])
    db.commit()
    db.refresh(b1)
    db.refresh(b2)

    resp = client.put(
        "/api/v1/blocks/chapter/ch-1/reorder",
        json=[
            {"id": str(b1.id), "order_index": 1},
            {"id": str(b2.id), "order_index": 0},
        ],
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["content"] == "B"
    assert data[1]["content"] == "A"


def test_reorder_blocks_empty_list(client: TestClient, db: Session):
    _seed_course(db)
    resp = client.put("/api/v1/blocks/chapter/ch-1/reorder", json=[])
    assert resp.status_code == 200
    assert resp.json() == []


def test_reorder_blocks_student_forbidden(student_client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    resp = student_client.put("/api/v1/blocks/chapter/ch-1/reorder", json=[])
    assert resp.status_code == 403


def test_reorder_blocks_chapter_not_found(client: TestClient, db: Session):
    resp = client.put("/api/v1/blocks/chapter/nonexistent/reorder", json=[])
    assert resp.status_code == 404


def test_reorder_blocks_anon_unauthorized(anon_client: TestClient):
    resp = anon_client.put("/api/v1/blocks/chapter/ch-1/reorder", json=[])
    assert resp.status_code == 401


# ═══════════════════════════════════════════════════════════════════════════
#  QUIZ TESTS
# ═══════════════════════════════════════════════════════════════════════════


# ── GET /api/v1/quizzes/chapter/{chapter_id} (student view) ──────────────


def test_get_chapter_quiz_enrolled_student(student_client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    _seed_quiz_with_questions(db)

    resp = student_client.get("/api/v1/quizzes/chapter/ch-1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Test Quiz"
    assert len(data["questions"]) == 2
    for q in data["questions"]:
        for opt in q["options"]:
            assert "is_correct" not in opt


def test_get_chapter_quiz_teacher_owner(client: TestClient, db: Session):
    _seed_course(db)
    _seed_quiz_with_questions(db)

    resp = client.get("/api/v1/quizzes/chapter/ch-1")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Test Quiz"


def test_get_chapter_quiz_none_exists(student_client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    resp = student_client.get("/api/v1/quizzes/chapter/ch-1")
    assert resp.status_code == 200
    assert resp.json() is None


def test_get_chapter_quiz_chapter_not_found(student_client: TestClient, db: Session):
    resp = student_client.get("/api/v1/quizzes/chapter/nonexistent")
    assert resp.status_code == 404


def test_get_chapter_quiz_anon_unauthorized(anon_client: TestClient):
    resp = anon_client.get("/api/v1/quizzes/chapter/ch-1")
    assert resp.status_code == 401


# ── GET /api/v1/quizzes/{quiz_id} (teacher detail) ──────────────────────


def test_get_quiz_detail_teacher(client: TestClient, db: Session):
    _seed_course(db)
    quiz, _, _ = _seed_quiz_with_questions(db)

    resp = client.get(f"/api/v1/quizzes/{quiz.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Test Quiz"
    assert len(data["questions"]) == 2
    for q in data["questions"]:
        for opt in q["options"]:
            assert "is_correct" in opt


def test_get_quiz_detail_student_forbidden(student_client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    quiz, _, _ = _seed_quiz_with_questions(db)

    resp = student_client.get(f"/api/v1/quizzes/{quiz.id}")
    assert resp.status_code == 403


def test_get_quiz_detail_not_found(client: TestClient, db: Session):
    resp = client.get(f"/api/v1/quizzes/{uuid.uuid4()}")
    assert resp.status_code == 404


def test_get_quiz_detail_anon_unauthorized(anon_client: TestClient):
    resp = anon_client.get(f"/api/v1/quizzes/{uuid.uuid4()}")
    assert resp.status_code == 401


# ── POST /api/v1/quizzes (create) ────────────────────────────────────────


def test_create_quiz_with_questions(client: TestClient, db: Session):
    _seed_course(db)
    resp = client.post(
        "/api/v1/quizzes",
        json={
            "chapter_id": "ch-1",
            "title": "New Quiz",
            "description": "Testing creation",
            "quiz_type": "quiz",
            "max_attempts": 5,
            "passing_score": 60,
            "questions": [
                {
                    "question_text": "Sky color?",
                    "question_type": "multiple_choice",
                    "order_index": 0,
                    "points": 1,
                    "options": [
                        {"option_text": "Blue", "is_correct": True, "order_index": 0},
                        {"option_text": "Red", "is_correct": False, "order_index": 1},
                    ],
                }
            ],
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "New Quiz"
    assert body["passing_score"] == 60
    assert len(body["questions"]) == 1
    assert len(body["questions"][0]["options"]) == 2


def test_create_quiz_exam_auto_max_attempts(client: TestClient, db: Session):
    _seed_course(db)
    resp = client.post(
        "/api/v1/quizzes",
        json={
            "chapter_id": "ch-1",
            "title": "Final Exam",
            "quiz_type": "exam",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["max_attempts"] == 1


def test_create_quiz_no_questions(client: TestClient, db: Session):
    _seed_course(db)
    resp = client.post(
        "/api/v1/quizzes",
        json={
            "chapter_id": "ch-1",
            "title": "Empty Quiz",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["questions"] == []


def test_create_quiz_student_forbidden(student_client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    resp = student_client.post(
        "/api/v1/quizzes",
        json={
            "chapter_id": "ch-1",
            "title": "No way",
        },
    )
    assert resp.status_code == 403


def test_create_quiz_chapter_not_found(client: TestClient, db: Session):
    resp = client.post(
        "/api/v1/quizzes",
        json={
            "chapter_id": "nonexistent",
            "title": "Orphan Quiz",
        },
    )
    assert resp.status_code == 404


def test_create_quiz_anon_unauthorized(anon_client: TestClient):
    resp = anon_client.post(
        "/api/v1/quizzes",
        json={
            "chapter_id": "ch-1",
            "title": "x",
        },
    )
    assert resp.status_code == 401


# ── PUT /api/v1/quizzes/{quiz_id} (update) ───────────────────────────────


def test_update_quiz_success(client: TestClient, db: Session):
    _seed_course(db)
    quiz, _, _ = _seed_quiz_with_questions(db)

    resp = client.put(
        f"/api/v1/quizzes/{quiz.id}",
        json={
            "title": "Updated Title",
            "passing_score": 80,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "Updated Title"
    assert body["passing_score"] == 80


def test_update_quiz_to_exam_sets_max_attempts(client: TestClient, db: Session):
    _seed_course(db)
    quiz, _, _ = _seed_quiz_with_questions(db)
    quiz.max_attempts = None
    db.commit()

    resp = client.put(f"/api/v1/quizzes/{quiz.id}", json={"quiz_type": "exam"})
    assert resp.status_code == 200
    assert resp.json()["max_attempts"] == 1


def test_update_quiz_student_forbidden(student_client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    quiz, _, _ = _seed_quiz_with_questions(db)

    resp = student_client.put(f"/api/v1/quizzes/{quiz.id}", json={"title": "Hack"})
    assert resp.status_code == 403


def test_update_quiz_not_found(client: TestClient, db: Session):
    resp = client.put(f"/api/v1/quizzes/{uuid.uuid4()}", json={"title": "Ghost"})
    assert resp.status_code == 404


def test_update_quiz_anon_unauthorized(anon_client: TestClient):
    resp = anon_client.put(f"/api/v1/quizzes/{uuid.uuid4()}", json={"title": "x"})
    assert resp.status_code == 401


# ── DELETE /api/v1/quizzes/{quiz_id} ──────────────────────────────────────


def test_delete_quiz_success(client: TestClient, db: Session):
    _seed_course(db)
    quiz, _, _ = _seed_quiz_with_questions(db)

    resp = client.delete(f"/api/v1/quizzes/{quiz.id}")
    assert resp.status_code == 204
    assert db.query(Quiz).filter(Quiz.id == quiz.id).first() is None


def test_delete_quiz_student_forbidden(student_client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    quiz, _, _ = _seed_quiz_with_questions(db)

    resp = student_client.delete(f"/api/v1/quizzes/{quiz.id}")
    assert resp.status_code == 403


def test_delete_quiz_not_found(client: TestClient, db: Session):
    resp = client.delete(f"/api/v1/quizzes/{uuid.uuid4()}")
    assert resp.status_code == 404


def test_delete_quiz_anon_unauthorized(anon_client: TestClient):
    resp = anon_client.delete(f"/api/v1/quizzes/{uuid.uuid4()}")
    assert resp.status_code == 401


# ── POST /api/v1/quizzes/{quiz_id}/submit ─────────────────────────────────


def test_submit_quiz_perfect_score(student_client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    quiz, questions, opts = _seed_quiz_with_questions(db)

    resp = student_client.post(
        f"/api/v1/quizzes/{quiz.id}/submit",
        json={
            "answers": [
                {"question_id": str(questions[0].id), "selected_option_id": str(opts["q1_correct"])},
                {"question_id": str(questions[1].id), "selected_option_id": str(opts["q2_correct"])},
            ],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["score"] == 2
    assert body["max_score"] == 2
    assert body["passed"] is True
    assert body["user_id"] == str(STUDENT_ID)


def test_submit_quiz_all_wrong(student_client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    quiz, questions, opts = _seed_quiz_with_questions(db)

    resp = student_client.post(
        f"/api/v1/quizzes/{quiz.id}/submit",
        json={
            "answers": [
                {"question_id": str(questions[0].id), "selected_option_id": str(opts["q1_wrong"])},
                {"question_id": str(questions[1].id), "selected_option_id": str(opts["q2_wrong"])},
            ],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["score"] == 0
    assert body["passed"] is False


def test_submit_quiz_empty_answers(student_client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    quiz, _, _ = _seed_quiz_with_questions(db)

    resp = student_client.post(f"/api/v1/quizzes/{quiz.id}/submit", json={"answers": []})
    assert resp.status_code == 200
    body = resp.json()
    assert body["score"] == 0
    assert body["max_score"] == 2


def test_submit_quiz_partial_answers(student_client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    quiz, questions, opts = _seed_quiz_with_questions(db)

    resp = student_client.post(
        f"/api/v1/quizzes/{quiz.id}/submit",
        json={
            "answers": [
                {"question_id": str(questions[0].id), "selected_option_id": str(opts["q1_correct"])},
            ],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["score"] == 1
    assert body["max_score"] == 2
    assert body["passed"] is True  # 50% >= 50 passing_score


def test_submit_quiz_not_enrolled(client: TestClient, db: Session):
    """Teacher owns the course but is not enrolled — should be rejected."""
    _seed_course(db)
    quiz, questions, opts = _seed_quiz_with_questions(db)

    resp = client.post(
        f"/api/v1/quizzes/{quiz.id}/submit",
        json={
            "answers": [
                {"question_id": str(questions[0].id), "selected_option_id": str(opts["q1_correct"])},
            ],
        },
    )
    assert resp.status_code == 403
    assert "enrolled" in resp.json()["detail"].lower()


def test_submit_quiz_not_found(student_client: TestClient, db: Session):
    resp = student_client.post(f"/api/v1/quizzes/{uuid.uuid4()}/submit", json={"answers": []})
    assert resp.status_code == 404


def test_submit_quiz_max_attempts_exceeded(student_client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    quiz, questions, opts = _seed_quiz_with_questions(db)
    quiz.max_attempts = 1
    db.commit()

    first = student_client.post(
        f"/api/v1/quizzes/{quiz.id}/submit",
        json={
            "answers": [
                {"question_id": str(questions[0].id), "selected_option_id": str(opts["q1_correct"])},
            ],
        },
    )
    assert first.status_code == 200

    second = student_client.post(
        f"/api/v1/quizzes/{quiz.id}/submit",
        json={
            "answers": [
                {"question_id": str(questions[0].id), "selected_option_id": str(opts["q1_correct"])},
            ],
        },
    )
    assert second.status_code == 403
    assert "attempts" in second.json()["detail"].lower()


def test_submit_quiz_extra_attempts_extend_limit(student_client: TestClient, db: Session):
    """After exhausting base attempts, extra-attempt grant should allow more."""
    from app.models.quiz import QuizExtraAttempt

    _seed_course_with_enrollment(db)
    quiz, questions, opts = _seed_quiz_with_questions(db)
    quiz.max_attempts = 1
    db.commit()

    student_client.post(
        f"/api/v1/quizzes/{quiz.id}/submit",
        json={
            "answers": [{"question_id": str(questions[0].id), "selected_option_id": str(opts["q1_wrong"])}],
        },
    )

    blocked = student_client.post(
        f"/api/v1/quizzes/{quiz.id}/submit",
        json={
            "answers": [{"question_id": str(questions[0].id), "selected_option_id": str(opts["q1_correct"])}],
        },
    )
    assert blocked.status_code == 403

    db.add(
        QuizExtraAttempt(
            quiz_id=quiz.id,
            user_id=STUDENT_ID,
            extra_attempts=1,
            granted_by=TEACHER_ID,
        )
    )
    db.commit()

    retry = student_client.post(
        f"/api/v1/quizzes/{quiz.id}/submit",
        json={
            "answers": [{"question_id": str(questions[0].id), "selected_option_id": str(opts["q1_correct"])}],
        },
    )
    assert retry.status_code == 200


def test_submit_quiz_anon_unauthorized(anon_client: TestClient):
    resp = anon_client.post(f"/api/v1/quizzes/{uuid.uuid4()}/submit", json={"answers": []})
    assert resp.status_code == 401


# ── GET /api/v1/quizzes/{quiz_id}/attempts (teacher) ─────────────────────


def test_get_all_attempts_teacher(client: TestClient, db: Session):
    _seed_course(db)
    quiz, _, _ = _seed_quiz_with_questions(db)
    db.add(QuizAttempt(quiz_id=quiz.id, user_id=STUDENT_ID, score=2, max_score=2, passed=True))
    db.commit()

    resp = client.get(f"/api/v1/quizzes/{quiz.id}/attempts")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["user_id"] == str(STUDENT_ID)


def test_get_all_attempts_empty(client: TestClient, db: Session):
    _seed_course(db)
    quiz, _, _ = _seed_quiz_with_questions(db)

    resp = client.get(f"/api/v1/quizzes/{quiz.id}/attempts")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_all_attempts_student_forbidden(student_client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    quiz, _, _ = _seed_quiz_with_questions(db)

    resp = student_client.get(f"/api/v1/quizzes/{quiz.id}/attempts")
    assert resp.status_code == 403


def test_get_all_attempts_not_found(client: TestClient, db: Session):
    resp = client.get(f"/api/v1/quizzes/{uuid.uuid4()}/attempts")
    assert resp.status_code == 404


def test_get_all_attempts_anon_unauthorized(anon_client: TestClient):
    resp = anon_client.get(f"/api/v1/quizzes/{uuid.uuid4()}/attempts")
    assert resp.status_code == 401


# ── GET /api/v1/quizzes/{quiz_id}/my-attempts (student) ──────────────────


def test_get_my_attempts_after_submit(student_client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    quiz, questions, opts = _seed_quiz_with_questions(db)

    student_client.post(
        f"/api/v1/quizzes/{quiz.id}/submit",
        json={
            "answers": [
                {"question_id": str(questions[0].id), "selected_option_id": str(opts["q1_correct"])},
            ],
        },
    )

    resp = student_client.get(f"/api/v1/quizzes/{quiz.id}/my-attempts")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["user_id"] == str(STUDENT_ID)


def test_get_my_attempts_empty(student_client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    quiz, _, _ = _seed_quiz_with_questions(db)

    resp = student_client.get(f"/api/v1/quizzes/{quiz.id}/my-attempts")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_my_attempts_teacher_sees_own(client: TestClient, db: Session):
    """Teacher can also call my-attempts; result is empty because they never submitted."""
    _seed_course(db)
    quiz, _, _ = _seed_quiz_with_questions(db)

    resp = client.get(f"/api/v1/quizzes/{quiz.id}/my-attempts")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_my_attempts_anon_unauthorized(anon_client: TestClient):
    resp = anon_client.get(f"/api/v1/quizzes/{uuid.uuid4()}/my-attempts")
    assert resp.status_code == 401


# ── POST /api/v1/quizzes/{quiz_id}/extra-attempts (grant) ────────────────


def test_grant_extra_attempts_success(client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    quiz, _, _ = _seed_quiz_with_questions(db)

    resp = client.post(
        f"/api/v1/quizzes/{quiz.id}/extra-attempts",
        json={
            "user_id": str(STUDENT_ID),
            "extra_attempts": 3,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["extra_attempts"] == 3
    assert body["user_id"] == str(STUDENT_ID)
    assert body["granted_by"] == str(TEACHER_ID)


def test_grant_extra_attempts_updates_existing(client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    quiz, _, _ = _seed_quiz_with_questions(db)

    client.post(
        f"/api/v1/quizzes/{quiz.id}/extra-attempts",
        json={
            "user_id": str(STUDENT_ID),
            "extra_attempts": 2,
        },
    )
    resp = client.post(
        f"/api/v1/quizzes/{quiz.id}/extra-attempts",
        json={
            "user_id": str(STUDENT_ID),
            "extra_attempts": 5,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["extra_attempts"] == 5


def test_grant_extra_attempts_student_forbidden(student_client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    quiz, _, _ = _seed_quiz_with_questions(db)

    resp = student_client.post(
        f"/api/v1/quizzes/{quiz.id}/extra-attempts",
        json={
            "user_id": str(STUDENT_ID),
            "extra_attempts": 1,
        },
    )
    assert resp.status_code == 403


def test_grant_extra_attempts_quiz_not_found(client: TestClient, db: Session):
    resp = client.post(
        f"/api/v1/quizzes/{uuid.uuid4()}/extra-attempts",
        json={
            "user_id": str(STUDENT_ID),
            "extra_attempts": 1,
        },
    )
    assert resp.status_code == 404


def test_grant_extra_attempts_anon_unauthorized(anon_client: TestClient):
    resp = anon_client.post(
        f"/api/v1/quizzes/{uuid.uuid4()}/extra-attempts",
        json={
            "user_id": str(STUDENT_ID),
            "extra_attempts": 1,
        },
    )
    assert resp.status_code == 401


# ── GET /api/v1/quizzes/{quiz_id}/extra-attempts (list) ──────────────────


def test_list_extra_attempts_success(client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    quiz, _, _ = _seed_quiz_with_questions(db)

    client.post(
        f"/api/v1/quizzes/{quiz.id}/extra-attempts",
        json={
            "user_id": str(STUDENT_ID),
            "extra_attempts": 2,
        },
    )

    resp = client.get(f"/api/v1/quizzes/{quiz.id}/extra-attempts")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["user_id"] == str(STUDENT_ID)
    assert data[0]["extra_attempts"] == 2


def test_list_extra_attempts_empty(client: TestClient, db: Session):
    _seed_course(db)
    quiz, _, _ = _seed_quiz_with_questions(db)

    resp = client.get(f"/api/v1/quizzes/{quiz.id}/extra-attempts")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_extra_attempts_student_forbidden(student_client: TestClient, db: Session):
    _seed_course_with_enrollment(db)
    quiz, _, _ = _seed_quiz_with_questions(db)

    resp = student_client.get(f"/api/v1/quizzes/{quiz.id}/extra-attempts")
    assert resp.status_code == 403


def test_list_extra_attempts_quiz_not_found(client: TestClient, db: Session):
    resp = client.get(f"/api/v1/quizzes/{uuid.uuid4()}/extra-attempts")
    assert resp.status_code == 404


def test_list_extra_attempts_anon_unauthorized(anon_client: TestClient):
    resp = anon_client.get(f"/api/v1/quizzes/{uuid.uuid4()}/extra-attempts")
    assert resp.status_code == 401
