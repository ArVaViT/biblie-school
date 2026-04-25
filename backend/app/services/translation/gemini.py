"""Gemini-backed implementation of ``TranslationProvider``.

We hit the public ``generativelanguage.googleapis.com`` REST surface
directly with ``httpx``; pulling in ``google-generativeai`` would add a
sizeable transitive dependency tree for one endpoint. The API contract is
documented at https://ai.google.dev/api/rest/v1beta/models/generateContent.

The provider is *only* constructed when ``settings.GEMINI_API_KEY`` is
set. See ``app.services.translation.service.get_translation_provider``.
"""

from __future__ import annotations

import contextlib
import logging
import time
from typing import Any

import httpx

from app.services.translation.prompt import build_system_prompt, build_user_prompt
from app.services.translation.protocol import (
    TranslationError,
    TranslationProvider,
    TranslationRequest,
    TranslationResult,
)

logger = logging.getLogger(__name__)

_API_BASE = "https://generativelanguage.googleapis.com/v1beta"

# Retry only on transient classes, never on generic 4xx responses.
_RETRYABLE_STATUSES = frozenset({408, 429, 500, 502, 503, 504})


class GeminiTranslationProvider:
    """Synchronous Gemini provider with bounded retries.

    Designed for short-lived FastAPI workers: one ``httpx.Client`` per
    instance, transports reused across calls, no global state.
    """

    name = "gemini"

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        timeout_seconds: float,
        max_output_tokens: int,
        max_retries: int = 2,
        client: httpx.Client | None = None,
    ) -> None:
        if not api_key:
            # Caller responsibility, but assert loudly. Silently swallowing
            # an empty key would leave us calling Gemini unauthenticated.
            raise ValueError("GeminiTranslationProvider requires a non-empty api_key")
        self._api_key = api_key
        self._model = model
        self._max_output_tokens = max_output_tokens
        self._max_retries = max_retries
        self._client = client or httpx.Client(timeout=timeout_seconds)

    def __del__(self) -> None:
        # Best-effort cleanup; FastAPI workers usually outlive the provider
        # but unit tests construct one per case.
        with contextlib.suppress(Exception):
            self._client.close()

    def translate(self, request: TranslationRequest) -> TranslationResult:
        if request.source_locale == request.target_locale or not request.text.strip():
            return TranslationResult(text=request.text, model=self._model)

        payload = self._build_payload(request)
        url = f"{_API_BASE}/models/{self._model}:generateContent"
        headers = {"Content-Type": "application/json", "X-goog-api-key": self._api_key}

        last_error: Exception | None = None
        for attempt in range(self._max_retries + 1):
            try:
                response = self._client.post(url, json=payload, headers=headers)
            except httpx.HTTPError as exc:
                last_error = exc
                logger.warning("Gemini transport error attempt=%s err=%s", attempt, exc)
            else:
                if response.status_code == 200:
                    return self._parse_response(response.json())
                if response.status_code in _RETRYABLE_STATUSES:
                    last_error = TranslationError(f"Gemini returned {response.status_code}: {response.text[:200]}")
                    logger.warning(
                        "Gemini transient %s attempt=%s body=%s",
                        response.status_code,
                        attempt,
                        response.text[:200],
                    )
                else:
                    raise TranslationError(f"Gemini returned {response.status_code}: {response.text[:200]}")

            if attempt < self._max_retries:
                # Exponential back-off with a small floor: keeps us from
                # hammering on a 429 burst but doesn't add noticeable latency
                # to the happy path.
                time.sleep(min(2.0, 0.25 * (2**attempt)))

        raise TranslationError(f"Gemini call failed after retries: {last_error!r}")

    def translate_batch(self, requests: list[TranslationRequest]) -> list[TranslationResult]:
        # The REST endpoint translates one request at a time; the batching
        # win comes from issuing them on a shared HTTP/2 connection. The
        # default sequential implementation is fine for the volumes we
        # anticipate (one course publish is a few hundred chunks).
        return [self.translate(req) for req in requests]

    def _build_payload(self, request: TranslationRequest) -> dict[str, Any]:
        system_prompt = build_system_prompt(
            source_locale=request.source_locale,
            target_locale=request.target_locale,
        )
        user_prompt = build_user_prompt(
            text=request.text,
            content_kind=request.content_kind,
            context=request.context,
        )
        return {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
            "generationConfig": {
                # ``temperature=0`` for translation: we want the most
                # likely rendering, not creative paraphrase.
                "temperature": 0,
                "maxOutputTokens": self._max_output_tokens,
            },
        }

    def _parse_response(self, body: dict[str, Any]) -> TranslationResult:
        candidates = body.get("candidates") or []
        if not candidates:
            raise TranslationError(f"Gemini returned no candidates: {body!r}")

        parts = candidates[0].get("content", {}).get("parts") or []
        text = "".join(p.get("text", "") for p in parts).strip()
        if not text:
            raise TranslationError("Gemini returned an empty translation")

        usage = body.get("usageMetadata") or {}
        return TranslationResult(
            text=text,
            input_tokens=usage.get("promptTokenCount"),
            output_tokens=usage.get("candidatesTokenCount"),
            model=self._model,
        )


__all__ = ["GeminiTranslationProvider"]


# mypy enforces ``GeminiTranslationProvider`` matches ``TranslationProvider``
# structurally; the binding keeps the protocol import alive so the check
# runs even when nothing in this module consumes it directly.
_PROVIDER_TYPE: type[TranslationProvider] = GeminiTranslationProvider
