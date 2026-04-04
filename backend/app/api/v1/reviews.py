from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.certificate import Certificate
from app.models.review import CourseReview
from app.models.user import User
from app.schemas.review import ReviewCreate, ReviewResponse

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/course/{course_id}", response_model=list[ReviewResponse])
async def list_course_reviews(
    course_id: str,
    db: Session = Depends(get_db),
):
    return (
        db.query(CourseReview)
        .filter(CourseReview.course_id == course_id)
        .order_by(CourseReview.created_at.desc())
        .all()
    )


@router.post("/course/{course_id}", response_model=ReviewResponse)
async def create_or_update_review(
    course_id: str,
    data: ReviewCreate,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cert = (
        db.query(Certificate)
        .filter(
            Certificate.user_id == current_user.id,
            Certificate.course_id == course_id,
            Certificate.status == "approved",
        )
        .first()
    )
    if not cert:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must complete the course and receive a certificate before reviewing",
        )

    existing = (
        db.query(CourseReview)
        .filter(CourseReview.user_id == current_user.id, CourseReview.course_id == course_id)
        .first()
    )

    if existing:
        existing.rating = data.rating
        existing.comment = data.comment
        db.commit()
        db.refresh(existing)
        response.status_code = status.HTTP_200_OK
        return existing

    review = CourseReview(
        user_id=current_user.id,
        course_id=course_id,
        rating=data.rating,
        comment=data.comment,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    response.status_code = status.HTTP_201_CREATED
    return review


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review(
    review_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    review = db.query(CourseReview).filter(CourseReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    if review.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete your own reviews")
    db.delete(review)
    db.commit()
