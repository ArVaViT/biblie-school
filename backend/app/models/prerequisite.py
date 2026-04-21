from sqlalchemy import Column, ForeignKey, Index, String

from app.core.database import Base


class CoursePrerequisite(Base):
    __tablename__ = "course_prerequisites"
    __table_args__ = (Index("ix_course_prerequisites_course_id", "course_id"),)

    # Plain join table — composite primary key matches production (no surrogate
    # id/created_at). Keeping the model lean prevents an accidental second
    # schema drift between ORM and DB.
    course_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True)
    prerequisite_course_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True)
