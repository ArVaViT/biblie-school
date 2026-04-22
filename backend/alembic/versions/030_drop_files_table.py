"""Drop unused ``files`` table.

The ``files`` table backed ``POST /api/v1/files/upload`` — a server-side
upload path with magic-byte validation that routed file content through
the backend using the Supabase service-role key. The frontend never hit
this endpoint; all real uploads (avatars, course covers, course materials,
inline content images) go directly from the browser to Supabase Storage
via ``frontend/src/services/storage.ts`` with the user's JWT.

In production the table was never written to — every row we checked was
empty. Keeping it would mean:

- A dead endpoint pretending to add "server-side magic byte validation"
  while the real upload path bypasses it entirely.
- Two sources of truth for who may upload (backend ``verify_course_owner``
  vs Supabase Storage RLS policies) that had to be kept in lock-step.
- A ``service_role`` code path that could write arbitrary objects to any
  bucket — reducing overall blast radius by removing it outright.

The endpoint, service, SQLAlchemy model, the ``SUPABASE_STORAGE_BUCKET``
setting and the associated tests are deleted in the same change.

Revision ID: 030_drop_files_table
Revises: 029_drop_course_unused_dates
Create Date: 2026-04-22
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "030_drop_files_table"
down_revision: str | None = "029_drop_course_unused_dates"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.files CASCADE")


def downgrade() -> None:
    op.create_table(
        "files",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("file_type", sa.String(), nullable=False),
        sa.Column("course_id", sa.String(), sa.ForeignKey("courses.id"), nullable=True),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("profiles.id"), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_files_course_id", "files", ["course_id"])
    op.create_index("ix_files_user_id", "files", ["user_id"])
