"""add unique constraint on certificates (user_id, course_id)

Revision ID: 007_add_certificate_unique_constraint
Revises: 006_add_quiz_extra_attempts
Create Date: 2026-03-31
"""

from collections.abc import Sequence
from typing import Union

from alembic import op

revision: str = "007_add_certificate_unique_constraint"
down_revision: Union[str, None] = "006_add_quiz_extra_attempts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_certificate_user_course",
        "certificates",
        ["user_id", "course_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_certificate_user_course", "certificates", type_="unique")
