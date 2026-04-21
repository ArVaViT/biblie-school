import uuid

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class ChapterProgress(Base):
    __tablename__ = "chapter_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "chapter_id", name="uq_progress_user_chapter"),
        # Mirrors production CHECK. Keeping it declarative in the model means
        # fresh Alembic-bootstrapped environments (and the SQLite test DB) also
        # reject invalid values, so a regression like completion_type="quiz" is
        # caught without having to go through the prod DB to find out.
        CheckConstraint(
            "completion_type IN ('self', 'teacher', 'quiz')",
            name="chapter_progress_completion_type_check",
        ),
        Index("ix_chapter_progress_user_id", "user_id"),
        Index("ix_chapter_progress_chapter_id", "chapter_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    chapter_id = Column(String, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    completed_by = Column(UUID(as_uuid=True), nullable=True)
    completion_type = Column(String(10), default="self", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
