from pydantic import BaseModel, Field
from datetime import datetime


class AnnouncementCreate(BaseModel):
    title: str = Field(..., max_length=200)
    content: str = Field(..., max_length=5000)
    course_id: str | None = None


class AnnouncementUpdate(BaseModel):
    title: str | None = None
    content: str | None = None


class AnnouncementResponse(BaseModel):
    id: str
    title: str
    content: str
    course_id: str | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True
