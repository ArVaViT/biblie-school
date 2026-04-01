from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/db")
async def check_database(db: Session = Depends(get_db)) -> dict:
    """Verify database connectivity and table existence."""
    try:
        result = db.execute(text("SELECT 1"))
        result.fetchone()

        result = db.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'profiles'
            )
        """))
        profiles_table_exists = result.scalar()

        return {
            "status": "ok",
            "database": "connected",
            "profiles_table_exists": profiles_table_exists,
        }
    except Exception:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database connection failed")
