"""Allow 'exam' chapter_type to match API schema.

Revision ID: 012_allow_exam_chapter_type
Revises: 011_add_fulltext_search
Create Date: 2026-04-04
"""

from collections.abc import Sequence

from alembic import op

revision: str = "012_allow_exam_chapter_type"
down_revision: str | None = "011_add_fulltext_search"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


ALLOWED = ("reading", "video", "audio", "quiz", "exam", "assignment", "discussion", "mixed", "content")


def upgrade() -> None:
    op.execute("ALTER TABLE chapters DROP CONSTRAINT IF EXISTS chapters_chapter_type_check")
    values = ", ".join(f"'{v}'" for v in ALLOWED)
    op.execute(
        f"ALTER TABLE chapters ADD CONSTRAINT chapters_chapter_type_check "
        f"CHECK (chapter_type IN ({values}))"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE chapters DROP CONSTRAINT IF EXISTS chapters_chapter_type_check")
    old = ("reading", "video", "audio", "quiz", "assignment", "discussion", "mixed", "content")
    values = ", ".join(f"'{v}'" for v in old)
    op.execute(
        f"ALTER TABLE chapters ADD CONSTRAINT chapters_chapter_type_check "
        f"CHECK (chapter_type IN ({values}))"
    )
