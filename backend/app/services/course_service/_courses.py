"""Course-level write operations (create, update, soft/hard delete, restore)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import select

from app.models.course import Chapter, Course, Module

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.orm import Session

    from app.schemas.course import CourseCreate, CourseUpdate


def create_course(db: Session, data: CourseCreate, user_id: str | UUID) -> Course:
    course = Course(
        id=str(uuid.uuid4()),
        title=data.title,
        description=data.description,
        image_url=data.image_url,
        created_by=user_id,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def update_course(db: Session, course: Course, data: CourseUpdate) -> Course:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(course, field, value)
    db.commit()
    db.refresh(course)
    return course


def delete_course(db: Session, course: Course) -> None:
    """Soft-delete: tombstone the course and cascade to modules/chapters.

    Uses bulk UPDATEs so a course with hundreds of chapters still completes in
    three round trips (course + modules + chapters) instead of one per row.
    Enrollments / progress / quiz attempts are intentionally left untouched
    so a restore is lossless.
    """
    now = datetime.now(UTC)
    course.deleted_at = now
    db.query(Module).filter(
        Module.course_id == course.id,
        Module.deleted_at.is_(None),
    ).update({Module.deleted_at: now}, synchronize_session=False)
    module_ids = select(Module.id).where(Module.course_id == course.id).scalar_subquery()
    db.query(Chapter).filter(
        Chapter.module_id.in_(module_ids),
        Chapter.deleted_at.is_(None),
    ).update({Chapter.deleted_at: now}, synchronize_session=False)
    db.commit()


def restore_course(db: Session, course: Course) -> Course:
    """Undelete a soft-deleted course tree via bulk UPDATEs.

    We rely on direct UPDATE statements rather than walking ``course.modules``
    because the eager loader in ``_COURSE_TREE`` filters out the very rows we
    need to flip back to live (their ``deleted_at`` is set).
    """
    course.deleted_at = None
    db.query(Module).filter(Module.course_id == course.id).update({Module.deleted_at: None}, synchronize_session=False)
    module_ids = select(Module.id).where(Module.course_id == course.id).scalar_subquery()
    db.query(Chapter).filter(Chapter.module_id.in_(module_ids)).update(
        {Chapter.deleted_at: None}, synchronize_session=False
    )
    db.commit()
    db.refresh(course)
    return course


def permanently_delete_course(db: Session, course: Course) -> None:
    db.delete(course)
    db.commit()
