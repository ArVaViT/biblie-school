from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_teacher, verify_course_owner
from app.core.database import get_db
from app.models.assignment import Assignment
from app.models.course import Chapter, Course, Module
from app.models.course_event import CourseEvent
from app.models.enrollment import Enrollment
from app.models.user import User
from app.schemas.calendar import (
    CalendarEvent,
    CourseEventCreate,
    CourseEventResponse,
    CourseEventUpdate,
)

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/events", response_model=list[CalendarEvent])
async def get_calendar_events(
    course_id: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CalendarEvent]:
    enrolled_q = db.query(Enrollment.course_id).filter(Enrollment.user_id == current_user.id)
    if course_id:
        enrolled_q = enrolled_q.filter(Enrollment.course_id == course_id)
    enrolled_course_ids = [row[0] for row in enrolled_q.all()]

    if not enrolled_course_ids:
        return []

    course_titles: dict[str, str] = {}
    courses = db.query(Course.id, Course.title).filter(Course.id.in_(enrolled_course_ids)).all()
    for cid, ctitle in courses:
        course_titles[cid] = ctitle

    events: list[CalendarEvent] = []

    modules = db.query(Module).filter(Module.course_id.in_(enrolled_course_ids), Module.due_date.isnot(None)).all()
    for m in modules:
        events.append(
            CalendarEvent(
                id=f"module-{m.id}",
                title=f"{m.title} — Due",
                description=m.description,
                event_type="deadline",
                event_date=m.due_date,
                course_id=m.course_id,
                course_title=course_titles.get(m.course_id),
                source="module_deadline",
            )
        )

    chapter_ids_by_course: dict[str, list[str]] = {}
    chapters = (
        db.query(Chapter.id, Module.course_id)
        .join(Module, Chapter.module_id == Module.id)
        .filter(Module.course_id.in_(enrolled_course_ids))
        .all()
    )
    for ch_id, crs_id in chapters:
        chapter_ids_by_course.setdefault(crs_id, []).append(ch_id)

    all_chapter_ids = [ch_id for ids in chapter_ids_by_course.values() for ch_id in ids]
    if all_chapter_ids:
        ch_to_course = {}
        for crs_id, ch_ids in chapter_ids_by_course.items():
            for ch_id in ch_ids:
                ch_to_course[ch_id] = crs_id

        assignments = (
            db.query(Assignment)
            .filter(
                Assignment.chapter_id.in_(all_chapter_ids),
                Assignment.due_date.isnot(None),
            )
            .all()
        )
        for a in assignments:
            crs_id = ch_to_course.get(a.chapter_id, "")
            events.append(
                CalendarEvent(
                    id=f"assignment-{a.id}",
                    title=a.title,
                    description=a.description,
                    event_type="deadline",
                    event_date=a.due_date,
                    course_id=crs_id,
                    course_title=course_titles.get(crs_id),
                    source="assignment_deadline",
                )
            )

    course_events = db.query(CourseEvent).filter(CourseEvent.course_id.in_(enrolled_course_ids)).all()
    for ce in course_events:
        events.append(
            CalendarEvent(
                id=str(ce.id),
                title=ce.title,
                description=ce.description,
                event_type=ce.event_type,
                event_date=ce.event_date,
                course_id=ce.course_id,
                course_title=course_titles.get(ce.course_id),
                source="course_event",
            )
        )

    events.sort(key=lambda e: e.event_date)
    return events


# ---------------------------------------------------------------------------
# Teacher CRUD for course events
# ---------------------------------------------------------------------------

event_router = APIRouter(prefix="/courses", tags=["calendar"])


@event_router.post(
    "/{course_id}/events",
    response_model=CourseEventResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_course_event(
    course_id: str,
    data: CourseEventCreate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> CourseEventResponse:
    verify_course_owner(db, course_id, teacher.id)
    event = CourseEvent(
        course_id=course_id,
        title=data.title,
        description=data.description,
        event_type=data.event_type,
        event_date=data.event_date,
        created_by=teacher.id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@event_router.get(
    "/{course_id}/events",
    response_model=list[CourseEventResponse],
)
async def list_course_events(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CourseEventResponse]:
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    is_owner = str(course.created_by) == str(current_user.id)
    is_admin = current_user.role == "admin"
    if not is_owner and not is_admin:
        enrolled = (
            db.query(Enrollment)
            .filter(Enrollment.user_id == current_user.id, Enrollment.course_id == course_id)
            .first()
        )
        if not enrolled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be enrolled in this course to view events",
            )
    events = db.query(CourseEvent).filter(CourseEvent.course_id == course_id).order_by(CourseEvent.event_date).all()
    return events


@event_router.put(
    "/{course_id}/events/{event_id}",
    response_model=CourseEventResponse,
)
async def update_course_event(
    course_id: str,
    event_id: str,
    data: CourseEventUpdate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> CourseEventResponse:
    verify_course_owner(db, course_id, teacher.id)
    event = (
        db.query(CourseEvent)
        .filter(
            CourseEvent.id == event_id,
            CourseEvent.course_id == course_id,
        )
        .first()
    )
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event


@event_router.delete(
    "/{course_id}/events/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_course_event(
    course_id: str,
    event_id: str,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> None:
    verify_course_owner(db, course_id, teacher.id)
    event = (
        db.query(CourseEvent)
        .filter(
            CourseEvent.id == event_id,
            CourseEvent.course_id == course_id,
        )
        .first()
    )
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    db.delete(event)
    db.commit()
