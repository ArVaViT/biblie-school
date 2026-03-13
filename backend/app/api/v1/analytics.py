from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.dependencies import require_teacher, verify_course_owner
from app.models.user import User
from app.models.enrollment import Enrollment

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/course/{course_id}")
async def get_course_analytics(
    course_id: str,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    course = verify_course_owner(db, course_id, teacher.id)

    enrollments = (
        db.query(Enrollment, User)
        .join(User, Enrollment.user_id == User.id)
        .filter(Enrollment.course_id == course_id)
        .all()
    )

    total_students = len(enrollments)
    avg_progress = 0.0
    completion_count = 0
    student_list = []

    if total_students > 0:
        progress_values = [e.progress for e, _ in enrollments]
        avg_progress = round(sum(progress_values) / total_students, 1)
        completion_count = sum(1 for p in progress_values if p >= 100)

    for enrollment, user in enrollments:
        student_list.append({
            "enrollment_id": enrollment.id,
            "user_id": str(enrollment.user_id),
            "full_name": user.full_name or user.email,
            "email": user.email,
            "progress": enrollment.progress,
            "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None,
        })

    return {
        "course_id": course_id,
        "course_title": course.title,
        "total_students": total_students,
        "avg_progress": avg_progress,
        "completion_count": completion_count,
        "enrollments": student_list,
    }
