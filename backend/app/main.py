from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import api_router

app = FastAPI(
    title="Bible School API",
    description="API for Bible School courses platform",
    version="1.0.0"
)

# CORS - настроен для работы с Vercel и разными окружениями
# Если CORS_ORIGINS не задан или пустой, разрешаем все origins для разработки
cors_origins = settings.cors_origins_list if settings.cors_origins_list else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
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

