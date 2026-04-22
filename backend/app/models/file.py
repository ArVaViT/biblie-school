from sqlalchemy import Column, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.sql import func

from app.core.database import Base


class File(Base):
    __tablename__ = "files"
    __table_args__ = (
        Index("ix_files_course_id", "course_id"),
        Index("ix_files_user_id", "user_id"),
    )

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    url = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    course_id = Column(String, ForeignKey("courses.id"), nullable=True)
    user_id = Column(PgUUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self) -> str:
        return f"<File id={self.id!r} name={self.name!r}>"
