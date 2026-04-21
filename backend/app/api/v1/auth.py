from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    return UserResponse.model_validate(current_user)
