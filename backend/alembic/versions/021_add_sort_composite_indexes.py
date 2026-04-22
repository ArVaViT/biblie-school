"""Composite indexes aligned with filter + order_by on hot paths.

Revision ID: 021_add_sort_composite_indexes
Revises: 020_add_partial_active_indexes
Create Date: 2026-04-21
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "021_add_sort_composite_indexes"
down_revision: str | None = "020_add_partial_active_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgres() -> bool:
    return op.get_context().dialect.name == "postgresql"


def upgrade() -> None:
    if not _is_postgres():
        return
    op.create_index(
        "ix_enrollments_user_enrolled_at",
        "enrollments",
        ["user_id", sa.text("enrolled_at DESC")],
    )
    op.create_index(
        "ix_announcements_course_created_at",
        "announcements",
        ["course_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_course_reviews_course_created_at",
        "course_reviews",
        ["course_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_quiz_attempts_quiz_started_at",
        "quiz_attempts",
        ["quiz_id", sa.text("started_at DESC")],
    )
    op.create_index(
        "ix_assignment_subs_assignment_submitted_at",
        "assignment_submissions",
        ["assignment_id", sa.text("submitted_at DESC")],
    )
    op.create_index(
        "ix_student_grades_course_graded_at",
        "student_grades",
        ["course_id", sa.text("graded_at DESC")],
    )
    op.create_index(
        "ix_certificates_user_requested_at",
        "certificates",
        ["user_id", sa.text("requested_at DESC")],
    )
    op.create_index(
        "ix_courses_published_catalog",
        "courses",
        [sa.text("created_at DESC")],
        postgresql_where=sa.text("status = 'published' AND deleted_at IS NULL"),
    )


def downgrade() -> None:
    if not _is_postgres():
        return
    op.drop_index("ix_courses_published_catalog", table_name="courses")
    op.drop_index("ix_certificates_user_requested_at", table_name="certificates")
    op.drop_index("ix_student_grades_course_graded_at", table_name="student_grades")
    op.drop_index("ix_assignment_subs_assignment_submitted_at", table_name="assignment_submissions")
    op.drop_index("ix_quiz_attempts_quiz_started_at", table_name="quiz_attempts")
    op.drop_index("ix_course_reviews_course_created_at", table_name="course_reviews")
    op.drop_index("ix_announcements_course_created_at", table_name="announcements")
    op.drop_index("ix_enrollments_user_enrolled_at", table_name="enrollments")
