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


def _is_sqlite() -> bool:
    bind = op.get_bind()
    return bind.dialect.name == "sqlite"


def upgrade() -> None:
    # SQLite cannot ``ALTER TABLE ADD CONSTRAINT``; batch mode rebuilds the
    # table so the CHECK lands. Postgres handles the inline path.
    if _is_sqlite():
        with op.batch_alter_table("courses", recreate="always") as batch:
            batch.add_column(sa.Column("quiz_weight", sa.Integer(), nullable=False, server_default="30"))
            batch.add_column(sa.Column("assignment_weight", sa.Integer(), nullable=False, server_default="50"))
            batch.add_column(sa.Column("participation_weight", sa.Integer(), nullable=False, server_default="20"))
            batch.create_check_constraint(
                "ck_courses_weights_sum_100",
                "quiz_weight + assignment_weight + participation_weight = 100",
            )
        return
    op.add_column("courses", sa.Column("quiz_weight", sa.Integer(), nullable=False, server_default="30"))
    op.add_column("courses", sa.Column("assignment_weight", sa.Integer(), nullable=False, server_default="50"))
    op.add_column("courses", sa.Column("participation_weight", sa.Integer(), nullable=False, server_default="20"))
    op.create_check_constraint(
        "ck_courses_weights_sum_100",
        "courses",
        "quiz_weight + assignment_weight + participation_weight = 100",
    )


def downgrade() -> None:
    if _is_sqlite():
        with op.batch_alter_table("courses", recreate="always") as batch:
            batch.drop_constraint("ck_courses_weights_sum_100", type_="check")
            batch.drop_column("participation_weight")
            batch.drop_column("assignment_weight")
            batch.drop_column("quiz_weight")
        return
    op.drop_constraint("ck_courses_weights_sum_100", "courses", type_="check")
    op.drop_column("courses", "participation_weight")
    op.drop_column("courses", "assignment_weight")
    op.drop_column("courses", "quiz_weight")
