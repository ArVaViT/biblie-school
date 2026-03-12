from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func as sqla_func

from app.core.database import get_db
from app.api.dependencies import require_teacher
from app.models.user import User
from app.models.course import Course, Module, Chapter
from app.models.enrollment import Enrollment
from app.models.quiz import Quiz, QuizAttempt
from app.models.assignment import Assignment, AssignmentSubmission

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/course/{course_id}/students")
async def get_course_student_progress(
    course_id: str,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    chapters = (
        db.query(Chapter)
        .join(Module, Chapter.module_id == Module.id)
        .filter(Module.course_id == course_id)
        .all()
    )
    chapter_ids = [c.id for c in chapters]
    chapter_map = {c.id: c.title for c in chapters}

    quiz_map: dict[str, list] = {}
    if chapter_ids:
        quizzes = db.query(Quiz).filter(Quiz.chapter_id.in_(chapter_ids)).all()
        for q in quizzes:
            quiz_map.setdefault(q.chapter_id, []).append(q)

    assignment_map: dict[str, list] = {}
    if chapter_ids:
        assignments = db.query(Assignment).filter(Assignment.chapter_id.in_(chapter_ids)).all()
        for a in assignments:
            assignment_map.setdefault(a.chapter_id, []).append(a)

    enrollments = (
        db.query(Enrollment, User)
        .join(User, Enrollment.user_id == User.id)
        .filter(Enrollment.course_id == course_id)
        .all()
    )

    student_progress = []
    for enrollment, user in enrollments:
        quiz_scores_by_chapter = {}
        for ch_id, quizzes_list in quiz_map.items():
            quiz_ids = [q.id for q in quizzes_list]
            best_attempts = (
                db.query(QuizAttempt)
                .filter(
                    QuizAttempt.quiz_id.in_(quiz_ids),
                    QuizAttempt.user_id == user.id,
                    QuizAttempt.completed_at.isnot(None),
                )
                .all()
            )
            if best_attempts:
                best = max(best_attempts, key=lambda a: (a.score or 0))
                quiz_scores_by_chapter[ch_id] = {
                    "chapter_title": chapter_map.get(ch_id),
                    "best_score": best.score,
                    "max_score": best.max_score,
                    "passed": best.passed,
                    "attempts": len(best_attempts),
                }

        assignment_grades_by_chapter = {}
        for ch_id, assignments_list in assignment_map.items():
            a_ids = [a.id for a in assignments_list]
            submissions = (
                db.query(AssignmentSubmission)
                .filter(
                    AssignmentSubmission.assignment_id.in_(a_ids),
                    AssignmentSubmission.student_id == user.id,
                )
                .all()
            )
            if submissions:
                graded = [s for s in submissions if s.grade is not None]
                assignment_grades_by_chapter[ch_id] = {
                    "chapter_title": chapter_map.get(ch_id),
                    "submissions": len(submissions),
                    "graded": len(graded),
                    "avg_grade": round(sum(s.grade for s in graded) / len(graded), 1) if graded else None,
                }

        latest_activity = enrollment.enrolled_at
        quiz_attempts_all = (
            db.query(sqla_func.max(QuizAttempt.completed_at))
            .filter(QuizAttempt.user_id == user.id)
            .scalar()
        )
        sub_latest = (
            db.query(sqla_func.max(AssignmentSubmission.submitted_at))
            .filter(AssignmentSubmission.student_id == user.id)
            .scalar()
        )
        for ts in [quiz_attempts_all, sub_latest]:
            if ts and (latest_activity is None or ts > latest_activity):
                latest_activity = ts

        student_progress.append({
            "user_id": str(user.id),
            "full_name": user.full_name or user.email,
            "email": user.email,
            "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None,
            "overall_progress": enrollment.progress,
            "quiz_scores": quiz_scores_by_chapter,
            "assignment_grades": assignment_grades_by_chapter,
            "latest_activity": latest_activity.isoformat() if latest_activity else None,
        })

    return {
        "course_id": course_id,
        "course_title": course.title,
        "total_chapters": len(chapter_ids),
        "total_students": len(enrollments),
        "students": student_progress,
    }
