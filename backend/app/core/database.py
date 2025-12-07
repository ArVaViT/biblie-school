from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError
from app.core.config import settings
import logging
from typing import Optional

logger = logging.getLogger(__name__)

Base = declarative_base()

# Lazy initialization - only create engine when needed
_engine: Optional[object] = None
_SessionLocal: Optional[sessionmaker] = None


def _get_engine():
    """Lazy initialization of database engine"""
    global _engine, _SessionLocal
    
    if _engine is not None:
        return _engine
    
    # Parse DATABASE_URL and configure for Supabase
    # IMPORTANT: For Vercel/serverless, use Connection Pooling endpoint from Supabase
    # Get it from: Supabase Dashboard -> Project Settings -> Database -> Connection Pooling
    # Use "Transaction" mode connection string
    try:
        db_url = settings.DATABASE_URL
    except Exception as e:
        logger.error(f"Failed to load DATABASE_URL: {e}")
        raise RuntimeError(f"DATABASE_URL not configured: {e}")
    
    if not db_url:
        raise RuntimeError("DATABASE_URL is empty or not set")
    
    # Ensure sslmode is set for Supabase
    if db_url and "sslmode" not in db_url:
        separator = "&" if "?" in db_url else "?"
        db_url = f"{db_url}{separator}sslmode=require"
    
    # Configure engine for serverless (Vercel) environment
    # For serverless, use small pool size and connection recycling
    try:
        # Проверяем что psycopg2 доступен
        try:
            import psycopg2
            logger.info("psycopg2 driver found")
        except ImportError:
            logger.error("psycopg2-binary not installed! Install it with: pip install psycopg2-binary")
            raise RuntimeError(
                "PostgreSQL driver (psycopg2-binary) is not installed. "
                "This is required for database connections. "
                "Please ensure psycopg2-binary==2.9.9 is in requirements.txt and deployed."
            )
        
        _engine = create_engine(
            db_url,
            pool_pre_ping=True,  # Verify connections before using
            pool_size=1,  # Small pool for serverless
            max_overflow=0,  # Don't create additional connections
            pool_recycle=300,  # Recycle connections after 5 minutes
            connect_args={
                "connect_timeout": 10,  # 10 second timeout
                "options": "-c statement_timeout=30000"  # 30 second statement timeout
            },
            echo=False  # Set to True for SQL query logging
        )
        logger.info("Database engine created successfully")
        
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    except RuntimeError:
        # Перебрасываем RuntimeError как есть
        raise
    except Exception as e:
        error_msg = f"Failed to create database engine: {str(e)}"
        logger.error(error_msg)
        if "Can't load plugin" in str(e) or "postgres" in str(e).lower():
            raise RuntimeError(
                "PostgreSQL driver (psycopg2-binary) is not available. "
                "Please check that psycopg2-binary==2.9.9 is installed. "
                f"Original error: {str(e)}"
            )
        raise RuntimeError(error_msg) from e
    
    return _engine


def get_db():
    """Dependency for getting database session"""
    try:
        # Initialize engine if not already done
        _get_engine()
    except RuntimeError as e:
        # Если проблема с драйвером, возвращаем понятную ошибку
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database connection error: {str(e)}. Please check that psycopg2-binary is installed."
        )
    
    if _SessionLocal is None:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database session factory not initialized"
        )
    
    db = _SessionLocal()
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
