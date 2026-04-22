import hashlib
import time
import uuid
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import assert_course_owner, get_current_user, require_admin, require_teacher
from app.core.database import get_db
from app.models.certificate import Certificate
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.user import User
from app.schemas.certificate import CertificateResponse, CertificateVerifyResponse
from app.services.audit_service import log_action
from app.services.notification_service import create_notification

router = APIRouter(prefix="/certificates", tags=["certificates"])


def _generate_certificate_number() -> str:
    raw = f"{uuid.uuid4().hex}{time.time()}"
    return "CERT-" + hashlib.sha256(raw.encode()).hexdigest()[:12].upper()


@router.post("/course/{course_id}", response_model=CertificateResponse, status_code=status.HTTP_201_CREATED)
def request_certificate(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Request a certificate (creates a pending request)."""
    # Soft-deleted courses must not accept new certificate requests.
    course = db.query(Course).filter(Course.id == course_id, Course.deleted_at.is_(None)).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    enrollment = (
        db.query(Enrollment).filter(Enrollment.user_id == current_user.id, Enrollment.course_id == course_id).first()
    )
    if not enrollment:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not enrolled in this course")
    if enrollment.progress < 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Course not completed. Current progress: {enrollment.progress}%",
        )

    existing = (
        db.query(Certificate).filter(Certificate.user_id == current_user.id, Certificate.course_id == course_id).first()
    )
    if existing:
        return existing

    cert = Certificate(
        user_id=current_user.id,
        course_id=course_id,
        status="pending",
        requested_at=datetime.now(UTC),
    )
    db.add(cert)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        existing = (
            db.query(Certificate)
            .filter(Certificate.user_id == current_user.id, Certificate.course_id == course_id)
            .first()
        )
        if existing:
            return existing
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Certificate already requested") from exc
    db.refresh(cert)
    return cert


@router.get("/course/{course_id}", response_model=CertificateResponse)
def get_course_certificate(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's certificate for a specific course."""
    cert = (
        db.query(Certificate).filter(Certificate.user_id == current_user.id, Certificate.course_id == course_id).first()
    )
    if not cert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No certificate found")
    return cert


@router.get("/my", response_model=list[CertificateResponse])
def list_my_certificates(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Certificate)
        .filter(Certificate.user_id == current_user.id)
        .order_by(Certificate.requested_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/pending", response_model=list[CertificateResponse])
def list_pending_certificates(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Teacher: list pending certificates for courses they teach."""
    # One query: join through Course with the ownership + soft-delete filter,
    # instead of materializing a Python list of course ids for IN (...).
    return (
        db.query(Certificate)
        .join(Course, Course.id == Certificate.course_id)
        .filter(
            Course.created_by == teacher.id,
            Course.deleted_at.is_(None),
            Certificate.status == "pending",
        )
        .order_by(Certificate.requested_at.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/admin/pending", response_model=list[CertificateResponse])
def list_admin_pending_certificates(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin: list all teacher-approved certificates awaiting admin approval."""
    return (
        db.query(Certificate)
        .filter(Certificate.status == "teacher_approved")
        .order_by(Certificate.teacher_approved_at.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.put("/{cert_id}/teacher-approve", response_model=CertificateResponse)
def teacher_approve_certificate(
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
    course = db.query(Course).filter(Course.id == cert.course_id, Course.deleted_at.is_(None)).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only approve certificates for your own courses",
        )
    try:
        assert_course_owner(course, teacher, allow_admin=False)
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only approve certificates for your own courses",
        ) from None
    cert.status = "teacher_approved"
    cert.teacher_approved_at = datetime.now(UTC)
    cert.teacher_approved_by = teacher.id
    db.commit()
    db.refresh(cert)
    log_action(db, teacher.id, "approve", "certificate", str(cert_id), details={"level": "teacher"}, request=request)
    return cert


@router.put("/{cert_id}/admin-approve", response_model=CertificateResponse)
def admin_approve_certificate(
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
    cert.admin_approved_at = datetime.now(UTC)
    cert.admin_approved_by = admin.id
    cert.issued_at = datetime.now(UTC)

    course = db.query(Course).filter(Course.id == cert.course_id, Course.deleted_at.is_(None)).first()
    course_title = course.title if course else "a course"
    create_notification(
        db,
        user_id=cert.user_id,
        type="certificate_approved",
        title="Certificate Approved",
        message=f'Your certificate for "{course_title}" has been approved!',
        link="/certificates",
        metadata={"course_id": cert.course_id, "certificate_id": str(cert.id)},
    )

    db.commit()
    db.refresh(cert)
    log_action(db, admin.id, "approve", "certificate", str(cert_id), details={"level": "admin"}, request=request)
    return cert


@router.put("/{cert_id}/reject", response_model=CertificateResponse)
def reject_certificate(
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
    course = db.query(Course).filter(Course.id == cert.course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only reject certificates for your own courses",
        )
    try:
        assert_course_owner(course, current_user)
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only reject certificates for your own courses",
        ) from None
    cert.status = "rejected"

    course_title = course.title if course else "a course"
    create_notification(
        db,
        user_id=cert.user_id,
        type="certificate_rejected",
        title="Certificate Rejected",
        message=f'Your certificate request for "{course_title}" was rejected.',
        link="/certificates",
        metadata={"course_id": cert.course_id, "certificate_id": str(cert.id)},
    )

    db.commit()
    db.refresh(cert)
    log_action(db, current_user.id, "reject", "certificate", str(cert_id), request=request)
    return cert


@router.get("/verify/{certificate_number}", response_model=CertificateVerifyResponse)
def verify_certificate(
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
