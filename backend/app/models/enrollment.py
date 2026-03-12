from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(PgUUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False)
    enrolled_at = Column(DateTime(timezone=True), server_default=func.now())
    progress = Column(Integer, default=0, nullable=False)

    user = relationship("User", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")

    def __repr__(self) -> str:
        return f"<Enrollment id={self.id!r} user_id={self.user_id} course_id={self.course_id!r}>"
