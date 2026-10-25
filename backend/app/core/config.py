"""Application settings, read once from environment variables (and a local .env file).

Every setting can be overridden with an environment variable of the same name in upper
case, e.g. DATABASE_URL or LOG_JSON=true. The API starts without DATABASE_URL, so a host
can serve the site before its database is connected: until then every data endpoint
answers 503 "Database not configured", and migrations and ingestion refuse to run.
"""

import os
from datetime import date
from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: Literal["local", "ci", "preview", "production"] = "local"

    database_url: str | None = Field(
        default=None,
        description="SQLAlchemy URL, e.g. postgresql+psycopg://user:pass@host:5432/db. Plain "
        "postgres:// URLs, as Neon and Vercel hand them out, work too.",
    )
    # Serverless hosts (Vercel) start many short-lived instances: let the provider's
    # pooler (Neon) share connections instead of each instance keeping its own pool.
    # On by default on Vercel, which sets VERCEL=1 in its functions.
    db_null_pool: bool = Field(default_factory=lambda: os.environ.get("VERCEL") == "1")

    cors_origins: list[str] = ["http://localhost:5173"]
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    log_json: bool = False

    # Historical data never changes, so API responses can be cached hard.
    cache_max_age_s: int = 300
    cache_s_maxage_s: int = 86_400

    elexon_base_url: str = "https://data.elexon.co.uk/bmrs/api/v1"
    elexon_timeout_s: float = 20.0
    elexon_max_concurrency: int = Field(default=4, ge=1, le=16)

    # Days kept in the database: a buffer around the analysis window (ADR 0003).
    ingest_start: date = date(2025, 12, 29)
    ingest_end: date = date(2026, 2, 2)
    # Delivery days the app scores: decisions made 1-31 January 2026.
    analysis_start: date = date(2026, 1, 2)
    analysis_end: date = date(2026, 2, 1)

    @field_validator("database_url")
    @classmethod
    def _use_psycopg(cls, url: str | None) -> str | None:
        """postgres:// and postgresql:// name no driver; this app uses psycopg 3."""
        if not url:
            return None
        for scheme in ("postgres://", "postgresql://"):
            if url.startswith(scheme):
                return "postgresql+psycopg://" + url.removeprefix(scheme)
        return url


@lru_cache
def get_settings() -> Settings:
    """The settings, built once per process."""
    return Settings()
