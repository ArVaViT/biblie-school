import time
from collections import defaultdict

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

ENDPOINT_LIMITS: dict[str, tuple[int, int]] = {
    "/api/v1/auth/": (10, 60),
    "/api/v1/files": (20, 60),
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """In-memory rate limiter with per-endpoint overrides."""

    def __init__(self, app, calls: int = 100, window: int = 60):
        super().__init__(app)
        self.calls = calls
        self.window = window
        self._hits: dict[str, list[float]] = defaultdict(list)

    def _resolve_limit(self, path: str) -> tuple[int, int]:
        for prefix, limit in ENDPOINT_LIMITS.items():
            if path.startswith(prefix):
                return limit
        return self.calls, self.window

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        max_calls, window = self._resolve_limit(path)

        bucket_key = f"{client_ip}:{path}" if max_calls != self.calls else client_ip
        now = time.time()
        cutoff = now - window

        hits = self._hits[bucket_key]
        self._hits[bucket_key] = [t for t in hits if t > cutoff]

        if len(self._hits[bucket_key]) >= max_calls:
            return Response(
                content='{"detail":"Too many requests"}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": str(window)},
            )

        self._hits[bucket_key].append(now)
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(max_calls)
        response.headers["X-RateLimit-Remaining"] = str(
            max(0, max_calls - len(self._hits[bucket_key]))
        )
        return response
