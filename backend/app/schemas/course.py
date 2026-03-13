from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID


class ChapterBase(BaseModel):
    title: str
    content: Optional[str] = None
    video_url: Optional[str] = None
    order_index: int = 0
    chapter_type: Literal["reading", "video", "audio", "quiz", "exam", "assignment", "discussion", "mixed"] = "reading"
    requires_completion: bool = False
    is_locked: bool = False


class ChapterCreate(ChapterBase):
    pass


class ChapterUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    video_url: Optional[str] = None
    order_index: Optional[int] = None
    chapter_type: Optional[Literal["reading", "video", "audio", "quiz", "exam", "assignment", "discussion", "mixed"]] = None
    requires_completion: Optional[bool] = None
    is_locked: Optional[bool] = None


class ChapterResponse(ChapterBase):
    id: str
    module_id: str
    chapter_type: str = "reading"
    requires_completion: bool = False
    is_locked: bool = False

    class Config:
        from_attributes = True


class ModuleBase(BaseModel):
    title: str
    description: Optional[str] = None
    order_index: int = 0
    due_date: Optional[datetime] = None


class ModuleCreate(ModuleBase):
    pass


class ModuleUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    order_index: Optional[int] = None
    due_date: Optional[datetime] = None


class ModuleResponse(ModuleBase):
    id: str
    course_id: str
    chapters: list[ChapterResponse] = []

    class Config:
        from_attributes = True


class CourseBase(BaseModel):
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    status: Optional[Literal["draft", "published"]] = None
    enrollment_start: Optional[datetime] = None
    enrollment_end: Optional[datetime] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class CourseResponse(CourseBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str = "draft"
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    enrollment_start: Optional[datetime] = None
    enrollment_end: Optional[datetime] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    modules: list[ModuleResponse] = []


class EnrollmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: UUID
    course_id: str
    cohort_id: Optional[UUID] = None
    enrolled_at: datetime
    progress: int
    course: Optional[CourseResponse] = None
