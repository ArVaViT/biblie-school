import re

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.services.file_service import upload_file_to_storage

router = APIRouter(prefix="/files", tags=["files"])

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

ALLOWED_MIME_PATTERNS = [
    re.compile(r"^image/"),
    re.compile(r"^audio/"),
    re.compile(r"^application/pdf$"),
    re.compile(r"^application/msword$"),
    re.compile(r"^application/vnd\.openxmlformats-officedocument\."),
]


def _mime_allowed(content_type: str) -> bool:
    return any(p.match(content_type) for p in ALLOWED_MIME_PATTERNS)


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    course_id: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    content_type = file.content_type or "application/octet-stream"
    if not _mime_allowed(content_type):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type '{content_type}' is not allowed",
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {MAX_FILE_SIZE // (1024 * 1024)} MB",
        )
    await file.seek(0)

    try:
        file_metadata = upload_file_to_storage(
            db=db,
            file=file.file,
            filename=file.filename,
            file_type=content_type,
            course_id=course_id,
            user_id=current_user.id,
        )
        return {
            "id": file_metadata.id,
            "name": file_metadata.name,
            "url": file_metadata.url,
            "file_type": file_metadata.file_type,
        }
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="File upload failed",
        )

