"""Add FK drift fixes on quiz_attempts.user_id and quiz_extra_attempts.user_id.

Revision ID: 015_add_quiz_user_fks
Revises: 014_fix_courses_created_by_ondelete
Create Date: 2026-04-20

Background:
  The SQLAlchemy models (see ``app/models/quiz.py``) declare ``user_id`` as a
  free-standing UUID on both ``quiz_attempts`` and ``quiz_extra_attempts``, so
  Postgres has no referential integrity tying these rows to ``profiles``. If a
  profile is ever deleted, orphan attempt / extra-grant rows remain in the
  database and slowly rot into silent bugs (wrong counts in teacher progress,
  leaked PII in audit exports, etc.).

  Add FK -> ``profiles(id) ON DELETE CASCADE`` on both columns. ``granted_by``
  on ``quiz_extra_attempts`` is intentionally left without an FK: we don't
  want a student's extra-attempt grant to disappear because an admin account
  was later deleted.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "015_add_quiz_user_fks"
down_revision: str | None = "014_fix_courses_created_by_ondelete"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgres() -> bool:
    bind = op.get_bind()
    return bind.dialect.name == "postgresql"


def upgrade() -> None:
    if not _is_postgres():
        return

    op.execute("ALTER TABLE public.quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_user_id_fkey")
    op.execute(
        """
        ALTER TABLE public.quiz_attempts
          ADD CONSTRAINT quiz_attempts_user_id_fkey
          FOREIGN KEY (user_id)
          REFERENCES public.profiles(id)
          ON DELETE CASCADE
        """
    )

    op.execute("ALTER TABLE public.quiz_extra_attempts DROP CONSTRAINT IF EXISTS quiz_extra_attempts_user_id_fkey")
    op.execute(
        """
        ALTER TABLE public.quiz_extra_attempts
          ADD CONSTRAINT quiz_extra_attempts_user_id_fkey
          FOREIGN KEY (user_id)
          REFERENCES public.profiles(id)
          ON DELETE CASCADE
        """
    )


def downgrade() -> None:
    if not _is_postgres():
        return

    op.execute("ALTER TABLE public.quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_user_id_fkey")
    op.execute("ALTER TABLE public.quiz_extra_attempts DROP CONSTRAINT IF EXISTS quiz_extra_attempts_user_id_fkey")
