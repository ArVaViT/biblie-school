import logging
import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_admin
from app.core.database import get_db
from app.models.assignment import AssignmentSubmission
from app.models.audit_log import AuditLog
from app.models.certificate import Certificate
from app.models.chapter_progress import ChapterProgress
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.file import File
from app.models.notification import Notification
from app.models.quiz import QuizAnswer, QuizAttempt
from app.models.review import CourseReview
from app.models.student_grade import StudentGrade
from app.models.user import User
from app.schemas.course import EnrollmentSummaryResponse
from app.services.audit_service import log_action
from app.services.course_service import get_user_courses

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/courses", response_model=list[EnrollmentSummaryResponse])
def get_my_courses(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Dashboard view: slim payload (chapter body content stripped).
    return get_user_courses(db, current_user.id, skip=skip, limit=limit)


class DeleteAccountRequest(BaseModel):
    confirm: str


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_account(
    body: DeleteAccountRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.confirm != "DELETE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='You must send {"confirm": "DELETE"} to delete your account.',
        )

    uid = current_user.id

    log_action(
        db,
        uid,
        "delete",
        "user",
        str(uid),
        details={"email": current_user.email, "self_deletion": True},
        request=request,
    )

    try:
        db.query(ChapterProgress).filter(ChapterProgress.user_id == uid).delete(synchronize_session=False)
        db.query(Notification).filter(Notification.user_id == uid).delete(synchronize_session=False)

        attempt_ids = [a.id for a in db.query(QuizAttempt.id).filter(QuizAttempt.user_id == uid).all()]
        if attempt_ids:
            db.query(QuizAnswer).filter(QuizAnswer.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        db.query(QuizAttempt).filter(QuizAttempt.user_id == uid).delete(synchronize_session=False)

        db.query(AssignmentSubmission).filter(AssignmentSubmission.student_id == uid).delete(synchronize_session=False)
        db.query(StudentGrade).filter(StudentGrade.student_id == uid).delete(synchronize_session=False)
        db.query(Enrollment).filter(Enrollment.user_id == uid).delete(synchronize_session=False)

        db.query(CourseReview).filter(CourseReview.user_id == uid).delete(synchronize_session=False)

        db.query(Certificate).filter(Certificate.user_id == uid).delete(synchronize_session=False)

        db.query(Course).filter(Course.created_by == uid).update(
            {Course.created_by: None},
            synchronize_session=False,
        )

        db.query(File).filter(File.user_id == uid).update(
            {File.user_id: None},
            synchronize_session=False,
        )

        db.query(AuditLog).filter(AuditLog.user_id == uid).update(
            {AuditLog.user_id: None},
            synchronize_session=False,
        )

        db.query(User).filter(User.id == uid).delete(synchronize_session=False)

        db.commit()
    except Exception as exc:
        db.rollback()
        logger.exception("Account deletion failed for user %s", uid)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account deletion failed. Please try again or contact support.",
        ) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/admin/users")
def list_all_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    users = db.query(User).order_by(User.created_at.desc()).offset(skip).limit(limit).all()
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


class BulkRoleUpdate(BaseModel):
    user_ids: list[str]
    role: str


@router.put("/admin/users/bulk-role")
def bulk_update_user_roles(
    body: BulkRoleUpdate,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    if body.role not in ("admin", "teacher", "pending_teacher", "student"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid role")
    if len(body.user_ids) > 100:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Maximum 100 users per batch")

    valid_uuids = []
    for uid_str in body.user_ids:
        try:
            valid_uuids.append(_uuid.UUID(uid_str))
        except ValueError:
            continue

    if not valid_uuids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No valid user IDs provided")

    admin_uuid = admin.id if isinstance(admin.id, _uuid.UUID) else _uuid.UUID(str(admin.id))
    safe_uuids = [u for u in valid_uuids if u != admin_uuid]

    updated = db.query(User).filter(User.id.in_(safe_uuids)).update({User.role: body.role}, synchronize_session="fetch")
    db.commit()

    log_action(
        db,
        admin.id,
        "bulk_role_update",
        "user",
        ",".join(str(u) for u in safe_uuids[:10]),
        details={"new_role": body.role, "count": updated},
        request=request,
    )

    return {"updated": updated, "role": body.role}


@router.put("/admin/users/{user_id}/role")
def update_user_role(
    user_id: str,
    request: Request,
    role: str = Query(...),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    if role not in ("admin", "teacher", "pending_teacher", "student"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid role")
    try:
        uid = _uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found") from None
    admin_uuid = admin.id if isinstance(admin.id, _uuid.UUID) else _uuid.UUID(str(admin.id))
    if uid == admin_uuid:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot change your own role")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    old_role = user.role
    user.role = role
    db.commit()
    db.refresh(user)
    log_action(
        db, admin.id, "update", "user", user_id, details={"old_role": old_role, "new_role": role}, request=request
    )
    return {"id": str(user.id), "email": user.email, "role": user.role}
