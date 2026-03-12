from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import uuid

from app.core.database import get_db
from app.api.dependencies import get_current_user, require_teacher, verify_course_owner
from app.models.user import User
from app.models.student_grade import StudentGrade
from app.schemas.grade import GradeUpsert, GradeResponse

router = APIRouter(prefix="/grades", tags=["grades"])


@router.get("/my", response_model=list[GradeResponse])
async def list_my_grades(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GradeResponse]:
    return (
        db.query(StudentGrade)
        .filter(StudentGrade.student_id == current_user.id)
        .order_by(StudentGrade.graded_at.desc())
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
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> list[GradeResponse]:
    verify_course_owner(db, course_id, teacher.id)
    return (
        db.query(StudentGrade)
        .filter(StudentGrade.course_id == course_id)
        .order_by(StudentGrade.graded_at.desc())
        .all()
    )


@router.get("/course/{course_id}/student/{student_id}", response_model=GradeResponse)
async def get_student_grade(
    course_id: str,
    student_id: str,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> GradeResponse:
    verify_course_owner(db, course_id, teacher.id)
    grade = (
        db.query(StudentGrade)
        .filter(
            StudentGrade.student_id == student_id,
            StudentGrade.course_id == course_id,
        )
        .first()
    )
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
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> GradeResponse:
    verify_course_owner(db, course_id, teacher.id)
    grade = (
        db.query(StudentGrade)
        .filter(
            StudentGrade.student_id == student_id,
            StudentGrade.course_id == course_id,
        )
        .first()
    )
    if grade:
        if data.grade is not None:
            grade.grade = data.grade
        if data.comment is not None:
            grade.comment = data.comment
        grade.graded_by = teacher.id
    else:
        grade = StudentGrade(
            id=uuid.uuid4(),
            student_id=student_id,
            course_id=course_id,
            grade=data.grade,
            comment=data.comment,
            graded_by=teacher.id,
        )
        db.add(grade)

    db.commit()
    db.refresh(grade)
    return grade
