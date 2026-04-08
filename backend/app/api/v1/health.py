from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/db")
async def check_database(db: Session = Depends(get_db)) -> dict:
    """Verify database connectivity."""
    try:
        result = db.execute(text("SELECT 1"))
        result.fetchone()
        return {"status": "ok", "database": "connected"}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database connection failed"
        ) from None
