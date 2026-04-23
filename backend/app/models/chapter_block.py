import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ChapterBlock(Base):
    __tablename__ = "chapter_blocks"
    __table_args__ = (Index("ix_chapter_blocks_chapter_id_order", "chapter_id", "order_index"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    chapter_id: Mapped[str] = mapped_column(ForeignKey("chapters.id", ondelete="CASCADE"))
    block_type: Mapped[str] = mapped_column(String(20))
    order_index: Mapped[int] = mapped_column(default=0)
    content: Mapped[str | None] = mapped_column(Text)
    quiz_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("quizzes.id", ondelete="SET NULL"))
    assignment_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("assignments.id", ondelete="SET NULL"))
    # Persist only the bucket + object path. Signed URLs are minted on
    # demand by the client against the current Supabase secret, so JWT-secret
    # rotation can never break chapter file links.
    file_bucket: Mapped[str | None] = mapped_column(String(50))
    file_path: Mapped[str | None] = mapped_column(Text)
    file_name: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
