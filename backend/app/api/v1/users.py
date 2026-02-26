from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.schemas.course import EnrollmentResponse
from app.services.course_service import get_user_courses

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/courses", response_model=list[EnrollmentResponse])
async def get_my_courses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_user_courses(db, current_user.id)
