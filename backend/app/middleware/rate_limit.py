import time
from collections import defaultdict

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiter. Limits per IP per window."""

    def __init__(self, app, calls: int = 60, window: int = 60):
        super().__init__(app)
        self.calls = calls
        self.window = window
        self._hits: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        cutoff = now - self.window

        hits = self._hits[client_ip]
        self._hits[client_ip] = [t for t in hits if t > cutoff]

        if len(self._hits[client_ip]) >= self.calls:
            return Response(
                content='{"detail":"Too many requests"}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": str(self.window)},
            )

        self._hits[client_ip].append(now)
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.calls)
        response.headers["X-RateLimit-Remaining"] = str(
            max(0, self.calls - len(self._hits[client_ip]))
        )
        return response
