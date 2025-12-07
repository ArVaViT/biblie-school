from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import settings
from app.api.v1 import api_router

app = FastAPI(
    title="Bible School API",
    description="API for Bible School courses platform",
    version="1.0.0"
)

# CORS origins configuration
try:
    cors_origins = settings.cors_origins_list if settings.cors_origins_list else ["*"]
except Exception:
    cors_origins = ["*"]

# Нельзя использовать credentials с "*"
allow_credentials = "*" not in cors_origins

# Middleware для обработки OPTIONS запросов ДО всего остального
class OptionsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            try:
                # Получаем origin из запроса
                origin = request.headers.get("origin")
                
                # Определяем allowed_origin
                allowed_origin = "*"
                credentials_header = ""
                
                try:
                    if allow_credentials and origin:
                        # Если credentials разрешены, используем конкретный origin
                        if cors_origins and "*" not in cors_origins:
                            if origin in cors_origins:
                                allowed_origin = origin
                                credentials_header = "true"
                            else:
                                # Origin не в списке, но для preflight все равно отвечаем
                                allowed_origin = origin
                                credentials_header = "true"
                        else:
                            # Если "*" в cors_origins, credentials не могут быть true
                            allowed_origin = "*"
                            credentials_header = "false"
                    else:
                        # Credentials не разрешены, можно использовать "*"
                        allowed_origin = "*"
                        credentials_header = "false"
                except Exception:
                    # В случае ошибки используем безопасные значения
                    allowed_origin = "*"
                    credentials_header = "false"
                
                # Строим заголовки
                headers = {
                    "Access-Control-Allow-Origin": allowed_origin,
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Origin, X-Requested-With",
                    "Access-Control-Max-Age": "3600",
                }
                
                # Добавляем credentials только если они разрешены
                if credentials_header == "true":
                    headers["Access-Control-Allow-Credentials"] = "true"
                
                return Response(status_code=200, headers=headers)
            except Exception as e:
                # В случае любой ошибки возвращаем базовый ответ без credentials
                return Response(
                    status_code=200,
                    headers={
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                        "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Origin, X-Requested-With",
                        "Access-Control-Max-Age": "3600",
                    }
                )
        return await call_next(request)

# Добавляем OPTIONS middleware ПЕРВЫМ
app.add_middleware(OptionsMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
    expose_headers=["*"],
    max_age=3600,
)

# Include API router
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {"message": "Bible School API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}

