import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models.notification import Notification


def create_notification(
    db: Session,
    user_id: str | uuid.UUID,
    type: str,
    title: str,
    message: str,
    link: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        link=link,
        meta=metadata,
    )
    db.add(notification)
    db.flush()
    return notification
