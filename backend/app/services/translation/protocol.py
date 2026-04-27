"""Provider-agnostic types for the translation pipeline.

The public contract is intentionally small: ask for one (or many)
text → text translations, get either a result or a typed error. Anything
provider-specific (model id, prompt, retry policy) lives behind the
``TranslationProvider`` implementation.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol, runtime_checkable

if TYPE_CHECKING:
    from app.schemas.locale import LocaleCode


@dataclass(frozen=True, slots=True)
class TranslationRequest:
    """A single unit of work for the translator.

    ``text`` may be plain prose or sanitized HTML — the prompt instructs the
    model to preserve markup verbatim. ``content_kind`` lets us specialize
    handling for known shapes (e.g. quiz options should never expand into
    multiple sentences) without leaking that hint into the database column.
    """

    text: str
    source_locale: LocaleCode
    target_locale: LocaleCode
    # One of: "plain", "html", "quiz_option", "quiz_question", "title".
    content_kind: str = "plain"
    # Optional contextual hint surfaced to the model as a system note.
    # E.g. "course on the Acts of the Apostles" — improves accuracy on
    # ambiguous theological terms without bloating every row.
    context: str | None = None


@dataclass(frozen=True, slots=True)
class TranslationResult:
    """Successful translation + telemetry."""

    text: str
    # Tokens reported by the provider (``None`` when unavailable).
    input_tokens: int | None = None
    output_tokens: int | None = None
    # Provider-specific model id actually used (so logs can pin a row to a
    # version of the upstream service).
    model: str | None = None


class TranslationError(RuntimeError):
    """Raised when a provider call fails permanently.

    Transient failures (network, 5xx) should be retried inside the provider
    before bubbling up — by the time this reaches the caller the work
    belongs in the failed-rows queue.
    """


@runtime_checkable
class TranslationProvider(Protocol):
    """Minimal surface every concrete provider must implement."""

    name: str

    def translate(self, request: TranslationRequest) -> TranslationResult:
        """Synchronously translate one request. Must be thread-safe."""

    def translate_batch(self, requests: list[TranslationRequest]) -> list[TranslationResult]:
        """Translate many requests; default to sequential calls.

        Providers that support batching natively should override this for a
        meaningful speedup.
        """
