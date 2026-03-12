from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from uuid import UUID


class CertificateResponse(BaseModel):
    id: UUID
    user_id: UUID
    course_id: str
    issued_at: datetime
    certificate_number: str

    class Config:
        from_attributes = True


class CertificateVerifyResponse(BaseModel):
    valid: bool
    certificate_number: str
    user_name: Optional[str] = None
    course_title: Optional[str] = None
    issued_at: Optional[datetime] = None
