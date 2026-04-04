import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class CourseReview(Base):
    __tablename__ = "course_reviews"
    __table_args__ = (
        UniqueConstraint("user_id", "course_id", name="uq_review_user_course"),
        Index("ix_course_reviews_course_id", "course_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    course_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
