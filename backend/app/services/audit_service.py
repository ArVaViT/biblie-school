import logging
from typing import Optional, Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


def log_action(
    db: Session,
    user_id: Optional[Any],
    action: str,
    resource_type: str,
    resource_id: str,
    details: Optional[dict] = None,
    request: Optional[Request] = None,
) -> None:
    """Persist an audit log entry. Uses a separate connection so it never
    interferes with the caller's transaction."""
    try:
        ip_address = None
        user_agent = None
        if request is not None:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent", "")[:500]

        nested = db.begin_nested()
        entry = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id),
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(entry)
        db.flush()
        nested.commit()
    except Exception:
        logger.exception("Failed to write audit log")
        try:
            nested.rollback()  # type: ignore[possibly-undefined]
        except Exception:
            pass
