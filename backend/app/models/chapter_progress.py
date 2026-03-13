from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class ChapterProgress(Base):
    __tablename__ = "chapter_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "chapter_id", name="uq_progress_user_chapter"),
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
