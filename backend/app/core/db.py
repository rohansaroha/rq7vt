"""Database engine and session factory, created lazily on first use."""

from functools import lru_cache
from typing import Any

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.core.errors import DatabaseNotConfiguredError


@lru_cache
def get_engine() -> Engine:
    settings = get_settings()
    if settings.database_url is None:
        raise DatabaseNotConfiguredError
    options: dict[str, Any] = {"pool_pre_ping": True}
    if settings.db_null_pool:
        # Serverless: each instance is short-lived, so the provider's pooler (Neon,
        # PgBouncer) shares connections instead of us. A transaction pooler may hand the
        # next transaction a different server session, where a statement psycopg
        # prepared earlier does not exist, so never prepare server-side statements.
        options = {"poolclass": NullPool, "connect_args": {"prepare_threshold": None}}
    return create_engine(settings.database_url, **options)


@lru_cache
def get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
