"""Replace ``chapter_blocks.file_url`` with ``file_bucket`` + ``file_path``.

Background
----------
``chapter_blocks.file_url`` used to store a long-lived Supabase-signed URL
(TTL: 1 year, extended from 1 hour as a previous mitigation). That URL embeds a token signed
with the current Supabase JWT secret. If the project's secret is ever
rotated — deliberately or after a compromise — every signed URL across
every course silently 403s and there is no way to re-mint them because
we no longer know which bucket / object path they originated from.

The architectural fix is to persist only what is stable
(``file_bucket`` + ``file_path``) and sign URLs on demand, so every page
load is already on the current secret.

Data migration
--------------
We attempt to parse the existing ``file_url`` strings to preserve
content that was already uploaded:

* Signed URL:   ``.../storage/v1/object/sign/{bucket}/{path}?token=...``
* Public URL:   ``.../storage/v1/object/public/{bucket}/{path}``
* Same-origin proxy we emit: ``/img/{bucket}/{path}``

Anything that doesn't match (raw external URLs like Google Drive) is
discarded — it never belonged in a "file" block anyway; teachers will
re-upload or use a text block with a hyperlink.

Revision ID: 032_chapter_blocks_bucket_path
Revises: 031_lock_function_search_paths
Create Date: 2026-04-22
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "032_chapter_blocks_bucket_path"
down_revision: str | None = "031_lock_function_search_paths"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "chapter_blocks",
        sa.Column("file_bucket", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "chapter_blocks",
        sa.Column("file_path", sa.Text(), nullable=True),
    )
    op.add_column(
        "chapter_blocks",
        sa.Column("file_name", sa.String(length=255), nullable=True),
    )

    op.execute(
        """
        UPDATE chapter_blocks
           SET file_bucket = substring(file_url FROM '/storage/v1/object/(?:sign|public)/([^/]+)/'),
               file_path = regexp_replace(
                   substring(file_url FROM '/storage/v1/object/(?:sign|public)/[^/]+/(.+)$'),
                   '\\?.*$', ''
               )
         WHERE file_url LIKE '%/storage/v1/object/%'
        """
    )
    op.execute(
        """
        UPDATE chapter_blocks
           SET file_bucket = substring(file_url FROM '^/img/([^/]+)/'),
               file_path = substring(file_url FROM '^/img/[^/]+/(.+)$')
         WHERE file_url LIKE '/img/%'
        """
    )

    op.drop_column("chapter_blocks", "file_url")


def downgrade() -> None:
    op.add_column(
        "chapter_blocks",
        sa.Column("file_url", sa.Text(), nullable=True),
    )
    op.drop_column("chapter_blocks", "file_name")
    op.drop_column("chapter_blocks", "file_path")
    op.drop_column("chapter_blocks", "file_bucket")
