from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Course(Base):
    __tablename__ = "courses"
    __table_args__ = (
        Index("ix_courses_created_by", "created_by"),
        Index("ix_courses_status", "status"),
        CheckConstraint(
            "quiz_weight + assignment_weight + participation_weight = 100",
            name="ck_courses_weights_sum_100",
        ),
    )

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    status = Column(String, default="draft", nullable=False)
    created_by = Column(PgUUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    enrollment_start = Column(DateTime(timezone=True), nullable=True)
    enrollment_end = Column(DateTime(timezone=True), nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    quiz_weight = Column(Integer, nullable=False, default=30, server_default="30")
    assignment_weight = Column(Integer, nullable=False, default=50, server_default="50")
    participation_weight = Column(Integer, nullable=False, default=20, server_default="20")

    modules = relationship("Module", back_populates="course", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="course", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Course id={self.id!r} title={self.title!r}>"


class Module(Base):
    __tablename__ = "modules"
    __table_args__ = (Index("ix_modules_course_id_order", "course_id", "order_index"),)

    id = Column(String, primary_key=True, index=True)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=True)

    course = relationship("Course", back_populates="modules")
    chapters = relationship("Chapter", back_populates="module", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Module id={self.id!r} title={self.title!r} course_id={self.course_id!r}>"


class Chapter(Base):
    __tablename__ = "chapters"
    __table_args__ = (Index("ix_chapters_module_id_order", "module_id", "order_index"),)

    id = Column(String, primary_key=True, index=True)
    module_id = Column(String, ForeignKey("modules.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    content = Column(String, nullable=True)
    video_url = Column(String, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)
    chapter_type = Column(String, default="reading", nullable=False)
    requires_completion = Column(Boolean, default=False, nullable=False)
    is_locked = Column(Boolean, default=False, nullable=False)

    module = relationship("Module", back_populates="chapters")

    def __repr__(self) -> str:
        return f"<Chapter id={self.id!r} title={self.title!r} module_id={self.module_id!r}>"
