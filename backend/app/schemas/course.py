from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# Mirrors the ``chapters_chapter_type_check`` CHECK in Postgres. ``content``
# is a legacy alias some seeded chapters already use on prod — leaving it out
# of the schema blocked PATCHes on those rows with a 422 even though the DB
# accepts them.
CHAPTER_TYPES = Literal[
    "reading", "video", "audio", "quiz", "exam", "assignment", "discussion", "mixed", "content"
]


class ChapterBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    content: str | None = Field(None, max_length=500_000)
    video_url: str | None = Field(None, max_length=2048)
    order_index: int = 0
    chapter_type: CHAPTER_TYPES = "reading"
    requires_completion: bool = False
    is_locked: bool = False


class ChapterCreate(ChapterBase):
    pass


class ChapterUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=300)
    content: str | None = Field(None, max_length=500_000)
    video_url: str | None = Field(None, max_length=2048)
    order_index: int | None = None
    chapter_type: CHAPTER_TYPES | None = None
    requires_completion: bool | None = None
    is_locked: bool | None = None


class ChapterResponse(ChapterBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    module_id: str
    chapter_type: CHAPTER_TYPES = "reading"
    requires_completion: bool = False
    is_locked: bool = False


class ChapterSummary(BaseModel):
    """Chapter fields safe to include in catalog/list responses (no body content)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    module_id: str
    title: str
    order_index: int = 0
    chapter_type: CHAPTER_TYPES = "reading"
    requires_completion: bool = False
    is_locked: bool = False


class ModuleBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    description: str | None = Field(None, max_length=5000)
    order_index: int = 0
    due_date: datetime | None = None


class ModuleCreate(ModuleBase):
    pass


class ModuleUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = Field(None, max_length=5000)
    order_index: int | None = None
    due_date: datetime | None = None


class ModuleResponse(ModuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    course_id: str
    chapters: list[ChapterResponse] = []


class ModuleSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    course_id: str
    title: str
    description: str | None = None
    order_index: int = 0
    due_date: datetime | None = None
    chapters: list[ChapterSummary] = []


class CourseBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    description: str | None = Field(None, max_length=10_000)
    image_url: str | None = Field(None, max_length=2048)


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = Field(None, max_length=10_000)
    image_url: str | None = Field(None, max_length=2048)
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
    deleted_at: datetime | None = None
    enrollment_start: datetime | None = None
    enrollment_end: datetime | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    modules: list[ModuleResponse] = []


class CourseSummary(CourseBase):
    """Catalog / list-view course — full structure minus chapter body content.

    Chapter ``content`` columns can reach 500k characters each, so loading and
    serialising them in list endpoints balloons responses into the megabytes.
    Full tree stays available via ``GET /courses/{id}``.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str = "draft"
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime | None = None
    deleted_at: datetime | None = None
    enrollment_start: datetime | None = None
    enrollment_end: datetime | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    modules: list[ModuleSummary] = []


class EnrollmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: UUID
    course_id: str
    cohort_id: UUID | None = None
    enrolled_at: datetime
    progress: int
    course: CourseResponse | None = None


class EnrollmentSummaryResponse(BaseModel):
    """Enrollment for list views — embeds the slim CourseSummary."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: UUID
    course_id: str
    cohort_id: UUID | None = None
    enrolled_at: datetime
    progress: int
    course: CourseSummary | None = None
