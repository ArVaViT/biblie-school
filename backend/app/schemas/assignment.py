from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Literal
from uuid import UUID


class AssignmentCreate(BaseModel):
    chapter_id: str
    title: str = Field(..., min_length=1, max_length=300)
    description: str | None = None
    max_score: int = Field(100, ge=1, le=10000)
    due_date: datetime | None = None


class AssignmentUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = None
    max_score: int | None = Field(None, ge=1, le=10000)
    due_date: datetime | None = None


class AssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    chapter_id: str
    title: str
    description: str | None = None
    max_score: int
    due_date: datetime | None = None
    created_at: datetime
    updated_at: datetime | None = None


class SubmissionCreate(BaseModel):
    content: str | None = None
    file_url: str | None = None


class SubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    assignment_id: UUID
    student_id: UUID
    content: str | None = None
    file_url: str | None = None
    submitted_at: datetime
    status: str
    grade: int | None = None
    feedback: str | None = None
    graded_by: UUID | None = None
    graded_at: datetime | None = None


class GradeSubmissionRequest(BaseModel):
    grade: int = Field(..., ge=0)
    feedback: str | None = None
    status: Literal["graded", "pending"] = "graded"
