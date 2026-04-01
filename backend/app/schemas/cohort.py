from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Literal
from uuid import UUID


class CohortCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    start_date: datetime
    end_date: datetime
    enrollment_start: datetime | None = None
    enrollment_end: datetime | None = None
    max_students: int | None = Field(None, ge=1)


class CohortUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    start_date: datetime | None = None
    end_date: datetime | None = None
    enrollment_start: datetime | None = None
    enrollment_end: datetime | None = None
    status: Literal["upcoming", "active", "completed", "archived"] | None = None
    max_students: int | None = Field(None, ge=1)


class CohortResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    course_id: str
    name: str
    start_date: datetime
    end_date: datetime
    enrollment_start: datetime | None = None
    enrollment_end: datetime | None = None
    status: str
    max_students: int | None = None
    created_at: datetime
    updated_at: datetime | None = None
    student_count: int = 0
