from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Literal
from uuid import UUID


class BlockCreate(BaseModel):
    block_type: Literal["text", "video", "quiz", "assignment", "file"]
    order_index: int = 0
    content: str | None = None
    video_url: str | None = None
    quiz_id: str | None = None
    assignment_id: str | None = None
    file_url: str | None = None


class BlockUpdate(BaseModel):
    block_type: str | None = None
    order_index: int | None = None
    content: str | None = None
    video_url: str | None = None
    quiz_id: str | None = None
    assignment_id: str | None = None
    file_url: str | None = None


class BlockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    chapter_id: str
    block_type: str
    order_index: int
    content: str | None = None
    video_url: str | None = None
    quiz_id: UUID | None = None
    assignment_id: UUID | None = None
    file_url: str | None = None
    created_at: datetime
    updated_at: datetime | None = None


class BlockReorderItem(BaseModel):
    id: str
    order_index: int
