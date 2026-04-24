from sqlalchemy.orm import Session

from app.api.dependencies import verify_chapter_owner
from app.models.quiz import Quiz


def verify_quiz_owner(db: Session, quiz: Quiz, teacher_id) -> None:
    """Teacher-owned-chapter check lifted into the `quizzes` package.

    Wraps ``verify_chapter_owner`` so callers don't need to reach into
    ``quiz.chapter_id`` each time.
    """
    verify_chapter_owner(db, quiz.chapter_id, teacher_id)
