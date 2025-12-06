from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.core.security import get_password_hash, verify_password, create_access_token
from app.schemas.auth import RegisterRequest, LoginRequest
from app.schemas.user import UserResponse
import uuid


def register_user(db: Session, user_data: RegisterRequest) -> tuple[User, str]:
    try:
        # Check if user exists
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            raise ValueError("User with this email already exists")

        # Create new user
        hashed_password = get_password_hash(user_data.password)
        user = User(
            id=str(uuid.uuid4()),
            email=user_data.email,
            hashed_password=hashed_password,
            full_name=user_data.full_name,
            role=UserRole.STUDENT
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create token
        access_token = create_access_token(data={"sub": user.id})
        return user, access_token
    except ValueError:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        import traceback
        error_msg = f"Database error during registration: {str(e)}"
        print(error_msg)
        print(traceback.format_exc())
        # Сохраняем оригинальную ошибку для диагностики
        raise RuntimeError(f"Failed to register user: {str(e)}") from e


def authenticate_user(db: Session, login_data: LoginRequest) -> tuple[User, str]:
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user:
        raise ValueError("Incorrect email or password")
    if not verify_password(login_data.password, user.hashed_password):
        raise ValueError("Incorrect email or password")

    access_token = create_access_token(data={"sub": user.id})
    return user, access_token

