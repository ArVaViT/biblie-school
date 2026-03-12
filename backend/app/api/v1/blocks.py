from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.api.dependencies import get_current_user, require_teacher, verify_chapter_owner
from app.models.user import User
from app.models.chapter_block import ChapterBlock
from app.schemas.chapter_block import BlockCreate, BlockUpdate, BlockResponse, BlockReorderItem

router = APIRouter(prefix="/blocks", tags=["blocks"])


@router.get("/chapter/{chapter_id}", response_model=list[BlockResponse])
async def list_blocks(
    chapter_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(ChapterBlock)
        .filter(ChapterBlock.chapter_id == chapter_id)
        .order_by(ChapterBlock.order_index)
        .all()
    )


@router.post("/chapter/{chapter_id}", response_model=BlockResponse, status_code=status.HTTP_201_CREATED)
async def create_block(
    chapter_id: str,
    data: BlockCreate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    verify_chapter_owner(db, chapter_id, teacher.id)
    block = ChapterBlock(
        chapter_id=chapter_id,
        block_type=data.block_type,
        order_index=data.order_index,
        content=data.content,
        video_url=data.video_url,
        quiz_id=data.quiz_id,
        assignment_id=data.assignment_id,
        file_url=data.file_url,
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    return block


@router.put("/{block_id}", response_model=BlockResponse)
async def update_block(
    block_id: UUID,
    data: BlockUpdate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    block = db.query(ChapterBlock).filter(ChapterBlock.id == block_id).first()
    if not block:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Block not found")
    verify_chapter_owner(db, block.chapter_id, teacher.id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(block, field, value)
    db.commit()
    db.refresh(block)
    return block


@router.delete("/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_block(
    block_id: UUID,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    block = db.query(ChapterBlock).filter(ChapterBlock.id == block_id).first()
    if not block:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Block not found")
    verify_chapter_owner(db, block.chapter_id, teacher.id)
    db.delete(block)
    db.commit()


@router.put("/chapter/{chapter_id}/reorder", response_model=list[BlockResponse])
async def reorder_blocks(
    chapter_id: str,
    items: list[BlockReorderItem],
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    verify_chapter_owner(db, chapter_id, teacher.id)
    for item in items:
        block = db.query(ChapterBlock).filter(
            ChapterBlock.id == item.id,
            ChapterBlock.chapter_id == chapter_id,
        ).first()
        if block:
            block.order_index = item.order_index
    db.commit()
    return (
        db.query(ChapterBlock)
        .filter(ChapterBlock.chapter_id == chapter_id)
        .order_by(ChapterBlock.order_index)
        .all()
    )
