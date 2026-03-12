from pydantic import BaseModel, Field
from datetime import datetime


class GradeUpsert(BaseModel):
    grade: str | None = Field(None, max_length=20)
    comment: str | None = Field(None, max_length=5000)


class GradeResponse(BaseModel):
    id: str
    student_id: str
    course_id: str
    grade: str | None = None
    comment: str | None = None
    graded_by: str
    graded_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
