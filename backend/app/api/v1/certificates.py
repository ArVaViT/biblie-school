from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from uuid import UUID
import uuid
import hashlib
import time

from app.core.database import get_db
from app.api.dependencies import get_current_user, require_teacher, require_admin
from app.models.user import User
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.certificate import Certificate
from app.schemas.certificate import CertificateResponse, CertificateVerifyResponse
from app.services.notification_service import create_notification
from app.services.audit_service import log_action

router = APIRouter(prefix="/certificates", tags=["certificates"])


def _generate_certificate_number() -> str:
    raw = f"{uuid.uuid4().hex}{time.time()}"
    return "CERT-" + hashlib.sha256(raw.encode()).hexdigest()[:12].upper()


@router.post("/course/{course_id}", response_model=CertificateResponse, status_code=status.HTTP_201_CREATED)
async def request_certificate(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Request a certificate (creates a pending request)."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == current_user.id, Enrollment.course_id == course_id)
        .first()
    )
    if not enrollment:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not enrolled in this course")
    if enrollment.progress < 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Course not completed. Current progress: {enrollment.progress}%",
        )

    existing = (
        db.query(Certificate)
        .filter(Certificate.user_id == current_user.id, Certificate.course_id == course_id)
        .first()
    )
    if existing:
        return existing

    cert = Certificate(
        user_id=current_user.id,
        course_id=course_id,
        status="pending",
        requested_at=datetime.now(timezone.utc),
    )
    db.add(cert)
    db.commit()
    db.refresh(cert)
    return cert


@router.get("/my", response_model=list[CertificateResponse])
async def list_my_certificates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Certificate)
        .filter(Certificate.user_id == current_user.id)
        .order_by(Certificate.requested_at.desc())
        .all()
    )


@router.get("/pending", response_model=list[CertificateResponse])
async def list_pending_certificates(
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Teacher: list pending certificates for courses they teach."""
    teacher_course_ids = [
        c.id for c in db.query(Course).filter(Course.created_by == teacher.id).all()
    ]
    if not teacher_course_ids:
        return []
    return (
        db.query(Certificate)
        .filter(
            Certificate.course_id.in_(teacher_course_ids),
            Certificate.status == "pending",
        )
        .order_by(Certificate.requested_at.asc())
        .all()
    )


@router.get("/admin/pending", response_model=list[CertificateResponse])
async def list_admin_pending_certificates(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin: list all teacher-approved certificates awaiting admin approval."""
    return (
        db.query(Certificate)
        .filter(Certificate.status == "teacher_approved")
        .order_by(Certificate.teacher_approved_at.asc())
        .all()
    )


@router.put("/{cert_id}/teacher-approve", response_model=CertificateResponse)
async def teacher_approve_certificate(
    cert_id: UUID,
    request: Request,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    cert = db.query(Certificate).filter(Certificate.id == cert_id).first()
    if not cert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found")
    if cert.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Certificate is not pending (current status: {cert.status})",
        )
    course = db.query(Course).filter(Course.id == cert.course_id).first()
    if not course or course.created_by != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only approve certificates for your own courses",
        )
    cert.status = "teacher_approved"
    cert.teacher_approved_at = datetime.now(timezone.utc)
    cert.teacher_approved_by = teacher.id
    db.commit()
    db.refresh(cert)
    log_action(db, teacher.id, "approve", "certificate", str(cert_id), details={"level": "teacher"}, request=request)
    return cert


@router.put("/{cert_id}/admin-approve", response_model=CertificateResponse)
async def admin_approve_certificate(
    cert_id: UUID,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    cert = db.query(Certificate).filter(Certificate.id == cert_id).first()
    if not cert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found")
    if cert.status != "teacher_approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Certificate must be teacher-approved first (current status: {cert.status})",
        )
    cert.status = "approved"
    cert.certificate_number = _generate_certificate_number()
    cert.admin_approved_at = datetime.now(timezone.utc)
    cert.admin_approved_by = admin.id
    cert.issued_at = datetime.now(timezone.utc)

    course = db.query(Course).filter(Course.id == cert.course_id).first()
    course_title = course.title if course else "a course"
    create_notification(
        db,
        user_id=cert.user_id,
        type="certificate_approved",
        title="Certificate Approved",
        message=f"Your certificate for \"{course_title}\" has been approved!",
        link="/certificates",
        metadata={"course_id": cert.course_id, "certificate_id": str(cert.id)},
    )

    db.commit()
    db.refresh(cert)
    log_action(db, admin.id, "approve", "certificate", str(cert_id), details={"level": "admin"}, request=request)
    return cert


@router.put("/{cert_id}/reject", response_model=CertificateResponse)
async def reject_certificate(
    cert_id: UUID,
    request: Request,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Teacher or admin can reject a certificate."""
    cert = db.query(Certificate).filter(Certificate.id == cert_id).first()
    if not cert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found")
    if cert.status in ("approved", "rejected"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Certificate cannot be rejected (current status: {cert.status})",
        )
    from app.models.user import UserRole
    if current_user.role != UserRole.ADMIN.value:
        course = db.query(Course).filter(Course.id == cert.course_id).first()
        if not course or str(course.created_by) != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only reject certificates for your own courses",
            )
    cert.status = "rejected"

    course = db.query(Course).filter(Course.id == cert.course_id).first()
    course_title = course.title if course else "a course"
    create_notification(
        db,
        user_id=cert.user_id,
        type="certificate_rejected",
        title="Certificate Rejected",
        message=f"Your certificate request for \"{course_title}\" was rejected.",
        link="/certificates",
        metadata={"course_id": cert.course_id, "certificate_id": str(cert.id)},
    )

    db.commit()
    db.refresh(cert)
    log_action(db, current_user.id, "reject", "certificate", str(cert_id), request=request)
    return cert


@router.get("/verify/{certificate_number}", response_model=CertificateVerifyResponse)
async def verify_certificate(
    certificate_number: str,
    db: Session = Depends(get_db),
):
    row = (
        db.query(Certificate, User, Course)
        .outerjoin(User, Certificate.user_id == User.id)
        .outerjoin(Course, Certificate.course_id == Course.id)
        .filter(Certificate.certificate_number == certificate_number)
        .first()
    )
    if not row:
        return CertificateVerifyResponse(valid=False, certificate_number=certificate_number)

    cert, user, course = row
    return CertificateVerifyResponse(
        valid=True,
        certificate_number=cert.certificate_number,
        user_name=user.full_name if user else None,
        course_title=course.title if course else None,
        issued_at=cert.issued_at,
    )
