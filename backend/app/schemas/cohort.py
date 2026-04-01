from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional, Literal
from uuid import UUID


class CohortCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    start_date: datetime
    end_date: datetime
    enrollment_start: Optional[datetime] = None
    enrollment_end: Optional[datetime] = None
    max_students: Optional[int] = Field(None, ge=1)


class CohortUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    enrollment_start: Optional[datetime] = None
    enrollment_end: Optional[datetime] = None
    status: Optional[Literal["upcoming", "active", "completed", "archived"]] = None
    max_students: Optional[int] = Field(None, ge=1)


class CohortResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    course_id: str
    name: str
    start_date: datetime
    end_date: datetime
    enrollment_start: Optional[datetime] = None
    enrollment_end: Optional[datetime] = None
    status: str
    max_students: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    student_count: int = 0
