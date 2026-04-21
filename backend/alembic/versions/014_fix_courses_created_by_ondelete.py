"""Fix FK drift on courses.created_by: ON DELETE CASCADE -> SET NULL.

Revision ID: 014_fix_courses_created_by_ondelete
Revises: 013_enable_rls_security_fixes
Create Date: 2026-04-20

Background:
  The SQLAlchemy model declares ``ondelete="SET NULL"`` on
  ``courses.created_by``, and the account deletion flow in
  ``api/v1/users.py`` explicitly nullifies ``created_by`` before removing a
  profile. However, the production FK was created with ``ON DELETE CASCADE``.
  If a profile row were ever deleted through a different path, every course
  that teacher created (and all child modules/chapters/etc. via cascade)
  would be silently wiped out. Align the constraint with the model.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "014_fix_courses_created_by_ondelete"
down_revision: str | None = "013_enable_rls_security_fixes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgres() -> bool:
    bind = op.get_bind()
    return bind.dialect.name == "postgresql"


def upgrade() -> None:
    if not _is_postgres():
        return

    op.execute("ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_created_by_fkey")
    op.execute(
        """
        ALTER TABLE public.courses
          ADD CONSTRAINT courses_created_by_fkey
          FOREIGN KEY (created_by)
          REFERENCES public.profiles(id)
          ON DELETE SET NULL
        """
    )


def downgrade() -> None:
    if not _is_postgres():
        return

    op.execute("ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_created_by_fkey")
    op.execute(
        """
        ALTER TABLE public.courses
          ADD CONSTRAINT courses_created_by_fkey
          FOREIGN KEY (created_by)
          REFERENCES public.profiles(id)
          ON DELETE CASCADE
        """
    )
