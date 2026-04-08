"""Add soft delete (deleted_at) to courses, modules, chapters

Revision ID: 010_add_soft_delete
Revises: 009_add_performance_indexes
Create Date: 2026-04-08
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "010_add_soft_delete"
down_revision: str | None = "009_add_performance_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("courses", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("modules", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("chapters", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))

    op.create_index("ix_courses_deleted_at", "courses", ["deleted_at"], postgresql_where=sa.text("deleted_at IS NOT NULL"))
    op.create_index("ix_modules_deleted_at", "modules", ["deleted_at"], postgresql_where=sa.text("deleted_at IS NOT NULL"))
    op.create_index("ix_chapters_deleted_at", "chapters", ["deleted_at"], postgresql_where=sa.text("deleted_at IS NOT NULL"))


def downgrade() -> None:
    op.drop_index("ix_chapters_deleted_at", table_name="chapters")
    op.drop_index("ix_modules_deleted_at", table_name="modules")
    op.drop_index("ix_courses_deleted_at", table_name="courses")

    op.drop_column("chapters", "deleted_at")
    op.drop_column("modules", "deleted_at")
    op.drop_column("courses", "deleted_at")
