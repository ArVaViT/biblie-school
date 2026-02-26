try:
    from supabase import create_client, Client
except ImportError:
    create_client = None  # type: ignore
    Client = None  # type: ignore

from app.core.config import settings
from app.models.file import File
from sqlalchemy.orm import Session
import uuid
from typing import BinaryIO


def get_supabase_client() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


def upload_file_to_storage(
    db: Session,
    file: BinaryIO,
    filename: str,
    file_type: str,
    course_id: str | None = None,
    user_id: str | None = None
) -> File:
    supabase = get_supabase_client()
    
    # Generate unique filename
    file_id = str(uuid.uuid4())
    file_extension = filename.split('.')[-1] if '.' in filename else ''
    unique_filename = f"{file_id}.{file_extension}" if file_extension else file_id
    
    # Upload to Supabase Storage
    file_content = file.read()
    file_path = f"{unique_filename}"
    
    supabase.storage.from_(settings.SUPABASE_STORAGE_BUCKET).upload(
        file_path,
        file_content,
        file_options={"content-type": file_type}
    )
    
    # Get public URL
    file_url = supabase.storage.from_(settings.SUPABASE_STORAGE_BUCKET).get_public_url(file_path)
    
    # Save metadata to database
    file_metadata = File(
        id=file_id,
        name=filename,
        url=file_url,
        file_type=file_type,
        course_id=course_id,
        user_id=user_id
    )
    db.add(file_metadata)
    db.commit()
    db.refresh(file_metadata)
    
    return file_metadata

