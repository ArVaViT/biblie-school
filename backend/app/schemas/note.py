from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime


class NoteUpsert(BaseModel):
    content: str = Field(..., max_length=50000)


class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    chapter_id: str
    content: str
    created_at: datetime
    updated_at: datetime | None = None
