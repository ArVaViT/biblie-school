import logging

import httpx
import jwt

from app.core.config import settings

logger = logging.getLogger(__name__)


def _validate_via_supabase(token: str) -> dict | None:
    """Fallback: validate a Supabase-issued token by calling GET /auth/v1/user.

    Used when the local JWT secret does not match the Supabase project's
    signing secret (e.g. after key rotation or in environments where the
    secret is not configured). Returns a payload-shaped dict on success.
    """
    supabase_url = getattr(settings, "SUPABASE_URL", None)
    if not supabase_url:
        return None
    try:
        resp = httpx.get(
            f"{supabase_url}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": settings.SUPABASE_KEY or "",
            },
            timeout=5.0,
        )
    except httpx.HTTPError as exc:
        logger.warning("Supabase token validation failed: %s", exc)
        return None
    if resp.status_code != 200:
        return None
    data = resp.json()
    return {
        "sub": data.get("id"),
        "email": data.get("email"),
        "aud": data.get("aud", "authenticated"),
        "role": data.get("role", "authenticated"),
    }


def decode_access_token(token: str) -> dict | None:
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
    except jwt.InvalidSignatureError:
        return _validate_via_supabase(token)
    except jwt.PyJWTError as exc:
        logger.warning("JWT decode failed: %s", exc)
        return None
