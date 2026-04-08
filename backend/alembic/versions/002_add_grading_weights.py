"""Add grading weight columns to courses table

Revision ID: 002_grading_weights
Revises: 001_initial
Create Date: 2026-03-12

"""
from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa

from alembic import op

revision: str = "002_grading_weights"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("courses", sa.Column("quiz_weight", sa.Integer(), nullable=False, server_default="30"))
    op.add_column("courses", sa.Column("assignment_weight", sa.Integer(), nullable=False, server_default="50"))
    op.add_column("courses", sa.Column("participation_weight", sa.Integer(), nullable=False, server_default="20"))
    op.create_check_constraint(
        "ck_courses_weights_sum_100",
        "courses",
        "quiz_weight + assignment_weight + participation_weight = 100",
    )


def downgrade() -> None:
    op.drop_constraint("ck_courses_weights_sum_100", "courses", type_="check")
    op.drop_column("courses", "participation_weight")
    op.drop_column("courses", "assignment_weight")
    op.drop_column("courses", "quiz_weight")
