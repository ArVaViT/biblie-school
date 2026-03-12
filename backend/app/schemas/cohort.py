from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Literal


class CohortCreate(BaseModel):
    name: str = Field(max_length=200)
    start_date: datetime
    end_date: datetime
    enrollment_start: Optional[datetime] = None
    enrollment_end: Optional[datetime] = None
    max_students: Optional[int] = None


class CohortUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    enrollment_start: Optional[datetime] = None
    enrollment_end: Optional[datetime] = None
    status: Optional[Literal["upcoming", "active", "completed", "archived"]] = None
    max_students: Optional[int] = None


class CohortResponse(BaseModel):
    id: str
    course_id: str
    name: str
    start_date: datetime
    end_date: datetime
    enrollment_start: Optional[datetime] = None
    enrollment_end: Optional[datetime] = None
    status: str
    max_students: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    student_count: int = 0

    class Config:
        from_attributes = True
