from collections.abc import Generator
from typing import Optional
import os

from sqlalchemy import create_engine, Engine
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

Base = declarative_base()

_engine: Optional[Engine] = None
_SessionLocal: Optional[sessionmaker] = None

IS_SERVERLESS = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))


def _get_engine() -> Engine:
    """Lazy initialization of the database engine."""
    global _engine, _SessionLocal

    if _engine is not None:
        return _engine

    try:
        db_url = settings.DATABASE_URL
    except Exception as e:
        logger.error(f"Failed to load DATABASE_URL: {e}")
        raise RuntimeError(f"DATABASE_URL not configured: {e}")

    if not db_url:
        raise RuntimeError("DATABASE_URL is empty or not set")

    if db_url and "sslmode" not in db_url:
        separator = "&" if "?" in db_url else "?"
        db_url = f"{db_url}{separator}sslmode=require"

    try:
        try:
            import psycopg2  # noqa: F401
        except ImportError:
            raise RuntimeError(
                "PostgreSQL driver (psycopg2-binary) is not installed. "
                "Please ensure psycopg2-binary is in requirements.txt."
            )

        pool_kwargs: dict = {
            "connect_args": {
                "connect_timeout": 10,
                "options": "-c statement_timeout=30000",
            },
            "echo": False,
        }

        if IS_SERVERLESS:
            pool_kwargs["poolclass"] = NullPool
        else:
            pool_kwargs.update({
                "pool_pre_ping": True,
                "pool_size": 2,
                "max_overflow": 3,
                "pool_recycle": 300,
            })

        _engine = create_engine(db_url, **pool_kwargs)
        logger.info("Database engine created successfully")

        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    except RuntimeError:
        raise
    except Exception as e:
        error_msg = f"Failed to create database engine: {str(e)}"
        logger.error(error_msg)
        raise RuntimeError(error_msg) from e

    return _engine


def reset_engine() -> None:
    """Dispose and reset the cached engine so the next call recreates it."""
    global _engine, _SessionLocal
    if _engine is not None:
        try:
            _engine.dispose()
        except Exception:
            pass
    _engine = None
    _SessionLocal = None


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session."""
    try:
        _get_engine()
    except RuntimeError as e:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection error",
        )

    if _SessionLocal is None:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database session factory not initialized",
        )

    try:
        db = _SessionLocal()
    except Exception as e:
        logger.error(f"Failed to create database session: {e}")
        reset_engine()
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database temporarily unavailable",
        )

    try:
        yield db
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        db.rollback()
        raise
    except Exception as e:
        logger.error(f"Unexpected error in database session: {e}")
        db.rollback()
        raise
    finally:
        db.close()
