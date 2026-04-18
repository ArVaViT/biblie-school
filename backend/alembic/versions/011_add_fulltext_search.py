"""Add full-text search tsvector column + GIN index to courses

Revision ID: 011_add_fulltext_search
Revises: 010_add_soft_delete
Create Date: 2026-04-08
"""

from collections.abc import Sequence

from alembic import op

revision: str = "011_add_fulltext_search"
down_revision: str | None = "010_add_soft_delete"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE courses ADD COLUMN search_vector tsvector")

    op.execute(
        """
        UPDATE courses SET search_vector =
            setweight(to_tsvector('russian', coalesce(title, '')), 'A') ||
            setweight(to_tsvector('russian', coalesce(description, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(description, '')), 'B')
        """
    )

    op.execute("CREATE INDEX ix_courses_search_vector ON courses USING GIN(search_vector)")

    op.execute(
        """
        CREATE OR REPLACE FUNCTION courses_search_vector_update() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector :=
                setweight(to_tsvector('russian', coalesce(NEW.title, '')), 'A') ||
                setweight(to_tsvector('russian', coalesce(NEW.description, '')), 'B') ||
                setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
        """
    )

    op.execute(
        """
        CREATE TRIGGER trg_courses_search_vector
        BEFORE INSERT OR UPDATE OF title, description ON courses
        FOR EACH ROW EXECUTE FUNCTION courses_search_vector_update()
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_courses_search_vector ON courses")
    op.execute("DROP FUNCTION IF EXISTS courses_search_vector_update()")
    op.execute("DROP INDEX IF EXISTS ix_courses_search_vector")
    op.execute("ALTER TABLE courses DROP COLUMN IF EXISTS search_vector")
