from sqlalchemy import Column, String, Text, Integer, ForeignKey, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class Assignment(Base):
    __tablename__ = "assignments"
    __table_args__ = (
        Index("ix_assignments_chapter_id", "chapter_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chapter_id = Column(String, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    max_score = Column(Integer, nullable=False, default=100)
    due_date = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AssignmentSubmission(Base):
    __tablename__ = "assignment_submissions"
    __table_args__ = (
        Index("ix_assignment_subs_student_assignment", "student_id", "assignment_id"),
        Index("ix_assignment_subs_assignment_id", "assignment_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(UUID(as_uuid=True), nullable=False)
    content = Column(Text)
    file_url = Column(Text)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(20), nullable=False, default="submitted")
    grade = Column(Integer)
    feedback = Column(Text)
    graded_by = Column(UUID(as_uuid=True))
    graded_at = Column(DateTime(timezone=True))
