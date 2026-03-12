from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from uuid import UUID


class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


class ReviewResponse(BaseModel):
    id: UUID
    user_id: UUID
    course_id: str
    rating: int
    comment: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
