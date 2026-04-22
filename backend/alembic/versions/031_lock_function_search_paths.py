"""Lock ``search_path`` on three ``SECURITY DEFINER``-adjacent functions.

Supabase's database linter flags functions without an explicit
``search_path`` as ``function_search_path_mutable`` (lint 0011). An
attacker with write access to any schema the function touches could
shadow a table or operator and have the function resolve to the
malicious version. Pinning ``search_path`` to ``pg_catalog, public``
removes that class of attack.

This is applied in Supabase directly too (via
``apply_migration(lock_function_search_paths)``); the alembic file is
kept so the fix survives any future ``alembic upgrade head`` against a
freshly-restored database.

Revision ID: 031_lock_function_search_paths
Revises: 030_drop_files_table
Create Date: 2026-04-22
"""

from collections.abc import Sequence

from alembic import op

revision: str = "031_lock_function_search_paths"
down_revision: str | None = "030_drop_files_table"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_FUNCTIONS: list[str] = [
    "public.update_updated_at()",
    "public.courses_search_vector_update()",
    "public.custom_access_token_hook(event jsonb)",
]


def upgrade() -> None:
    for sig in _FUNCTIONS:
        op.execute(f"ALTER FUNCTION {sig} SET search_path = pg_catalog, public")


def downgrade() -> None:
    for sig in _FUNCTIONS:
        op.execute(f"ALTER FUNCTION {sig} RESET search_path")
