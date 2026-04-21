import logging
import os
import time

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.v1 import api_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.sentry import init_sentry
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.security import SecurityHeadersMiddleware

setup_logging()

# Must run before FastAPI is constructed so the integrations can patch the
# ASGI stack. No-op when SENTRY_DSN isn't configured.
init_sentry()

logger = logging.getLogger("api")

_IS_PRODUCTION = bool(os.environ.get("VERCEL") or os.environ.get("PRODUCTION"))

app = FastAPI(
    title="Bible School API",
    description=(
        "RESTful API for the Bible School learning platform. "
        "Provides endpoints for course management, user enrollment, "
        "progress tracking, and file uploads."
    ),
    version="1.0.0",
    docs_url=None if _IS_PRODUCTION else "/docs",
    redoc_url=None if _IS_PRODUCTION else "/redoc",
)

cors_origins = settings.cors_origins_list or [
    "http://localhost:3000",
    "http://localhost:5173",
]

# credentials=True is not allowed with origin "*"
allow_credentials = "*" not in cors_origins


class OptionsMiddleware(BaseHTTPMiddleware):
    """Handle OPTIONS preflight requests before FastAPI validation."""

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method == "OPTIONS":
            origin = request.headers.get("origin", "*")
            allowed_origin = "*"

            if origin and origin != "*":
                if cors_origins == ["*"] or origin in cors_origins:
                    allowed_origin = origin

            headers = {
                "Access-Control-Allow-Origin": allowed_origin,
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Origin, X-Requested-With, Access-Control-Request-Method, Access-Control-Request-Headers",
                "Access-Control-Max-Age": "3600",
            }

            if allow_credentials and allowed_origin != "*":
                headers["Access-Control-Allow-Credentials"] = "true"

            return Response(status_code=200, headers=headers)

        return await call_next(request)


app.add_middleware(SecurityHeadersMiddleware)

# GZip JSON responses larger than ~1KB. Starlette runs middleware in LIFO order
# on the response path, so this sits between SecurityHeaders (innermost, closest
# to the route) and CORS (outermost). That way Content-Length already reflects
# the compressed payload by the time CORS/logging sees it.
app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=5)

app.add_middleware(RateLimitMiddleware, calls=100, window=60)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if cors_origins != ["*"] else ["*"],
    allow_credentials=allow_credentials,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "X-Requested-With",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
    ],
    expose_headers=["Content-Disposition", "X-Request-Id"],
    max_age=3600,
)

app.add_middleware(OptionsMiddleware)

app.include_router(api_router, prefix="/api/v1")


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    # Constraint violations (unique/foreign-key/check) mean the request
    # conflicts with current state — not that the database is down. Surfacing
    # these as 503 hid real client-side bugs (duplicate keys, stale refs)
    # behind a generic outage message.
    # We pull the pgcode and constraint name off ``exc.orig`` so log search can
    # jump straight to the offending constraint instead of fishing through the
    # full rendered SQL statement.
    orig = getattr(exc, "orig", None)
    pgcode = getattr(orig, "pgcode", None)
    diag = getattr(orig, "diag", None)
    constraint = getattr(diag, "constraint_name", None) if diag is not None else None
    logger.warning(
        "Integrity error on %s %s pgcode=%s constraint=%s: %s",
        request.method,
        request.url.path,
        pgcode,
        constraint,
        exc,
    )
    return JSONResponse(
        status_code=409,
        content={"detail": "Request conflicts with current state of the resource."},
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.error("Database error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=503,
        content={"detail": "Database temporarily unavailable. Please try again."},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = round((time.time() - start) * 1000, 1)
    logger.info(
        "%s %s %s %sms",
        request.method,
        request.url.path,
        response.status_code,
        duration,
    )
    return response


@app.get("/")
async def root() -> dict:
    return {"message": "Bible School API", "version": "1.0.0"}


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/favicon.ico", include_in_schema=False)
@app.options("/favicon.ico", include_in_schema=False)
async def favicon() -> Response:
    return Response(status_code=204)


@app.get("/vite.svg", include_in_schema=False)
@app.options("/vite.svg", include_in_schema=False)
@app.get("/favicon.png", include_in_schema=False)
@app.options("/favicon.png", include_in_schema=False)
@app.get("/favicon.svg", include_in_schema=False)
@app.options("/favicon.svg", include_in_schema=False)
async def static_icons() -> Response:
    return Response(status_code=204)
