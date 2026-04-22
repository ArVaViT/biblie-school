from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

BLOCK_TYPES = Literal["text", "video", "audio", "quiz", "assignment", "file"]


class BlockCreate(BaseModel):
    block_type: BLOCK_TYPES
    order_index: int = Field(0, ge=0)
    content: str | None = Field(None, max_length=500_000)
    video_url: str | None = Field(None, max_length=2048)
    quiz_id: str | None = Field(None, max_length=36)
    assignment_id: str | None = Field(None, max_length=36)
    file_url: str | None = Field(None, max_length=2048)


class BlockUpdate(BaseModel):
    block_type: BLOCK_TYPES | None = None
    order_index: int | None = Field(None, ge=0)
    content: str | None = Field(None, max_length=500_000)
    video_url: str | None = Field(None, max_length=2048)
    quiz_id: str | None = Field(None, max_length=36)
    assignment_id: str | None = Field(None, max_length=36)
    file_url: str | None = Field(None, max_length=2048)


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
    id: UUID
    order_index: int
