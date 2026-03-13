from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from uuid import UUID

from app.models.course import Course, Module, Chapter
from app.models.quiz import Quiz, QuizAttempt
from app.models.assignment import Assignment, AssignmentSubmission
from app.models.chapter_progress import ChapterProgress
from app.models.enrollment import Enrollment
from app.models.student_grade import StudentGrade
from app.models.user import User
from app.schemas.grade import GradeBreakdown


LETTER_GRADES = [
    (90, "A"),
    (80, "B"),
    (70, "C"),
    (60, "D"),
    (0, "F"),
]


def score_to_letter(score: float) -> str:
    for threshold, letter in LETTER_GRADES:
        if score >= threshold:
            return letter
    return "F"


def _get_course_chapter_ids(db: Session, course_id: str) -> list[str]:
    """Get all chapter IDs for a course in a single query."""
    rows = (
        db.query(Chapter.id)
        .join(Module, Module.id == Chapter.module_id)
        .filter(Module.course_id == course_id)
        .all()
    )
    return [r[0] for r in rows]


def _get_quiz_ids_for_chapters(db: Session, chapter_ids: list[str]) -> list[UUID]:
    if not chapter_ids:
        return []
    rows = db.query(Quiz.id).filter(Quiz.chapter_id.in_(chapter_ids)).all()
    return [r[0] for r in rows]


def _get_assignment_ids_for_chapters(db: Session, chapter_ids: list[str]) -> list[UUID]:
    if not chapter_ids:
        return []
    rows = db.query(Assignment.id).filter(Assignment.chapter_id.in_(chapter_ids)).all()
    return [r[0] for r in rows]


def calculate_student_grade(
    db: Session,
    course: Course,
    student_id: UUID,
    chapter_ids: list[str],
    quiz_ids: list[UUID],
    assignment_ids: list[UUID],
) -> GradeBreakdown:
    """Calculate a single student's weighted grade breakdown."""

    # --- Quiz component: best attempt per quiz ---
    quiz_avg = 0.0
    if quiz_ids:
        best_scores: list[float] = []
        for qid in quiz_ids:
            best = (
                db.query(
                    sqlfunc.max(
                        QuizAttempt.score * 100.0 / sqlfunc.nullif(QuizAttempt.max_score, 0)
                    )
                )
                .filter(
                    QuizAttempt.quiz_id == qid,
                    QuizAttempt.user_id == student_id,
                    QuizAttempt.completed_at.isnot(None),
                )
                .scalar()
            )
            if best is not None:
                best_scores.append(float(best))
        quiz_avg = sum(best_scores) / len(best_scores) if best_scores else 0.0

    # --- Assignment component: average of graded submissions ---
    assignment_avg = 0.0
    if assignment_ids:
        asgn_rows = (
            db.query(AssignmentSubmission.grade, Assignment.max_score)
            .join(Assignment, Assignment.id == AssignmentSubmission.assignment_id)
            .filter(
                AssignmentSubmission.assignment_id.in_(assignment_ids),
                AssignmentSubmission.student_id == student_id,
                AssignmentSubmission.grade.isnot(None),
            )
            .all()
        )
        if asgn_rows:
            pcts = [
                (row.grade / row.max_score * 100.0) if row.max_score else 0.0
                for row in asgn_rows
            ]
            assignment_avg = sum(pcts) / len(pcts)

    # --- Participation component: completed chapters / total chapters ---
    total_chapters = len(chapter_ids)
    participation_pct = 0.0
    if total_chapters > 0:
        completed_count = (
            db.query(sqlfunc.count(ChapterProgress.id))
            .filter(
                ChapterProgress.user_id == student_id,
                ChapterProgress.chapter_id.in_(chapter_ids),
                ChapterProgress.completed.is_(True),
            )
            .scalar()
        ) or 0
        participation_pct = (completed_count / total_chapters) * 100.0

    quiz_weighted = quiz_avg * course.quiz_weight / 100.0
    assignment_weighted = assignment_avg * course.assignment_weight / 100.0
    participation_weighted = participation_pct * course.participation_weight / 100.0
    final_score = round(quiz_weighted + assignment_weighted + participation_weighted, 2)

    return GradeBreakdown(
        quiz_avg=round(quiz_avg, 2),
        quiz_weighted=round(quiz_weighted, 2),
        assignment_avg=round(assignment_avg, 2),
        assignment_weighted=round(assignment_weighted, 2),
        participation_pct=round(participation_pct, 2),
        participation_weighted=round(participation_weighted, 2),
        final_score=final_score,
        letter_grade=score_to_letter(final_score),
    )


def calculate_all_student_grades(db: Session, course: Course):
    """
    Calculate grades for all enrolled students in a course.
    Returns list of (student_id, student_name, student_email, breakdown, manual_grade).
    Minimizes DB queries by pre-fetching shared data.
    """
    chapter_ids = _get_course_chapter_ids(db, course.id)
    quiz_ids = _get_quiz_ids_for_chapters(db, chapter_ids)
    assignment_ids = _get_assignment_ids_for_chapters(db, chapter_ids)

    enrollments = (
        db.query(Enrollment.user_id, User.full_name, User.email)
        .join(User, User.id == Enrollment.user_id)
        .filter(Enrollment.course_id == course.id)
        .all()
    )

    manual_grades_map: dict[str, str | None] = {}
    manual_rows = (
        db.query(StudentGrade.student_id, StudentGrade.grade)
        .filter(StudentGrade.course_id == course.id)
        .all()
    )
    for row in manual_rows:
        manual_grades_map[str(row.student_id)] = row.grade

    results = []
    for user_id, full_name, email in enrollments:
        breakdown = calculate_student_grade(
            db, course, user_id, chapter_ids, quiz_ids, assignment_ids
        )
        results.append({
            "student_id": str(user_id),
            "student_name": full_name,
            "student_email": email,
            "breakdown": breakdown,
            "manual_grade": manual_grades_map.get(str(user_id)),
        })

    return results
