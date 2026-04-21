import logging
import os

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    SUPABASE_URL: str
    # Server-side Supabase key (storage uploads, admin queries). Also read
    # from the legacy SUPABASE_KEY env var for backwards compatibility with
    # early deployments — see load_alternative_env_vars() below.
    SUPABASE_SERVICE_ROLE_KEY: str | None = Field(default=None, description="Supabase service-role key (server-only)")
    SUPABASE_STORAGE_BUCKET: str = "files"

    DATABASE_URL: str | None = Field(default=None, description="Database connection URL")

    JWT_SECRET_KEY: str | None = Field(default=None, description="JWT secret key")
    JWT_ALGORITHM: str = "HS256"

    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173,https://biblie-school-frontend.vercel.app"

    # Sentry — entirely optional. Leaving SENTRY_DSN unset skips init.
    SENTRY_DSN: str | None = Field(default=None, description="Sentry DSN for error monitoring")
    SENTRY_ENVIRONMENT: str | None = Field(default=None, description="Sentry environment label")
    SENTRY_TRACES_SAMPLE_RATE: float = Field(default=0.1, ge=0.0, le=1.0)

    @model_validator(mode="after")
    def load_alternative_env_vars(self):
        """Support alternative env var names from Vercel/Supabase integration."""
        if not self.SUPABASE_SERVICE_ROLE_KEY:
            # Accept the legacy SUPABASE_KEY name from older deployments.
            # Anon keys are NEVER accepted as a server-side secret.
            legacy = os.getenv("SUPABASE_KEY")
            if legacy:
                logger.warning("SUPABASE_KEY is deprecated; set SUPABASE_SERVICE_ROLE_KEY explicitly")
                self.SUPABASE_SERVICE_ROLE_KEY = legacy

        if not self.DATABASE_URL:
            self.DATABASE_URL = (
                os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL") or os.getenv("POSTGRES_PRISMA_URL")
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


settings = Settings()
