from pydantic_settings import BaseSettings
from pydantic import model_validator, Field
from typing import Optional
import os


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: Optional[str] = Field(default=None, description="Supabase anon key")
    SUPABASE_STORAGE_BUCKET: str = "files"

    DATABASE_URL: Optional[str] = Field(default=None, description="Database connection URL")

    JWT_SECRET_KEY: Optional[str] = Field(default=None, description="JWT secret key")
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30 * 24 * 60  # 30 days

    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    @model_validator(mode='after')
    def load_alternative_env_vars(self):
        """Support alternative env var names from Vercel/Supabase integration."""
        if not self.SUPABASE_KEY:
            self.SUPABASE_KEY = (
                os.getenv("SUPABASE_KEY") or
                os.getenv("SUPABASE_ANON_KEY") or
                os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
            )

        if not self.DATABASE_URL:
            self.DATABASE_URL = (
                os.getenv("DATABASE_URL") or
                os.getenv("POSTGRES_URL") or
                os.getenv("POSTGRES_PRISMA_URL")
            )
        if self.DATABASE_URL:
            self.DATABASE_URL = self.DATABASE_URL.strip()

        supabase_jwt = os.getenv("SUPABASE_JWT_SECRET")
        if supabase_jwt:
            self.JWT_SECRET_KEY = supabase_jwt.strip()
        elif not self.JWT_SECRET_KEY:
            self.JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
        if self.JWT_SECRET_KEY:
            self.JWT_SECRET_KEY = self.JWT_SECRET_KEY.strip()

        if not self.DATABASE_URL:
            raise ValueError("DATABASE_URL or POSTGRES_URL must be set")
        if not self.JWT_SECRET_KEY:
            raise ValueError("JWT_SECRET_KEY or SUPABASE_JWT_SECRET must be set")

        return self

    @property
    def cors_origins_list(self) -> list[str]:
        if not self.CORS_ORIGINS:
            return ["http://localhost:3000", "http://localhost:5173"]
        origins = [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
        return [o for o in origins if o]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
