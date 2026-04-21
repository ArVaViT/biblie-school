"""Sync Alembic schema with the production Supabase schema.

Production drifted from the Alembic lineage because the original DB was
provisioned via the Supabase dashboard/SQL migrations instead of ``alembic
upgrade head``. This migration makes a fresh ``alembic upgrade head`` produce
the exact shape production already uses, so local tests and production stay
in lock-step from here on.

Changes:
* ``course_prerequisites`` — drop surrogate ``id`` + ``created_at``; make
  ``(course_id, prerequisite_course_id)`` the primary key (matches prod).
* ``notifications`` — rename the JSON column ``metadata`` → ``meta`` to match
  the column name actually present in prod.
* ``certificates`` — allow ``certificate_number`` to stay NULL until an admin
  approves the request (prod was NOT NULL which blocked INSERTs from the
  request endpoint).
* ``chapter_progress`` — the columns ``completed`` / ``created_at`` /
  ``updated_at`` already exist in the Alembic-managed schema from 001; we
  only need to mirror the prod change that made ``completed_at`` nullable.

Revision ID: 017_sync_prod_schema_drift
Revises: 016_rls_perf_cleanup
Create Date: 2026-04-21
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "017_sync_prod_schema_drift"
down_revision: str | None = "016_rls_perf_cleanup"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _dialect() -> str:
    return op.get_context().dialect.name


def upgrade() -> None:
    dialect = _dialect()

    # ── course_prerequisites: shrink to a pure join table ─────────────────
    if dialect == "sqlite":
        # SQLite cannot drop PK/columns in-place without rebuilding the table.
        with op.batch_alter_table("course_prerequisites", recreate="always") as batch:
            batch.drop_column("id")
            batch.drop_column("created_at")
            batch.create_primary_key(
                "course_prerequisites_pkey", ["course_id", "prerequisite_course_id"]
            )
            # The dedicated uniqueness constraint is now redundant with the PK.
            try:
                batch.drop_constraint("uq_prerequisite_course_pair", type_="unique")
            except Exception:  # noqa: BLE001 — constraint may not exist on SQLite batches
                pass
    else:
        # Postgres / production path.
        op.execute("ALTER TABLE course_prerequisites DROP CONSTRAINT IF EXISTS uq_prerequisite_course_pair")
        op.execute("ALTER TABLE course_prerequisites DROP CONSTRAINT IF EXISTS course_prerequisites_pkey")
        with op.batch_alter_table("course_prerequisites") as batch:
            batch.drop_column("created_at")
            batch.drop_column("id")
        op.create_primary_key(
            "course_prerequisites_pkey",
            "course_prerequisites",
            ["course_id", "prerequisite_course_id"],
        )

    # ── notifications.metadata → meta ─────────────────────────────────────
    with op.batch_alter_table("notifications") as batch:
        batch.alter_column("metadata", new_column_name="meta")

    # ── certificates.certificate_number becomes nullable ──────────────────
    with op.batch_alter_table("certificates") as batch:
        batch.alter_column("certificate_number", existing_type=sa.String(length=50), nullable=True)

    # ── chapter_progress.completed_at becomes nullable ────────────────────
    with op.batch_alter_table("chapter_progress") as batch:
        batch.alter_column("completed_at", existing_type=sa.DateTime(timezone=True), nullable=True)


def downgrade() -> None:
    # Best-effort reverse. Not exercised in CI; kept for parity.
    with op.batch_alter_table("chapter_progress") as batch:
        batch.alter_column("completed_at", existing_type=sa.DateTime(timezone=True), nullable=False)

    with op.batch_alter_table("certificates") as batch:
        batch.alter_column("certificate_number", existing_type=sa.String(length=50), nullable=False)

    with op.batch_alter_table("notifications") as batch:
        batch.alter_column("meta", new_column_name="metadata")

    dialect = _dialect()
    if dialect == "sqlite":
        with op.batch_alter_table("course_prerequisites", recreate="always") as batch:
            batch.add_column(
                sa.Column("id", sa.String(length=36), nullable=True)
            )
            batch.add_column(
                sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now())
            )
    else:
        op.execute("ALTER TABLE course_prerequisites DROP CONSTRAINT IF EXISTS course_prerequisites_pkey")
        op.add_column(
            "course_prerequisites",
            sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        )
        op.add_column(
            "course_prerequisites",
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.execute("UPDATE course_prerequisites SET id = gen_random_uuid() WHERE id IS NULL")
        op.alter_column("course_prerequisites", "id", nullable=False)
        op.create_primary_key("course_prerequisites_pkey", "course_prerequisites", ["id"])
        op.create_unique_constraint(
            "uq_prerequisite_course_pair",
            "course_prerequisites",
            ["course_id", "prerequisite_course_id"],
        )
