import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class ChapterBlock(Base):
    __tablename__ = "chapter_blocks"
    __table_args__ = (Index("ix_chapter_blocks_chapter_id_order", "chapter_id", "order_index"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chapter_id = Column(String, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    block_type = Column(String(20), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)
    content = Column(Text)
    quiz_id = Column(UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="SET NULL"))
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assignments.id", ondelete="SET NULL"))
    # Pt12: persist only the bucket + object path. Signed URLs are minted on
    # demand by the client against the current Supabase secret, so JWT-secret
    # rotation can never break chapter file links.
    file_bucket = Column(String(50))
    file_path = Column(Text)
    file_name = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
