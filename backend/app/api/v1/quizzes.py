from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from uuid import UUID

from app.core.database import get_db
from app.api.dependencies import get_current_user, require_teacher, verify_chapter_owner
from app.models.user import User
from app.models.quiz import Quiz, QuizQuestion, QuizOption, QuizAttempt, QuizAnswer
from app.schemas.quiz import (
    QuizCreate,
    QuizUpdate,
    QuizResponse,
    QuizStudentResponse,
    QuizSubmitRequest,
    QuizAttemptResponse,
)

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


@router.get("/chapter/{chapter_id}", response_model=QuizStudentResponse | None)
async def get_chapter_quiz(
    chapter_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    quiz = db.query(Quiz).filter(Quiz.chapter_id == chapter_id).first()
    if not quiz:
        return None
    return quiz


def _verify_quiz_owner(db: Session, quiz: Quiz, teacher_id) -> None:
    """Resolve quiz -> chapter -> module -> course and verify ownership."""
    verify_chapter_owner(db, quiz.chapter_id, teacher_id)


@router.get("/{quiz_id}", response_model=QuizResponse)
async def get_quiz_detail(
    quiz_id: UUID,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Teacher-only: get full quiz with correct answers visible."""
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
    quiz = Quiz(
        chapter_id=data.chapter_id,
        title=data.title,
        description=data.description,
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

    attempt = QuizAttempt(
        quiz_id=quiz_id,
        user_id=current_user.id,
    )
    db.add(attempt)
    db.flush()

    total_score = 0
    max_score = 0

    questions_map: dict[UUID, QuizQuestion] = {q.id: q for q in quiz.questions}

    all_options = (
        db.query(QuizOption)
        .join(QuizQuestion)
        .filter(QuizQuestion.quiz_id == quiz_id)
        .all()
    )
    options_by_id = {str(o.id): o for o in all_options}

    for ans in data.answers:
        question = questions_map.get(ans.question_id)
        if not question:
            continue

        max_score += question.points
        is_correct = False
        points_earned = 0

        if question.question_type in ("multiple_choice", "true_false") and ans.selected_option_id:
            option = options_by_id.get(str(ans.selected_option_id))
            if option and option.question_id == question.id and option.is_correct:
                is_correct = True
                points_earned = question.points

        total_score += points_earned

        answer = QuizAnswer(
            attempt_id=attempt.id,
            question_id=ans.question_id,
            selected_option_id=ans.selected_option_id,
            text_answer=ans.text_answer,
            is_correct=is_correct,
            points_earned=points_earned,
        )
        db.add(answer)

    attempt.score = total_score
    attempt.max_score = max_score
    percentage = (total_score / max_score * 100) if max_score > 0 else 0
    attempt.passed = percentage >= quiz.passing_score
    attempt.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(attempt)
    return attempt


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
    return (
        db.query(QuizAttempt)
        .filter(QuizAttempt.quiz_id == quiz_id)
        .order_by(QuizAttempt.started_at.desc())
        .all()
    )


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
