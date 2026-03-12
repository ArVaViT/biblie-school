from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import uuid

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.models.student_note import StudentNote
from app.schemas.note import NoteUpsert, NoteResponse

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("/my", response_model=list[NoteResponse])
async def list_my_notes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[NoteResponse]:
    return (
        db.query(StudentNote)
        .filter(StudentNote.user_id == current_user.id)
        .order_by(StudentNote.updated_at.desc())
        .all()
    )


@router.get("/chapter/{chapter_id}", response_model=NoteResponse)
async def get_note_for_chapter(
    chapter_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NoteResponse:
    note = (
        db.query(StudentNote)
        .filter(
            StudentNote.user_id == current_user.id,
            StudentNote.chapter_id == chapter_id,
        )
        .first()
    )
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No note found for chapter '{chapter_id}'",
        )
    return note


@router.put("/chapter/{chapter_id}", response_model=NoteResponse)
async def upsert_note_for_chapter(
    chapter_id: str,
    data: NoteUpsert,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NoteResponse:
    note = (
        db.query(StudentNote)
        .filter(
            StudentNote.user_id == current_user.id,
            StudentNote.chapter_id == chapter_id,
        )
        .first()
    )
    if note:
        note.content = data.content
    else:
        note = StudentNote(
            id=uuid.uuid4(),
            user_id=current_user.id,
            chapter_id=chapter_id,
            content=data.content,
        )
        db.add(note)

    db.commit()
    db.refresh(note)
    return note


@router.delete("/chapter/{chapter_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note_for_chapter(
    chapter_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    note = (
        db.query(StudentNote)
        .filter(
            StudentNote.user_id == current_user.id,
            StudentNote.chapter_id == chapter_id,
        )
        .first()
    )
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No note found for chapter '{chapter_id}'",
        )
    db.delete(note)
    db.commit()
