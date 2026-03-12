from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func as sqla_func
from uuid import UUID

from app.core.database import get_db
from app.api.dependencies import get_current_user, require_teacher, verify_course_owner, verify_chapter_owner
from app.models.user import User
from app.models.course import Course, Module, Chapter
from app.models.enrollment import Enrollment
from app.models.quiz import Quiz, QuizAttempt
from app.models.assignment import Assignment, AssignmentSubmission
from app.models.chapter_progress import ChapterProgress

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/course/{course_id}/students")
async def get_course_student_progress(
    course_id: str,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    course = verify_course_owner(db, course_id, teacher.id)

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


@router.put("/chapter/{chapter_id}/complete")
async def self_complete_chapter(
    chapter_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Student self-completes a chapter (only if requires_completion is False)."""
    chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
    if chapter.requires_completion:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This chapter requires teacher completion",
        )

    progress = (
        db.query(ChapterProgress)
        .filter(ChapterProgress.user_id == current_user.id, ChapterProgress.chapter_id == chapter_id)
        .first()
    )
    if progress and progress.completed:
        return {"message": "Already completed", "chapter_id": chapter_id}

    if not progress:
        progress = ChapterProgress(
            user_id=current_user.id,
            chapter_id=chapter_id,
        )
        db.add(progress)
    progress.completed = True
    progress.completed_at = datetime.now(timezone.utc)
    progress.completion_type = "self"
    db.commit()
    return {"message": "Chapter marked as complete", "chapter_id": chapter_id}


@router.put("/chapter/{chapter_id}/student/{student_id}/complete")
async def teacher_complete_chapter(
    chapter_id: str,
    student_id: UUID,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Teacher marks a student's chapter as complete."""
    verify_chapter_owner(db, chapter_id, teacher.id)
    chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()

    progress = (
        db.query(ChapterProgress)
        .filter(ChapterProgress.user_id == student_id, ChapterProgress.chapter_id == chapter_id)
        .first()
    )
    if progress and progress.completed:
        return {"message": "Already completed", "chapter_id": chapter_id, "student_id": str(student_id)}

    if not progress:
        progress = ChapterProgress(
            user_id=student_id,
            chapter_id=chapter_id,
        )
        db.add(progress)
    progress.completed = True
    progress.completed_at = datetime.now(timezone.utc)
    progress.completed_by = teacher.id
    progress.completion_type = "teacher"
    db.commit()
    return {"message": "Chapter marked as complete by teacher", "chapter_id": chapter_id, "student_id": str(student_id)}


@router.put("/chapter/{chapter_id}/student/{student_id}/incomplete")
async def teacher_uncomplete_chapter(
    chapter_id: str,
    student_id: UUID,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Teacher removes a student's chapter completion."""
    verify_chapter_owner(db, chapter_id, teacher.id)
    progress = (
        db.query(ChapterProgress)
        .filter(ChapterProgress.user_id == student_id, ChapterProgress.chapter_id == chapter_id)
        .first()
    )
    if not progress or not progress.completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chapter is not completed",
        )
    progress.completed = False
    progress.completed_at = None
    progress.completed_by = None
    progress.completion_type = "self"
    db.commit()
    return {"message": "Chapter completion removed", "chapter_id": chapter_id, "student_id": str(student_id)}
