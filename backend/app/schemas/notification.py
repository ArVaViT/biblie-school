from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Any
from uuid import UUID


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    type: str
    title: str
    message: str
    link: Optional[str] = None
    is_read: bool = False
    created_at: datetime
    metadata: Optional[dict[str, Any]] = Field(None, validation_alias="meta")

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    total: int
    page: int
    page_size: int


class UnreadCountResponse(BaseModel):
    count: int
