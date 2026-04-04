from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    type: str
    title: str
    message: str
    link: str | None = None
    is_read: bool = False
    created_at: datetime
    metadata: dict[str, Any] | None = Field(None, validation_alias="meta")


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    total: int
    page: int
    page_size: int


class UnreadCountResponse(BaseModel):
    count: int
