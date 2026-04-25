from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.locale import DEFAULT_LOCALE, LocaleCode


class UserBase(BaseModel):
    email: EmailStr
    full_name: str | None = Field(None, max_length=200)


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: str
    preferred_locale: LocaleCode = DEFAULT_LOCALE
    created_at: datetime | None = None
    updated_at: datetime | None = None
    avatar_url: str | None = None


class PreferredLocaleUpdate(BaseModel):
    """Body for ``PATCH /users/me/preferences``.

    Kept as a dedicated schema so we can grow it (timezone, theme, …) without
    breaking the existing endpoint contract.
    """

    preferred_locale: LocaleCode
