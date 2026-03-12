import logging
import time

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.logging import setup_logging
from app.middleware.rate_limit import RateLimitMiddleware
from app.api.v1 import api_router

setup_logging()

logger = logging.getLogger("api")

app = FastAPI(
    title="Bible School API",
    description=(
        "RESTful API for the Bible School learning platform. "
        "Provides endpoints for course management, user enrollment, "
        "progress tracking, and file uploads."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

try:
    cors_origins = settings.cors_origins_list if settings.cors_origins_list else ["*"]
except Exception:
    cors_origins = ["*"]

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


app.add_middleware(RateLimitMiddleware, calls=100, window=60)

app.add_middleware(OptionsMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if cors_origins != ["*"] else ["*"],
    allow_credentials=allow_credentials,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With", "Access-Control-Request-Method", "Access-Control-Request-Headers"],
    expose_headers=["*"],
    max_age=3600,
)

app.include_router(api_router, prefix="/api/v1")


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
