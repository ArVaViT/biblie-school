import logging
import re
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, verify_course_owner
from app.core.database import get_db
from app.models.user import User
from app.services.file_service import upload_file_to_storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/files", tags=["files"])

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

ALLOWED_MIME_PATTERNS = [
    re.compile(r"^image/"),
    re.compile(r"^audio/"),
    re.compile(r"^application/pdf$"),
    re.compile(r"^application/msword$"),
    re.compile(r"^application/vnd\.openxmlformats-officedocument\."),
]

MAGIC_BYTES = {
    b"\x89PNG": "image/",
    b"\xff\xd8\xff": "image/",
    b"GIF8": "image/",
    b"%PDF": "application/pdf",
    b"\xd0\xcf\x11\xe0": "application/msword",
    b"PK\x03\x04": "application/vnd.openxmlformats",  # docx/xlsx/pptx
    b"ID3": "audio/",
    b"\xff\xfb": "audio/",
    b"\xff\xf3": "audio/",
    b"OggS": "audio/",
    b"fLaC": "audio/",
}


def _mime_allowed(content_type: str) -> bool:
    return any(p.match(content_type) for p in ALLOWED_MIME_PATTERNS)


def _validate_magic_bytes(header: bytes, declared_type: str) -> bool:
    """Verify that the file's magic bytes are consistent with the declared MIME type."""
    if not header:
        return False
    if header[:4] == b"RIFF" and len(header) >= 12:
        subtype = header[8:12]
        if subtype == b"WEBP":
            return declared_type.startswith("image/")
        if subtype == b"WAVE":
            return declared_type.startswith("audio/")
        if subtype == b"AVI ":
            return declared_type.startswith("video/")
        return False
    for magic, expected_prefix in MAGIC_BYTES.items():
        if header[: len(magic)] == magic:
            return declared_type.startswith(expected_prefix)
    return False


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    # Typed as UUID so FastAPI 422s on malformed input instead of letting
    # ``verify_course_owner``/SQLAlchemy bubble up opaque DB errors.
    # See PLATFORM_ISSUES #7.
    course_id: UUID | None = None,
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

    if not _validate_magic_bytes(contents[:8], content_type):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="File content does not match its declared type",
        )

    await file.seek(0)

    # ``Course.id`` is stored as String in the DB, so the UUID is serialised
    # back to string once FastAPI has validated its shape.
    course_id_str = str(course_id) if course_id is not None else None

    if course_id_str:
        # Only the course owner (or an admin) may upload files scoped to a course.
        # Previously the check allowed any teacher/admin through, enabling cross-
        # tenant uploads; see audit P0.3.
        verify_course_owner(db, course_id_str, current_user.id, allow_admin=True)

    try:
        file_metadata = upload_file_to_storage(
            db=db,
            file=file.file,
            filename=file.filename,
            file_type=content_type,
            course_id=course_id_str,
            user_id=current_user.id,
        )
        return {
            "id": file_metadata.id,
            "name": file_metadata.name,
            "url": file_metadata.url,
            "file_type": file_metadata.file_type,
        }
    except Exception as exc:
        logger.exception("File upload failed for user %s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="File upload failed",
        ) from exc
