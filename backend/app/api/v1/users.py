from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.dependencies import get_current_user, require_admin
from app.models.user import User, UserRole
from app.schemas.course import EnrollmentResponse
from app.services.course_service import get_user_courses

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/courses", response_model=list[EnrollmentResponse])
async def get_my_courses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_user_courses(db, current_user.id)


@router.get("/admin/users")
async def list_all_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "avatar_url": getattr(u, "avatar_url", None),
            "created_at": str(u.created_at),
        }
        for u in users
    ]


@router.put("/admin/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    role: str = Query(...),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if role not in ("admin", "teacher", "pending_teacher", "student"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid role")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    user.role = role
    db.commit()
    db.refresh(user)
    return {"id": str(user.id), "email": user.email, "role": user.role}
