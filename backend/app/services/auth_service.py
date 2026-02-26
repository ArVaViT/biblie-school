from sqlalchemy.orm import Session
from app.models.user import User
from app.core.security import get_password_hash, verify_password, create_access_token
from app.schemas.auth import RegisterRequest, LoginRequest
import uuid


def register_user(db: Session, user_data: RegisterRequest) -> tuple[User, str]:
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise ValueError("User with this email already exists")

    user = User(
        id=str(uuid.uuid4()),
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        role=user_data.role,
    )
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise

    access_token = create_access_token(data={"sub": user.id, "role": user.role})
    return user, access_token


def authenticate_user(db: Session, login_data: LoginRequest) -> tuple[User, str]:
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user:
        raise ValueError("Incorrect email or password")
    if not verify_password(login_data.password, user.hashed_password):
        raise ValueError("Incorrect email or password")

    access_token = create_access_token(data={"sub": user.id, "role": user.role})
    return user, access_token
