from __future__ import annotations

import contextlib
import logging
from typing import TYPE_CHECKING

from app.core.http import get_client_ip
from app.models.audit_log import AuditLog

if TYPE_CHECKING:
    from uuid import UUID

    from fastapi import Request
    from sqlalchemy.orm import Session, SessionTransaction

logger = logging.getLogger(__name__)


def log_action(
    db: Session,
    user_id: str | UUID,
    action: str,
    resource_type: str,
    resource_id: str,
    details: dict[str, object] | None = None,
    request: Request | None = None,
) -> None:
    """Persist an audit log entry inside a SAVEPOINT so it never
    interferes with the caller's transaction."""
    nested: SessionTransaction | None = None
    try:
        ip_address: str | None = None
        user_agent: str | None = None
        if request is not None:
            ip_address = get_client_ip(request)
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
        if nested is not None:
            with contextlib.suppress(Exception):
                nested.rollback()
