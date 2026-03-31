from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from uuid import UUID


class NoteUpsert(BaseModel):
    content: str = Field(..., max_length=50000)


class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    chapter_id: str
    content: str
    created_at: datetime
    updated_at: datetime | None = None
