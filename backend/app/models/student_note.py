from sqlalchemy import Column, String, Text, ForeignKey, DateTime, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class StudentNote(Base):
    __tablename__ = "student_notes"
    __table_args__ = (
        UniqueConstraint("user_id", "chapter_id", name="uq_student_note_user_chapter"),
        Index("ix_student_notes_user_id", "user_id"),
        Index("ix_student_notes_chapter_id", "chapter_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    chapter_id = Column(String, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<StudentNote id={self.id} user_id={self.user_id} chapter_id='{self.chapter_id}'>"
