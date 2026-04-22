from collections import defaultdict
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, func
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
def get_my_chapter_progress(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    enrolled = (
        db.query(Enrollment).filter(Enrollment.user_id == current_user.id, Enrollment.course_id == course_id).first()
    )
    if not enrolled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enrolled in this course",
        )

    completed = (
        db.query(ChapterProgress.chapter_id)
        .join(Chapter, Chapter.id == ChapterProgress.chapter_id)
        .join(Module, Module.id == Chapter.module_id)
        .filter(
            Module.course_id == course_id,
            Module.deleted_at.is_(None),
            Chapter.deleted_at.is_(None),
            ChapterProgress.user_id == current_user.id,
            ChapterProgress.completed == True,
        )
        .all()
    )
    return [str(c[0]) for c in completed]


@router.get("/course/{course_id}/students")
def get_course_student_progress(
    course_id: str,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    course = verify_course_owner(db, course_id, teacher.id)

    modules = (
        db.query(Module)
        .filter(Module.course_id == course_id, Module.deleted_at.is_(None))
        .order_by(Module.order_index)
        .all()
    )
    module_map = {m.id: {"id": m.id, "title": m.title, "order_index": m.order_index} for m in modules}

    chapters = (
        db.query(Chapter)
        .join(Module, Chapter.module_id == Module.id)
        .filter(
            Module.course_id == course_id,
            Module.deleted_at.is_(None),
            Chapter.deleted_at.is_(None),
        )
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

    quiz_to_chapter: dict = {}
    for ch_id, qs in quiz_map.items():
        for q in qs:
            quiz_to_chapter[q.id] = ch_id

    # Aggregate best quiz attempt per (user, quiz) in SQL instead of pulling
    # every attempt row. Pre-aggregated data is collapsed per (user, chapter)
    # below so the rest of the endpoint can iterate a small dictionary.
    best_by_user_chapter: dict[tuple[str, str], dict] = {}
    attempts_by_user_chapter_count: dict[tuple[str, str], int] = {}
    latest_quiz_by_user: dict[str, datetime] = {}
    if all_quiz_ids:
        passed_any = func.max(case((QuizAttempt.passed.is_(True), 1), else_=0)).label("passed_any")
        quiz_aggs = (
            db.query(
                QuizAttempt.user_id.label("user_id"),
                QuizAttempt.quiz_id.label("quiz_id"),
                func.max(QuizAttempt.score).label("best_score"),
                func.max(QuizAttempt.max_score).label("best_max_score"),
                passed_any,
                func.count().label("attempts"),
                func.max(QuizAttempt.completed_at).label("last_completed"),
            )
            .filter(
                QuizAttempt.quiz_id.in_(all_quiz_ids),
                QuizAttempt.completed_at.isnot(None),
            )
            .group_by(QuizAttempt.user_id, QuizAttempt.quiz_id)
            .all()
        )
        for row in quiz_aggs:
            uid = str(row.user_id)
            ch_id = quiz_to_chapter.get(row.quiz_id)
            if ch_id is None:
                continue
            ch_key = (uid, str(ch_id))
            attempts_by_user_chapter_count[ch_key] = attempts_by_user_chapter_count.get(ch_key, 0) + int(
                row.attempts or 0
            )
            score = int(row.best_score or 0)
            entry = {
                "chapter_id": str(ch_id),
                "quiz_id": str(row.quiz_id),
                "score": score,
                "max_score": int(row.best_max_score or 0),
                "passed": bool(row.passed_any),
            }
            prev = best_by_user_chapter.get(ch_key)
            if prev is None or score > prev["score"]:
                best_by_user_chapter[ch_key] = entry
            if row.last_completed and (uid not in latest_quiz_by_user or row.last_completed > latest_quiz_by_user[uid]):
                latest_quiz_by_user[uid] = row.last_completed

    all_assignment_ids = [a.id for al in assignment_map.values() for a in al]

    assignment_to_chapter: dict = {}
    assignment_to_chapter_str: dict[str, str] = {}
    assignment_by_id: dict = {}
    assignment_by_id_str: dict[str, Assignment] = {}
    for ch_id, als in assignment_map.items():
        for a in als:
            assignment_to_chapter[a.id] = ch_id
            assignment_to_chapter_str[str(a.id)] = str(ch_id)
            assignment_by_id[a.id] = a
            assignment_by_id_str[str(a.id)] = a

    # Latest submission per (student, assignment) — use MIN/MAX aggregate so
    # earlier revisions aren't loaded into memory. Tie-break on id for
    # determinism when two rows share submitted_at.
    latest_sub_by_user_assignment: dict[tuple[str, str], dict] = {}
    latest_sub_by_user: dict[str, datetime] = {}
    if all_assignment_ids:
        latest_ts_subq = (
            db.query(
                AssignmentSubmission.student_id.label("student_id"),
                AssignmentSubmission.assignment_id.label("assignment_id"),
                func.max(AssignmentSubmission.submitted_at).label("latest_at"),
            )
            .filter(AssignmentSubmission.assignment_id.in_(all_assignment_ids))
            .group_by(AssignmentSubmission.student_id, AssignmentSubmission.assignment_id)
            .subquery()
        )
        latest_rows = (
            db.query(AssignmentSubmission)
            .join(
                latest_ts_subq,
                (AssignmentSubmission.student_id == latest_ts_subq.c.student_id)
                & (AssignmentSubmission.assignment_id == latest_ts_subq.c.assignment_id)
                & (AssignmentSubmission.submitted_at == latest_ts_subq.c.latest_at),
            )
            .all()
        )
        for s in latest_rows:
            uid = str(s.student_id)
            aid = str(s.assignment_id)
            key = (uid, aid)
            existing = latest_sub_by_user_assignment.get(key)
            # Guard against the rare duplicate submitted_at tie — prefer latest id.
            if existing is None or str(s.id) > existing["id"]:
                latest_sub_by_user_assignment[key] = {
                    "id": str(s.id),
                    "assignment_id": aid,
                    "status": s.status or "submitted",
                    "grade": s.grade,
                    "submitted_at": s.submitted_at,
                }
            if s.submitted_at and (uid not in latest_sub_by_user or s.submitted_at > latest_sub_by_user[uid]):
                latest_sub_by_user[uid] = s.submitted_at

    # Group latest submissions by (user, chapter) for easy lookup during the
    # per-student render loop below.
    subs_by_user_chapter: dict[tuple[str, str], list[dict]] = {}
    for (uid, aid), sub in latest_sub_by_user_assignment.items():
        ch_id = assignment_to_chapter_str.get(aid)
        if ch_id is None:
            continue
        subs_by_user_chapter.setdefault((uid, ch_id), []).append(sub)

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
            ch_key = (uid, str(ch_id))
            best = best_by_user_chapter.get(ch_key)
            if best is not None:
                quiz_results.append(
                    {
                        "chapter_title": chapter_map.get(str(ch_id), ""),
                        "chapter_id": str(ch_id),
                        "quiz_id": best["quiz_id"],
                        "score": best["score"],
                        "max_score": best["max_score"],
                        "passed": best["passed"],
                        "attempts_used": attempts_by_user_chapter_count.get(ch_key, 0),
                    }
                )

        assignment_results = []
        for ch_id in assignment_map:
            ch_key = (uid, str(ch_id))
            submissions = subs_by_user_chapter.get(ch_key, [])
            for a in assignment_map[ch_id]:
                a_id = str(a.id)
                matching = [s for s in submissions if s["assignment_id"] == a_id]
                if matching:
                    latest = matching[0]
                    assignment_results.append(
                        {
                            "chapter_title": chapter_map.get(str(ch_id), ""),
                            "chapter_id": str(ch_id),
                            "title": a.title,
                            "status": latest["status"],
                            "grade": latest["grade"],
                            "max_score": a.max_score or 0,
                        }
                    )

        user_progress = progress_by_user.get(uid, {})
        chapters_completed = sum(1 for cid in gradable_chapter_ids if cid in user_progress)

        chapter_infos = []
        for ch in chapters:
            cp = user_progress.get(str(ch.id))
            ch_key = (uid, str(ch.id))
            best = best_by_user_chapter.get(ch_key)
            quiz_data = None
            if best is not None:
                quiz_data = {
                    "score": best["score"],
                    "max_score": best["max_score"],
                    "passed": best["passed"],
                }
            ch_subs = subs_by_user_chapter.get(ch_key, [])
            asgn_data = None
            if ch_subs:
                latest_sub = max(ch_subs, key=lambda s: s["submitted_at"] or datetime.min)
                asgn = assignment_by_id_str.get(latest_sub["assignment_id"])
                max_score = asgn.max_score if asgn is not None else 100
                asgn_data = {
                    "status": latest_sub["status"],
                    "grade": latest_sub["grade"],
                    "max_score": max_score,
                }
            chapter_infos.append(
                {
                    "id": str(ch.id),
                    "title": ch.title,
                    "module_id": str(ch.module_id),
                    "chapter_type": "reading" if (ch.chapter_type or "reading") == "content" else ch.chapter_type,
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
def teacher_complete_chapter(
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
def teacher_uncomplete_chapter(
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
    # Preserve whatever ``completion_type`` the row already had; the column
    # is NOT NULL in Postgres so we cannot clear it, and rewriting it to
    # ``"self"`` unconditionally destroyed the signal of how the chapter
    # was originally completed (quiz/teacher/self).
    sync_enrollment_progress(db, student_id, course_id)
    db.commit()
    return {"message": "Chapter completion removed", "chapter_id": chapter_id, "student_id": str(student_id)}
