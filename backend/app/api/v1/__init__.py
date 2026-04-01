from fastapi import APIRouter
from app.api.v1 import auth, courses, users, files, health
from app.api.v1 import announcements, grades, analytics
from app.api.v1 import quizzes, assignments, certificates, reviews, prerequisites, progress
from app.api.v1 import blocks, cohorts, notifications, audit
from app.api.v1 import calendar as calendar_mod

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(courses.router)
api_router.include_router(users.router)
api_router.include_router(files.router)
api_router.include_router(health.router)
api_router.include_router(announcements.router)
api_router.include_router(grades.router)
api_router.include_router(analytics.router)
api_router.include_router(quizzes.router)
api_router.include_router(assignments.router)
api_router.include_router(certificates.router)
api_router.include_router(reviews.router)
api_router.include_router(prerequisites.router)
api_router.include_router(progress.router)
api_router.include_router(blocks.router)
api_router.include_router(cohorts.router)
api_router.include_router(notifications.router)
api_router.include_router(audit.router)
api_router.include_router(calendar_mod.router)
api_router.include_router(calendar_mod.event_router)

