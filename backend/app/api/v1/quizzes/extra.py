"""Teacher tool to grant extra quiz attempts to individual students."""

from uuid import UUID

from fastapi import Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import require_teacher, resolve_chapter_course_id
from app.core.database import get_db
from app.models.enrollment import Enrollment
from app.models.quiz import Quiz, QuizExtraAttempt
from app.models.user import User
from app.schemas.quiz import ExtraAttemptsResponse, GrantExtraAttemptsRequest

from ._deps import verify_quiz_owner
from ._router import router


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
    verify_quiz_owner(db, quiz, teacher.id)

    course_id = resolve_chapter_course_id(db, quiz.chapter_id)
    enrolled = (
        db.query(Enrollment)
        .filter(
            Enrollment.user_id == data.user_id,
            Enrollment.course_id == course_id,
        )
        .first()
    )
    if not enrolled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student is not enrolled in this course",
        )

    existing = (
        db.query(QuizExtraAttempt)
        .filter(
            QuizExtraAttempt.quiz_id == quiz_id,
            QuizExtraAttempt.user_id == data.user_id,
        )
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
        # Concurrent POST inserted the same ``(quiz_id, user_id)`` row
        # between our check and commit. Recover by updating the winner
        # row instead of surfacing a 500.
        db.rollback()
        existing = (
            db.query(QuizExtraAttempt)
            .filter(
                QuizExtraAttempt.quiz_id == quiz_id,
                QuizExtraAttempt.user_id == data.user_id,
            )
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
    verify_quiz_owner(db, quiz, teacher.id)

    return (
        db.query(QuizExtraAttempt)
        .filter(QuizExtraAttempt.quiz_id == quiz_id)
        .order_by(QuizExtraAttempt.id)
        .offset(skip)
        .limit(limit)
        .all()
    )
