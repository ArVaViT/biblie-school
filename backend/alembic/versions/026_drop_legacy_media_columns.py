"""Drop legacy media columns now that content lives in chapter_blocks.

Migrations 024-025 moved every bit of chapter-level content into
``chapter_blocks`` rows. These three columns have been unread and unwritten
ever since, so the time to drop them is now - keeping dead columns around
costs storage, confuses readers, and risks accidental writes later.

Columns dropped:
  - ``chapters.content``       (legacy HTML body, now a text block)
  - ``chapters.video_url``     (legacy media URL, now a text block embed)
  - ``chapter_blocks.video_url`` (legacy media URL on video/audio blocks;
    migration 025 already zeroed it out while rewriting those blocks as
    text blocks)

``downgrade()`` re-adds the columns as nullable so a rollback at least
restores the schema shape. Data is gone.

Revision ID: 026_drop_legacy_media_columns
Revises: 025_collapse_media_blocks_into_text
Create Date: 2026-04-21
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "026_drop_legacy_media_columns"
down_revision: str | None = "025_collapse_media_blocks_into_text"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("chapter_blocks", "video_url")
    op.drop_column("chapters", "video_url")
    op.drop_column("chapters", "content")


def downgrade() -> None:
    op.add_column("chapters", sa.Column("content", sa.String(), nullable=True))
    op.add_column("chapters", sa.Column("video_url", sa.String(), nullable=True))
    op.add_column("chapter_blocks", sa.Column("video_url", sa.Text(), nullable=True))
