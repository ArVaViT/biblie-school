"""Fire-and-forget hooks from write endpoints into ``translate_course_content``."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.services.course_service import get_course
from app.services.translation.course_pipeline import translate_course_content
from app.services.translation.service import is_translation_enabled

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def run_course_translation_pipeline_if_published(db: Session, course_id: str) -> None:
    """Re-run the translation pipeline when a published course mutates.

    No-ops when the course is a draft, Gemini is disabled, or the load fails.
    Errors never propagate — teachers must never lose a save because MT lagged.
    """
    if not is_translation_enabled():
        return
    course = get_course(db, course_id)
    if not course or course.status != "published":
        return
    try:
        translate_course_content(db, course)
    except Exception:
        logger.exception("Translation pipeline failed after mutation (course_id=%s)", course_id)
