"""add exam support to quizzes

Revision ID: 004_add_exam_support
Revises: 003_calendar_system
Create Date: 2026-03-13 00:00:00
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "004_add_exam_support"
# NOTE: revision 003's file is 003_add_calendar_system.py but its revision id
# is "003_calendar_system" (no "_add_"). Keep these in sync.
down_revision = "003_calendar_system"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "quizzes",
        sa.Column("quiz_type", sa.String(length=20), nullable=False, server_default="quiz"),
    )
    op.add_column(
        "quizzes",
        sa.Column("max_attempts", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("quizzes", "max_attempts")
    op.drop_column("quizzes", "quiz_type")
