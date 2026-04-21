from __future__ import annotations

import logging
import uuid
from typing import TYPE_CHECKING, BinaryIO

from app.core.config import settings
from app.models.file import File

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
    from supabase import Client

logger = logging.getLogger(__name__)


def get_supabase_client() -> Client:
    from supabase import create_client

    # Server-side uploads need the service-role key so they bypass storage
    # RLS policies. Never fall back to the anon key here — it would silently
    # fail uploads for any RLS-protected bucket.
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
    if not key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY (or legacy SUPABASE_KEY) is not configured",
        )
    return create_client(settings.SUPABASE_URL, key)


def upload_file_to_storage(
    db: Session,
    file: BinaryIO,
    filename: str,
    file_type: str,
    course_id: str | None = None,
    user_id: str | None = None,
) -> File:
    client = get_supabase_client()

    file_id = str(uuid.uuid4())
    file_extension = filename.split(".")[-1] if "." in filename else ""
    unique_filename = f"{file_id}.{file_extension}" if file_extension else file_id

    file_content = file.read()
    file_path = unique_filename

    bucket = client.storage.from_(settings.SUPABASE_STORAGE_BUCKET)
    bucket.upload(
        file_path,
        file_content,
        file_options={"content-type": file_type},
    )

    file_url = bucket.get_public_url(file_path)

    file_metadata = File(
        id=file_id,
        name=filename,
        url=file_url,
        file_type=file_type,
        course_id=course_id,
        user_id=user_id,
    )
    db.add(file_metadata)
    try:
        db.commit()
    except Exception:
        db.rollback()
        try:
            bucket.remove([file_path])
        except Exception:
            logger.warning("Failed to clean up orphan storage object: %s", file_path)
        raise
    db.refresh(file_metadata)

    return file_metadata
