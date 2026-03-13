from pydantic import BaseModel, Field
from datetime import datetime


class NoteUpsert(BaseModel):
    content: str = Field(..., max_length=50000)


class NoteResponse(BaseModel):
    id: str
    user_id: str
    chapter_id: str
    content: str
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True
