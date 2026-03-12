from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.api.dependencies import get_current_user, require_teacher, verify_course_owner
from app.models.user import User
from app.models.course import Course
from app.models.prerequisite import CoursePrerequisite

router = APIRouter(prefix="/prerequisites", tags=["prerequisites"])


class PrerequisiteSetRequest(BaseModel):
    prerequisite_course_ids: list[str]


class PrerequisiteResponse(BaseModel):
    course_id: str
    prerequisite_course_id: str
    prerequisite_course_title: str | None = None


@router.get("/course/{course_id}", response_model=list[PrerequisiteResponse])
async def get_prerequisites(
    course_id: str,
    db: Session = Depends(get_db),
):
    prereqs = (
        db.query(CoursePrerequisite)
        .filter(CoursePrerequisite.course_id == course_id)
        .all()
    )

    results = []
    for p in prereqs:
        course = db.query(Course).filter(Course.id == p.prerequisite_course_id).first()
        results.append(PrerequisiteResponse(
            course_id=p.course_id,
            prerequisite_course_id=p.prerequisite_course_id,
            prerequisite_course_title=course.title if course else None,
        ))
    return results


@router.put("/course/{course_id}", response_model=list[PrerequisiteResponse])
async def set_prerequisites(
    course_id: str,
    data: PrerequisiteSetRequest,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    verify_course_owner(db, course_id, teacher.id)

    # Prevent circular: a course cannot be its own prerequisite
    if course_id in data.prerequisite_course_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A course cannot be its own prerequisite",
        )

    for pid in data.prerequisite_course_ids:
        if not db.query(Course).filter(Course.id == pid).first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Prerequisite course '{pid}' not found",
            )

    db.query(CoursePrerequisite).filter(CoursePrerequisite.course_id == course_id).delete()

    new_prereqs = []
    for pid in data.prerequisite_course_ids:
        prereq = CoursePrerequisite(course_id=course_id, prerequisite_course_id=pid)
        db.add(prereq)
        new_prereqs.append(prereq)

    db.commit()

    results = []
    for p in new_prereqs:
        prereq_course = db.query(Course).filter(Course.id == p.prerequisite_course_id).first()
        results.append(PrerequisiteResponse(
            course_id=p.course_id,
            prerequisite_course_id=p.prerequisite_course_id,
            prerequisite_course_title=prereq_course.title if prereq_course else None,
        ))
    return results
