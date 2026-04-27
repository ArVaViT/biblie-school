"""Manual translation backfill for already-published courses.

The ``draft → published`` hook in ``crud.py`` covers every new publish, but
courses that were already live before the translation pipeline shipped need
a way to get their ``content_translations`` rows seeded after the fact. This
endpoint exposes a teacher-only "Translate now" action for exactly that
case.

Designed to be safe to call repeatedly: the orchestrator's
``source_hash`` short-circuit means re-translating an unchanged course costs
zero Gemini calls.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from fastapi import Depends, HTTPException, status

from app.api.dependencies import assert_course_owner, require_teacher
from app.core.database import get_db
from app.schemas.course import CourseTranslationResponse
from app.services.course_service import get_course
from app.services.translation.orchestrator import translate_course_metadata
from app.services.translation.service import is_translation_enabled

from ._router import router

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.models.user import User

logger = logging.getLogger(__name__)


@router.post("/{course_id}/translate", response_model=CourseTranslationResponse)
def trigger_course_translation(
    course_id: str,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> CourseTranslationResponse:
    """Run the translation pipeline against an existing course.

    Authorization mirrors the rest of the course write surface — the owner
    or an admin can trigger it; everyone else gets a 404. The body returns
    a counter so the UI can render a "translated 2 fields" toast.
    """
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course '{course_id}' not found",
        )
    assert_course_owner(course, teacher, allow_admin=True)

    if not is_translation_enabled():
        # Surface the disabled state explicitly so the UI can render a
        # "translation provider not configured" hint instead of a
        # silent no-op.
        return CourseTranslationResponse(enabled=False)

    report = translate_course_metadata(db, course)
    return CourseTranslationResponse(
        translated=report.translated,
        skipped=report.skipped,
        failed=report.failed,
        enabled=True,
    )
