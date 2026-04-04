import uuid

from sqlalchemy import JSON, Column, DateTime, Index, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.sql import func

from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(PgUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PgUUID(as_uuid=True), nullable=True)
    action = Column(String(50), nullable=False)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(String, nullable=False)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_audit_logs_user_id", "user_id"),
        Index("ix_audit_logs_resource_type", "resource_type"),
        Index("ix_audit_logs_action", "action"),
        Index("ix_audit_logs_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} {self.resource_type}/{self.resource_id}>"
