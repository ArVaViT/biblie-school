import uuid
from collections import defaultdict
from datetime import UTC, datetime

from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.constants import GRADABLE_CHAPTER_TYPES
from app.models.assignment import Assignment
from app.models.chapter_block import ChapterBlock
from app.models.chapter_progress import ChapterProgress
from app.models.course import Chapter, Course, Module
from app.models.enrollment import Enrollment
from app.models.quiz import Quiz, QuizOption, QuizQuestion
from app.schemas.course import (
    ChapterCreate,
    ChapterUpdate,
    CourseCreate,
    CourseUpdate,
    ModuleCreate,
    ModuleUpdate,
)

# Eager-load modules + their chapters without the cartesian row explosion a
# chained ``joinedload`` would produce: one IN query per level means the
# catalog page fetches ~3 rows of wire instead of ``courses * modules *
# chapters`` when a course has many chapters.
_COURSE_TREE: "tuple" = (selectinload(Course.modules).selectinload(Module.chapters),)


def get_courses(db: Session, *, skip: int = 0, limit: int = 100, search: str | None = None) -> list[Course]:
    query = db.query(Course).options(*_COURSE_TREE).filter(Course.status == "published", Course.deleted_at.is_(None))
    if search:
        ts_query = func.plainto_tsquery("russian", search)
        ts_query_en = func.plainto_tsquery("english", search)
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        term = f"%{escaped}%"
        query = query.filter(
            or_(
                Course.search_vector.op("@@")(ts_query),
                Course.search_vector.op("@@")(ts_query_en),
                Course.title.ilike(term),
                Course.description.ilike(term),
            )
        )
    return query.order_by(Course.created_at.desc()).offset(skip).limit(limit).all()


def get_course(db: Session, course_id: str, include_deleted: bool = False) -> Course | None:
    query = db.query(Course).options(*_COURSE_TREE).filter(Course.id == course_id)
    if not include_deleted:
        query = query.filter(Course.deleted_at.is_(None))
    return query.first()


def get_teacher_courses(
    db: Session,
    teacher_id: str,
    *,
    deleted_only: bool = False,
    skip: int = 0,
    limit: int | None = None,
) -> list[Course]:
    query = db.query(Course).options(*_COURSE_TREE).filter(Course.created_by == teacher_id)
    query = query.filter(Course.deleted_at.isnot(None)) if deleted_only else query.filter(Course.deleted_at.is_(None))
    query = query.order_by(Course.created_at.desc())
    if skip:
        query = query.offset(skip)
    if limit is not None:
        query = query.limit(limit)
    return query.all()


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
    now = datetime.now(UTC)
    course.deleted_at = now
    for module in course.modules:
        module.deleted_at = now
        for chapter in module.chapters:
            chapter.deleted_at = now
    db.commit()


def restore_course(db: Session, course: Course) -> Course:
    course.deleted_at = None
    for module in course.modules:
        module.deleted_at = None
        for chapter in module.chapters:
            chapter.deleted_at = None
    db.commit()
    db.refresh(course)
    return course


def permanently_delete_course(db: Session, course: Course) -> None:
    db.delete(course)
    db.commit()


def get_module(db: Session, course_id: str, module_id: str) -> Module | None:
    return (
        db.query(Module)
        .options(joinedload(Module.chapters))
        .filter(Module.id == module_id, Module.course_id == course_id, Module.deleted_at.is_(None))
        .first()
    )


def _next_module_order(db: Session, course_id: str) -> int:
    current_max = (
        db.query(func.max(Module.order_index))
        .filter(Module.course_id == course_id, Module.deleted_at.is_(None))
        .scalar()
    )
    return 0 if current_max is None else current_max + 1


def create_module(db: Session, course_id: str, data: ModuleCreate) -> Module:
    # If the client left ``order_index`` at its default (0) and the course
    # already has modules, append at the tail instead of silently colliding.
    # Clients that need a specific slot (e.g. drag-and-drop reorder) still
    # pass their explicit index and control the full layout themselves.
    # See PLATFORM_ISSUES #9.
    order_index = data.order_index if data.order_index else _next_module_order(db, course_id)
    module = Module(
        id=str(uuid.uuid4()),
        course_id=course_id,
        title=data.title,
        description=data.description,
        order_index=order_index,
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
    now = datetime.now(UTC)
    module.deleted_at = now
    for chapter in module.chapters:
        chapter.deleted_at = now
    db.commit()


def get_chapter(db: Session, course_id: str, module_id: str, chapter_id: str) -> Chapter | None:
    return (
        db.query(Chapter)
        .join(Module, Chapter.module_id == Module.id)
        .filter(
            Chapter.id == chapter_id,
            Chapter.module_id == module_id,
            Module.course_id == course_id,
            Chapter.deleted_at.is_(None),
            Module.deleted_at.is_(None),
        )
        .first()
    )


def _next_chapter_order(db: Session, module_id: str) -> int:
    current_max = (
        db.query(func.max(Chapter.order_index))
        .filter(Chapter.module_id == module_id, Chapter.deleted_at.is_(None))
        .scalar()
    )
    return 0 if current_max is None else current_max + 1


def create_chapter(db: Session, module_id: str, data: ChapterCreate) -> Chapter:
    # Mirrors ``create_module``: default order_index (0) appends at the tail
    # when the module already has chapters. See PLATFORM_ISSUES #9.
    order_index = data.order_index if data.order_index else _next_chapter_order(db, module_id)
    chapter = Chapter(
        id=str(uuid.uuid4()),
        module_id=module_id,
        title=data.title,
        order_index=order_index,
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
    chapter.deleted_at = datetime.now(UTC)
    db.commit()


def enroll_user_in_course(db: Session, user_id: str, course_id: str, cohort_id: str | None = None) -> Enrollment:
    existing = db.query(Enrollment).filter(Enrollment.user_id == user_id, Enrollment.course_id == course_id).first()
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
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.query(Enrollment).filter(Enrollment.user_id == user_id, Enrollment.course_id == course_id).first()
        if existing:
            return existing
        raise
    db.refresh(enrollment)
    return enrollment


def get_user_courses(
    db: Session,
    user_id: str,
    *,
    skip: int = 0,
    limit: int | None = None,
) -> list[Enrollment]:
    query = (
        db.query(Enrollment)
        .join(Course, Course.id == Enrollment.course_id)
        .options(
            joinedload(Enrollment.course).options(*_COURSE_TREE),
        )
        .filter(Enrollment.user_id == user_id, Course.deleted_at.is_(None))
        .order_by(Enrollment.enrolled_at.desc())
    )
    if skip:
        query = query.offset(skip)
    if limit is not None:
        query = query.limit(limit)
    return query.all()


def sync_enrollment_progress(db: Session, user_id: str, course_id: str) -> Enrollment | None:
    db.flush()
    enrollment = db.query(Enrollment).filter(Enrollment.user_id == user_id, Enrollment.course_id == course_id).first()
    if not enrollment:
        return None

    # Single round-trip: count gradable chapters and the subset that this user
    # has completed via a LEFT JOIN + COUNT FILTER.
    row = (
        db.query(
            func.count(Chapter.id).label("total_gradable"),
            func.count(ChapterProgress.id).filter(ChapterProgress.completed.is_(True)).label("completed_gradable"),
        )
        .select_from(Chapter)
        .join(Module, Chapter.module_id == Module.id)
        .outerjoin(
            ChapterProgress,
            (ChapterProgress.chapter_id == Chapter.id) & (ChapterProgress.user_id == user_id),
        )
        .filter(
            Module.course_id == course_id,
            Chapter.chapter_type.in_(GRADABLE_CHAPTER_TYPES),
            Module.deleted_at.is_(None),
            Chapter.deleted_at.is_(None),
        )
        .one()
    )
    total_gradable = row.total_gradable or 0
    completed_gradable = row.completed_gradable or 0

    if total_gradable == 0:
        enrollment.progress = 0
    else:
        enrollment.progress = round((completed_gradable / total_gradable) * 100)
    db.flush()
    return enrollment


def clone_course(db: Session, course_id: str, teacher_id: str | uuid.UUID) -> Course | None:
    """Deep-clone a course and all nested content. Returns the new Course.

    Copies: Course -> Modules -> Chapters -> ChapterBlocks, Quizzes
    (with questions + options), Assignments.
    ChapterBlock.quiz_id / assignment_id are remapped to the cloned entities.
    Enrollments, progress, grades, submissions, and certificates are NOT copied.
    """
    # Only clone live courses. Attempting to clone a trashed course should
    # 404 (mirrors the API-level visibility rules in get_course()).
    original = (
        db.query(Course).options(*_COURSE_TREE).filter(Course.id == course_id, Course.deleted_at.is_(None)).first()
    )
    if original is None:
        return None

    all_chapter_ids = [ch.id for mod in original.modules for ch in mod.chapters]
    if not all_chapter_ids:
        all_quizzes: list[Quiz] = []
        all_questions: list[QuizQuestion] = []
        all_options: list[QuizOption] = []
        all_assignments: list[Assignment] = []
        all_blocks: list[ChapterBlock] = []
    else:
        all_quizzes = db.query(Quiz).filter(Quiz.chapter_id.in_(all_chapter_ids)).all()
        all_quiz_ids = [q.id for q in all_quizzes]

        all_questions = (
            db.query(QuizQuestion).filter(QuizQuestion.quiz_id.in_(all_quiz_ids)).all() if all_quiz_ids else []
        )
        all_question_ids = [q.id for q in all_questions]

        all_options = (
            db.query(QuizOption).filter(QuizOption.question_id.in_(all_question_ids)).all() if all_question_ids else []
        )

        all_assignments = db.query(Assignment).filter(Assignment.chapter_id.in_(all_chapter_ids)).all()
        all_blocks = db.query(ChapterBlock).filter(ChapterBlock.chapter_id.in_(all_chapter_ids)).all()

    quizzes_by_chapter: dict[str, list[Quiz]] = defaultdict(list)
    for q in all_quizzes:
        quizzes_by_chapter[q.chapter_id].append(q)

    questions_by_quiz: dict[str, list[QuizQuestion]] = defaultdict(list)
    for q in all_questions:
        questions_by_quiz[str(q.quiz_id)].append(q)

    options_by_question: dict[str, list[QuizOption]] = defaultdict(list)
    for o in all_options:
        options_by_question[str(o.question_id)].append(o)

    assignments_by_chapter: dict[str, list[Assignment]] = defaultdict(list)
    for a in all_assignments:
        assignments_by_chapter[a.chapter_id].append(a)

    blocks_by_chapter: dict[str, list[ChapterBlock]] = defaultdict(list)
    for b in all_blocks:
        blocks_by_chapter[b.chapter_id].append(b)

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
                order_index=chapter.order_index,
                chapter_type=chapter.chapter_type,
                requires_completion=chapter.requires_completion,
                is_locked=chapter.is_locked,
            )
            db.add(new_chapter)

            quiz_id_map: dict[str, uuid.UUID] = {}
            assignment_id_map: dict[str, uuid.UUID] = {}

            for quiz in quizzes_by_chapter.get(chapter.id, []):
                new_quiz_id = uuid.uuid4()
                quiz_id_map[str(quiz.id)] = new_quiz_id
                db.add(
                    Quiz(
                        id=new_quiz_id,
                        chapter_id=new_chapter_id,
                        title=quiz.title,
                        description=quiz.description,
                        quiz_type=quiz.quiz_type or "quiz",
                        max_attempts=quiz.max_attempts,
                        passing_score=quiz.passing_score,
                    )
                )

                for question in sorted(
                    questions_by_quiz.get(str(quiz.id), []),
                    key=lambda q: q.order_index,
                ):
                    new_question_id = uuid.uuid4()
                    db.add(
                        QuizQuestion(
                            id=new_question_id,
                            quiz_id=new_quiz_id,
                            question_text=question.question_text,
                            question_type=question.question_type,
                            order_index=question.order_index,
                            points=question.points,
                        )
                    )

                    for option in sorted(
                        options_by_question.get(str(question.id), []),
                        key=lambda o: o.order_index,
                    ):
                        db.add(
                            QuizOption(
                                id=uuid.uuid4(),
                                question_id=new_question_id,
                                option_text=option.option_text,
                                is_correct=option.is_correct,
                                order_index=option.order_index,
                            )
                        )

            for assignment in assignments_by_chapter.get(chapter.id, []):
                new_assignment_id = uuid.uuid4()
                assignment_id_map[str(assignment.id)] = new_assignment_id
                db.add(
                    Assignment(
                        id=new_assignment_id,
                        chapter_id=new_chapter_id,
                        title=assignment.title,
                        description=assignment.description,
                        max_score=assignment.max_score,
                        due_date=None,
                    )
                )

            for block in sorted(blocks_by_chapter.get(chapter.id, []), key=lambda b: b.order_index):
                db.add(
                    ChapterBlock(
                        id=uuid.uuid4(),
                        chapter_id=new_chapter_id,
                        block_type=block.block_type,
                        order_index=block.order_index,
                        content=block.content,
                        quiz_id=quiz_id_map.get(str(block.quiz_id)) if block.quiz_id else None,
                        assignment_id=assignment_id_map.get(str(block.assignment_id)) if block.assignment_id else None,
                        file_url=block.file_url,
                    )
                )

    db.commit()

    return db.query(Course).options(*_COURSE_TREE).filter(Course.id == new_course_id).first()
