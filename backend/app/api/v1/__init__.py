from fastapi import APIRouter
from app.api.v1 import auth, courses, users, files, health
from app.api.v1 import announcements, notes, grades, analytics

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(courses.router)
api_router.include_router(users.router)
api_router.include_router(files.router)
api_router.include_router(health.router)
api_router.include_router(announcements.router)
api_router.include_router(notes.router)
api_router.include_router(grades.router)
api_router.include_router(analytics.router)

