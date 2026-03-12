from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
import uuid
import hashlib
import time

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.certificate import Certificate
from app.schemas.certificate import CertificateResponse, CertificateVerifyResponse

router = APIRouter(prefix="/certificates", tags=["certificates"])


def _generate_certificate_number() -> str:
    raw = f"{uuid.uuid4().hex}{time.time()}"
    return "CERT-" + hashlib.sha256(raw.encode()).hexdigest()[:12].upper()


@router.post("/course/{course_id}", response_model=CertificateResponse, status_code=status.HTTP_201_CREATED)
async def issue_certificate(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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
        certificate_number=_generate_certificate_number(),
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
        .order_by(Certificate.issued_at.desc())
        .all()
    )


@router.get("/verify/{certificate_number}", response_model=CertificateVerifyResponse)
async def verify_certificate(
    certificate_number: str,
    db: Session = Depends(get_db),
):
    cert = db.query(Certificate).filter(Certificate.certificate_number == certificate_number).first()
    if not cert:
        return CertificateVerifyResponse(valid=False, certificate_number=certificate_number)

    user = db.query(User).filter(User.id == cert.user_id).first()
    course = db.query(Course).filter(Course.id == cert.course_id).first()

    return CertificateVerifyResponse(
        valid=True,
        certificate_number=cert.certificate_number,
        user_name=user.full_name if user else None,
        course_title=course.title if course else None,
        issued_at=cert.issued_at,
    )
