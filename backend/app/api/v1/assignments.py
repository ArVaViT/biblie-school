from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from uuid import UUID

from app.core.database import get_db
from app.api.dependencies import get_current_user, require_teacher
from app.models.user import User
from app.models.assignment import Assignment, AssignmentSubmission
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentUpdate,
    AssignmentResponse,
    SubmissionCreate,
    SubmissionResponse,
    GradeSubmissionRequest,
)

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.get("/chapter/{chapter_id}", response_model=list[AssignmentResponse])
async def list_chapter_assignments(
    chapter_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Assignment)
        .filter(Assignment.chapter_id == chapter_id)
        .order_by(Assignment.created_at)
        .all()
    )


@router.post("", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    data: AssignmentCreate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
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

    submission = AssignmentSubmission(
        assignment_id=assignment_id,
        student_id=current_user.id,
        content=data.content,
        file_url=data.file_url,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


@router.get("/{assignment_id}/submissions", response_model=list[SubmissionResponse])
async def list_submissions(
    assignment_id: UUID,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return (
        db.query(AssignmentSubmission)
        .filter(AssignmentSubmission.assignment_id == assignment_id)
        .order_by(AssignmentSubmission.submitted_at.desc())
        .all()
    )


@router.put("/submissions/{submission_id}/grade", response_model=SubmissionResponse)
async def grade_submission(
    submission_id: UUID,
    data: GradeSubmissionRequest,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    submission = db.query(AssignmentSubmission).filter(AssignmentSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    submission.grade = data.grade
    submission.feedback = data.feedback
    submission.status = data.status
    submission.graded_by = teacher.id
    submission.graded_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(submission)
    return submission
