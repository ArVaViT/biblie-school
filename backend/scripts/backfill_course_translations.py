"""One-shot backfill: translate every published course's title + description.

Run from ``backend/`` after activating the project's Python env, with
``backend/.env`` populated for the target database. The script dispatches
to the same ``translate_course_metadata`` orchestrator that the FastAPI
publish hook now invokes, so behaviour stays identical to the live
endpoint (idempotent on rerun, leaves ``origin='human'`` rows alone, etc.).

This file is throw-away: once the Wave 2 admin UI ships a "Re-translate"
button, the same logic is reachable through ``POST /api/v1/courses/{id}/
translate`` and we can delete this file.
"""

from __future__ import annotations

import logging
import sys

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.core.database import _get_engine
from app.models.course import Course
from app.services.translation.orchestrator import translate_course_metadata
from app.services.translation.service import is_translation_enabled

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("backfill")


def main() -> int:
    if not is_translation_enabled():
        logger.error("Translation provider not configured (GEMINI_API_KEY missing)")
        return 1

    engine = _get_engine()
    SessionFactory = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    with SessionFactory() as db:
        courses = list(
            db.execute(select(Course).where(Course.deleted_at.is_(None), Course.status == "published")).scalars()
        )
        logger.info("Backfilling %d published courses", len(courses))
        totals = {"translated": 0, "skipped": 0, "failed": 0}
        for course in courses:
            logger.info("-> %s (%s)", course.id, course.title)
            report = translate_course_metadata(db, course)
            totals["translated"] += report.translated
            totals["skipped"] += report.skipped
            totals["failed"] += report.failed
            logger.info(
                "   translated=%d skipped=%d failed=%d",
                report.translated,
                report.skipped,
                report.failed,
            )

    logger.info("Done. Totals: %s", totals)
    return 0


if __name__ == "__main__":
    sys.exit(main())
