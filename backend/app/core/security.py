from typing import Optional
import jwt
from app.core.config import settings


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            audience="authenticated",
        )
    except jwt.PyJWTError:
        return None
