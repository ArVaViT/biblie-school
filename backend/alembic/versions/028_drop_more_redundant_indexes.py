"""Drop a second round of redundant indexes found by auditing query predicates.

Five indexes whose workload is entirely covered by another index already on
the same table:

1. ``ix_enrollments_user_id`` - shadowed by ``uq_enrollment_user_course``'s
   B-tree ``(user_id, course_id)``. Any ``WHERE user_id = ?`` uses the
   leading column of the unique index.

2. ``ix_chapter_progress_user_id`` - shadowed by
   ``uq_progress_user_chapter`` ``(user_id, chapter_id)``.

3. ``ix_certificates_user_course`` - plain-index copy of
   ``uq_certificate_user_course``. Identical key columns, identical
   ordering, pure duplication.

4. ``ix_notifications_user_id`` - shadowed by
   ``ix_notifications_user_unread`` ``(user_id, is_read)``.

5. ``ix_notifications_is_read`` - boolean columns have at most two distinct
   values; a B-tree index on one yields no useful selectivity. The unread-
   count query already uses ``ix_notifications_user_unread``.

The SQLAlchemy models drop the corresponding ``Index(...)`` entries and the
redundant ``index=True`` flags in the same change so autogenerate doesn't
resurrect them.

Revision ID: 028_drop_more_redundant_indexes
Revises: 027_drop_redundant_indexes
Create Date: 2026-04-22
"""
from collections.abc import Sequence

from alembic import op

revision: str = "028_drop_more_redundant_indexes"
down_revision: str | None = "027_drop_redundant_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_DROPS: list[str] = [
    "ix_enrollments_user_id",
    "ix_chapter_progress_user_id",
    "ix_certificates_user_course",
    "ix_notifications_user_id",
    "ix_notifications_is_read",
]


def upgrade() -> None:
    for idx in _DROPS:
        op.execute(f'DROP INDEX IF EXISTS "{idx}"')


def downgrade() -> None:
    op.create_index("ix_enrollments_user_id", "enrollments", ["user_id"])
    op.create_index("ix_chapter_progress_user_id", "chapter_progress", ["user_id"])
    op.create_index("ix_certificates_user_course", "certificates", ["user_id", "course_id"])
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_is_read", "notifications", ["is_read"])
