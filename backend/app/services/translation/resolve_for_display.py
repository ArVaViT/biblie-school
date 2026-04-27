"""Map stored ``content_translations`` onto course read models for the API.

Wave 1 only materializes course ``title`` / ``description``; the canonical
source text still lives on ``courses.*``. When the reader's display locale
differs from ``courses.source_locale`` and a matching ``content_translations``
row exists (``status='ok'``), we substitute those strings in JSON responses.

Authoring views (owner + admin) always see the source columns so editors are
not surprised by machine translations when the UI is in another language.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from app.models.content_translation import ContentTranslation
from app.models.user import User, UserRole
from app.schemas.course import CourseResponse, CourseSummary
from app.schemas.locale import LocaleCode, normalize_locale

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.models.course import Course


def _str_uuid(v: str | uuid.UUID) -> str:
    """Case-normalise UUIDs so SQLite/Postgres string forms compare equal."""
    return str(uuid.UUID(str(v)))


def should_apply_course_translation_overlay(*, course: Course, current_user: User | None) -> bool:
    """Return True when the API should show localized metadata to this caller."""
    if current_user is None:
        return True
    if current_user.role == UserRole.ADMIN.value:
        return False
    is_owner = course.created_by is not None and _str_uuid(course.created_by) == _str_uuid(current_user.id)
    return not is_owner


def batch_fetch_course_translations(
    db: Session,
    *,
    course_ids: list[str],
    display_locale: LocaleCode,
) -> dict[tuple[str, str], str]:
    """Return a map ``(entity_id, field) -> text`` for ok course-level rows."""
    if not course_ids:
        return {}
    rows = (
        db.query(ContentTranslation)
        .filter(
            ContentTranslation.entity_type == "course",
            ContentTranslation.entity_id.in_(course_ids),
            ContentTranslation.locale == display_locale,
            ContentTranslation.field.in_(("title", "description")),
            ContentTranslation.status == "ok",
        )
        .all()
    )
    return {(r.entity_id, r.field): r.text for r in rows}


def pick_localized_text(
    course: Course,
    field: str,
    base: str,
    overlay: dict[tuple[str, str], str],
    display_locale: LocaleCode,
) -> str:
    if normalize_locale(course.source_locale) == display_locale:
        return base
    return overlay.get((course.id, field), base)


def _localize_optional_description(
    course: Course,
    base: str | None,
    overlay: dict[tuple[str, str], str],
    display_locale: LocaleCode,
) -> str | None:
    if base is not None:
        return pick_localized_text(course, "description", base, overlay, display_locale)
    if normalize_locale(course.source_locale) == display_locale:
        return None
    return overlay.get((course.id, "description"))


def build_localized_course_summary(
    course: Course,
    overlay: dict[tuple[str, str], str],
    display_locale: LocaleCode,
) -> CourseSummary:
    title = pick_localized_text(course, "title", course.title, overlay, display_locale)
    desc = _localize_optional_description(course, course.description, overlay, display_locale)
    base = CourseSummary.model_validate(course, from_attributes=True)
    if title == base.title and desc == base.description:
        return base
    return base.model_copy(update={"title": title, "description": desc})


def build_localized_course_response(
    course: Course,
    overlay: dict[tuple[str, str], str],
    display_locale: LocaleCode,
) -> CourseResponse:
    title = pick_localized_text(course, "title", course.title, overlay, display_locale)
    desc = _localize_optional_description(course, course.description, overlay, display_locale)
    base = CourseResponse.model_validate(course, from_attributes=True)
    if title == base.title and desc == base.description:
        return base
    return base.model_copy(update={"title": title, "description": desc})


__all__ = [
    "batch_fetch_course_translations",
    "build_localized_course_response",
    "build_localized_course_summary",
    "should_apply_course_translation_overlay",
]
