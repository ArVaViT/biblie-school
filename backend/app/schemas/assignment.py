from pydantic import BaseModel
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID


class AssignmentCreate(BaseModel):
    chapter_id: str
    title: str
    description: Optional[str] = None
    max_score: int = 100
    due_date: Optional[datetime] = None


class AssignmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    max_score: Optional[int] = None
    due_date: Optional[datetime] = None


class AssignmentResponse(BaseModel):
    id: UUID
    chapter_id: str
    title: str
    description: Optional[str] = None
    max_score: int
    due_date: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SubmissionCreate(BaseModel):
    content: Optional[str] = None
    file_url: Optional[str] = None


class SubmissionResponse(BaseModel):
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

    class Config:
        from_attributes = True


class GradeSubmissionRequest(BaseModel):
    grade: int
    feedback: Optional[str] = None
    status: Literal["graded", "pending"] = "graded"
