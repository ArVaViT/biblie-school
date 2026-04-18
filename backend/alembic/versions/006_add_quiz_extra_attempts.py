"""add quiz_extra_attempts table

Revision ID: 006_add_quiz_extra_attempts
Revises: 005_add_audit_notifications
Create Date: 2026-03-13
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = "006_add_quiz_extra_attempts"
down_revision: Union[str, None] = "005_add_audit_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "quiz_extra_attempts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("quiz_id", UUID(as_uuid=True), sa.ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("extra_attempts", sa.Integer, nullable=False, server_default="1"),
        sa.Column("granted_by", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_quiz_extra_attempts_quiz_user",
        "quiz_extra_attempts",
        ["quiz_id", "user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_quiz_extra_attempts_quiz_user", table_name="quiz_extra_attempts")
    op.drop_table("quiz_extra_attempts")
