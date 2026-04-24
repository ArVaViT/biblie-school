"""Module write operations (create / update / soft-delete)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import func

from app.models.course import Chapter, Module

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.schemas.course import ModuleCreate, ModuleUpdate


def _next_module_order(db: Session, course_id: str) -> int:
    """Return the tail ``order_index`` for a new module on this course."""
    current_max = (
        db.query(func.max(Module.order_index))
        .filter(Module.course_id == course_id, Module.deleted_at.is_(None))
        .scalar()
    )
    return 0 if current_max is None else current_max + 1


def create_module(db: Session, course_id: str, data: ModuleCreate) -> Module:
    # If the client left ``order_index`` at its default (0) and the course
    # already has modules, append at the tail instead of silently colliding.
    # Clients that need a specific slot (e.g. drag-and-drop reorder) still
    # pass their explicit index and control the full layout themselves.
    order_index = data.order_index if data.order_index else _next_module_order(db, course_id)
    module = Module(
        id=str(uuid.uuid4()),
        course_id=course_id,
        title=data.title,
        description=data.description,
        order_index=order_index,
        due_date=data.due_date,
    )
    db.add(module)
    db.commit()
    db.refresh(module)
    return module


def update_module(db: Session, module: Module, data: ModuleUpdate) -> Module:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(module, field, value)
    db.commit()
    db.refresh(module)
    return module


def delete_module(db: Session, module: Module) -> None:
    now = datetime.now(UTC)
    module.deleted_at = now
    # Bulk UPDATE so the cascade is one round trip regardless of chapter count
    # and works whether ``module.chapters`` was eager-loaded with a deleted_at
    # filter or not.
    db.query(Chapter).filter(
        Chapter.module_id == module.id,
        Chapter.deleted_at.is_(None),
    ).update({Chapter.deleted_at: now}, synchronize_session=False)
    db.commit()
