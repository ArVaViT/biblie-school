import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

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

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column()
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    certificate_number: Mapped[str | None] = mapped_column(String(50), unique=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    teacher_approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    teacher_approved_by: Mapped[uuid.UUID | None] = mapped_column()
    admin_approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    admin_approved_by: Mapped[uuid.UUID | None] = mapped_column()
    cohort_id: Mapped[uuid.UUID | None] = mapped_column()
