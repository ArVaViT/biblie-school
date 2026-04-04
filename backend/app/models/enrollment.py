from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("user_id", "course_id", name="uq_enrollment_user_course"),
        Index("ix_enrollments_user_id", "user_id"),
        Index("ix_enrollments_course_id", "course_id"),
        Index("ix_enrollments_cohort_id", "cohort_id"),
    )

    id = Column(String, primary_key=True, index=True)
    user_id = Column(PgUUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False)
    cohort_id = Column(PgUUID(as_uuid=True), ForeignKey("cohorts.id", ondelete="SET NULL"), nullable=True)
    enrolled_at = Column(DateTime(timezone=True), server_default=func.now())
    progress = Column(Integer, default=0, nullable=False)

    user = relationship("User", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")

    def __repr__(self) -> str:
        return f"<Enrollment id={self.id!r} user_id={self.user_id} course_id={self.course_id!r}>"
