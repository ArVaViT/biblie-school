from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.sql import func
from app.core.database import Base


class File(Base):
    __tablename__ = "files"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    url = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    course_id = Column(String, ForeignKey("courses.id"), nullable=True)
    user_id = Column(PgUUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self) -> str:
        return f"<File id={self.id!r} name={self.name!r}>"
