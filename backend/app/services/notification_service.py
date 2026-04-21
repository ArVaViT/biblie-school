import uuid
from collections.abc import Iterable
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


def create_notifications_bulk(
    db: Session,
    user_ids: Iterable[str | uuid.UUID],
    *,
    type: str,
    title: str,
    message: str,
    link: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> int:
    # Bulk-insert one identical notification row per recipient. Used for fan-out
    # cases like course announcements where a per-row ``create_notification`` +
    # ``flush`` would cost one round-trip per enrolled student.
    #
    # ``bulk_insert_mappings`` bypasses the ORM ``default=uuid.uuid4`` on the
    # ``id`` column and ``notifications.id`` has no server-side default in the
    # migration (``005_add_audit_notifications``). Generate the UUIDs in
    # Python so the insert does not fail with a NOT NULL violation.
    payloads = [
        {
            "id": uuid.uuid4(),
            "user_id": uid,
            "type": type,
            "title": title,
            "message": message,
            "link": link,
            "meta": metadata,
        }
        for uid in user_ids
    ]
    if not payloads:
        return 0
    db.bulk_insert_mappings(Notification, payloads)
    return len(payloads)
