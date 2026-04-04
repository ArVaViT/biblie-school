from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

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
async def get_chapter_quiz(
    chapter_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_chapter_access(db, chapter_id, current_user)
    quiz = db.query(Quiz).filter(Quiz.chapter_id == chapter_id).first()
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
async def get_quiz_detail(
    quiz_id: UUID,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    _verify_quiz_owner(db, quiz, teacher.id)
    return quiz


@router.post("", response_model=QuizResponse, status_code=status.HTTP_201_CREATED)
async def create_quiz(
    data: QuizCreate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    verify_chapter_owner(db, data.chapter_id, teacher.id)
    max_attempts = data.max_attempts
    if data.quiz_type == "exam" and max_attempts is None:
        max_attempts = 1

    quiz = Quiz(
        chapter_id=data.chapter_id,
        title=data.title,
        description=data.description,
        quiz_type=data.quiz_type,
        max_attempts=max_attempts,
        passing_score=data.passing_score,
    )
    db.add(quiz)
    db.flush()

    for q_data in data.questions:
        question = QuizQuestion(
            quiz_id=quiz.id,
            question_text=q_data.question_text,
            question_type=q_data.question_type,
            order_index=q_data.order_index,
            points=q_data.points,
        )
        db.add(question)
        db.flush()

        for o_data in q_data.options:
            option = QuizOption(
                question_id=question.id,
                option_text=o_data.option_text,
                is_correct=o_data.is_correct,
                order_index=o_data.order_index,
            )
            db.add(option)

    db.commit()
    db.refresh(quiz)
    return quiz


@router.put("/{quiz_id}", response_model=QuizResponse)
async def update_quiz(
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
    db.refresh(quiz)
    return quiz


@router.delete("/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quiz(
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


@router.post("/{quiz_id}/submit", response_model=QuizAttemptResponse)
async def submit_quiz(
    quiz_id: UUID,
    data: QuizSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
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

    if quiz.max_attempts is not None:
        used_attempts = (
            db.query(QuizAttempt)
            .filter(
                QuizAttempt.quiz_id == quiz_id,
                QuizAttempt.user_id == current_user.id,
                QuizAttempt.completed_at.isnot(None),
            )
            .count()
        )
        extra = (
            db.query(QuizExtraAttempt)
            .filter(
                QuizExtraAttempt.quiz_id == quiz_id,
                QuizExtraAttempt.user_id == current_user.id,
            )
            .first()
        )
        total_allowed = quiz.max_attempts + (extra.extra_attempts if extra else 0)
        if used_attempts >= total_allowed:
            detail = "Maximum attempts reached"
            if quiz.quiz_type == "exam":
                detail = "Exam attempts limit reached"
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)

    attempt = QuizAttempt(
        quiz_id=quiz_id,
        user_id=current_user.id,
    )
    db.add(attempt)
    db.flush()

    total_score = 0

    questions_map: dict[UUID, QuizQuestion] = {q.id: q for q in quiz.questions}
    max_score = sum(q.points for q in quiz.questions)

    all_options = db.query(QuizOption).join(QuizQuestion).filter(QuizQuestion.quiz_id == quiz_id).all()
    options_by_id = {str(o.id): o for o in all_options}

    correct_option_map: dict[str, UUID | None] = {}
    for o in all_options:
        if o.is_correct:
            correct_option_map[str(o.question_id)] = o.id

    answer_results: list[QuizAnswerResult] = []
    answered_question_ids: set[UUID] = set()

    for ans in data.answers:
        question = questions_map.get(ans.question_id)
        if not question:
            continue

        answered_question_ids.add(question.id)
        is_correct = False
        points_earned = 0

        if question.question_type in ("multiple_choice", "true_false") and ans.selected_option_id:
            option = options_by_id.get(str(ans.selected_option_id))
            if option and option.question_id == question.id and option.is_correct:
                is_correct = True
                points_earned = question.points

        total_score += points_earned

        db_answer = QuizAnswer(
            attempt_id=attempt.id,
            question_id=ans.question_id,
            selected_option_id=ans.selected_option_id,
            text_answer=ans.text_answer,
            is_correct=is_correct,
            points_earned=points_earned,
        )
        db.add(db_answer)

        answer_results.append(
            QuizAnswerResult(
                question_id=ans.question_id,
                selected_option_id=ans.selected_option_id,
                text_answer=ans.text_answer,
                is_correct=is_correct,
                points_earned=points_earned,
                correct_option_id=correct_option_map.get(str(ans.question_id)),
            )
        )

    for q in quiz.questions:
        if q.id not in answered_question_ids:
            db_answer = QuizAnswer(
                attempt_id=attempt.id,
                question_id=q.id,
                selected_option_id=None,
                text_answer=None,
                is_correct=False,
                points_earned=0,
            )
            db.add(db_answer)
            answer_results.append(
                QuizAnswerResult(
                    question_id=q.id,
                    selected_option_id=None,
                    text_answer=None,
                    is_correct=False,
                    points_earned=0,
                    correct_option_id=correct_option_map.get(str(q.id)),
                )
            )

    attempt.score = total_score
    attempt.max_score = max_score
    percentage = (total_score / max_score * 100) if max_score > 0 else 0
    attempt.passed = percentage >= quiz.passing_score
    attempt.completed_at = datetime.now(UTC)

    cp = (
        db.query(ChapterProgress)
        .filter(ChapterProgress.user_id == current_user.id, ChapterProgress.chapter_id == str(quiz.chapter_id))
        .first()
    )
    if not cp:
        cp = ChapterProgress(user_id=current_user.id, chapter_id=str(quiz.chapter_id))
        db.add(cp)
    if not cp.completed:
        cp.completed = True
        cp.completed_at = datetime.now(UTC)
        cp.completion_type = "quiz"

    db.commit()
    sync_enrollment_progress(db, current_user.id, course_id)
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
async def get_quiz_attempts(
    quiz_id: UUID,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    _verify_quiz_owner(db, quiz, teacher.id)
    return db.query(QuizAttempt).filter(QuizAttempt.quiz_id == quiz_id).order_by(QuizAttempt.started_at.desc()).all()


@router.get("/{quiz_id}/my-attempts", response_model=list[QuizAttemptResponse])
async def get_my_quiz_attempts(
    quiz_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.quiz_id == quiz_id,
            QuizAttempt.user_id == current_user.id,
        )
        .order_by(QuizAttempt.started_at.desc())
        .all()
    )


@router.post("/{quiz_id}/extra-attempts", response_model=ExtraAttemptsResponse)
async def grant_extra_attempts(
    quiz_id: UUID,
    data: GrantExtraAttemptsRequest,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    _verify_quiz_owner(db, quiz, teacher.id)

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

    db.commit()
    db.refresh(existing)
    return existing


@router.get("/{quiz_id}/extra-attempts", response_model=list[ExtraAttemptsResponse])
async def list_extra_attempts(
    quiz_id: UUID,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    _verify_quiz_owner(db, quiz, teacher.id)

    return db.query(QuizExtraAttempt).filter(QuizExtraAttempt.quiz_id == quiz_id).all()
