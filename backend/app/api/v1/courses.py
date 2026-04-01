from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func
from app.core.database import get_db
from app.api.dependencies import get_current_user, get_optional_user, require_teacher
from app.models.user import User
from app.models.cohort import Cohort
from app.models.enrollment import Enrollment
from app.services.audit_service import log_action
from app.core.sanitize import sanitize_string
from app.schemas.course import (
    CourseCreate, CourseUpdate, CourseResponse,
    ModuleCreate, ModuleUpdate, ModuleResponse,
    ChapterCreate, ChapterUpdate, ChapterResponse,
    EnrollmentResponse,
)
from app.services.course_service import (
    get_courses, get_course, get_teacher_courses,
    create_course, update_course, delete_course,
    get_module, create_module, update_module, delete_module,
    get_chapter, create_chapter, update_chapter, delete_chapter,
    enroll_user_in_course,
    clone_course,
)


class EnrollRequest(BaseModel):
    cohort_id: str | None = None

router = APIRouter(prefix="/courses", tags=["courses"])


# ---------------------------------------------------------------------------
# Public course endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[CourseResponse])
async def list_courses(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    search: str | None = Query(None, min_length=1, max_length=200),
    db: Session = Depends(get_db),
) -> list[CourseResponse]:
    return get_courses(db, skip=skip, limit=limit, search=search)


@router.get("/my", response_model=list[CourseResponse])
async def list_my_courses(
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> list[CourseResponse]:
    return get_teacher_courses(db, current_user.id)


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course_detail(
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
            str(course.created_by) != str(current_user.id)
            and current_user.role != "admin"
        ):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Course '{course_id}' not found",
            )
    return course


@router.get("/{course_id}/modules/{module_id}", response_model=ModuleResponse)
async def get_module_detail(
    course_id: str,
    module_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> ModuleResponse:
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course '{course_id}' not found",
        )
    if course.status != "published":
        if not current_user or (
            str(course.created_by) != str(current_user.id)
            and current_user.role != "admin"
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
    return module


# ---------------------------------------------------------------------------
# Teacher course CRUD
# ---------------------------------------------------------------------------

@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_new_course(
    data: CourseCreate,
    request: Request,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> CourseResponse:
    if data.title:
        data.title = sanitize_string(data.title)
    course = create_course(db, data, teacher.id)
    log_action(db, teacher.id, "create", "course", course.id, request=request)
    return course


@router.put("/{course_id}", response_model=CourseResponse)
async def update_existing_course(
    course_id: str,
    data: CourseUpdate,
    request: Request,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> CourseResponse:
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course '{course_id}' not found",
        )
    if str(course.created_by) != str(teacher.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own courses",
        )
    if data.title:
        data.title = sanitize_string(data.title)
    old_status = course.status
    result = update_course(db, course, data)
    details = {}
    if data.status and data.status != old_status:
        details = {"old_status": old_status, "new_status": data.status}
    action = "publish" if data.status == "published" and old_status != "published" else "update"
    log_action(db, teacher.id, action, "course", course_id, details=details or None, request=request)
    return result


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_course(
    course_id: str,
    request: Request,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> None:
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course '{course_id}' not found",
        )
    if str(course.created_by) != str(teacher.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own courses",
        )
    log_action(db, teacher.id, "delete", "course", course_id, details={"title": course.title}, request=request)
    delete_course(db, course)


# ---------------------------------------------------------------------------
# Course cloning
# ---------------------------------------------------------------------------

@router.post(
    "/{course_id}/clone",
    response_model=CourseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def clone_existing_course(
    course_id: str,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> CourseResponse:
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course '{course_id}' not found",
        )
    is_owner = str(course.created_by) == str(teacher.id)
    if course.status != "published" and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can clone a draft course",
        )
    new_course = clone_course(db, course_id, str(teacher.id))
    if not new_course:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clone course",
        )
    return new_course


# ---------------------------------------------------------------------------
# Teacher module CRUD
# ---------------------------------------------------------------------------

@router.post(
    "/{course_id}/modules",
    response_model=ModuleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_new_module(
    course_id: str,
    data: ModuleCreate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> ModuleResponse:
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course '{course_id}' not found",
        )
    if str(course.created_by) != str(teacher.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own courses",
        )
    return create_module(db, course_id, data)


@router.put("/{course_id}/modules/{module_id}", response_model=ModuleResponse)
async def update_existing_module(
    course_id: str,
    module_id: str,
    data: ModuleUpdate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> ModuleResponse:
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course '{course_id}' not found",
        )
    if str(course.created_by) != str(teacher.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own courses",
        )
    module = get_module(db, course_id, module_id)
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Module '{module_id}' not found in course '{course_id}'",
        )
    return update_module(db, module, data)


@router.delete(
    "/{course_id}/modules/{module_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_module(
    course_id: str,
    module_id: str,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> None:
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course '{course_id}' not found",
        )
    if str(course.created_by) != str(teacher.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own courses",
        )
    module = get_module(db, course_id, module_id)
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Module '{module_id}' not found in course '{course_id}'",
        )
    delete_module(db, module)


# ---------------------------------------------------------------------------
# Teacher chapter CRUD
# ---------------------------------------------------------------------------

@router.post(
    "/{course_id}/modules/{module_id}/chapters",
    response_model=ChapterResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_new_chapter(
    course_id: str,
    module_id: str,
    data: ChapterCreate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> ChapterResponse:
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course '{course_id}' not found",
        )
    if str(course.created_by) != str(teacher.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own courses",
        )
    module = get_module(db, course_id, module_id)
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Module '{module_id}' not found in course '{course_id}'",
        )
    if data.title:
        data.title = sanitize_string(data.title)
    if data.content:
        data.content = sanitize_string(data.content)
    return create_chapter(db, module_id, data)


@router.put(
    "/{course_id}/modules/{module_id}/chapters/{chapter_id}",
    response_model=ChapterResponse,
)
async def update_existing_chapter(
    course_id: str,
    module_id: str,
    chapter_id: str,
    data: ChapterUpdate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> ChapterResponse:
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course '{course_id}' not found",
        )
    if str(course.created_by) != str(teacher.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own courses",
        )
    chapter = get_chapter(db, course_id, module_id, chapter_id)
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chapter '{chapter_id}' not found in module '{module_id}'",
        )
    if data.title:
        data.title = sanitize_string(data.title)
    if data.content:
        data.content = sanitize_string(data.content)
    return update_chapter(db, chapter, data)


@router.delete(
    "/{course_id}/modules/{module_id}/chapters/{chapter_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_chapter(
    course_id: str,
    module_id: str,
    chapter_id: str,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> None:
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course '{course_id}' not found",
        )
    if str(course.created_by) != str(teacher.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own courses",
        )
    chapter = get_chapter(db, course_id, module_id, chapter_id)
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chapter '{chapter_id}' not found in module '{module_id}'",
        )
    delete_chapter(db, chapter)


# ---------------------------------------------------------------------------
# Enrollment
# ---------------------------------------------------------------------------

@router.post("/{course_id}/enroll", response_model=EnrollmentResponse)
async def enroll_course(
    course_id: str,
    request: Request,
    body: EnrollRequest = EnrollRequest(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EnrollmentResponse:
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course '{course_id}' not found",
        )
    if course.status != "published":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot enroll in an unpublished course",
        )
    now = datetime.now(timezone.utc)

    cohort_id: str | None = None
    if body.cohort_id:
        cohort = db.query(Cohort).filter(
            Cohort.id == body.cohort_id,
            Cohort.course_id == course_id,
        ).first()
        if not cohort:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cohort not found for this course")
        if cohort.status != "active":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cohort is not active")
        if cohort.enrollment_start and now < cohort.enrollment_start:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cohort enrollment has not started yet")
        if cohort.enrollment_end and now > cohort.enrollment_end:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cohort enrollment period has ended")
        if cohort.max_students:
            current_count = db.query(sa_func.count(Enrollment.id)).filter(
                Enrollment.cohort_id == cohort.id
            ).scalar() or 0
            if current_count >= cohort.max_students:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cohort has reached maximum capacity")
        cohort_id = body.cohort_id
    else:
        if course.enrollment_start and now < course.enrollment_start:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Enrollment has not started yet",
            )
        if course.enrollment_end and now > course.enrollment_end:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Enrollment period has ended",
            )

    enrollment = enroll_user_in_course(db, current_user.id, course_id, cohort_id=cohort_id)
    log_action(db, current_user.id, "enroll", "enrollment", str(enrollment.id), details={"course_id": course_id}, request=request)
    return enrollment


