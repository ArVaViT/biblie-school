"""Partial + composite indexes for progress/calendar/cohort hot paths.

Revision ID: 022_add_hot_path_partial_indexes
Revises: 021_add_sort_composite_indexes
Create Date: 2026-04-22
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "022_add_hot_path_partial_indexes"
down_revision: str | None = "021_add_sort_composite_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgres() -> bool:
    return op.get_context().dialect.name == "postgresql"


def upgrade() -> None:
    if not _is_postgres():
        return
    # Progress board: `WHERE chapter_id IN (...) AND completed = true`.
    op.create_index(
        "ix_chapter_progress_chapter_completed_true",
        "chapter_progress",
        ["chapter_id"],
        postgresql_where=sa.text("completed = true"),
    )
    # Best / latest completed attempt per (user, quiz).
    op.create_index(
        "ix_quiz_attempts_quiz_user_completed",
        "quiz_attempts",
        ["quiz_id", "user_id"],
        postgresql_where=sa.text("completed_at IS NOT NULL"),
    )
    # Cohort roster ordered by enrollment time.
    op.create_index(
        "ix_enrollments_cohort_enrolled_at",
        "enrollments",
        ["cohort_id", sa.text("enrolled_at DESC")],
    )
    # "My grades" cross-course list.
    op.create_index(
        "ix_student_grades_student_graded_at",
        "student_grades",
        ["student_id", sa.text("graded_at DESC")],
    )
    # Calendar: modules with due dates, still active.
    op.create_index(
        "ix_modules_course_due_active",
        "modules",
        ["course_id"],
        postgresql_where=sa.text("due_date IS NOT NULL AND deleted_at IS NULL"),
    )
    # Per-course event list sorted by event_date.
    op.create_index(
        "ix_course_events_course_event_date",
        "course_events",
        ["course_id", "event_date"],
    )
    # Teacher's pending certificate queue.
    op.create_index(
        "ix_certificates_pending_course_requested_at",
        "certificates",
        ["course_id", "requested_at"],
        postgresql_where=sa.text("status = 'pending'"),
    )
    # Admin's teacher-approved queue.
    op.create_index(
        "ix_certificates_teacher_approved_queue",
        "certificates",
        ["teacher_approved_at"],
        postgresql_where=sa.text("status = 'teacher_approved'"),
    )
    # Admin user directory.
    op.create_index(
        "ix_profiles_created_at",
        "profiles",
        [sa.text("created_at DESC")],
    )
    # Assignment list by chapter ordered by creation time.
    op.create_index(
        "ix_assignments_chapter_created_at",
        "assignments",
        ["chapter_id", "created_at"],
    )


def downgrade() -> None:
    if not _is_postgres():
        return
    op.drop_index("ix_assignments_chapter_created_at", table_name="assignments")
    op.drop_index("ix_profiles_created_at", table_name="profiles")
    op.drop_index("ix_certificates_teacher_approved_queue", table_name="certificates")
    op.drop_index("ix_certificates_pending_course_requested_at", table_name="certificates")
    op.drop_index("ix_course_events_course_event_date", table_name="course_events")
    op.drop_index("ix_modules_course_due_active", table_name="modules")
    op.drop_index("ix_student_grades_student_graded_at", table_name="student_grades")
    op.drop_index("ix_enrollments_cohort_enrolled_at", table_name="enrollments")
    op.drop_index("ix_quiz_attempts_quiz_user_completed", table_name="quiz_attempts")
    op.drop_index("ix_chapter_progress_chapter_completed_true", table_name="chapter_progress")
