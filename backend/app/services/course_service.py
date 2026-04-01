from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, or_
from app.models.course import Course, Module, Chapter
from app.models.enrollment import Enrollment
from app.models.chapter_progress import ChapterProgress
from app.models.chapter_block import ChapterBlock
from app.models.quiz import Quiz, QuizQuestion, QuizOption
from app.models.assignment import Assignment
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
    query = db.query(Course).options(
        selectinload(Course.modules).selectinload(Module.chapters)
    ).filter(Course.status == "published")
    if search:
        term = f"%{search}%"
        query = query.filter(
            or_(Course.title.ilike(term), Course.description.ilike(term))
        )
    return query.order_by(Course.created_at.desc()).offset(skip).limit(limit).all()


def get_course(db: Session, course_id: str) -> Course | None:
    return (
        db.query(Course)
        .options(joinedload(Course.modules).joinedload(Module.chapters))
        .filter(Course.id == course_id)
        .first()
    )


def get_teacher_courses(db: Session, teacher_id: str) -> list[Course]:
    return (
        db.query(Course)
        .options(joinedload(Course.modules).joinedload(Module.chapters))
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
    return (
        db.query(Module)
        .options(joinedload(Module.chapters))
        .filter(Module.id == module_id, Module.course_id == course_id)
        .first()
    )


def create_module(db: Session, course_id: str, data: ModuleCreate) -> Module:
    module = Module(
        id=str(uuid.uuid4()),
        course_id=course_id,
        title=data.title,
        description=data.description,
        order_index=data.order_index,
        due_date=data.due_date,
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
        video_url=data.video_url,
        order_index=data.order_index,
        chapter_type=data.chapter_type,
        requires_completion=data.requires_completion,
        is_locked=data.is_locked,
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

def enroll_user_in_course(
    db: Session, user_id: str, course_id: str, cohort_id: str | None = None
) -> Enrollment:
    existing = db.query(Enrollment).filter(
        Enrollment.user_id == user_id, Enrollment.course_id == course_id
    ).first()
    if existing:
        return existing

    enrollment = Enrollment(
        id=str(uuid.uuid4()),
        user_id=user_id,
        course_id=course_id,
        cohort_id=cohort_id,
        progress=0,
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment


def get_user_courses(db: Session, user_id: str) -> list[Enrollment]:
    return (
        db.query(Enrollment)
        .options(
            joinedload(Enrollment.course)
            .selectinload(Course.modules)
            .selectinload(Module.chapters)
        )
        .filter(Enrollment.user_id == user_id)
        .order_by(Enrollment.enrolled_at.desc())
        .all()
    )


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


GRADABLE_CHAPTER_TYPES = ("quiz", "exam", "assignment")


def sync_enrollment_progress(db: Session, user_id: str, course_id: str) -> Enrollment | None:
    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == user_id, Enrollment.course_id == course_id)
        .first()
    )
    if not enrollment:
        return None

    total_gradable = (
        db.query(func.count(Chapter.id))
        .join(Module, Chapter.module_id == Module.id)
        .filter(Module.course_id == course_id, Chapter.chapter_type.in_(GRADABLE_CHAPTER_TYPES))
        .scalar()
    ) or 0

    completed_gradable = (
        db.query(func.count(ChapterProgress.id))
        .join(Chapter, Chapter.id == ChapterProgress.chapter_id)
        .join(Module, Module.id == Chapter.module_id)
        .filter(
            Module.course_id == course_id,
            Chapter.chapter_type.in_(GRADABLE_CHAPTER_TYPES),
            ChapterProgress.user_id == user_id,
            ChapterProgress.completed.is_(True),
        )
        .scalar()
    ) or 0

    if total_gradable == 0:
        enrollment.progress = 100
    else:
        enrollment.progress = round((completed_gradable / total_gradable) * 100)
    db.commit()
    db.refresh(enrollment)
    return enrollment


# ---------------------------------------------------------------------------
# Course cloning
# ---------------------------------------------------------------------------

def clone_course(db: Session, course_id: str, teacher_id: str | uuid.UUID) -> Course:
    """Deep-clone a course and all nested content. Returns the new Course.

    Copies: Course → Modules → Chapters → ChapterBlocks, Quizzes
    (with questions + options), Assignments.
    ChapterBlock.quiz_id / assignment_id are remapped to the cloned entities.
    Enrollments, progress, grades, submissions, and certificates are NOT copied.
    """
    original = (
        db.query(Course)
        .options(joinedload(Course.modules).joinedload(Module.chapters))
        .filter(Course.id == course_id)
        .first()
    )
    if original is None:
        return None

    new_course_id = str(uuid.uuid4())
    new_course = Course(
        id=new_course_id,
        title=f"{original.title} (Copy)",
        description=original.description,
        image_url=original.image_url,
        status="draft",
        created_by=uuid.UUID(teacher_id) if isinstance(teacher_id, str) else teacher_id,
        enrollment_start=None,
        enrollment_end=None,
    )
    db.add(new_course)

    for module in sorted(original.modules, key=lambda m: m.order_index):
        new_module_id = str(uuid.uuid4())
        new_module = Module(
            id=new_module_id,
            course_id=new_course_id,
            title=module.title,
            description=module.description,
            order_index=module.order_index,
            due_date=module.due_date,
        )
        db.add(new_module)

        for chapter in sorted(module.chapters, key=lambda c: c.order_index):
            new_chapter_id = str(uuid.uuid4())
            new_chapter = Chapter(
                id=new_chapter_id,
                module_id=new_module_id,
                title=chapter.title,
                content=chapter.content,
                video_url=chapter.video_url,
                order_index=chapter.order_index,
                chapter_type=chapter.chapter_type,
                requires_completion=chapter.requires_completion,
                is_locked=chapter.is_locked,
            )
            db.add(new_chapter)

            quiz_id_map: dict[str, uuid.UUID] = {}
            assignment_id_map: dict[str, uuid.UUID] = {}

            quizzes = db.query(Quiz).filter(Quiz.chapter_id == chapter.id).all()
            for quiz in quizzes:
                new_quiz_id = uuid.uuid4()
                quiz_id_map[str(quiz.id)] = new_quiz_id
                new_quiz = Quiz(
                    id=new_quiz_id,
                    chapter_id=new_chapter_id,
                    title=quiz.title,
                    description=quiz.description,
                    quiz_type=getattr(quiz, "quiz_type", "quiz") or "quiz",
                    max_attempts=getattr(quiz, "max_attempts", None),
                    passing_score=quiz.passing_score,
                )
                db.add(new_quiz)

                questions = (
                    db.query(QuizQuestion)
                    .filter(QuizQuestion.quiz_id == quiz.id)
                    .order_by(QuizQuestion.order_index)
                    .all()
                )
                for question in questions:
                    new_question_id = uuid.uuid4()
                    new_question = QuizQuestion(
                        id=new_question_id,
                        quiz_id=new_quiz_id,
                        question_text=question.question_text,
                        question_type=question.question_type,
                        order_index=question.order_index,
                        points=question.points,
                    )
                    db.add(new_question)

                    options = (
                        db.query(QuizOption)
                        .filter(QuizOption.question_id == question.id)
                        .order_by(QuizOption.order_index)
                        .all()
                    )
                    for option in options:
                        new_option = QuizOption(
                            id=uuid.uuid4(),
                            question_id=new_question_id,
                            option_text=option.option_text,
                            is_correct=option.is_correct,
                            order_index=option.order_index,
                        )
                        db.add(new_option)

            assignments = (
                db.query(Assignment).filter(Assignment.chapter_id == chapter.id).all()
            )
            for assignment in assignments:
                new_assignment_id = uuid.uuid4()
                assignment_id_map[str(assignment.id)] = new_assignment_id
                new_assignment = Assignment(
                    id=new_assignment_id,
                    chapter_id=new_chapter_id,
                    title=assignment.title,
                    description=assignment.description,
                    max_score=assignment.max_score,
                    due_date=None,
                )
                db.add(new_assignment)

            blocks = (
                db.query(ChapterBlock)
                .filter(ChapterBlock.chapter_id == chapter.id)
                .order_by(ChapterBlock.order_index)
                .all()
            )
            for block in blocks:
                new_block = ChapterBlock(
                    id=uuid.uuid4(),
                    chapter_id=new_chapter_id,
                    block_type=block.block_type,
                    order_index=block.order_index,
                    content=block.content,
                    video_url=block.video_url,
                    quiz_id=quiz_id_map.get(str(block.quiz_id)) if block.quiz_id else None,
                    assignment_id=assignment_id_map.get(str(block.assignment_id)) if block.assignment_id else None,
                    file_url=block.file_url,
                )
                db.add(new_block)

    db.commit()

    return (
        db.query(Course)
        .options(joinedload(Course.modules).joinedload(Module.chapters))
        .filter(Course.id == new_course_id)
        .first()
    )
