from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.course import Course, Module, Chapter
from app.models.enrollment import Enrollment
from app.schemas.course import (
    CourseCreate, CourseUpdate,
    ModuleCreate, ModuleUpdate,
    ChapterCreate, ChapterUpdate,
)
import uuid


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------

def get_courses(
    db: Session, *, skip: int = 0, limit: int = 100, search: str | None = None
) -> list[Course]:
    query = db.query(Course)
    if search:
        term = f"%{search}%"
        query = query.filter(
            or_(Course.title.ilike(term), Course.description.ilike(term))
        )
    return query.order_by(Course.created_at.desc()).offset(skip).limit(limit).all()


def get_course(db: Session, course_id: str) -> Course | None:
    return db.query(Course).filter(Course.id == course_id).first()


def get_teacher_courses(db: Session, teacher_id: str) -> list[Course]:
    return (
        db.query(Course)
        .filter(Course.created_by == teacher_id)
        .order_by(Course.created_at.desc())
        .all()
    )


def create_course(db: Session, data: CourseCreate, user_id: str) -> Course:
    course = Course(
        id=str(uuid.uuid4()),
        title=data.title,
        description=data.description,
        image_url=data.image_url,
        created_by=user_id,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def update_course(db: Session, course: Course, data: CourseUpdate) -> Course:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(course, field, value)
    db.commit()
    db.refresh(course)
    return course


def delete_course(db: Session, course: Course) -> None:
    db.delete(course)
    db.commit()


# ---------------------------------------------------------------------------
# Modules
# ---------------------------------------------------------------------------

def get_module(db: Session, course_id: str, module_id: str) -> Module | None:
    return db.query(Module).filter(
        Module.id == module_id, Module.course_id == course_id
    ).first()


def create_module(db: Session, course_id: str, data: ModuleCreate) -> Module:
    module = Module(
        id=str(uuid.uuid4()),
        course_id=course_id,
        title=data.title,
        description=data.description,
        order_index=data.order_index,
    )
    db.add(module)
    db.commit()
    db.refresh(module)
    return module


def update_module(db: Session, module: Module, data: ModuleUpdate) -> Module:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(module, field, value)
    db.commit()
    db.refresh(module)
    return module


def delete_module(db: Session, module: Module) -> None:
    db.delete(module)
    db.commit()


# ---------------------------------------------------------------------------
# Chapters
# ---------------------------------------------------------------------------

def get_chapter(
    db: Session, course_id: str, module_id: str, chapter_id: str
) -> Chapter | None:
    return (
        db.query(Chapter)
        .join(Module, Chapter.module_id == Module.id)
        .filter(
            Chapter.id == chapter_id,
            Chapter.module_id == module_id,
            Module.course_id == course_id,
        )
        .first()
    )


def create_chapter(db: Session, module_id: str, data: ChapterCreate) -> Chapter:
    chapter = Chapter(
        id=str(uuid.uuid4()),
        module_id=module_id,
        title=data.title,
        content=data.content,
        order_index=data.order_index,
    )
    db.add(chapter)
    db.commit()
    db.refresh(chapter)
    return chapter


def update_chapter(db: Session, chapter: Chapter, data: ChapterUpdate) -> Chapter:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(chapter, field, value)
    db.commit()
    db.refresh(chapter)
    return chapter


def delete_chapter(db: Session, chapter: Chapter) -> None:
    db.delete(chapter)
    db.commit()


# ---------------------------------------------------------------------------
# Enrollments
# ---------------------------------------------------------------------------

def enroll_user_in_course(db: Session, user_id: str, course_id: str) -> Enrollment:
    existing = db.query(Enrollment).filter(
        Enrollment.user_id == user_id, Enrollment.course_id == course_id
    ).first()
    if existing:
        return existing

    enrollment = Enrollment(
        id=str(uuid.uuid4()),
        user_id=user_id,
        course_id=course_id,
        progress=0,
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment


def get_user_courses(db: Session, user_id: str) -> list[Enrollment]:
    return db.query(Enrollment).filter(Enrollment.user_id == user_id).all()


def update_enrollment_progress(
    db: Session, user_id: str, course_id: str, progress: int
) -> Enrollment | None:
    enrollment = db.query(Enrollment).filter(
        Enrollment.user_id == user_id, Enrollment.course_id == course_id
    ).first()
    if not enrollment:
        return None
    enrollment.progress = max(0, min(100, progress))
    db.commit()
    db.refresh(enrollment)
    return enrollment
