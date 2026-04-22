"""Drop unused ``courses.start_date`` / ``courses.end_date`` columns.

Neither field is referenced anywhere in the application:

- No backend query, service, or API route reads ``Course.start_date`` or
  ``Course.end_date``.
- The frontend never renders or edits them; every ``start_date`` / ``end_date``
  usage on the UI (CourseDetail, CourseEditor, cohort forms) targets the
  authoritative ``Cohort`` fields instead.
- ``clone_course`` copied them as literal ``None`` so they were always null in
  cloned courses anyway.

The pair was introduced by migration ``003_add_calendar_system`` on the
assumption that courses would carry their own schedule window. The cohort
model ended up owning that concept, so the course-level columns became dead
weight that still widened every ``SELECT * FROM courses`` and every
``CourseResponse`` payload.

The SQLAlchemy ``Course`` model and the ``CourseUpdate`` /
``CourseResponse`` / ``CourseSummary`` schemas drop the fields in the same
change so autogenerate doesn't resurrect them. ``clone_course`` no longer
sets the removed attributes.

Revision ID: 029_drop_course_unused_dates
Revises: 028_drop_more_redundant_indexes
Create Date: 2026-04-22
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "029_drop_course_unused_dates"
down_revision: str | None = "028_drop_more_redundant_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("courses", "start_date")
    op.drop_column("courses", "end_date")


def downgrade() -> None:
    op.add_column("courses", sa.Column("start_date", sa.DateTime(timezone=True), nullable=True))
    op.add_column("courses", sa.Column("end_date", sa.DateTime(timezone=True), nullable=True))
