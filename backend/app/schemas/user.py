from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class UserBase(BaseModel):
    email: EmailStr
    full_name: str | None = None


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
