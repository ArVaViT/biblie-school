import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class Cohort(Base):
    __tablename__ = "cohorts"
    __table_args__ = (
        Index("ix_cohorts_course_id", "course_id"),
        Index("ix_cohorts_status", "status"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    enrollment_start = Column(DateTime(timezone=True))
    enrollment_end = Column(DateTime(timezone=True))
    status = Column(String(20), nullable=False, default="upcoming")
    max_students = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<Cohort id={self.id} name='{self.name}' course_id='{self.course_id}'>"
