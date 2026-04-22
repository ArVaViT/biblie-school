"""Alembic migration environment configuration.

Imports of app.core.database and app.models are placed after
_get_database_url() intentionally: the function only uses stdlib/env
and must work before any app-level module is loaded.
"""

from __future__ import annotations

import os
from logging.config import fileConfig

from sqlalchemy import String, engine_from_config, pool, text

from alembic import context

# Revision ids in this project exceed Alembic's default VARCHAR(32) for
# alembic_version.version_num (e.g. "007_add_certificate_unique_constraint"
# is 36 chars). Widen the column so alembic can record every revision.
_VERSION_COLUMN_TYPE = String(length=255)


def _ensure_wide_version_table(connection) -> None:
    """Guarantee alembic_version.version_num can hold long revision ids.

    ``version_table_column_type`` on ``context.configure`` is only honored
    when Alembic creates the table itself; an existing ``alembic_version``
    with VARCHAR(32) is left untouched. Pre-create / widen the column here
    so we work on fresh CI DBs and already-migrated production DBs alike.
    Postgres-only; other dialects keep Alembic's default behavior.
    """
    if connection.dialect.name != "postgresql":
        return
    connection.execute(
        text(
            "CREATE TABLE IF NOT EXISTS alembic_version ("
            "version_num VARCHAR(255) NOT NULL, "
            "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))"
        )
    )
    connection.execute(text("ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(255)"))


config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def _get_database_url() -> str:
    url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL") or os.getenv("POSTGRES_PRISMA_URL")
    if not url:
        raise RuntimeError("No database URL found. Set DATABASE_URL or POSTGRES_URL.")
    url = url.strip()
    if "sslmode" not in url:
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}sslmode=require"
    return url


# These imports MUST come after _get_database_url is defined because they
# trigger module-level side effects (engine creation, model registration).
import app.models as _models  # noqa: E402
from app.core.database import Base  # noqa: E402

_ = _models  # ensure the import is not flagged as unused

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode — emit SQL to stdout."""
    url = _get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table_column_type=_VERSION_COLUMN_TYPE,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live database connection."""
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = _get_database_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        _ensure_wide_version_table(connection)
        connection.commit()
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            version_table_column_type=_VERSION_COLUMN_TYPE,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
