from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Parse DATABASE_URL and configure for Supabase
# IMPORTANT: For Vercel/serverless, use Connection Pooling endpoint from Supabase
# Get it from: Supabase Dashboard -> Project Settings -> Database -> Connection Pooling
# Use "Transaction" mode connection string
try:
    db_url = settings.DATABASE_URL
except Exception as e:
    logger.error(f"Failed to load DATABASE_URL: {e}")
    raise

# Ensure sslmode is set for Supabase
if "sslmode" not in db_url:
    separator = "&" if "?" in db_url else "?"
    db_url = f"{db_url}{separator}sslmode=require"

# Configure engine for serverless (Vercel) environment
# For serverless, use small pool size and connection recycling
try:
    engine = create_engine(
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
except Exception as e:
    logger.error(f"Failed to create database engine: {e}")
    raise

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
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
