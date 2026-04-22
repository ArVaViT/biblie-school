"""Collapse video/audio/mixed chapter types into block-based reading.

With ``audio`` available as a ``chapter_blocks.block_type`` (feat D.1), there's
no reason for ``video`` / ``audio`` / ``mixed`` / ``content`` to exist as
top-level chapter types: everything content-shaped fits inside a chapter as
a sequence of typed blocks. The four allowed ``chapter_type`` values become
``reading`` / ``quiz`` / ``exam`` / ``assignment``.

Data migration:
  - Chapters with zero blocks and a non-empty ``video_url`` and a
    chapter type of ``video`` or ``audio`` get a single matching block.
  - Chapters with zero blocks and non-empty ``content`` get a ``text`` block
    appended after the media block (if any).
  - ``mixed`` and legacy ``content`` chapters just rename to ``reading`` —
    their blocks already exist.
  - Everything becomes ``reading`` at the end.

``chapters.video_url`` and ``chapters.content`` are left in place for now —
a later DB cleanup pass will drop them once we're confident no live deploy
still reads them.

Revision ID: 024_collapse_chapter_types_to_blocks
Revises: 023_drop_discussion_chapter_type
Create Date: 2026-04-21
"""

from collections.abc import Sequence

from alembic import op

revision: str = "024_collapse_chapter_types_to_blocks"
down_revision: str | None = "023_drop_discussion_chapter_type"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


NEW_ALLOWED = ("reading", "quiz", "exam", "assignment")
OLD_ALLOWED = ("reading", "video", "audio", "quiz", "exam", "assignment", "mixed", "content")


def upgrade() -> None:
    # For every video/audio chapter that has no blocks yet, synthesise blocks
    # from the legacy ``video_url`` + ``content`` columns. ``ON CONFLICT`` is
    # unnecessary: ``chapter_blocks`` has no unique constraint on content, and
    # we guard with a ``NOT EXISTS`` so each chapter is touched exactly once.
    op.execute(
        """
        INSERT INTO chapter_blocks (id, chapter_id, block_type, order_index, video_url)
        SELECT gen_random_uuid(), c.id, c.chapter_type, 0, c.video_url
        FROM chapters c
        WHERE c.chapter_type IN ('video', 'audio')
          AND c.video_url IS NOT NULL
          AND c.video_url <> ''
          AND NOT EXISTS (SELECT 1 FROM chapter_blocks b WHERE b.chapter_id = c.id)
        """
    )

    # Any chapter (including legacy reading, video-with-notes, audio-with-transcript)
    # that still has no blocks but does have HTML ``content`` — turn that into
    # a single text block. We order_index after any media block we may have
    # just inserted (hence COALESCE on the max).
    op.execute(
        """
        INSERT INTO chapter_blocks (id, chapter_id, block_type, order_index, content)
        SELECT
            gen_random_uuid(),
            c.id,
            'text',
            COALESCE((SELECT MAX(b.order_index) + 1 FROM chapter_blocks b WHERE b.chapter_id = c.id), 0),
            c.content
        FROM chapters c
        WHERE c.content IS NOT NULL
          AND c.content <> ''
          AND NOT EXISTS (
              SELECT 1 FROM chapter_blocks b
              WHERE b.chapter_id = c.id AND b.block_type = 'text'
          )
        """
    )

    # Collapse the type enum down to the four things that are actually different
    # things (narrative vs. quiz vs. exam vs. assignment).
    op.execute(
        "UPDATE chapters SET chapter_type = 'reading' "
        "WHERE chapter_type IN ('video', 'audio', 'mixed', 'content')"
    )

    op.execute("ALTER TABLE chapters DROP CONSTRAINT IF EXISTS chapters_chapter_type_check")
    values = ", ".join(f"'{v}'" for v in NEW_ALLOWED)
    op.execute(
        f"ALTER TABLE chapters ADD CONSTRAINT chapters_chapter_type_check CHECK (chapter_type IN ({values}))"
    )


def downgrade() -> None:
    # Downgrade only restores the constraint — the per-row data is not
    # round-trippable (we'd need to guess which blocks were "the" video/audio).
    op.execute("ALTER TABLE chapters DROP CONSTRAINT IF EXISTS chapters_chapter_type_check")
    values = ", ".join(f"'{v}'" for v in OLD_ALLOWED)
    op.execute(
        f"ALTER TABLE chapters ADD CONSTRAINT chapters_chapter_type_check CHECK (chapter_type IN ({values}))"
    )
