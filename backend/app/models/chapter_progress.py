import uuid

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class ChapterProgress(Base):
    __tablename__ = "chapter_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "chapter_id", name="uq_progress_user_chapter"),
        # Mirrors the production CHECK so the SQLite test DB (bootstrapped
        # from these models via ``Base.metadata.create_all``) rejects invalid
        # values too. A regression like completion_type="quiz" is caught in
        # tests without having to go through the prod DB to find out.
        CheckConstraint(
            "completion_type IN ('self', 'teacher', 'quiz')",
            name="chapter_progress_completion_type_check",
        ),
        # ``uq_progress_user_chapter`` already provides a B-tree on
        # ``user_id`` via its leading column; keep only the chapter-side
        # index for the "all progress rows for chapter X" access pattern.
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
