"""Quiz CRUD endpoints (teacher + student read-through).

Every route here attaches to the shared ``router`` in ``_router.py``.
"""

import uuid
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import (
    get_current_user,
    require_teacher,
    verify_chapter_access,
    verify_chapter_owner,
)
from app.core.database import get_db
from app.models.quiz import Quiz, QuizExtraAttempt, QuizOption, QuizQuestion
from app.models.user import User
from app.schemas.quiz import (
    QuizCreate,
    QuizResponse,
    QuizStudentResponse,
    QuizUpdate,
)

from ._deps import verify_quiz_owner
from ._router import router


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
            .filter(
                QuizExtraAttempt.quiz_id == quiz.id,
                QuizExtraAttempt.user_id == current_user.id,
            )
            .first()
        )
        if extra:
            resp.max_attempts = resp.max_attempts + extra.extra_attempts
    return resp


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
    verify_quiz_owner(db, quiz, teacher.id)
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
    verify_quiz_owner(db, quiz, teacher.id)

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
    verify_quiz_owner(db, quiz, teacher.id)
    db.delete(quiz)
    db.commit()
