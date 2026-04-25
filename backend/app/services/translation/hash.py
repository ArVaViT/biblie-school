"""Stable, content-addressable hash for source strings.

A short SHA-256 (16 bytes hex-encoded → 32 chars) is more than enough to
distinguish unrelated edits without bloating the row. Whitespace is
collapsed first so trailing-newline-only edits don't mark every row as
``stale``. The output is deterministic across Python versions and
platforms — vital because the value is persisted next to the translation
and compared on every publish.
"""

from __future__ import annotations

import hashlib
import re

_WHITESPACE = re.compile(r"\s+")


def _normalize(text: str) -> str:
    """Strip & collapse whitespace; preserve case and punctuation otherwise."""
    return _WHITESPACE.sub(" ", text).strip()


def compute_source_hash(text: str, *, locale: str | None = None) -> str:
    """Return a 32-char hex digest for ``text``.

    ``locale`` participates in the hash so a row with the same text in a
    different source language is treated as a different source — useful when
    a teacher swaps the authoring language mid-course.
    """
    payload = f"{(locale or '').lower()}\x00{_normalize(text)}".encode()
    return hashlib.sha256(payload).hexdigest()[:32]
