import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class CourseEvent(Base):
    __tablename__ = "course_events"
    __table_args__ = (
        Index("ix_course_events_course_id", "course_id"),
        Index("ix_course_events_event_date", "event_date"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(String(30), nullable=False, default="other")
    event_date = Column(DateTime(timezone=True), nullable=False)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
