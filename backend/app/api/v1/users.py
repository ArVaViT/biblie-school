import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.dependencies import get_current_user, require_admin
from app.models.user import User
from app.models.enrollment import Enrollment
from app.models.course import Course
from app.models.quiz import QuizAttempt, QuizAnswer
from app.models.assignment import AssignmentSubmission
from app.models.certificate import Certificate
from app.models.student_note import StudentNote
from app.models.student_grade import StudentGrade
from app.models.review import CourseReview
from app.models.notification import Notification
from app.models.chapter_progress import ChapterProgress
from app.models.audit_log import AuditLog
from app.models.file import File
from app.schemas.course import EnrollmentResponse
from app.services.course_service import get_user_courses
from app.services.audit_service import log_action

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/courses", response_model=list[EnrollmentResponse])
async def get_my_courses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_user_courses(db, current_user.id)


@router.get("/me/export-data")
async def export_my_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    uid = current_user.id

    def _ts(dt: datetime | None) -> str | None:
        if dt is None:
            return None
        return dt.isoformat() if isinstance(dt, datetime) else str(dt)

    profile = {
        "id": str(uid),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "created_at": _ts(current_user.created_at),
        "updated_at": _ts(current_user.updated_at),
    }

    enrollments_rows = (
        db.query(Enrollment, Course.title)
        .outerjoin(Course, Course.id == Enrollment.course_id)
        .filter(Enrollment.user_id == uid)
        .all()
    )
    enrollments = [
        {
            "id": str(e.id),
            "course_id": str(e.course_id),
            "course_title": title,
            "cohort_id": str(e.cohort_id) if e.cohort_id else None,
            "enrolled_at": _ts(e.enrolled_at),
            "progress": e.progress,
        }
        for e, title in enrollments_rows
    ]

    attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.user_id == uid)
        .all()
    )
    quiz_attempts = [
        {
            "id": str(a.id),
            "quiz_id": str(a.quiz_id),
            "score": a.score,
            "max_score": a.max_score,
            "passed": a.passed,
            "started_at": _ts(a.started_at),
            "completed_at": _ts(a.completed_at),
        }
        for a in attempts
    ]

    submissions = (
        db.query(AssignmentSubmission)
        .filter(AssignmentSubmission.student_id == uid)
        .all()
    )
    assignment_submissions = [
        {
            "id": str(s.id),
            "assignment_id": str(s.assignment_id),
            "content": s.content,
            "file_url": s.file_url,
            "submitted_at": _ts(s.submitted_at),
            "status": s.status,
            "grade": s.grade,
            "feedback": s.feedback,
        }
        for s in submissions
    ]

    grades_rows = (
        db.query(StudentGrade, Course.title)
        .outerjoin(Course, Course.id == StudentGrade.course_id)
        .filter(StudentGrade.student_id == uid)
        .all()
    )
    grades = [
        {
            "id": str(g.id),
            "course_id": str(g.course_id),
            "course_title": title,
            "grade": g.grade,
            "comment": g.comment,
            "graded_at": _ts(g.graded_at),
        }
        for g, title in grades_rows
    ]

    certs_rows = (
        db.query(Certificate, Course.title)
        .outerjoin(Course, Course.id == Certificate.course_id)
        .filter(Certificate.user_id == uid)
        .all()
    )
    certificates = [
        {
            "id": str(c.id),
            "course_id": str(c.course_id),
            "course_title": title,
            "certificate_number": c.certificate_number,
            "status": c.status,
            "issued_at": _ts(c.issued_at),
            "requested_at": _ts(c.requested_at),
        }
        for c, title in certs_rows
    ]

    notes_rows = db.query(StudentNote).filter(StudentNote.user_id == uid).all()
    notes = [
        {
            "id": str(n.id),
            "chapter_id": str(n.chapter_id),
            "content": n.content,
            "created_at": _ts(n.created_at),
            "updated_at": _ts(n.updated_at),
        }
        for n in notes_rows
    ]

    reviews_rows = (
        db.query(CourseReview, Course.title)
        .outerjoin(Course, Course.id == CourseReview.course_id)
        .filter(CourseReview.user_id == uid)
        .all()
    )
    reviews = [
        {
            "id": str(r.id),
            "course_id": str(r.course_id),
            "course_title": title,
            "rating": r.rating,
            "comment": r.comment,
            "created_at": _ts(r.created_at),
        }
        for r, title in reviews_rows
    ]

    notif_rows = db.query(Notification).filter(Notification.user_id == uid).all()
    notifications = [
        {
            "id": str(n.id),
            "type": n.type,
            "title": n.title,
            "message": n.message,
            "link": n.link,
            "is_read": n.is_read,
            "created_at": _ts(n.created_at),
        }
        for n in notif_rows
    ]

    progress_rows = db.query(ChapterProgress).filter(ChapterProgress.user_id == uid).all()
    chapter_progress = [
        {
            "id": str(p.id),
            "chapter_id": str(p.chapter_id),
            "completed": p.completed,
            "completed_at": _ts(p.completed_at),
        }
        for p in progress_rows
    ]

    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "profile": profile,
        "enrollments": enrollments,
        "quiz_attempts": quiz_attempts,
        "assignment_submissions": assignment_submissions,
        "grades": grades,
        "certificates": certificates,
        "notes": notes,
        "reviews": reviews,
        "notifications": notifications,
        "chapter_progress": chapter_progress,
    }


class DeleteAccountRequest(BaseModel):
    confirm: str


@router.delete("/me", status_code=204)
async def delete_my_account(
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
        db, uid, "delete", "user", str(uid),
        details={"email": current_user.email, "self_deletion": True},
        request=request,
    )

    try:
        db.query(ChapterProgress).filter(ChapterProgress.user_id == uid).delete(synchronize_session=False)
        db.query(Notification).filter(Notification.user_id == uid).delete(synchronize_session=False)

        attempt_ids = [
            a.id for a in db.query(QuizAttempt.id).filter(QuizAttempt.user_id == uid).all()
        ]
        if attempt_ids:
            db.query(QuizAnswer).filter(QuizAnswer.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        db.query(QuizAttempt).filter(QuizAttempt.user_id == uid).delete(synchronize_session=False)

        db.query(AssignmentSubmission).filter(AssignmentSubmission.student_id == uid).delete(synchronize_session=False)
        db.query(StudentNote).filter(StudentNote.user_id == uid).delete(synchronize_session=False)
        db.query(StudentGrade).filter(StudentGrade.student_id == uid).delete(synchronize_session=False)
        db.query(Enrollment).filter(Enrollment.user_id == uid).delete(synchronize_session=False)

        db.query(CourseReview).filter(CourseReview.user_id == uid).delete(synchronize_session=False)

        db.query(Certificate).filter(Certificate.user_id == uid).delete(synchronize_session=False)

        db.query(Course).filter(Course.created_by == uid).update(
            {Course.created_by: None}, synchronize_session=False,
        )

        db.query(File).filter(File.user_id == uid).update(
            {File.user_id: None}, synchronize_session=False,
        )

        db.query(AuditLog).filter(AuditLog.user_id == uid).update(
            {AuditLog.user_id: None}, synchronize_session=False,
        )

        db.query(User).filter(User.id == uid).delete(synchronize_session=False)

        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Account deletion failed for user %s", uid)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account deletion failed. Please try again or contact support.",
        )

    return Response(status_code=204)


@router.get("/admin/users")
async def list_all_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
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
    request: Request,
    role: str = Query(...),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    if role not in ("admin", "teacher", "pending_teacher", "student"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid role")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    old_role = user.role
    user.role = role
    db.commit()
    db.refresh(user)
    log_action(db, admin.id, "update", "user", user_id, details={"old_role": old_role, "new_role": role}, request=request)
    return {"id": str(user.id), "email": user.email, "role": user.role}
