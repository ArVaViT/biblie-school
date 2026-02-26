from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
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
    created_by = Column(PgUUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    modules = relationship("Module", back_populates="course", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="course", cascade="all, delete-orphan")


class Module(Base):
    __tablename__ = "modules"

    id = Column(String, primary_key=True, index=True)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)

    course = relationship("Course", back_populates="modules")
    chapters = relationship("Chapter", back_populates="module", cascade="all, delete-orphan")


class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(String, primary_key=True, index=True)
    module_id = Column(String, ForeignKey("modules.id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(String, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)

    module = relationship("Module", back_populates="chapters")
