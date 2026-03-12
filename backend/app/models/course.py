from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Course(Base):
    __tablename__ = "courses"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    status = Column(String, default="draft", nullable=False)
    created_by = Column(PgUUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    enrollment_start = Column(DateTime(timezone=True), nullable=True)
    enrollment_end = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    modules = relationship("Module", back_populates="course", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="course", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Course id={self.id!r} title={self.title!r}>"


class Module(Base):
    __tablename__ = "modules"

    id = Column(String, primary_key=True, index=True)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)

    course = relationship("Course", back_populates="modules")
    chapters = relationship("Chapter", back_populates="module", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Module id={self.id!r} title={self.title!r} course_id={self.course_id!r}>"


class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(String, primary_key=True, index=True)
    module_id = Column(String, ForeignKey("modules.id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(String, nullable=True)
    video_url = Column(String, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)
    chapter_type = Column(String, default="content", nullable=False)
    requires_completion = Column(Boolean, default=False, nullable=False)

    module = relationship("Module", back_populates="chapters")

    def __repr__(self) -> str:
        return f"<Chapter id={self.id!r} title={self.title!r} module_id={self.module_id!r}>"
