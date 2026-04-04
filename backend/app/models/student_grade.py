import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class StudentGrade(Base):
    __tablename__ = "student_grades"
    __table_args__ = (
        Index("ix_student_grades_student_course", "student_id", "course_id"),
        Index("ix_student_grades_student_course_cohort", "student_id", "course_id", "cohort_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), nullable=False)
    course_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    cohort_id = Column(UUID(as_uuid=True), ForeignKey("cohorts.id", ondelete="SET NULL"), nullable=True)
    grade = Column(String(10), nullable=True)
    comment = Column(Text, nullable=True)
    graded_by = Column(UUID(as_uuid=True), nullable=False)
    graded_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<StudentGrade id={self.id} student_id={self.student_id} course_id='{self.course_id}'>"
