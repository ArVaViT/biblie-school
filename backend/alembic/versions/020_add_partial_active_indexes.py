"""Partial ``WHERE deleted_at IS NULL`` indexes for hot read paths.

Revision ID: 020_add_partial_active_indexes
Revises: 019_drop_restrictive_profiles_role_check
Create Date: 2026-04-21
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "020_add_partial_active_indexes"
down_revision: str | None = "019_drop_restrictive_profiles_role_check"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgres() -> bool:
    return op.get_context().dialect.name == "postgresql"


def upgrade() -> None:
    if not _is_postgres():
        return
    op.create_index(
        "ix_courses_created_by_active",
        "courses",
        ["created_by"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_modules_course_id_order_active",
        "modules",
        ["course_id", "order_index"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_chapters_module_id_order_active",
        "chapters",
        ["module_id", "order_index"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    if not _is_postgres():
        return
    op.drop_index("ix_chapters_module_id_order_active", table_name="chapters")
    op.drop_index("ix_modules_course_id_order_active", table_name="modules")
    op.drop_index("ix_courses_created_by_active", table_name="courses")
