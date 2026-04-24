"""Chapter write operations (create / update / soft-delete)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import func

from app.models.course import Chapter

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.schemas.course import ChapterCreate, ChapterUpdate


def _next_chapter_order(db: Session, module_id: str) -> int:
    """Return the tail ``order_index`` for a new chapter on this module."""
    current_max = (
        db.query(func.max(Chapter.order_index))
        .filter(Chapter.module_id == module_id, Chapter.deleted_at.is_(None))
        .scalar()
    )
    return 0 if current_max is None else current_max + 1


def create_chapter(db: Session, module_id: str, data: ChapterCreate) -> Chapter:
    # Mirrors ``create_module``: default order_index (0) appends at the tail
    # when the module already has chapters.
    order_index = data.order_index if data.order_index else _next_chapter_order(db, module_id)
    chapter = Chapter(
        id=str(uuid.uuid4()),
        module_id=module_id,
        title=data.title,
        order_index=order_index,
        chapter_type=data.chapter_type,
        requires_completion=data.requires_completion,
        is_locked=data.is_locked,
    )
    db.add(chapter)
    db.commit()
    db.refresh(chapter)
    return chapter


def update_chapter(db: Session, chapter: Chapter, data: ChapterUpdate) -> Chapter:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(chapter, field, value)
    db.commit()
    db.refresh(chapter)
    return chapter


def delete_chapter(db: Session, chapter: Chapter) -> None:
    chapter.deleted_at = datetime.now(UTC)
    db.commit()
