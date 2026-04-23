from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.dependencies import get_optional_user, require_teacher, verify_course_owner
from app.core.database import get_db
from app.models.cohort import Cohort
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.student_grade import StudentGrade
from app.models.user import User, UserRole
from app.schemas.cohort import CohortCreate, CohortResponse, CohortUpdate

router = APIRouter(prefix="/cohorts", tags=["cohorts"])


def _cohort_to_response(cohort: Cohort, student_count: int) -> CohortResponse:
    """Serialize a cohort with its pre-computed student count.

    ``student_count`` is a computed field not stored on the model, so callers
    must count enrollments themselves (one query per cohort, or a single
    batched ``group_by`` for lists — see :func:`list_cohorts`).
    """
    resp = CohortResponse.model_validate(cohort)
    resp.student_count = student_count
    return resp


def _count_students_in_cohort(db: Session, cohort_id: object) -> int:
    return db.query(func.count(Enrollment.id)).filter(Enrollment.cohort_id == cohort_id).scalar() or 0


def _get_cohort_or_404(db: Session, cohort_id: str) -> Cohort:
    cohort = db.query(Cohort).filter(Cohort.id == cohort_id).first()
    if not cohort:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cohort not found")
    return cohort


@router.get("/course/{course_id}", response_model=list[CohortResponse])
def list_cohorts(
    course_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> list[CohortResponse]:
    course = db.query(Course).filter(Course.id == course_id, Course.deleted_at.is_(None)).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course.status != "published":
        if not current_user or (
            str(course.created_by) != str(current_user.id) and current_user.role != UserRole.ADMIN.value
        ):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    cohorts = db.query(Cohort).filter(Cohort.course_id == course_id).order_by(Cohort.start_date.desc()).all()
    if not cohorts:
        return []

    cohort_ids = [c.id for c in cohorts]
    counts = (
        db.query(Enrollment.cohort_id, func.count(Enrollment.id))
        .filter(Enrollment.cohort_id.in_(cohort_ids))
        .group_by(Enrollment.cohort_id)
        .all()
    )
    count_map = {row[0]: row[1] for row in counts}
    return [_cohort_to_response(c, count_map.get(c.id, 0)) for c in cohorts]


@router.post(
    "/course/{course_id}",
    response_model=CohortResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_cohort(
    course_id: str,
    data: CohortCreate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> CohortResponse:
    verify_course_owner(db, course_id, teacher)

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
    return _cohort_to_response(cohort, 0)


@router.put("/{cohort_id}", response_model=CohortResponse)
def update_cohort(
    cohort_id: str,
    data: CohortUpdate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> CohortResponse:
    cohort = _get_cohort_or_404(db, cohort_id)
    verify_course_owner(db, cohort.course_id, teacher)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(cohort, field, value)

    db.commit()
    db.refresh(cohort)
    return _cohort_to_response(cohort, _count_students_in_cohort(db, cohort.id))


@router.delete("/{cohort_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cohort(
    cohort_id: str,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> None:
    cohort = _get_cohort_or_404(db, cohort_id)
    verify_course_owner(db, cohort.course_id, teacher)
    db.delete(cohort)
    db.commit()


@router.get("/{cohort_id}/students")
def list_cohort_students(
    cohort_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    cohort = _get_cohort_or_404(db, cohort_id)
    verify_course_owner(db, cohort.course_id, teacher)

    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.cohort_id == cohort.id)
        .order_by(Enrollment.enrolled_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    student_ids = [e.user_id for e in enrollments]
    grades_map: dict[str, StudentGrade] = {}
    if student_ids:
        grades = (
            db.query(StudentGrade)
            .filter(
                StudentGrade.student_id.in_(student_ids),
                StudentGrade.course_id == cohort.course_id,
                StudentGrade.cohort_id == cohort.id,
            )
            .all()
        )
        grades_map = {str(g.student_id): g for g in grades}

    results = []
    for enrollment in enrollments:
        grade = grades_map.get(str(enrollment.user_id))
        results.append(
            {
                "enrollment_id": str(enrollment.id),
                "user_id": str(enrollment.user_id),
                "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None,
                "progress": enrollment.progress,
                "grade": grade.grade if grade else None,
                "grade_comment": grade.comment if grade else None,
            }
        )

    return results


@router.post("/{cohort_id}/complete", response_model=CohortResponse)
def complete_cohort(
    cohort_id: str,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> CohortResponse:
    cohort = _get_cohort_or_404(db, cohort_id)
    verify_course_owner(db, cohort.course_id, teacher)

    if cohort.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cohort is already completed",
        )

    cohort.status = "completed"
    db.commit()
    db.refresh(cohort)
    return _cohort_to_response(cohort, _count_students_in_cohort(db, cohort.id))
