import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class CoursePrerequisite(Base):
    __tablename__ = "course_prerequisites"
    __table_args__ = (
        UniqueConstraint("course_id", "prerequisite_course_id", name="uq_prerequisite_course_pair"),
        Index("ix_course_prerequisites_course_id", "course_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    prerequisite_course_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
