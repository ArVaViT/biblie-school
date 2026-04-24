from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_admin, require_teacher
from app.core.database import get_db
from app.models.certificate import Certificate
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.user import User
from app.schemas.certificate import CertificateResponse, CertificateVerifyResponse
from app.services import certificate_service

router = APIRouter(prefix="/certificates", tags=["certificates"])


@router.post("/course/{course_id}", response_model=CertificateResponse, status_code=status.HTTP_201_CREATED)
def request_certificate(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Certificate:
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

    cert = Certificate(user_id=current_user.id, course_id=course_id, status="pending")
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
) -> Certificate:
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
) -> list[Certificate]:
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
) -> list[Certificate]:
    """Teacher: list pending certificates for courses they teach."""
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
) -> list[Certificate]:
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
) -> Certificate:
    return certificate_service.teacher_approve(db, cert_id, teacher, request)


@router.put("/{cert_id}/admin-approve", response_model=CertificateResponse)
def admin_approve_certificate(
    cert_id: UUID,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Certificate:
    return certificate_service.admin_approve(db, cert_id, admin, request)


@router.put("/{cert_id}/reject", response_model=CertificateResponse)
def reject_certificate(
    cert_id: UUID,
    request: Request,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> Certificate:
    """Teacher or admin can reject a certificate."""
    return certificate_service.reject(db, cert_id, current_user, request)


@router.get("/verify/{certificate_number}", response_model=CertificateVerifyResponse)
def verify_certificate(
    certificate_number: str,
    db: Session = Depends(get_db),
) -> CertificateVerifyResponse:
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
