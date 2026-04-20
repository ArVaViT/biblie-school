"""Seed the Book of Acts course directly into the database.

Usage (from repository root):
    python scripts/seed_acts_course.py <admin_email>

Requires `backend/.env` with a valid `DATABASE_URL`. Idempotent: skips the
course if a course with the same title already exists for the admin.
"""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from dotenv import load_dotenv

load_dotenv(REPO_ROOT / "backend" / ".env")

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Chapter, ChapterBlock, Course, Module, User, UserRole
from scripts.acts_content import COURSE, MODULES


def _new_id() -> str:
    return str(uuid.uuid4())


def seed(admin_email: str) -> None:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        sys.exit("ERROR: DATABASE_URL is not set (check backend/.env).")

    engine = create_engine(database_url, future=True)

    with Session(engine, expire_on_commit=False) as db:
        admin: User | None = db.query(User).filter(User.email == admin_email).one_or_none()
        if admin is None:
            sys.exit(f"ERROR: admin user not found: {admin_email}")
        if admin.role != UserRole.ADMIN.value:
            sys.exit(f"ERROR: user {admin_email} is not an admin (role={admin.role!r}).")

        existing = db.query(Course).filter(Course.title == COURSE["title"], Course.created_by == admin.id).one_or_none()
        if existing is not None:
            print(f"Course already exists (id={existing.id}). Nothing to do.")
            return

        course = Course(
            id=_new_id(),
            title=COURSE["title"],
            description=COURSE["description"],
            status=COURSE.get("status", "published"),
            created_by=admin.id,
        )
        db.add(course)
        db.flush()

        for module_data in MODULES:
            module = Module(
                id=_new_id(),
                course_id=course.id,
                title=module_data["title"],
                description=module_data["description"],
                order_index=module_data["order_index"],
            )
            db.add(module)
            db.flush()

            for chapter_data in module_data["chapters"]:
                chapter = Chapter(
                    id=_new_id(),
                    module_id=module.id,
                    title=chapter_data["title"],
                    chapter_type=chapter_data["chapter_type"],
                    order_index=chapter_data["order_index"],
                )
                db.add(chapter)
                db.flush()

                for idx, block_data in enumerate(chapter_data.get("content_blocks", [])):
                    db.add(
                        ChapterBlock(
                            chapter_id=chapter.id,
                            block_type=block_data["block_type"],
                            order_index=idx,
                            content=block_data.get("content"),
                            video_url=block_data.get("video_url"),
                        )
                    )

        db.commit()
        print(f"Seeded course {course.id!r} for admin {admin_email!r}.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python scripts/seed_acts_course.py <admin_email>")
    seed(sys.argv[1])
