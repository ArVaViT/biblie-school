from fastapi import APIRouter
from app.api.v1 import auth, courses, users, files, health

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(courses.router)
api_router.include_router(users.router)
api_router.include_router(files.router)
api_router.include_router(health.router)

