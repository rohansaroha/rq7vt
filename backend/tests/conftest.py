"""Shared test setup. Unit tests never touch a database or the network."""

import os
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

if TYPE_CHECKING:
    from tests.synthetic import World

# Unit tests run as if a database were configured, but never connect to it.
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/wind")

INGESTED_AT = datetime(2026, 2, 3, 6, 0, tzinfo=UTC)


class FakeSession:
    """Stands in for a SQLAlchemy session in API tests that must not touch a database."""

    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail

    def execute(self, *_: Any, **__: Any) -> None:
        if self.fail:
            raise OperationalError("SELECT 1", {}, ConnectionError("database is down"))


@pytest.fixture
def app() -> FastAPI:
    from app.main import create_app

    return create_app()


@pytest.fixture(scope="session")
def world() -> "World":
    from tests.synthetic import build_world

    return build_world()


@pytest.fixture
def world_client(app: FastAPI, world: "World") -> Iterator[TestClient]:
    """The real app, with repositories swapped for in-memory fakes over a synthetic month."""
    from app.api.deps import get_actuals, get_forecasts, get_ingestion_log
    from tests.fakes import FakeActuals, FakeForecasts, FakeIngestionLog

    app.dependency_overrides[get_forecasts] = lambda: FakeForecasts(world.forecasts)
    app.dependency_overrides[get_actuals] = lambda: FakeActuals(world.actuals)
    app.dependency_overrides[get_ingestion_log] = lambda: FakeIngestionLog(
        {"actuals": INGESTED_AT, "forecasts": INGESTED_AT}
    )
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    from app.api.deps import get_optional_session, get_session

    app.dependency_overrides[get_session] = lambda: FakeSession()
    app.dependency_overrides[get_optional_session] = lambda: FakeSession()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
