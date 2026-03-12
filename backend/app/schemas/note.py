from pydantic import BaseModel
from datetime import datetime


class NoteUpsert(BaseModel):
    content: str


class NoteResponse(BaseModel):
    id: str
    user_id: str
    chapter_id: str
    content: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
