from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.api.dependencies import get_current_user, require_teacher, verify_course_owner
from app.models.user import User
from app.models.cohort import Cohort
from app.models.enrollment import Enrollment
from app.models.student_grade import StudentGrade
from app.schemas.cohort import CohortCreate, CohortUpdate, CohortResponse

router = APIRouter(prefix="/cohorts", tags=["cohorts"])


def _cohort_to_response(db: Session, cohort: Cohort) -> CohortResponse:
    student_count = db.query(func.count(Enrollment.id)).filter(
        Enrollment.cohort_id == cohort.id
    ).scalar() or 0

    return CohortResponse(
        id=str(cohort.id),
        course_id=str(cohort.course_id),
        name=cohort.name,
        start_date=cohort.start_date,
        end_date=cohort.end_date,
        enrollment_start=cohort.enrollment_start,
        enrollment_end=cohort.enrollment_end,
        status=cohort.status,
        max_students=cohort.max_students,
        created_at=cohort.created_at,
        updated_at=cohort.updated_at,
        student_count=student_count,
    )


def _get_cohort_or_404(db: Session, cohort_id: str) -> Cohort:
    cohort = db.query(Cohort).filter(Cohort.id == cohort_id).first()
    if not cohort:
        raise HTTPException(status_code=404, detail="Cohort not found")
    return cohort


@router.get("/course/{course_id}", response_model=list[CohortResponse])
async def list_cohorts(
    course_id: str,
    db: Session = Depends(get_db),
) -> list[CohortResponse]:
    cohorts = (
        db.query(Cohort)
        .filter(Cohort.course_id == course_id)
        .order_by(Cohort.start_date.desc())
        .all()
    )
    return [_cohort_to_response(db, c) for c in cohorts]


@router.post(
    "/course/{course_id}",
    response_model=CohortResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_cohort(
    course_id: str,
    data: CohortCreate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> CohortResponse:
    verify_course_owner(db, course_id, teacher.id)

    cohort = Cohort(
        course_id=course_id,
        name=data.name,
        start_date=data.start_date,
        end_date=data.end_date,
        enrollment_start=data.enrollment_start,
        enrollment_end=data.enrollment_end,
        max_students=data.max_students,
    )
    db.add(cohort)
    db.commit()
    db.refresh(cohort)
    return _cohort_to_response(db, cohort)


@router.put("/{cohort_id}", response_model=CohortResponse)
async def update_cohort(
    cohort_id: str,
    data: CohortUpdate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> CohortResponse:
    cohort = _get_cohort_or_404(db, cohort_id)
    verify_course_owner(db, cohort.course_id, teacher.id)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(cohort, field, value)

    db.commit()
    db.refresh(cohort)
    return _cohort_to_response(db, cohort)


@router.delete("/{cohort_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cohort(
    cohort_id: str,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> None:
    cohort = _get_cohort_or_404(db, cohort_id)
    verify_course_owner(db, cohort.course_id, teacher.id)
    db.delete(cohort)
    db.commit()


@router.get("/{cohort_id}/students")
async def list_cohort_students(
    cohort_id: str,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    cohort = _get_cohort_or_404(db, cohort_id)
    verify_course_owner(db, cohort.course_id, teacher.id)

    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.cohort_id == cohort.id)
        .all()
    )

    results = []
    for enrollment in enrollments:
        grade = db.query(StudentGrade).filter(
            StudentGrade.student_id == enrollment.user_id,
            StudentGrade.course_id == cohort.course_id,
            StudentGrade.cohort_id == cohort.id,
        ).first()

        results.append({
            "enrollment_id": str(enrollment.id),
            "user_id": str(enrollment.user_id),
            "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None,
            "progress": enrollment.progress,
            "grade": grade.grade if grade else None,
            "grade_comment": grade.comment if grade else None,
        })

    return results


@router.post("/{cohort_id}/complete", response_model=CohortResponse)
async def complete_cohort(
    cohort_id: str,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> CohortResponse:
    cohort = _get_cohort_or_404(db, cohort_id)
    verify_course_owner(db, cohort.course_id, teacher.id)

    if cohort.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cohort is already completed",
        )

    cohort.status = "completed"
    db.commit()
    db.refresh(cohort)
    return _cohort_to_response(db, cohort)
