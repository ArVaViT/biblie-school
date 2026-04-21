from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_teacher, verify_course_owner
from app.core.database import get_db
from app.models.course import Course
from app.models.prerequisite import CoursePrerequisite
from app.models.user import User, UserRole

router = APIRouter(prefix="/prerequisites", tags=["prerequisites"])


class PrerequisiteSetRequest(BaseModel):
    prerequisite_course_ids: list[str]


class PrerequisiteResponse(BaseModel):
    course_id: str
    prerequisite_course_id: str
    prerequisite_course_title: str | None = None


@router.get("/course/{course_id}", response_model=list[PrerequisiteResponse])
def get_prerequisites(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Requires auth and that the course is visible to the caller. Previously
    # this endpoint was public and would happily leak draft-course
    # relationships to anonymous callers (audit P1.4).
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    is_admin = current_user.role == UserRole.ADMIN.value
    is_owner = str(course.created_by) == str(current_user.id)
    is_published = getattr(course, "status", None) == "published"
    if not (is_admin or is_owner or is_published):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    prereqs = db.query(CoursePrerequisite).filter(CoursePrerequisite.course_id == course_id).all()

    prereq_ids = [p.prerequisite_course_id for p in prereqs]
    courses = db.query(Course).filter(Course.id.in_(prereq_ids)).all() if prereq_ids else []
    title_map = {str(c.id): c.title for c in courses}

    return [
        PrerequisiteResponse(
            course_id=p.course_id,
            prerequisite_course_id=p.prerequisite_course_id,
            prerequisite_course_title=title_map.get(p.prerequisite_course_id),
        )
        for p in prereqs
    ]


@router.put("/course/{course_id}", response_model=list[PrerequisiteResponse])
def set_prerequisites(
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

    if data.prerequisite_course_ids:
        existing_courses = db.query(Course).filter(Course.id.in_(data.prerequisite_course_ids)).all()
        existing_ids = {str(c.id) for c in existing_courses}
        for pid in data.prerequisite_course_ids:
            if pid not in existing_ids:
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

    prereq_ids = [p.prerequisite_course_id for p in new_prereqs]
    prereq_courses = db.query(Course).filter(Course.id.in_(prereq_ids)).all() if prereq_ids else []
    title_map = {str(c.id): c.title for c in prereq_courses}

    return [
        PrerequisiteResponse(
            course_id=p.course_id,
            prerequisite_course_id=p.prerequisite_course_id,
            prerequisite_course_title=title_map.get(p.prerequisite_course_id),
        )
        for p in new_prereqs
    ]
