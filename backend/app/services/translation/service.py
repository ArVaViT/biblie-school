"""Translation provider factory + a pass-through fallback.

Most environments boot without a Gemini key configured (local dev, CI). We
still want the rest of the service to import the translation module without
raising, so ``get_translation_provider()`` returns a ``NoopTranslationProvider``
that simply echoes the source text. Callers can branch on
``is_translation_enabled()`` if they need to refuse to publish a course
when no real provider is wired up.
"""

from __future__ import annotations

import logging
from functools import lru_cache

from app.core.config import settings
from app.services.translation.protocol import (
    TranslationProvider,
    TranslationRequest,
    TranslationResult,
)

logger = logging.getLogger(__name__)


class NoopTranslationProvider:
    """Return the source text unchanged. Safe default when Gemini is off."""

    name = "noop"

    def translate(self, request: TranslationRequest) -> TranslationResult:
        return TranslationResult(text=request.text, model="noop")

    def translate_batch(self, requests: list[TranslationRequest]) -> list[TranslationResult]:
        return [self.translate(req) for req in requests]


def is_translation_enabled() -> bool:
    """Cheap predicate the API/UI can call to gate translation features."""
    return bool(getattr(settings, "GEMINI_API_KEY", None))


@lru_cache(maxsize=1)
def get_translation_provider() -> TranslationProvider:
    """Return the configured provider singleton.

    Uses ``lru_cache`` so we get one ``httpx.Client`` per process — a clean
    win on warm-start serverless invocations where the client gets reused
    across requests.
    """
    if not is_translation_enabled():
        logger.info("Translation provider not configured — using NoopTranslationProvider")
        return NoopTranslationProvider()

    # Imported lazily so environments without ``httpx`` (e.g. tooling) can
    # still touch this module.
    from app.services.translation.gemini import GeminiTranslationProvider

    api_key = settings.GEMINI_API_KEY
    if not api_key:
        # Already covered by ``is_translation_enabled``, but mypy needs the
        # explicit narrowing.
        return NoopTranslationProvider()

    return GeminiTranslationProvider(
        api_key=api_key,
        model=settings.GEMINI_MODEL,
        timeout_seconds=settings.GEMINI_TIMEOUT_SECONDS,
        max_output_tokens=settings.GEMINI_MAX_OUTPUT_TOKENS,
    )


def reset_translation_provider_cache() -> None:
    """Test-only hook: clear the cached singleton.

    The pipeline is exercised in unit tests with monkeypatched settings; if
    we don't reset the cache between tests the first one to hit the factory
    pins a stale provider.
    """
    get_translation_provider.cache_clear()
