"""Shared helpers for inspecting incoming HTTP requests.

Kept out of the middleware/service layers so that rate limiting, audit logging,
and anything else that needs a reliable client IP share one implementation.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import Request


def get_client_ip(request: Request, fallback: str | None = None) -> str | None:
    """Resolve the real client IP, honoring standard proxy-forwarding headers.

    On Vercel (and any reverse-proxy deploy) ``request.client.host`` is the
    proxy worker's IP, not the user's real IP. ``X-Forwarded-For`` is set by
    the proxy to ``<client>, <proxy>, <proxy>...`` (left-to-right), so the
    left-most entry is the original client; everything after is proxy chain.

    ``request.client.host`` is used as a last resort for local development,
    where no proxy is in front. Returns ``fallback`` when we truly cannot
    determine the IP (for the rate limiter, pass ``"unknown"``; for audit
    logging, pass ``None`` so the DB column stays NULL).
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
        if ip:
            return ip

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()

    if request.client is not None and request.client.host:
        return request.client.host

    return fallback
