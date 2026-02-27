from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.api.dependencies import get_current_user, require_teacher
from app.models.user import User
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
    enroll_user_in_course, update_enrollment_progress,
)

router = APIRouter(prefix="/courses", tags=["courses"])


# ---------------------------------------------------------------------------
# Public course endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[CourseResponse])
async def list_courses(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = Query(None, min_length=1, max_length=200),
    db: Session = Depends(get_db),
):
    return get_courses(db, skip=skip, limit=limit, search=search)


@router.get("/my", response_model=list[CourseResponse])
async def list_my_courses(
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return get_teacher_courses(db, current_user.id)


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course_detail(course_id: str, db: Session = Depends(get_db)):
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    return course


@router.get("/{course_id}/modules/{module_id}", response_model=ModuleResponse)
async def get_module_detail(
    course_id: str,
    module_id: str,
    db: Session = Depends(get_db),
):
    module = get_module(db, course_id, module_id)
    if not module:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Module not found")
    return module


# ---------------------------------------------------------------------------
# Teacher course CRUD
# ---------------------------------------------------------------------------

@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_new_course(
    data: CourseCreate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return create_course(db, data, teacher.id)


@router.put("/{course_id}", response_model=CourseResponse)
async def update_existing_course(
    course_id: str,
    data: CourseUpdate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    if course.created_by != teacher.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit your own courses")
    return update_course(db, course, data)


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_course(
    course_id: str,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    if course.created_by != teacher.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only delete your own courses")
    delete_course(db, course)


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
):
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    if course.created_by != teacher.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit your own courses")
    return create_module(db, course_id, data)


@router.put("/{course_id}/modules/{module_id}", response_model=ModuleResponse)
async def update_existing_module(
    course_id: str,
    module_id: str,
    data: ModuleUpdate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    if course.created_by != teacher.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit your own courses")
    module = get_module(db, course_id, module_id)
    if not module:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Module not found")
    return update_module(db, module, data)


@router.delete(
    "/{course_id}/modules/{module_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_module(
    course_id: str,
    module_id: str,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    if course.created_by != teacher.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit your own courses")
    module = get_module(db, course_id, module_id)
    if not module:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Module not found")
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
):
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    if course.created_by != teacher.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit your own courses")
    module = get_module(db, course_id, module_id)
    if not module:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Module not found")
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
):
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    if course.created_by != teacher.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit your own courses")
    chapter = get_chapter(db, course_id, module_id, chapter_id)
    if not chapter:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Chapter not found")
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
):
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    if course.created_by != teacher.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit your own courses")
    chapter = get_chapter(db, course_id, module_id, chapter_id)
    if not chapter:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Chapter not found")
    delete_chapter(db, chapter)


# ---------------------------------------------------------------------------
# Enrollment
# ---------------------------------------------------------------------------

@router.post("/{course_id}/enroll", response_model=EnrollmentResponse)
async def enroll_course(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    return enroll_user_in_course(db, current_user.id, course_id)


@router.put("/{course_id}/progress", response_model=EnrollmentResponse)
async def update_progress(
    course_id: str,
    progress: int = Query(..., ge=0, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enrollment = update_enrollment_progress(db, current_user.id, course_id, progress)
    if not enrollment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Enrollment not found")
    return enrollment
