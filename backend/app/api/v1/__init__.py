from fastapi import APIRouter
from app.api.v1 import auth, courses, users, files, health
from app.api.v1 import announcements, notes, grades, analytics
from app.api.v1 import quizzes, assignments, certificates, reviews, prerequisites, progress
from app.api.v1 import blocks

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
api_router.include_router(quizzes.router)
api_router.include_router(assignments.router)
api_router.include_router(certificates.router)
api_router.include_router(reviews.router)
api_router.include_router(prerequisites.router)
api_router.include_router(progress.router)
api_router.include_router(blocks.router)

