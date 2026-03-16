from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional
from uuid import UUID


class CertificateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    course_id: str
    issued_at: Optional[datetime] = None
    certificate_number: Optional[str] = None
    status: str = "pending"
    requested_at: Optional[datetime] = None
    teacher_approved_at: Optional[datetime] = None
    teacher_approved_by: Optional[UUID] = None
    admin_approved_at: Optional[datetime] = None
    admin_approved_by: Optional[UUID] = None


class CertificateVerifyResponse(BaseModel):
    valid: bool
    certificate_number: str
    user_name: Optional[str] = None
    course_title: Optional[str] = None
    issued_at: Optional[datetime] = None
