from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.types import TypeDecorator

from app.core.database import Base


class TSVector(TypeDecorator):
    """PostgreSQL TSVECTOR that falls back to TEXT on non-PG dialects (SQLite)."""

    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import TSVECTOR

            return dialect.type_descriptor(TSVECTOR())
        return dialect.type_descriptor(Text())


class Course(Base):
    __tablename__ = "courses"
    __table_args__ = (
        Index("ix_courses_created_by", "created_by"),
        Index("ix_courses_status", "status"),
        Index(
            "ix_courses_created_by_active",
            "created_by",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        CheckConstraint(
            "quiz_weight + assignment_weight + participation_weight = 100",
            name="ck_courses_weights_sum_100",
        ),
    )

    id = Column(String, primary_key=True)
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
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    quiz_weight = Column(Integer, nullable=False, default=30, server_default="30")
    assignment_weight = Column(Integer, nullable=False, default=50, server_default="50")
    participation_weight = Column(Integer, nullable=False, default=20, server_default="20")

    search_vector = Column(TSVector(), nullable=True)

    # ``order_by`` guarantees deterministic ordering whenever the relationship is
    # accessed, including via ``joinedload`` in ``get_course``. Without it
    # Postgres returns rows in whatever order the query plan chose, which
    # surfaced on prod as chapters shown in reverse (see PLATFORM_ISSUES #2).
    modules = relationship(
        "Module",
        back_populates="course",
        cascade="all, delete-orphan",
        order_by="Module.order_index",
    )
    enrollments = relationship("Enrollment", back_populates="course", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Course id={self.id!r} title={self.title!r}>"


class Module(Base):
    __tablename__ = "modules"
    __table_args__ = (
        Index("ix_modules_course_id_order", "course_id", "order_index"),
        Index(
            "ix_modules_course_id_order_active",
            "course_id",
            "order_index",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id = Column(String, primary_key=True)
    # The composite ``ix_modules_course_id_order`` covers plain ``course_id``
    # lookups via its leading column, so no single-column FK index here.
    course_id = Column(String, ForeignKey("courses.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    course = relationship("Course", back_populates="modules")
    chapters = relationship(
        "Chapter",
        back_populates="module",
        cascade="all, delete-orphan",
        order_by="Chapter.order_index",
    )

    def __repr__(self) -> str:
        return f"<Module id={self.id!r} title={self.title!r} course_id={self.course_id!r}>"


class Chapter(Base):
    __tablename__ = "chapters"
    __table_args__ = (
        Index("ix_chapters_module_id_order", "module_id", "order_index"),
        Index(
            "ix_chapters_module_id_order_active",
            "module_id",
            "order_index",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id = Column(String, primary_key=True)
    # Covered by the composite ``ix_chapters_module_id_order`` — same reason
    # as ``Module.course_id``.
    module_id = Column(String, ForeignKey("modules.id"), nullable=False)
    title = Column(String, nullable=False)
    order_index = Column(Integer, default=0, nullable=False)
    chapter_type = Column(String, default="reading", nullable=False)
    requires_completion = Column(Boolean, default=False, nullable=False)
    is_locked = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    module = relationship("Module", back_populates="chapters")

    def __repr__(self) -> str:
        return f"<Chapter id={self.id!r} title={self.title!r} module_id={self.module_id!r}>"
