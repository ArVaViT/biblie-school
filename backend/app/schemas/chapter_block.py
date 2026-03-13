from pydantic import BaseModel
from datetime import datetime
from typing import Literal, Optional


class BlockCreate(BaseModel):
    block_type: Literal["text", "video", "quiz", "assignment", "file"]
    order_index: int = 0
    content: Optional[str] = None
    video_url: Optional[str] = None
    quiz_id: Optional[str] = None
    assignment_id: Optional[str] = None
    file_url: Optional[str] = None


class BlockUpdate(BaseModel):
    block_type: Optional[str] = None
    order_index: Optional[int] = None
    content: Optional[str] = None
    video_url: Optional[str] = None
    quiz_id: Optional[str] = None
    assignment_id: Optional[str] = None
    file_url: Optional[str] = None


class BlockResponse(BaseModel):
    id: str
    chapter_id: str
    block_type: str
    order_index: int
    content: Optional[str] = None
    video_url: Optional[str] = None
    quiz_id: Optional[str] = None
    assignment_id: Optional[str] = None
    file_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BlockReorderItem(BaseModel):
    id: str
    order_index: int
