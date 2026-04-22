"""Drop redundant indexes on primary keys and FK prefixes of composites.

Two classes of duplication to clean up:

1. **Primary-key duplicates**: Columns declared as
   ``Column(..., primary_key=True, index=True)`` produce *two* B-tree indexes
   in Postgres: the one PostgreSQL creates automatically for the PRIMARY KEY
   constraint, and a second one named ``ix_<table>_id`` from the
   ``index=True`` flag. The second one is pure waste — writes maintain both,
   reads always prefer the PK, and they answer identical queries.

2. **Single-FK columns shadowed by a composite**: e.g. ``modules.course_id``
   has both ``ix_modules_course_id`` (single) and
   ``ix_modules_course_id_order`` (``(course_id, order_index)``). Any query
   of the form ``WHERE course_id = ?`` can use the composite's leading
   column equally well, so the single-column variant is overhead with no
   benefit.

The model definitions are updated in the same PR so Alembic autogenerate
doesn't re-create the dropped indexes next time someone runs it.

Revision ID: 027_drop_redundant_indexes
Revises: 026_drop_legacy_media_columns
Create Date: 2026-04-21
"""

from collections.abc import Sequence

from alembic import op

revision: str = "027_drop_redundant_indexes"
down_revision: str | None = "026_drop_legacy_media_columns"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# (index_name, table_name) — ``IF EXISTS`` keeps this idempotent if the
# environment somehow already dropped a subset.
_REDUNDANT_PK_INDEXES: list[tuple[str, str]] = [
    ("ix_courses_id", "courses"),
    ("ix_modules_id", "modules"),
    ("ix_chapters_id", "chapters"),
    ("ix_enrollments_id", "enrollments"),
    ("ix_files_id", "files"),
    ("ix_profiles_id", "profiles"),
]

# Single-column FK indexes shadowed by a composite ``(fk, order_index)``.
_REDUNDANT_FK_INDEXES: list[tuple[str, str]] = [
    ("ix_modules_course_id", "modules"),
    ("ix_chapters_module_id", "chapters"),
]

# UNIQUE columns that also have a plain ``index=True`` flag — the unique
# constraint already backs a B-tree, so the plain index is duplication.
_REDUNDANT_UNIQUE_INDEXES: list[tuple[str, str]] = [
    ("ix_profiles_email", "profiles"),
]


def upgrade() -> None:
    all_drops = _REDUNDANT_PK_INDEXES + _REDUNDANT_FK_INDEXES + _REDUNDANT_UNIQUE_INDEXES
    for idx, table in all_drops:
        op.execute(f'DROP INDEX IF EXISTS "{idx}"')
        # Keep the table name in scope even though we use raw SQL — it's
        # informational for future ``alembic downgrade`` readers.
        del table


def downgrade() -> None:
    for idx, table in _REDUNDANT_PK_INDEXES:
        op.create_index(idx, table, ["id"])
    op.create_index("ix_modules_course_id", "modules", ["course_id"])
    op.create_index("ix_chapters_module_id", "chapters", ["module_id"])
    op.create_index("ix_profiles_email", "profiles", ["email"])
