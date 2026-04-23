import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import assert_course_owner, get_current_user, require_teacher
from app.core.database import get_db
from app.models.announcement import Announcement
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.user import User, UserRole
from app.schemas.announcement import (
    AnnouncementCreate,
    AnnouncementResponse,
    AnnouncementUpdate,
)
from app.services.notification_service import create_notifications_bulk

router = APIRouter(prefix="/announcements", tags=["announcements"])


@router.get("", response_model=list[AnnouncementResponse])
def list_announcements(
    course_id: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AnnouncementResponse]:
    query = db.query(Announcement)
    is_admin = current_user.role in (UserRole.ADMIN.value, "admin")

    if course_id is not None:
        if not is_admin:
            # Non-admin must be enrolled in or own this course to see its announcements.
            # Previously this branch skipped the check entirely (IDOR). See audit P0.4.
            has_access = (
                db.query(Enrollment.id)
                .filter(
                    Enrollment.user_id == current_user.id,
                    Enrollment.course_id == course_id,
                )
                .first()
                is not None
            ) or (
                db.query(Course.id)
                .filter(
                    Course.id == course_id,
                    Course.created_by == current_user.id,
                )
                .first()
                is not None
            )
            if not has_access:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have access to this course's announcements",
                )
        query = query.filter(Announcement.course_id == course_id)
    elif not is_admin:
        enrolled_ids = db.query(Enrollment.course_id).filter(Enrollment.user_id == current_user.id).scalar_subquery()
        owned_ids = db.query(Course.id).filter(Course.created_by == current_user.id).scalar_subquery()
        query = query.filter(
            Announcement.course_id.in_(enrolled_ids)
            | Announcement.course_id.in_(owned_ids)
            | Announcement.course_id.is_(None)
        )
    # Admin without course_id sees all announcements (paginated, capped by limit).

    return query.order_by(Announcement.created_at.desc()).offset(skip).limit(limit).all()  # type: ignore[return-value]  # FastAPI serializes via from_attributes


@router.post("", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
def create_announcement(
    data: AnnouncementCreate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> AnnouncementResponse:
    if data.course_id:
        course = db.query(Course).filter(Course.id == data.course_id).first()
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Course '{data.course_id}' not found",
            )
        try:
            assert_course_owner(course, teacher)
        except HTTPException:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only create announcements for your own courses",
            ) from None
    else:
        course = None

    announcement = Announcement(
        id=uuid.uuid4(),
        title=data.title,
        content=data.content,
        course_id=data.course_id,
        created_by=teacher.id,
    )
    db.add(announcement)
    db.flush()

    if data.course_id:
        enrolled_users = db.query(Enrollment.user_id).filter(Enrollment.course_id == data.course_id).all()
        course_title = course.title if course else "a course"
        recipients = [user_id for (user_id,) in enrolled_users if str(user_id) != str(teacher.id)]
        create_notifications_bulk(
            db,
            recipients,
            type="new_announcement",
            title="New Announcement",
            message=f'{data.title} — in "{course_title}"',
            link=f"/courses/{data.course_id}",
            metadata={"course_id": data.course_id, "announcement_id": str(announcement.id)},
        )

    db.commit()
    db.refresh(announcement)
    return announcement  # type: ignore[return-value]  # FastAPI serializes via from_attributes


@router.put("/{announcement_id}", response_model=AnnouncementResponse)
def update_announcement(
    announcement_id: str,
    data: AnnouncementUpdate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> AnnouncementResponse:
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )
    if str(announcement.created_by) != str(teacher.id) and teacher.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own announcements",
        )

    if data.title is not None:
        announcement.title = data.title
    if data.content is not None:
        announcement.content = data.content

    db.commit()
    db.refresh(announcement)
    return announcement  # type: ignore[return-value]  # FastAPI serializes via from_attributes


@router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_announcement(
    announcement_id: str,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> None:
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )
    if str(announcement.created_by) != str(teacher.id) and teacher.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own announcements",
        )

    db.delete(announcement)
    db.commit()
