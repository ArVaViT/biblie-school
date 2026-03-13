"""Add calendar system: module due_date, course start/end dates, course_events table

Revision ID: 003_calendar_system
Revises: 002_grading_weights
Create Date: 2026-03-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "003_calendar_system"
down_revision: Union[str, None] = "002_grading_weights"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("modules", sa.Column("due_date", sa.DateTime(timezone=True), nullable=True))
    op.add_column("courses", sa.Column("start_date", sa.DateTime(timezone=True), nullable=True))
    op.add_column("courses", sa.Column("end_date", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "course_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("course_id", sa.String(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("event_type", sa.String(30), nullable=False, server_default="other"),
        sa.Column("event_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_course_events_course_id", "course_events", ["course_id"])
    op.create_index("ix_course_events_event_date", "course_events", ["event_date"])


def downgrade() -> None:
    op.drop_index("ix_course_events_event_date", table_name="course_events")
    op.drop_index("ix_course_events_course_id", table_name="course_events")
    op.drop_table("course_events")
    op.drop_column("courses", "end_date")
    op.drop_column("courses", "start_date")
    op.drop_column("modules", "due_date")
