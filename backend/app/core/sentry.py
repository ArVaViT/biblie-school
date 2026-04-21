"""Optional Sentry integration for the backend.

Init is deferred to a helper so it can be called once from main.py before the
FastAPI app is created. When SENTRY_DSN is unset, the helper is a no-op — this
keeps local dev and test runs free of the sentry-sdk import side effects.
"""

from __future__ import annotations

import logging
import os

from app.core.config import settings

logger = logging.getLogger(__name__)


def init_sentry() -> None:
    """Initialize sentry-sdk if configured. Safe to call multiple times."""
    dsn = settings.SENTRY_DSN
    if not dsn:
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
    except ImportError:
        # sentry-sdk is optional in requirements.txt — if someone sets
        # SENTRY_DSN without installing the SDK we log a warning instead of
        # crashing the app on import.
        logger.warning("SENTRY_DSN is set but sentry-sdk is not installed; skipping init")
        return

    environment = (
        settings.SENTRY_ENVIRONMENT
        or ("production" if os.environ.get("VERCEL_ENV") == "production" else os.environ.get("VERCEL_ENV"))
        or "development"
    )

    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        # Keep trace volume modest; Sentry's free tier is trivial to exhaust
        # on a serverless app with hot startup traces. Tune via env var.
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        # send_default_pii is OFF — our RLS model already scopes data per user,
        # so we don't need Sentry stuffing usernames into events.
        send_default_pii=False,
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            StarletteIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
        ],
    )
    logger.info("Sentry initialized (environment=%s)", environment)
