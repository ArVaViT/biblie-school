"""Health check endpoints for diagnostics."""
from fastapi import APIRouter, Depends, HTTPException
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
                AND table_name = 'users'
            )
        """))
        users_table_exists = result.scalar()

        return {
            "status": "ok",
            "database": "connected",
            "users_table_exists": users_table_exists,
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database connection failed: {str(e)}")
