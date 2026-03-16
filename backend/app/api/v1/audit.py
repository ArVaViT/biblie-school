from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.dependencies import require_admin
from app.models.user import User
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/audit", tags=["audit"])


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: Optional[UUID] = None
    action: str
    resource_type: str
    resource_id: str
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime


class AuditLogPage(BaseModel):
    items: list[AuditLogResponse]
    total: int
    page: int
    page_size: int


@router.get("", response_model=AuditLogPage)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user_id: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AuditLogPage:
    q = db.query(AuditLog)

    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    if resource_type:
        q = q.filter(AuditLog.resource_type == resource_type)
    if action:
        q = q.filter(AuditLog.action == action)
    if date_from:
        q = q.filter(AuditLog.created_at >= date_from)
    if date_to:
        q = q.filter(AuditLog.created_at <= date_to)

    total = q.count()
    items = (
        q.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return AuditLogPage(items=items, total=total, page=page, page_size=page_size)
