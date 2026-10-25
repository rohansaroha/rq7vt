from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.core.db import get_engine, get_sessionmaker

CACHED = (get_settings, get_engine, get_sessionmaker)


@pytest.mark.parametrize(
    ("given", "used"),
    [
        (
            "postgres://u:p@host/db?sslmode=require",
            "postgresql+psycopg://u:p@host/db?sslmode=require",
        ),
        ("postgresql://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
        ("postgresql+psycopg://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
        ("", None),
    ],
)
def test_database_urls_from_hosts_are_used_with_psycopg(given: str, used: str | None) -> None:
    assert Settings(_env_file=None, database_url=given).database_url == used


def test_connections_are_not_pooled_on_vercel(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DB_NULL_POOL", raising=False)
    monkeypatch.delenv("VERCEL", raising=False)
    assert Settings(_env_file=None).db_null_pool is False

    monkeypatch.setenv("VERCEL", "1")
    assert Settings(_env_file=None).db_null_pool is True


@pytest.fixture
def no_database(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """As on a fresh deployment: DATABASE_URL is empty (it beats any local .env file)."""
    monkeypatch.setenv("DATABASE_URL", "")
    for cached in CACHED:
        cached.cache_clear()
    yield
    for cached in CACHED:
        cached.cache_clear()


@pytest.mark.usefixtures("no_database")
def test_without_a_database_the_api_still_answers(app: FastAPI) -> None:
    with TestClient(app) as client:
        health = client.get("/api/v1/health")
        meta = client.get("/api/v1/meta")

    assert health.status_code == 503
    assert health.json()["database"] == "unavailable"
    assert meta.status_code == 503
    assert meta.json()["type"] == "/problems/database-not-configured"
    assert "cache-control" not in meta.headers
