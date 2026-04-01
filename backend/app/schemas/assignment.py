from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID


class AssignmentCreate(BaseModel):
    chapter_id: str
    title: str = Field(..., min_length=1, max_length=300)
    description: Optional[str] = None
    max_score: int = Field(100, ge=1, le=10000)
    due_date: Optional[datetime] = None


class AssignmentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    description: Optional[str] = None
    max_score: Optional[int] = Field(None, ge=1, le=10000)
    due_date: Optional[datetime] = None


class AssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    chapter_id: str
    title: str
    description: Optional[str] = None
    max_score: int
    due_date: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class SubmissionCreate(BaseModel):
    content: Optional[str] = None
    file_url: Optional[str] = None


class SubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    assignment_id: UUID
    student_id: UUID
    content: Optional[str] = None
    file_url: Optional[str] = None
    submitted_at: datetime
    status: str
    grade: Optional[int] = None
    feedback: Optional[str] = None
    graded_by: Optional[UUID] = None
    graded_at: Optional[datetime] = None


class GradeSubmissionRequest(BaseModel):
    grade: int = Field(..., ge=0)
    feedback: Optional[str] = None
    status: Literal["graded", "pending"] = "graded"
