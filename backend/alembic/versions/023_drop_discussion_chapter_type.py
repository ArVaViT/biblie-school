"""Drop the fake 'discussion' chapter type.

The old ``discussion`` type presented a prompt + textarea to students, but the
textarea content was never persisted — the feature was cosmetic. Any existing
rows are migrated to ``reading`` (the prompt HTML lives on in ``content`` and
renders identically) and the value is removed from the ``chapter_type`` check
constraint.

Revision ID: 023_drop_discussion_chapter_type
Revises: 022_add_hot_path_partial_indexes
Create Date: 2026-04-21
"""

from collections.abc import Sequence

from alembic import op

revision: str = "023_drop_discussion_chapter_type"
down_revision: str | None = "022_add_hot_path_partial_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


NEW_ALLOWED = ("reading", "video", "audio", "quiz", "exam", "assignment", "mixed", "content")
OLD_ALLOWED = ("reading", "video", "audio", "quiz", "exam", "assignment", "discussion", "mixed", "content")


def upgrade() -> None:
    op.execute("UPDATE chapters SET chapter_type = 'reading' WHERE chapter_type = 'discussion'")
    op.execute("ALTER TABLE chapters DROP CONSTRAINT IF EXISTS chapters_chapter_type_check")
    values = ", ".join(f"'{v}'" for v in NEW_ALLOWED)
    op.execute(f"ALTER TABLE chapters ADD CONSTRAINT chapters_chapter_type_check CHECK (chapter_type IN ({values}))")


def downgrade() -> None:
    op.execute("ALTER TABLE chapters DROP CONSTRAINT IF EXISTS chapters_chapter_type_check")
    values = ", ".join(f"'{v}'" for v in OLD_ALLOWED)
    op.execute(f"ALTER TABLE chapters ADD CONSTRAINT chapters_chapter_type_check CHECK (chapter_type IN ({values}))")
