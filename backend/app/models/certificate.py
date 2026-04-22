import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class Certificate(Base):
    __tablename__ = "certificates"
    __table_args__ = (
        # The unique constraint already backs a B-tree on
        # ``(user_id, course_id)``; a separate identical index was pure
        # duplication (same columns, same order).
        UniqueConstraint("user_id", "course_id", name="uq_certificate_user_course"),
        Index("ix_certificates_status", "status"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    course_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    issued_at = Column(DateTime(timezone=True), server_default=func.now())
    certificate_number = Column(String(50), nullable=True, unique=True)
    status = Column(String(20), default="pending", nullable=False)
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    teacher_approved_at = Column(DateTime(timezone=True), nullable=True)
    teacher_approved_by = Column(UUID(as_uuid=True), nullable=True)
    admin_approved_at = Column(DateTime(timezone=True), nullable=True)
    admin_approved_by = Column(UUID(as_uuid=True), nullable=True)
    cohort_id = Column(UUID(as_uuid=True), nullable=True)
