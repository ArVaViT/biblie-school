import uuid
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import (
    get_current_user,
    require_teacher,
    resolve_chapter_course_id,
    verify_chapter_access,
    verify_chapter_owner,
)
from app.core.database import get_db
from app.models.chapter_progress import ChapterProgress
from app.models.enrollment import Enrollment
from app.models.quiz import Quiz, QuizAnswer, QuizAttempt, QuizExtraAttempt, QuizOption, QuizQuestion
from app.models.user import User
from app.schemas.quiz import (
    ExtraAttemptsResponse,
    GrantExtraAttemptsRequest,
    PendingAnswerInfo,
    QuizAnswerGradeRequest,
    QuizAnswerResult,
    QuizAttemptResponse,
    QuizCreate,
    QuizResponse,
    QuizStudentResponse,
    QuizSubmitRequest,
    QuizUpdate,
)
from app.services.course_service import sync_enrollment_progress

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


@router.get("/chapter/{chapter_id}", response_model=QuizStudentResponse | None)
def get_chapter_quiz(
    chapter_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_chapter_access(db, chapter_id, current_user)
    quiz = (
        db.query(Quiz)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.options))
        .filter(Quiz.chapter_id == chapter_id)
        .first()
    )
    if not quiz:
        return None

    resp = QuizStudentResponse.model_validate(quiz)
    if resp.max_attempts is not None:
        extra = (
            db.query(QuizExtraAttempt)
            .filter(QuizExtraAttempt.quiz_id == quiz.id, QuizExtraAttempt.user_id == current_user.id)
            .first()
        )
        if extra:
            resp.max_attempts = resp.max_attempts + extra.extra_attempts
    return resp


def _verify_quiz_owner(db: Session, quiz: Quiz, teacher_id) -> None:
    verify_chapter_owner(db, quiz.chapter_id, teacher_id)


@router.get("/{quiz_id}", response_model=QuizResponse)
def get_quiz_detail(
    quiz_id: UUID,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    quiz = (
        db.query(Quiz)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.options))
        .filter(Quiz.id == quiz_id)
        .first()
    )
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    _verify_quiz_owner(db, quiz, teacher.id)
    return quiz


@router.post("", response_model=QuizResponse, status_code=status.HTTP_201_CREATED)
def create_quiz(
    data: QuizCreate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    verify_chapter_owner(db, data.chapter_id, teacher)
    max_attempts = data.max_attempts
    if data.quiz_type == "exam" and max_attempts is None:
        max_attempts = 1

    quiz_id_val = uuid.uuid4()
    quiz = Quiz(
        id=quiz_id_val,
        chapter_id=data.chapter_id,
        title=data.title,
        description=data.description,
        quiz_type=data.quiz_type,
        max_attempts=max_attempts,
        passing_score=data.passing_score,
    )
    db.add(quiz)

    for q_data in data.questions:
        question_id = uuid.uuid4()
        db.add(
            QuizQuestion(
                id=question_id,
                quiz_id=quiz_id_val,
                question_text=q_data.question_text,
                question_type=q_data.question_type,
                order_index=q_data.order_index,
                points=q_data.points,
                # ``min_words`` is only meaningful for ``essay``; it's
                # intentionally persisted as-is for every type so that
                # switching a question to ``essay`` later keeps the hint.
                min_words=q_data.min_words,
            )
        )
        for o_data in q_data.options:
            db.add(
                QuizOption(
                    question_id=question_id,
                    option_text=o_data.option_text,
                    is_correct=o_data.is_correct,
                    order_index=o_data.order_index,
                )
            )

    db.commit()
    reloaded = (
        db.query(Quiz)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.options))
        .filter(Quiz.id == quiz_id_val)
        .first()
    )
    if reloaded is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    return reloaded


@router.put("/{quiz_id}", response_model=QuizResponse)
def update_quiz(
    quiz_id: UUID,
    data: QuizUpdate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    _verify_quiz_owner(db, quiz, teacher.id)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(quiz, field, value)

    if quiz.quiz_type == "exam" and quiz.max_attempts is None:
        quiz.max_attempts = 1

    db.commit()
    reloaded = (
        db.query(Quiz)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.options))
        .filter(Quiz.id == quiz.id)
        .first()
    )
    if reloaded is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    return reloaded


@router.delete("/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(
    quiz_id: UUID,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    _verify_quiz_owner(db, quiz, teacher.id)
    db.delete(quiz)
    db.commit()


# Question types that are auto-graded at submit time.
# ``short_answer`` and ``essay`` are graded by the teacher afterwards via
# ``PATCH /quizzes/answers/{answer_id}``.
AUTO_GRADED_QUESTION_TYPES = ("multiple_choice", "true_false")
MANUAL_GRADED_QUESTION_TYPES = ("short_answer", "essay")


def _ensure_attempts_available(db: Session, quiz: Quiz, user_id: UUID) -> None:
    """Raise 403 if the student has used every allowed attempt on this quiz."""
    if quiz.max_attempts is None:
        return
    used_attempts = (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.quiz_id == quiz.id,
            QuizAttempt.user_id == user_id,
            QuizAttempt.completed_at.isnot(None),
        )
        .count()
    )
    extra = (
        db.query(QuizExtraAttempt)
        .filter(QuizExtraAttempt.quiz_id == quiz.id, QuizExtraAttempt.user_id == user_id)
        .first()
    )
    total_allowed = quiz.max_attempts + (extra.extra_attempts if extra else 0)
    if used_attempts >= total_allowed:
        detail = "Exam attempts limit reached" if quiz.quiz_type == "exam" else "Maximum attempts reached"
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def _index_quiz_options(quiz: Quiz) -> tuple[dict[str, QuizOption], dict[str, UUID]]:
    """Build ``{option_id: option}`` and ``{question_id: correct_option_id}`` maps.

    Options were already eager-loaded on the quiz, so this is just a fan-out.
    """
    options_by_id: dict[str, QuizOption] = {}
    correct_option_map: dict[str, UUID] = {}
    for q in quiz.questions:
        for o in q.options:
            options_by_id[str(o.id)] = o
            if o.is_correct:
                correct_option_map[str(o.question_id)] = o.id
    return options_by_id, correct_option_map


def _grade_single_answer(
    question: QuizQuestion,
    selected_option_id: UUID | None,
    options_by_id: dict[str, QuizOption],
) -> tuple[bool, int]:
    """Return ``(is_correct, points_earned)`` for an auto-gradable answer."""
    if question.question_type not in AUTO_GRADED_QUESTION_TYPES or not selected_option_id:
        return False, 0
    option = options_by_id.get(str(selected_option_id))
    if option and option.question_id == question.id and option.is_correct:
        return True, int(question.points)
    return False, 0


def _persist_answers(
    db: Session,
    attempt: QuizAttempt,
    quiz: Quiz,
    submitted: list,
    questions_map: dict[UUID, QuizQuestion],
    options_by_id: dict[str, QuizOption],
    correct_option_map: dict[str, UUID],
) -> tuple[int, list[QuizAnswerResult]]:
    """Write ``QuizAnswer`` rows for submitted AND unanswered questions.

    Returns ``(total_score, answer_results)``. Exam attempts do not leak the
    correct option back to the student.
    """
    show_correct = quiz.quiz_type != "exam"
    total_score = 0
    answer_results: list[QuizAnswerResult] = []
    answered: set[Any] = set()

    for ans in submitted:
        question = questions_map.get(ans.question_id)
        if not question:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown question_id: {ans.question_id}",
            )
        answered.add(question.id)
        is_correct, points_earned = _grade_single_answer(question, ans.selected_option_id, options_by_id)
        total_score += points_earned

        answer_row = QuizAnswer(
            attempt_id=attempt.id,
            question_id=ans.question_id,
            selected_option_id=ans.selected_option_id,
            text_answer=ans.text_answer,
            is_correct=is_correct,
            points_earned=points_earned,
        )
        db.add(answer_row)
        db.flush()
        answer_results.append(
            QuizAnswerResult(
                id=answer_row.id,
                question_id=ans.question_id,
                selected_option_id=ans.selected_option_id,
                text_answer=ans.text_answer,
                is_correct=is_correct,
                points_earned=points_earned,
                correct_option_id=correct_option_map.get(str(ans.question_id)) if show_correct else None,
            )
        )

    # Record a zeroed answer for every question the student skipped. This is
    # what keeps ``max_score`` honest and makes the results screen render
    # every row, not just the ones the student touched.
    for q in quiz.questions:
        if q.id in answered:
            continue
        skip_row = QuizAnswer(
            attempt_id=attempt.id,
            question_id=q.id,
            selected_option_id=None,
            text_answer=None,
            is_correct=False,
            points_earned=0,
        )
        db.add(skip_row)
        db.flush()
        answer_results.append(
            QuizAnswerResult(
                id=skip_row.id,
                question_id=q.id,
                selected_option_id=None,
                text_answer=None,
                is_correct=False,
                points_earned=0,
                correct_option_id=correct_option_map.get(str(q.id)) if show_correct else None,
            )
        )
    return total_score, answer_results


def _upsert_passed_chapter_progress(db: Session, user_id: UUID, chapter_id: str) -> None:
    """Mark the chapter as ``quiz``-completed for the student (idempotent)."""
    cp = (
        db.query(ChapterProgress)
        .filter(ChapterProgress.user_id == user_id, ChapterProgress.chapter_id == chapter_id)
        .first()
    )
    if not cp:
        cp = ChapterProgress(user_id=user_id, chapter_id=chapter_id)
        db.add(cp)
    if not cp.completed:
        cp.completed = True
        cp.completed_at = datetime.now(UTC)
        cp.completion_type = "quiz"


@router.post("/{quiz_id}/submit", response_model=QuizAttemptResponse)
def submit_quiz(
    quiz_id: UUID,
    data: QuizSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    quiz = (
        db.query(Quiz)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.options))
        .filter(Quiz.id == quiz_id)
        .with_for_update()
        .first()
    )
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")

    course_id = resolve_chapter_course_id(db, quiz.chapter_id)
    enrolled = (
        db.query(Enrollment).filter(Enrollment.user_id == current_user.id, Enrollment.course_id == course_id).first()
    )
    if not enrolled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be enrolled in this course to submit quizzes",
        )

    _ensure_attempts_available(db, quiz, current_user.id)

    attempt = QuizAttempt(quiz_id=quiz_id, user_id=current_user.id)
    db.add(attempt)
    db.flush()

    questions_map: dict[UUID, QuizQuestion] = {q.id: q for q in quiz.questions}
    options_by_id, correct_option_map = _index_quiz_options(quiz)
    # ``max_score`` is the full potential score including open-ended
    # questions so that students can't be auto-passed on half-graded work
    # (e.g. auto 4/4 on MCQ + pending 20-point essay would otherwise report
    # 100%). When a teacher later grades the essay the ``passed`` flag is
    # recomputed in ``grade_answer``.
    max_score = sum(q.points for q in quiz.questions)

    total_score, answer_results = _persist_answers(
        db, attempt, quiz, data.answers, questions_map, options_by_id, correct_option_map
    )

    attempt.score = total_score
    attempt.max_score = max_score
    percentage = (total_score / max_score * 100) if max_score > 0 else 0
    # A quiz with only manual questions will have ``percentage == 0`` on
    # submit and therefore will not auto-pass; ``passed`` stays ``False``
    # until the teacher grades at least enough manual answers to clear
    # ``passing_score``.
    attempt.passed = max_score > 0 and percentage >= quiz.passing_score
    attempt.completed_at = datetime.now(UTC)

    if attempt.passed:
        _upsert_passed_chapter_progress(db, current_user.id, str(quiz.chapter_id))
        sync_enrollment_progress(db, current_user.id, course_id)

    db.commit()
    db.refresh(attempt)

    return QuizAttemptResponse(
        id=attempt.id,
        quiz_id=attempt.quiz_id,
        user_id=attempt.user_id,
        score=attempt.score,
        max_score=attempt.max_score,
        passed=attempt.passed,
        started_at=attempt.started_at,
        completed_at=attempt.completed_at,
        answers=answer_results,
    )


@router.get("/{quiz_id}/attempts", response_model=list[QuizAttemptResponse])
def get_quiz_attempts(
    quiz_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    _verify_quiz_owner(db, quiz, teacher.id)
    return (
        db.query(QuizAttempt)
        .options(selectinload(QuizAttempt.answers))
        .filter(QuizAttempt.quiz_id == quiz_id)
        .order_by(QuizAttempt.started_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{quiz_id}/pending-answers", response_model=list[PendingAnswerInfo])
def list_pending_answers(
    quiz_id: UUID,
    include_graded: bool = Query(
        False,
        description="If true, return already-graded open-ended answers too.",
    ),
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Flat list of open-ended answers for the teacher's grading queue.

    An answer is considered *pending* when it carries text but still has
    ``points_earned == 0`` AND no ``grader_comment`` — that's our proxy for
    "not graded yet", since a legitimate 0-point grade with a comment is
    distinguishable from the untouched default.
    """
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    _verify_quiz_owner(db, quiz, teacher.id)

    query = (
        db.query(QuizAnswer, QuizQuestion, QuizAttempt, User)
        .join(QuizQuestion, QuizQuestion.id == QuizAnswer.question_id)
        .join(QuizAttempt, QuizAttempt.id == QuizAnswer.attempt_id)
        .join(User, User.id == QuizAttempt.user_id)
        .filter(
            QuizAttempt.quiz_id == quiz_id,
            QuizAttempt.completed_at.isnot(None),
            QuizQuestion.question_type.in_(MANUAL_GRADED_QUESTION_TYPES),
            QuizAnswer.text_answer.isnot(None),
        )
        .order_by(QuizAttempt.completed_at.desc(), QuizQuestion.order_index.asc())
    )
    if not include_graded:
        query = query.filter(QuizAnswer.grader_comment.is_(None), QuizAnswer.points_earned == 0)

    results: list[PendingAnswerInfo] = []
    for answer, question, attempt, student in query.all():
        results.append(
            PendingAnswerInfo(
                answer_id=answer.id,
                attempt_id=attempt.id,
                question_id=question.id,
                question_text=question.question_text,
                question_type=question.question_type,
                max_points=int(question.points),
                min_words=question.min_words,
                text_answer=answer.text_answer,
                points_earned=int(answer.points_earned),
                grader_comment=answer.grader_comment,
                student_id=student.id,
                student_name=student.full_name,
                student_email=student.email,
                submitted_at=attempt.completed_at,
            )
        )
    return results


def _recompute_attempt_grade(db: Session, attempt: QuizAttempt, quiz: Quiz) -> None:
    """Re-aggregate ``score`` / ``passed`` from the persisted answer rows.

    Called after every manual grade update so the attempt stays in sync
    without the teacher having to touch a "recompute" button.
    """
    rows = db.query(QuizAnswer).filter(QuizAnswer.attempt_id == attempt.id).all()
    attempt.score = sum(int(r.points_earned or 0) for r in rows)
    # ``max_score`` is already the full potential from submit(); we don't
    # recompute it here because question.points might legally change later
    # (rare) and we want the attempt to reflect the grading state, not
    # the current quiz definition.
    was_passed = bool(attempt.passed)
    max_score = int(attempt.max_score or 0)
    percentage = (attempt.score / max_score * 100) if max_score > 0 else 0
    attempt.passed = max_score > 0 and percentage >= quiz.passing_score

    if attempt.passed and not was_passed:
        _upsert_passed_chapter_progress(db, attempt.user_id, str(quiz.chapter_id))
        course_id = resolve_chapter_course_id(db, quiz.chapter_id)
        sync_enrollment_progress(db, attempt.user_id, course_id)


@router.patch("/answers/{answer_id}", response_model=QuizAnswerResult)
def grade_answer(
    answer_id: UUID,
    data: QuizAnswerGradeRequest,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Teacher grades a single open-ended answer.

    Rules:
    * The associated question must be ``short_answer`` or ``essay``;
      auto-graded answers cannot be edited (they're scored deterministically).
    * ``points_earned`` is clamped by the question's ``points`` cap.
    * On success we re-aggregate ``attempt.score`` + ``attempt.passed`` and,
      if ``passed`` flipped from False → True, mark the chapter as
      ``quiz``-completed.
    """
    answer = db.query(QuizAnswer).filter(QuizAnswer.id == answer_id).first()
    if not answer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Answer not found")

    question = db.query(QuizQuestion).filter(QuizQuestion.id == answer.question_id).first()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    if question.question_type not in MANUAL_GRADED_QUESTION_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only open-ended answers (short_answer / essay) can be graded manually",
        )

    attempt = db.query(QuizAttempt).filter(QuizAttempt.id == answer.attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found")

    quiz = db.query(Quiz).filter(Quiz.id == attempt.quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    _verify_quiz_owner(db, quiz, teacher.id)

    if data.points_earned > int(question.points):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"points_earned ({data.points_earned}) exceeds question cap ({question.points})",
        )

    answer.points_earned = data.points_earned
    answer.grader_comment = data.grader_comment
    # Flip ``is_correct`` to a ternary-ish flag that the UI can interpret:
    # ``True`` when the teacher awarded full credit, ``False`` when they
    # awarded zero, ``None`` for partial credit.
    if data.points_earned == int(question.points):
        answer.is_correct = True
    elif data.points_earned == 0:
        answer.is_correct = False
    else:
        answer.is_correct = None

    _recompute_attempt_grade(db, attempt, quiz)
    db.commit()
    db.refresh(answer)

    return QuizAnswerResult(
        id=answer.id,
        question_id=answer.question_id,
        selected_option_id=answer.selected_option_id,
        text_answer=answer.text_answer,
        is_correct=answer.is_correct,
        points_earned=int(answer.points_earned),
        grader_comment=answer.grader_comment,
        correct_option_id=None,
    )


@router.get("/{quiz_id}/my-attempts", response_model=list[QuizAttemptResponse])
def get_my_quiz_attempts(
    quiz_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    verify_chapter_access(db, quiz.chapter_id, current_user)

    return (
        db.query(QuizAttempt)
        .options(selectinload(QuizAttempt.answers))
        .filter(
            QuizAttempt.quiz_id == quiz_id,
            QuizAttempt.user_id == current_user.id,
        )
        .order_by(QuizAttempt.started_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.post("/{quiz_id}/extra-attempts", response_model=ExtraAttemptsResponse)
def grant_extra_attempts(
    quiz_id: UUID,
    data: GrantExtraAttemptsRequest,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    _verify_quiz_owner(db, quiz, teacher.id)

    course_id = resolve_chapter_course_id(db, quiz.chapter_id)
    enrolled = (
        db.query(Enrollment).filter(Enrollment.user_id == data.user_id, Enrollment.course_id == course_id).first()
    )
    if not enrolled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student is not enrolled in this course")

    existing = (
        db.query(QuizExtraAttempt)
        .filter(QuizExtraAttempt.quiz_id == quiz_id, QuizExtraAttempt.user_id == data.user_id)
        .first()
    )
    if existing:
        existing.extra_attempts = data.extra_attempts
        existing.granted_by = teacher.id
    else:
        existing = QuizExtraAttempt(
            quiz_id=quiz_id,
            user_id=data.user_id,
            extra_attempts=data.extra_attempts,
            granted_by=teacher.id,
        )
        db.add(existing)

    try:
        db.commit()
    except IntegrityError:
        # Concurrent POST inserted the same ``(quiz_id, user_id)`` row between
        # our check and commit. Recover by updating the winner row instead of
        # surfacing a 500.
        db.rollback()
        existing = (
            db.query(QuizExtraAttempt)
            .filter(QuizExtraAttempt.quiz_id == quiz_id, QuizExtraAttempt.user_id == data.user_id)
            .first()
        )
        if existing is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Could not grant extra attempts — please retry",
            ) from None
        existing.extra_attempts = data.extra_attempts
        existing.granted_by = teacher.id
        db.commit()
    db.refresh(existing)
    return existing


@router.get("/{quiz_id}/extra-attempts", response_model=list[ExtraAttemptsResponse])
def list_extra_attempts(
    quiz_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    _verify_quiz_owner(db, quiz, teacher.id)

    return (
        db.query(QuizExtraAttempt)
        .filter(QuizExtraAttempt.quiz_id == quiz_id)
        .order_by(QuizExtraAttempt.id)
        .offset(skip)
        .limit(limit)
        .all()
    )
