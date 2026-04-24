"""Course catalog read endpoints (listings + detail views)."""

from fastapi import Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_optional_user, require_teacher
from app.core.database import get_db
from app.models.course import Course
from app.models.user import User, UserRole
from app.schemas.course import CourseResponse, CourseSummary, ModuleResponse
from app.services.course_service import (
    get_course,
    get_courses,
    get_module,
    get_teacher_courses,
)

from ._router import router


@router.get("", response_model=list[CourseSummary])
def list_courses(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    search: str | None = Query(None, min_length=1, max_length=200),
    db: Session = Depends(get_db),
):
    # Catalog view: slim payload (no chapter body content).
    # Full tree is served from GET /courses/{id}.
    #
    # Cache-Control: the catalog is public (RLS restricts to published courses)
    # and changes on a human editorial cadence, not per-request. Short private
    # cache + a slightly longer CDN window with stale-while-revalidate keeps the
    # home page snappy without holding onto stale content for long.
    response.headers["Cache-Control"] = "public, max-age=30, s-maxage=60, stale-while-revalidate=120"
    return get_courses(db, skip=skip, limit=limit, search=search)


@router.get("/my", response_model=list[CourseSummary])
def list_my_courses(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return get_teacher_courses(db, current_user.id, skip=skip, limit=limit)


@router.get("/my/trash", response_model=list[CourseSummary])
def list_my_trashed_courses(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return get_teacher_courses(db, current_user.id, deleted_only=True, skip=skip, limit=limit)


@router.get("/{course_id}", response_model=CourseResponse)
def get_course_detail(
    course_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> CourseResponse:
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course '{course_id}' not found",
        )
    if course.status != "published":
        if not current_user or (
            str(course.created_by) != str(current_user.id) and current_user.role != UserRole.ADMIN.value
        ):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Course '{course_id}' not found",
            )
    # FastAPI serializes via from_attributes.
    return course  # type: ignore[return-value]


@router.get("/{course_id}/modules/{module_id}", response_model=ModuleResponse)
def get_module_detail(
    course_id: str,
    module_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> ModuleResponse:
    # Lightweight access probe — avoids loading the whole course→modules→chapters
    # tree just to check publication state.
    course_row = (
        db.query(Course.status, Course.created_by).filter(Course.id == course_id, Course.deleted_at.is_(None)).first()
    )
    if not course_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course '{course_id}' not found",
        )
    course_status, course_owner_id = course_row
    if course_status != "published":
        if not current_user or (
            str(course_owner_id) != str(current_user.id) and current_user.role != UserRole.ADMIN.value
        ):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Course '{course_id}' not found",
            )
    module = get_module(db, course_id, module_id)
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Module '{module_id}' not found in course '{course_id}'",
        )
    # FastAPI serializes via from_attributes.
    return module  # type: ignore[return-value]
