from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_current_user,
    require_teacher,
    resolve_chapter_course_id,
    verify_chapter_access,
    verify_chapter_owner,
)
from app.core.database import get_db
from app.models.assignment import Assignment, AssignmentSubmission
from app.models.chapter_progress import ChapterProgress
from app.models.enrollment import Enrollment
from app.models.user import User
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentResponse,
    AssignmentUpdate,
    GradeSubmissionRequest,
    SubmissionCreate,
    SubmissionResponse,
)
from app.services.audit_service import log_action
from app.services.course_service import sync_enrollment_progress
from app.services.notification_service import create_notification

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.get("/chapter/{chapter_id}", response_model=list[AssignmentResponse])
async def list_chapter_assignments(
    chapter_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_chapter_access(db, chapter_id, current_user)
    return db.query(Assignment).filter(Assignment.chapter_id == chapter_id).order_by(Assignment.created_at).all()


@router.post("", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    data: AssignmentCreate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    verify_chapter_owner(db, data.chapter_id, teacher.id)
    assignment = Assignment(**data.model_dump())
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.put("/{assignment_id}", response_model=AssignmentResponse)
async def update_assignment(
    assignment_id: UUID,
    data: AssignmentUpdate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    verify_chapter_owner(db, assignment.chapter_id, teacher.id)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(assignment, field, value)

    db.commit()
    db.refresh(assignment)
    return assignment


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assignment(
    assignment_id: UUID,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    verify_chapter_owner(db, assignment.chapter_id, teacher.id)
    db.delete(assignment)
    db.commit()


@router.post("/{assignment_id}/submit", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
async def submit_assignment(
    assignment_id: UUID,
    data: SubmissionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    course_id = resolve_chapter_course_id(db, assignment.chapter_id)
    enrolled = (
        db.query(Enrollment).filter(Enrollment.user_id == current_user.id, Enrollment.course_id == course_id).first()
    )
    if not enrolled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be enrolled in this course to submit assignments",
        )

    submission = AssignmentSubmission(
        assignment_id=assignment_id,
        student_id=current_user.id,
        content=data.content,
        file_url=data.file_url,
    )
    db.add(submission)

    progress = (
        db.query(ChapterProgress)
        .filter(
            ChapterProgress.user_id == current_user.id,
            ChapterProgress.chapter_id == assignment.chapter_id,
        )
        .first()
    )
    if not progress:
        progress = ChapterProgress(
            user_id=current_user.id,
            chapter_id=assignment.chapter_id,
        )
        db.add(progress)
    if not progress.completed:
        progress.completed = True
        progress.completed_at = datetime.now(UTC)
        progress.completion_type = "self"

    db.commit()
    sync_enrollment_progress(db, current_user.id, course_id)
    db.refresh(submission)
    return submission


@router.get("/{assignment_id}/submissions", response_model=list[SubmissionResponse])
async def list_submissions(
    assignment_id: UUID,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    verify_chapter_owner(db, assignment.chapter_id, teacher.id)
    return (
        db.query(AssignmentSubmission)
        .filter(AssignmentSubmission.assignment_id == assignment_id)
        .order_by(AssignmentSubmission.submitted_at.desc())
        .all()
    )


@router.get("/{assignment_id}/my-submissions", response_model=list[SubmissionResponse])
async def list_my_submissions(
    assignment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    return (
        db.query(AssignmentSubmission)
        .filter(
            AssignmentSubmission.assignment_id == assignment_id,
            AssignmentSubmission.student_id == current_user.id,
        )
        .order_by(AssignmentSubmission.submitted_at.desc())
        .all()
    )


@router.put("/submissions/{submission_id}/grade", response_model=SubmissionResponse)
async def grade_submission(
    submission_id: UUID,
    data: GradeSubmissionRequest,
    request: Request,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    submission = db.query(AssignmentSubmission).filter(AssignmentSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    verify_chapter_owner(db, assignment.chapter_id, teacher.id)

    if data.grade > assignment.max_score:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Grade ({data.grade}) cannot exceed max score ({assignment.max_score})",
        )

    submission.grade = data.grade
    submission.feedback = data.feedback
    submission.status = data.status
    submission.graded_by = teacher.id
    submission.graded_at = datetime.now(UTC)

    create_notification(
        db,
        user_id=submission.student_id,
        type="assignment_graded",
        title="Assignment Graded",
        message=f'Your submission for "{assignment.title}" has been graded: {data.grade}/{assignment.max_score}.',
        link=None,
        metadata={"assignment_id": str(assignment.id), "submission_id": str(submission.id)},
    )

    db.commit()
    db.refresh(submission)
    log_action(
        db,
        teacher.id,
        "grade",
        "assignment_submission",
        str(submission_id),
        details={"grade": data.grade, "status": data.status},
        request=request,
    )
    return submission
