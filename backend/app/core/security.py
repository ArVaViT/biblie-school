from typing import Optional
import logging

import jwt

from app.core.config import settings

logger = logging.getLogger(__name__)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        logger.warning("JWT token has expired")
        return None
    except jwt.InvalidAudienceError:
        logger.warning("JWT token has invalid audience")
        return None
    except jwt.PyJWTError as exc:
        logger.warning("JWT decode failed: %s", exc)
        return None
