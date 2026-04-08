from collections import defaultdict
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_teacher, verify_chapter_owner, verify_course_owner
from app.constants import GRADABLE_CHAPTER_TYPES
from app.core.database import get_db
from app.models.assignment import Assignment, AssignmentSubmission
from app.models.chapter_progress import ChapterProgress
from app.models.course import Chapter, Module
from app.models.enrollment import Enrollment
from app.models.quiz import Quiz, QuizAttempt
from app.models.user import User
from app.services.course_service import sync_enrollment_progress

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/course/{course_id}/my-progress")
async def get_my_chapter_progress(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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

    modules = db.query(Module).filter(Module.course_id == course_id).order_by(Module.order_index).all()
    module_map = {m.id: {"id": m.id, "title": m.title, "order_index": m.order_index} for m in modules}

    chapters = (
        db.query(Chapter)
        .join(Module, Chapter.module_id == Module.id)
        .filter(Module.course_id == course_id)
        .order_by(Module.order_index, Chapter.order_index)
        .all()
    )
    chapter_ids = [c.id for c in chapters]
    gradable_chapter_ids = [c.id for c in chapters if c.chapter_type in GRADABLE_CHAPTER_TYPES]
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
        (
            db.query(QuizAttempt)
            .filter(QuizAttempt.quiz_id.in_(all_quiz_ids), QuizAttempt.completed_at.isnot(None))
            .all()
        )
        if all_quiz_ids
        else []
    )

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
        (db.query(AssignmentSubmission).filter(AssignmentSubmission.assignment_id.in_(all_assignment_ids)).all())
        if all_assignment_ids
        else []
    )

    assignment_to_chapter: dict = {}
    assignment_by_id: dict = {}
    for ch_id, als in assignment_map.items():
        for a in als:
            assignment_to_chapter[a.id] = ch_id
            assignment_by_id[a.id] = a

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
        (
            db.query(ChapterProgress)
            .filter(
                ChapterProgress.chapter_id.in_(chapter_ids),
                ChapterProgress.completed == True,
            )
            .all()
        )
        if chapter_ids
        else []
    )

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
                best = max(best_attempts, key=lambda a: a.score or 0)
                quiz_results.append(
                    {
                        "chapter_title": chapter_map.get(str(ch_id), ""),
                        "chapter_id": str(ch_id),
                        "quiz_id": quiz_to_quiz_id.get(best.quiz_id, ""),
                        "score": best.score or 0,
                        "max_score": best.max_score or 0,
                        "passed": bool(best.passed),
                        "attempts_used": len(best_attempts),
                    }
                )

        assignment_results = []
        for ch_id in assignment_map:
            submissions = subs_by_user_chapter.get((uid, ch_id), [])
            for a in assignment_map[ch_id]:
                a_subs = [s for s in submissions if str(s.assignment_id) == str(a.id)]
                if a_subs:
                    latest = max(a_subs, key=lambda s: s.submitted_at or datetime.min)
                    assignment_results.append(
                        {
                            "chapter_title": chapter_map.get(str(ch_id), ""),
                            "chapter_id": str(ch_id),
                            "title": a.title,
                            "status": latest.status or "submitted",
                            "grade": latest.grade,
                            "max_score": a.max_score or 0,
                        }
                    )

        user_progress = progress_by_user.get(uid, {})
        chapters_completed = sum(1 for cid in gradable_chapter_ids if cid in user_progress)

        chapter_infos = []
        for ch in chapters:
            cp = user_progress.get(str(ch.id))
            ch_quiz_results = attempts_by_user_chapter.get((uid, ch.id), [])
            quiz_data = None
            if ch_quiz_results:
                best = max(ch_quiz_results, key=lambda a: a.score or 0)
                quiz_data = {
                    "score": best.score or 0,
                    "max_score": best.max_score or 0,
                    "passed": bool(best.passed),
                }
            ch_subs = subs_by_user_chapter.get((uid, ch.id), [])
            asgn_data = None
            if ch_subs:
                latest_sub = max(ch_subs, key=lambda s: s.submitted_at or datetime.min)
                asgn = assignment_by_id.get(latest_sub.assignment_id)
                max_score = asgn.max_score if asgn is not None else 100
                asgn_data = {
                    "status": latest_sub.status or "submitted",
                    "grade": latest_sub.grade,
                    "max_score": max_score,
                }
            chapter_infos.append(
                {
                    "id": str(ch.id),
                    "title": ch.title,
                    "module_id": str(ch.module_id),
                    "chapter_type": ch.chapter_type or "reading",
                    "requires_completion": bool(getattr(ch, "requires_completion", False)),
                    "completed": cp is not None,
                    "completed_by": cp.completion_type if cp else None,
                    "quiz_result": quiz_data,
                    "assignment_result": asgn_data,
                }
            )

        latest_activity = enrollment.enrolled_at
        for ts in [latest_quiz_by_user.get(uid), latest_sub_by_user.get(uid)]:
            if ts and (latest_activity is None or ts > latest_activity):
                latest_activity = ts

        student_progress.append(
            {
                "id": uid,
                "full_name": user.full_name or user.email,
                "email": user.email,
                "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None,
                "progress": enrollment.progress,
                "chapters_completed": chapters_completed,
                "total_chapters": len(gradable_chapter_ids),
                "quiz_results": quiz_results,
                "assignment_results": assignment_results,
                "last_activity": latest_activity.isoformat() if latest_activity else None,
                "chapters": chapter_infos,
            }
        )

    return {
        "course_id": course_id,
        "course_title": course.title,
        "total_chapters": len(gradable_chapter_ids),
        "total_students": len(enrollments),
        "modules": list(module_map.values()),
        "students": student_progress,
    }


@router.put("/chapter/{chapter_id}/student/{student_id}/complete")
async def teacher_complete_chapter(
    chapter_id: str,
    student_id: UUID,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    _chapter, course_id = verify_chapter_owner(db, chapter_id, teacher.id)

    enrolled = db.query(Enrollment).filter(Enrollment.user_id == student_id, Enrollment.course_id == course_id).first()
    if not enrolled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student is not enrolled in this course",
        )

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
    progress.completed_at = datetime.now(UTC)
    progress.completed_by = teacher.id
    progress.completion_type = "teacher"
    sync_enrollment_progress(db, student_id, course_id)
    db.commit()
    return {"message": "Chapter marked as complete by teacher", "chapter_id": chapter_id, "student_id": str(student_id)}


@router.put("/chapter/{chapter_id}/student/{student_id}/incomplete")
async def teacher_uncomplete_chapter(
    chapter_id: str,
    student_id: UUID,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    _chapter, course_id = verify_chapter_owner(db, chapter_id, teacher.id)

    enrolled = db.query(Enrollment).filter(Enrollment.user_id == student_id, Enrollment.course_id == course_id).first()
    if not enrolled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student is not enrolled in this course",
        )

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
    sync_enrollment_progress(db, student_id, course_id)
    db.commit()
    return {"message": "Chapter completion removed", "chapter_id": chapter_id, "student_id": str(student_id)}
