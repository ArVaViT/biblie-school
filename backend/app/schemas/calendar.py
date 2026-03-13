from pydantic import BaseModel
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID


EventType = Literal["deadline", "live_session", "exam", "other"]


class CourseEventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    event_type: EventType = "other"
    event_date: datetime


class CourseEventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[EventType] = None
    event_date: Optional[datetime] = None


class CourseEventResponse(BaseModel):
    id: UUID
    course_id: str
    title: str
    description: Optional[str] = None
    event_type: str
    event_date: datetime
    created_by: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class CalendarEvent(BaseModel):
    """Unified calendar event returned by the aggregate endpoint."""
    id: str
    title: str
    description: Optional[str] = None
    event_type: str
    event_date: datetime
    course_id: str
    course_title: Optional[str] = None
    source: Literal["module_deadline", "assignment_deadline", "course_event"]
