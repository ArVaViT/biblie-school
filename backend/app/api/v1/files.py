from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.services.file_service import upload_file_to_storage
from app.models.file import File as FileModel
router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    course_id: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        file_metadata = upload_file_to_storage(
            db=db,
            file=file.file,
            filename=file.filename,
            file_type=file.content_type or "application/octet-stream",
            course_id=course_id,
            user_id=current_user.id
        )
        return {
            "id": file_metadata.id,
            "name": file_metadata.name,
            "url": file_metadata.url,
            "file_type": file_metadata.file_type
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading file: {str(e)}"
        )

