import enum

from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class UserRole(enum.StrEnum):
    ADMIN = "admin"
    TEACHER = "teacher"
    PENDING_TEACHER = "pending_teacher"
    STUDENT = "student"


class User(Base):
    __tablename__ = "profiles"

    id = Column(PgUUID(as_uuid=True), primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    role = Column(String, default=UserRole.STUDENT.value, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    enrollments = relationship("Enrollment", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role!r}>"

    @property
    def role_enum(self) -> UserRole:
        return UserRole(self.role) if isinstance(self.role, str) else self.role
