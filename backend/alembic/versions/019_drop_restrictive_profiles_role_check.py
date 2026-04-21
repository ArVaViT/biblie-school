"""Drop the duplicate restrictive ``profiles_role_check`` CHECK.

Prod ended up with two CHECKs on ``profiles.role``:

* ``chk_profiles_role`` — allows ``admin|teacher|pending_teacher|student`` (the
  values the code actually uses, including the ``pending_teacher`` onboarding
  state).
* ``profiles_role_check`` — the older, restrictive version that only allows
  ``admin|teacher|student`` and silently blocked any INSERT/UPDATE with
  ``role = 'pending_teacher'`` with a generic 409 ``CheckViolation``.

We drop the restrictive one; the inclusive one stays as the single source of
truth. SQLite test DBs never had either constraint (the CHECK was Postgres-
only) so the downgrade there is a no-op.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "019_drop_restrictive_profiles_role_check"
down_revision: str | None = "018_allow_quiz_completion_type"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _dialect() -> str:
    return op.get_context().dialect.name


def upgrade() -> None:
    if _dialect() != "postgresql":
        return
    op.execute("ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check")


def downgrade() -> None:
    if _dialect() != "postgresql":
        return
    op.execute("ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check")
    op.execute(
        "ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check "
        "CHECK (role = ANY (ARRAY['admin'::text, 'teacher'::text, 'student'::text]))"
    )
