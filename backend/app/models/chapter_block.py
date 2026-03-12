from sqlalchemy import Column, String, Text, Integer, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class ChapterBlock(Base):
    __tablename__ = "chapter_blocks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chapter_id = Column(String, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    block_type = Column(String(20), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)
    content = Column(Text)
    video_url = Column(Text)
    quiz_id = Column(UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="SET NULL"))
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assignments.id", ondelete="SET NULL"))
    file_url = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
