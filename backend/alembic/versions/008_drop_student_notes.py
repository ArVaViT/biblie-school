"""drop student_notes table

Revision ID: 008_drop_student_notes
Revises: 007_add_certificate_unique_constraint
Create Date: 2026-03-31
"""
from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "008_drop_student_notes"
down_revision: Union[str, None] = "007_add_certificate_unique_constraint"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("student_notes")


def downgrade() -> None:
    op.create_table(
        "student_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chapter_id", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["chapter_id"], ["chapters.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "chapter_id", name="uq_student_note_user_chapter"),
    )
    op.create_index("ix_student_notes_user_id", "student_notes", ["user_id"])
    op.create_index("ix_student_notes_chapter_id", "student_notes", ["chapter_id"])
