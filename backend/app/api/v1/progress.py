from collections import defaultdict
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.api.dependencies import get_current_user, require_teacher, verify_course_owner, verify_chapter_owner
from app.models.user import User
from app.models.course import Module, Chapter
from app.models.enrollment import Enrollment
from app.models.quiz import Quiz, QuizAttempt
from app.models.assignment import Assignment, AssignmentSubmission
from app.models.chapter_progress import ChapterProgress

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/course/{course_id}/my-progress")
async def get_my_chapter_progress(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return list of completed chapter IDs for current user in this course."""
    completed = (
        db.query(ChapterProgress.chapter_id)
        .join(Chapter, Chapter.id == ChapterProgress.chapter_id)
        .join(Module, Module.id == Chapter.module_id)
        .filter(
            Module.course_id == course_id,
            ChapterProgress.user_id == current_user.id,
            ChapterProgress.completed == True,
        )
        .all()
    )
    return [str(c[0]) for c in completed]


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

    all_quiz_ids = [q.id for qs in quiz_map.values() for q in qs]
    all_attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.quiz_id.in_(all_quiz_ids), QuizAttempt.completed_at.isnot(None))
        .all()
    ) if all_quiz_ids else []

    quiz_to_chapter = {}
    quiz_to_quiz_id = {}
    for ch_id, qs in quiz_map.items():
        for q in qs:
            quiz_to_chapter[q.id] = ch_id
            quiz_to_quiz_id[q.id] = str(q.id)

    attempts_by_user_chapter: dict[tuple, list] = defaultdict(list)
    latest_quiz_by_user: dict[str, datetime] = {}
    for a in all_attempts:
        uid = str(a.user_id)
        ch_id = quiz_to_chapter.get(a.quiz_id)
        if ch_id:
            attempts_by_user_chapter[(uid, ch_id)].append(a)
        if a.completed_at and (uid not in latest_quiz_by_user or a.completed_at > latest_quiz_by_user[uid]):
            latest_quiz_by_user[uid] = a.completed_at

    all_assignment_ids = [a.id for al in assignment_map.values() for a in al]
    all_submissions = (
        db.query(AssignmentSubmission)
        .filter(AssignmentSubmission.assignment_id.in_(all_assignment_ids))
        .all()
    ) if all_assignment_ids else []

    assignment_to_chapter = {}
    for ch_id, als in assignment_map.items():
        for a in als:
            assignment_to_chapter[a.id] = ch_id

    subs_by_user_chapter: dict[tuple, list] = defaultdict(list)
    latest_sub_by_user: dict[str, datetime] = {}
    for s in all_submissions:
        uid = str(s.student_id)
        ch_id = assignment_to_chapter.get(s.assignment_id)
        if ch_id:
            subs_by_user_chapter[(uid, ch_id)].append(s)
        if s.submitted_at and (uid not in latest_sub_by_user or s.submitted_at > latest_sub_by_user[uid]):
            latest_sub_by_user[uid] = s.submitted_at

    all_progress = (
        db.query(ChapterProgress)
        .filter(
            ChapterProgress.chapter_id.in_(chapter_ids),
            ChapterProgress.completed == True,
        )
        .all()
    ) if chapter_ids else []

    progress_by_user: dict[str, dict[str, ChapterProgress]] = defaultdict(dict)
    for p in all_progress:
        progress_by_user[str(p.user_id)][str(p.chapter_id)] = p

    student_progress = []
    for enrollment, user in enrollments:
        uid = str(user.id)

        quiz_results = []
        for ch_id in quiz_map:
            best_attempts = attempts_by_user_chapter.get((uid, ch_id), [])
            if best_attempts:
                best = max(best_attempts, key=lambda a: (a.score or 0))
                quiz_results.append({
                    "chapter_title": chapter_map.get(str(ch_id), ""),
                    "chapter_id": str(ch_id),
                    "quiz_id": quiz_to_quiz_id.get(best.quiz_id, ""),
                    "score": best.score or 0,
                    "max_score": best.max_score or 0,
                    "passed": bool(best.passed),
                    "attempts_used": len(best_attempts),
                })

        assignment_results = []
        for ch_id in assignment_map:
            submissions = subs_by_user_chapter.get((uid, ch_id), [])
            for a in assignment_map[ch_id]:
                a_subs = [s for s in submissions if str(s.assignment_id) == str(a.id)]
                if a_subs:
                    latest = max(a_subs, key=lambda s: s.submitted_at or datetime.min)
                    assignment_results.append({
                        "chapter_title": chapter_map.get(str(ch_id), ""),
                        "chapter_id": str(ch_id),
                        "title": a.title,
                        "status": latest.status or "submitted",
                        "grade": latest.grade,
                        "max_score": a.max_score or 0,
                    })

        user_progress = progress_by_user.get(uid, {})
        chapters_completed = len(user_progress)

        chapter_infos = []
        for ch in chapters:
            cp = user_progress.get(str(ch.id))
            chapter_infos.append({
                "id": str(ch.id),
                "title": ch.title,
                "requires_completion": bool(getattr(ch, "requires_completion", False)),
                "completed": cp is not None,
                "completed_by": cp.completion_type if cp else None,
            })

        latest_activity = enrollment.enrolled_at
        for ts in [latest_quiz_by_user.get(uid), latest_sub_by_user.get(uid)]:
            if ts and (latest_activity is None or ts > latest_activity):
                latest_activity = ts

        student_progress.append({
            "id": uid,
            "full_name": user.full_name or user.email,
            "email": user.email,
            "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None,
            "progress": enrollment.progress,
            "chapters_completed": chapters_completed,
            "total_chapters": len(chapter_ids),
            "quiz_results": quiz_results,
            "assignment_results": assignment_results,
            "last_activity": latest_activity.isoformat() if latest_activity else None,
            "chapters": chapter_infos,
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
    """Student self-completes a chapter."""
    chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")

    module = db.query(Module).filter(Module.id == chapter.module_id).first()
    if module:
        enrolled = (
            db.query(Enrollment)
            .filter(Enrollment.user_id == current_user.id, Enrollment.course_id == module.course_id)
            .first()
        )
        if not enrolled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be enrolled in this course",
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


@router.put("/chapter/{chapter_id}/uncomplete")
async def self_uncomplete_chapter(
    chapter_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Student removes their own chapter completion."""
    chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")

    progress = (
        db.query(ChapterProgress)
        .filter(ChapterProgress.user_id == current_user.id, ChapterProgress.chapter_id == chapter_id)
        .first()
    )
    if not progress or not progress.completed:
        return {"message": "Not completed", "chapter_id": chapter_id}

    progress.completed = False
    progress.completed_at = None
    progress.completion_type = "self"
    db.commit()
    return {"message": "Chapter completion removed", "chapter_id": chapter_id}


@router.put("/chapter/{chapter_id}/student/{student_id}/complete")
async def teacher_complete_chapter(
    chapter_id: str,
    student_id: UUID,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Teacher marks a student's chapter as complete."""
    verify_chapter_owner(db, chapter_id, teacher.id)

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
