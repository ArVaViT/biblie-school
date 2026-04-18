"""Add performance indexes for common query patterns

Revision ID: 009_add_performance_indexes
Revises: 008_drop_student_notes
Create Date: 2026-04-04
"""

from collections.abc import Sequence

from alembic import op

revision: str = "009_add_performance_indexes"
down_revision: str | None = "008_drop_student_notes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_chapters_module_id_chapter_type",
        "chapters",
        ["module_id", "chapter_type"],
    )

    op.create_index(
        "ix_notifications_user_id_created_at",
        "notifications",
        ["user_id", "created_at"],
    )

    op.create_index(
        "ix_audit_logs_user_id_created_at",
        "audit_logs",
        ["user_id", "created_at"],
    )

    op.create_index(
        "ix_chapter_progress_user_chapter_completed",
        "chapter_progress",
        ["user_id", "chapter_id", "completed"],
    )


def downgrade() -> None:
    op.drop_index("ix_chapter_progress_user_chapter_completed", table_name="chapter_progress")
    op.drop_index("ix_audit_logs_user_id_created_at", table_name="audit_logs")
    op.drop_index("ix_notifications_user_id_created_at", table_name="notifications")
    op.drop_index("ix_chapters_module_id_chapter_type", table_name="chapters")
