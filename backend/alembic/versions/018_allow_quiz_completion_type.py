"""Allow ``completion_type = 'quiz'`` on chapter_progress.

The production CHECK constraint only permitted ``'self'`` / ``'teacher'``, but
``submit_quiz`` writes ``'quiz'`` when a student passes a quiz, which triggered
an IntegrityError (surfaced to the client as 409 "Request conflicts with
current state of the resource."). Expanding the constraint keeps the
analytical distinction between self-completion, teacher-completion, and
quiz-driven completion while unblocking the submit flow.

Revision ID: 018_allow_quiz_completion_type
Revises: 017_sync_prod_schema_drift
Create Date: 2026-04-21
"""

import contextlib
from collections.abc import Sequence

from alembic import op

revision: str = "018_allow_quiz_completion_type"
down_revision: str | None = "017_sync_prod_schema_drift"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_CONSTRAINT_NAME = "chapter_progress_completion_type_check"
_TABLE = "chapter_progress"


def _dialect() -> str:
    return op.get_context().dialect.name


def upgrade() -> None:
    if _dialect() == "sqlite":
        with op.batch_alter_table(_TABLE, recreate="always") as batch:
            # The constraint may or may not already exist on older test DBs.
            with contextlib.suppress(Exception):
                batch.drop_constraint(_CONSTRAINT_NAME, type_="check")
            batch.create_check_constraint(
                _CONSTRAINT_NAME,
                "completion_type IN ('self', 'teacher', 'quiz')",
            )
        return

    op.execute(f"ALTER TABLE {_TABLE} DROP CONSTRAINT IF EXISTS {_CONSTRAINT_NAME}")
    op.create_check_constraint(
        _CONSTRAINT_NAME,
        _TABLE,
        "completion_type IN ('self', 'teacher', 'quiz')",
    )


def downgrade() -> None:
    if _dialect() == "sqlite":
        with op.batch_alter_table(_TABLE, recreate="always") as batch:
            with contextlib.suppress(Exception):
                batch.drop_constraint(_CONSTRAINT_NAME, type_="check")
            batch.create_check_constraint(
                _CONSTRAINT_NAME,
                "completion_type IN ('self', 'teacher')",
            )
        return

    op.execute(f"ALTER TABLE {_TABLE} DROP CONSTRAINT IF EXISTS {_CONSTRAINT_NAME}")
    op.create_check_constraint(
        _CONSTRAINT_NAME,
        _TABLE,
        "completion_type IN ('self', 'teacher')",
    )
