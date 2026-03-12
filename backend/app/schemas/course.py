from pydantic import BaseModel
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID


class ChapterBase(BaseModel):
    title: str
    content: Optional[str] = None
    video_url: Optional[str] = None
    order_index: int = 0
    chapter_type: Literal["content", "quiz", "assignment", "mixed"] = "content"
    requires_completion: bool = False


class ChapterCreate(ChapterBase):
    pass


class ChapterUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    video_url: Optional[str] = None
    order_index: Optional[int] = None
    chapter_type: Optional[Literal["content", "quiz", "assignment", "mixed"]] = None
    requires_completion: Optional[bool] = None


class ChapterResponse(ChapterBase):
    id: str
    module_id: str
    chapter_type: str = "content"
    requires_completion: bool = False

    class Config:
        from_attributes = True


class ModuleBase(BaseModel):
    title: str
    description: Optional[str] = None
    order_index: int = 0


class ModuleCreate(ModuleBase):
    pass


class ModuleUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    order_index: Optional[int] = None


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


class CourseResponse(CourseBase):
    id: str
    status: str = "draft"
    created_by: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    enrollment_start: Optional[datetime] = None
    enrollment_end: Optional[datetime] = None
    modules: list[ModuleResponse] = []

    class Config:
        from_attributes = True


class EnrollmentResponse(BaseModel):
    id: str
    user_id: UUID
    course_id: str
    enrolled_at: datetime
    progress: int
    course: Optional[CourseResponse] = None

    class Config:
        from_attributes = True
