"""Course-level write operations (create, update, soft/hard delete, restore)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from app.models.course import Course

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

    We don't touch enrollments / progress / quiz attempts so a restore is
    lossless.
    """
    now = datetime.now(UTC)
    course.deleted_at = now
    for module in course.modules:
        module.deleted_at = now
        for chapter in module.chapters:
            chapter.deleted_at = now
    db.commit()


def restore_course(db: Session, course: Course) -> Course:
    course.deleted_at = None
    for module in course.modules:
        module.deleted_at = None
        for chapter in module.chapters:
            chapter.deleted_at = None
    db.commit()
    db.refresh(course)
    return course


def permanently_delete_course(db: Session, course: Course) -> None:
    db.delete(course)
    db.commit()
