from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    full_name: str | None = Field(None, max_length=200)


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
