"""Collapse ``video`` / ``audio`` blocks into ``text`` blocks.

The text block's rich editor (Tiptap) already embeds YouTube and audio via
dedicated toolbar buttons, so separate ``video`` / ``audio`` block types
just duplicate that. Every existing block is rewritten into a ``text`` block
whose ``content`` HTML carries the equivalent embed, then ``video_url`` is
cleared.

Notes on safety:
  - DOMPurify strips any ``<iframe>`` whose ``src`` doesn't start with one
    of our YouTube embed prefixes, so unparseable URLs fall back to a
    plain ``<a>`` link.
  - ``src`` / ``href`` values are HTML-escaped inline so stray quotes or
    angle-brackets in ``video_url`` can't break out of the attribute.

Revision ID: 025_collapse_media_blocks_into_text
Revises: 024_collapse_chapter_types_to_blocks
Create Date: 2026-04-21
"""

from collections.abc import Sequence

from alembic import op

revision: str = "025_collapse_media_blocks_into_text"
down_revision: str | None = "024_collapse_chapter_types_to_blocks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Matches any of the four YouTube URL shapes we support elsewhere
# (see ``frontend/src/lib/youtubeUrl.ts``) and captures the 11-char ID.
_YT_ID_RE = (
    r"(?:youtu\.be/|youtube\.com/watch\?v=|"
    r"youtube\.com/embed/|youtube-nocookie\.com/embed/)"
    r"([a-zA-Z0-9_-]{11})"
)


def _html_escape(expr: str) -> str:
    """Return a SQL expression that HTML-escapes ``expr`` in place."""
    return (
        f"replace(replace(replace(replace({expr},"
        f"'&','&amp;'),'<','&lt;'),'>','&gt;'),'\"','&quot;')"
    )


def upgrade() -> None:
    # Video blocks with a parseable YouTube URL → iframe embed matching
    # what YoutubeExtension renders from the editor.
    op.execute(
        f"""
        UPDATE chapter_blocks
        SET block_type = 'text',
            content = '<div data-youtube-embed="" class="youtube-embed-wrapper">'
                   || '<iframe src="https://www.youtube.com/embed/'
                   || substring(video_url FROM '{_YT_ID_RE}')
                   || '" width="100%" height="400" frameborder="0" '
                   || 'allowfullscreen="true" '
                   || 'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" '
                   || 'loading="lazy"></iframe></div>',
            video_url = NULL
        WHERE block_type = 'video'
          AND video_url IS NOT NULL
          AND video_url ~ '{_YT_ID_RE}'
        """
    )

    # Video blocks pointing at non-YouTube URLs (or URLs our regex can't
    # parse) → fall back to a plain link so the data isn't lost.
    op.execute(
        f"""
        UPDATE chapter_blocks
        SET block_type = 'text',
            content = '<p><a href="' || {_html_escape("video_url")}
                   || '" target="_blank" rel="noopener noreferrer">'
                   || {_html_escape("video_url")} || '</a></p>',
            video_url = NULL
        WHERE block_type = 'video'
          AND video_url IS NOT NULL
        """
    )

    # Audio blocks → ``<audio>`` tag matching AudioExtension's renderHTML.
    # DOMPurify enforces the URI whitelist on render, so any non-https
    # source gets stripped client-side (we keep the tag for fidelity).
    op.execute(
        f"""
        UPDATE chapter_blocks
        SET block_type = 'text',
            content = '<audio src="' || {_html_escape("video_url")}
                   || '" controls="" preload="metadata" class="w-full my-4"></audio>',
            video_url = NULL
        WHERE block_type = 'audio'
          AND video_url IS NOT NULL
        """
    )

    # Orphans: video/audio blocks without a URL. Preserve whatever content
    # they already had so we don't lose anything, then reclassify as text.
    op.execute(
        """
        UPDATE chapter_blocks
        SET block_type = 'text'
        WHERE block_type IN ('video', 'audio')
        """
    )


def downgrade() -> None:
    # This is a lossy migration — the original video_url was encoded into
    # the HTML content. Restoring it requires parsing the embedded HTML,
    # which we'd rather not do in Alembic. Leaving this as a no-op is the
    # honest answer: if you need to roll back, roll back to before 025.
    pass
