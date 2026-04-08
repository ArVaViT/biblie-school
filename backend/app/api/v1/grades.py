import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_teacher, verify_course_owner
from app.core.database import get_db
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.student_grade import StudentGrade
from app.models.user import User
from app.schemas.grade import (
    GradeResponse,
    GradeSummaryResponse,
    GradeUpsert,
    GradingConfigResponse,
    GradingConfigUpdate,
    StudentCalculatedGrade,
)
from app.services.grade_calculator import (
    _get_assignment_ids_for_chapters,
    _get_course_chapter_ids,
    _get_quiz_ids_for_chapters,
    calculate_all_student_grades,
    calculate_student_grade,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/grades", tags=["grades"])


# ── Grading Configuration ──────────────────────────────────────────


@router.get("/course/{course_id}/config", response_model=GradingConfigResponse)
async def get_grading_config(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    is_owner = str(course.created_by) == str(current_user.id)
    is_privileged = current_user.role in ("teacher", "admin")
    is_enrolled = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == current_user.id, Enrollment.course_id == course_id)
        .first()
        is not None
    )
    if not (is_owner or is_privileged or is_enrolled):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return GradingConfigResponse(
        quiz_weight=course.quiz_weight,
        assignment_weight=course.assignment_weight,
        participation_weight=course.participation_weight,
    )


@router.put("/course/{course_id}/config", response_model=GradingConfigResponse)
async def update_grading_config(
    course_id: str,
    data: GradingConfigUpdate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    course = verify_course_owner(db, course_id, teacher.id)
    course.quiz_weight = data.quiz_weight
    course.assignment_weight = data.assignment_weight
    course.participation_weight = data.participation_weight
    db.commit()
    db.refresh(course)
    return GradingConfigResponse(
        quiz_weight=course.quiz_weight,
        assignment_weight=course.assignment_weight,
        participation_weight=course.participation_weight,
    )


# ── Calculated Grades ──────────────────────────────────────────────


@router.get(
    "/course/{course_id}/student/{student_id}/calculated",
    response_model=StudentCalculatedGrade,
)
async def get_calculated_grade(
    course_id: str,
    student_id: str,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    course = verify_course_owner(db, course_id, teacher.id)

    enrolled = db.query(Enrollment).filter(Enrollment.user_id == student_id, Enrollment.course_id == course_id).first()
    if not enrolled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not enrolled in this course",
        )

    user = db.query(User).filter(User.id == student_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    chapter_ids = _get_course_chapter_ids(db, course_id)
    quiz_ids = _get_quiz_ids_for_chapters(db, chapter_ids)
    assignment_ids = _get_assignment_ids_for_chapters(db, chapter_ids)

    breakdown = calculate_student_grade(db, course, uuid.UUID(student_id), chapter_ids, quiz_ids, assignment_ids)

    manual = (
        db.query(StudentGrade.grade)
        .filter(StudentGrade.course_id == course_id, StudentGrade.student_id == student_id)
        .scalar()
    )

    return StudentCalculatedGrade(
        student_id=student_id,
        student_name=user.full_name,
        student_email=user.email,
        breakdown=breakdown,
        manual_grade=manual,
    )


@router.get("/course/{course_id}/summary", response_model=GradeSummaryResponse)
async def get_grade_summary(
    course_id: str,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    try:
        course = verify_course_owner(db, course_id, teacher.id)
        results = calculate_all_student_grades(db, course)

        students = [StudentCalculatedGrade(**r) for r in results]
        class_avg = round(sum(s.breakdown.final_score for s in students) / len(students), 2) if students else 0.0

        return GradeSummaryResponse(
            course_id=course_id,
            config=GradingConfigResponse(
                quiz_weight=course.quiz_weight,
                assignment_weight=course.assignment_weight,
                participation_weight=course.participation_weight,
            ),
            students=students,
            class_average=class_avg,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Grade summary error for course %s: %s", course_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Grade calculation failed",
        ) from None


# ── Existing Manual Grade Endpoints ───────────────────────────────


@router.get("/my", response_model=list[GradeResponse])
async def list_my_grades(
    skip: int = 0,
    limit: int = Query(100, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GradeResponse]:
    return (
        db.query(StudentGrade)
        .filter(StudentGrade.student_id == current_user.id)
        .order_by(StudentGrade.graded_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/my/{course_id}", response_model=GradeResponse)
async def get_my_grade_for_course(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GradeResponse:
    grade = (
        db.query(StudentGrade)
        .filter(
            StudentGrade.student_id == current_user.id,
            StudentGrade.course_id == course_id,
        )
        .first()
    )
    if not grade:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No grade found for course '{course_id}'",
        )
    return grade


@router.get("/course/{course_id}", response_model=list[GradeResponse])
async def list_course_grades(
    course_id: str,
    cohort_id: str | None = Query(None),
    skip: int = 0,
    limit: int = Query(100, le=500),
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> list[GradeResponse]:
    verify_course_owner(db, course_id, teacher.id)
    query = db.query(StudentGrade).filter(StudentGrade.course_id == course_id)
    if cohort_id is not None:
        query = query.filter(StudentGrade.cohort_id == cohort_id)
    return query.order_by(StudentGrade.graded_at.desc()).offset(skip).limit(limit).all()


@router.get("/course/{course_id}/student/{student_id}", response_model=GradeResponse)
async def get_student_grade(
    course_id: str,
    student_id: str,
    cohort_id: str | None = Query(None),
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> GradeResponse:
    verify_course_owner(db, course_id, teacher.id)
    query = db.query(StudentGrade).filter(
        StudentGrade.student_id == student_id,
        StudentGrade.course_id == course_id,
    )
    if cohort_id is not None:
        query = query.filter(StudentGrade.cohort_id == cohort_id)
    grade = query.first()
    if not grade:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No grade found for student '{student_id}' in course '{course_id}'",
        )
    return grade


@router.put("/course/{course_id}/student/{student_id}", response_model=GradeResponse)
async def upsert_student_grade(
    course_id: str,
    student_id: str,
    data: GradeUpsert,
    cohort_id: str | None = Query(None),
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> GradeResponse:
    verify_course_owner(db, course_id, teacher.id)

    enrolled = db.query(Enrollment).filter(
        Enrollment.user_id == student_id, Enrollment.course_id == course_id
    ).first()
    if not enrolled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student is not enrolled in this course")

    query = db.query(StudentGrade).filter(
        StudentGrade.student_id == student_id,
        StudentGrade.course_id == course_id,
    )
    if cohort_id is not None:
        query = query.filter(StudentGrade.cohort_id == cohort_id)
    grade = query.first()

    if grade:
        if data.grade is not None:
            grade.grade = data.grade
        if data.comment is not None:
            grade.comment = data.comment
        grade.graded_by = teacher.id
        grade.graded_at = datetime.now(UTC)
    else:
        grade = StudentGrade(
            id=uuid.uuid4(),
            student_id=student_id,
            course_id=course_id,
            cohort_id=cohort_id,
            grade=data.grade,
            comment=data.comment,
            graded_by=teacher.id,
        )
        db.add(grade)

    db.commit()
    db.refresh(grade)
    return grade
