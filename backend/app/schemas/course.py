from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ChapterBase(BaseModel):
    title: str
    content: str | None = None
    video_url: str | None = None
    order_index: int = 0
    chapter_type: Literal["reading", "video", "audio", "quiz", "exam", "assignment", "discussion", "mixed"] = "reading"
    requires_completion: bool = False
    is_locked: bool = False


class ChapterCreate(ChapterBase):
    pass


class ChapterUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    video_url: str | None = None
    order_index: int | None = None
    chapter_type: Literal["reading", "video", "audio", "quiz", "exam", "assignment", "discussion", "mixed"] | None = (
        None
    )
    requires_completion: bool | None = None
    is_locked: bool | None = None


class ChapterResponse(ChapterBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    module_id: str
    chapter_type: str = "reading"
    requires_completion: bool = False
    is_locked: bool = False


class ModuleBase(BaseModel):
    title: str
    description: str | None = None
    order_index: int = 0
    due_date: datetime | None = None


class ModuleCreate(ModuleBase):
    pass


class ModuleUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    order_index: int | None = None
    due_date: datetime | None = None


class ModuleResponse(ModuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    course_id: str
    chapters: list[ChapterResponse] = []


class CourseBase(BaseModel):
    title: str
    description: str | None = None
    image_url: str | None = None


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    image_url: str | None = None
    status: Literal["draft", "published"] | None = None
    enrollment_start: datetime | None = None
    enrollment_end: datetime | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


class CourseResponse(CourseBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str = "draft"
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime | None = None
    enrollment_start: datetime | None = None
    enrollment_end: datetime | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    modules: list[ModuleResponse] = []


class EnrollmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: UUID
    course_id: str
    cohort_id: UUID | None = None
    enrolled_at: datetime
    progress: int
    course: CourseResponse | None = None
