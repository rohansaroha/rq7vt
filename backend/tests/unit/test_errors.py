from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError, ProgrammingError

from app.api.deps import get_actuals, get_forecasts
from app.core.errors import InvalidWindowError


def test_unknown_routes_return_a_problem_document(client: TestClient) -> None:
    response = client.get("/api/v1/does-not-exist")

    assert response.status_code == 404
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json() == {"type": "about:blank", "title": "Not Found", "status": 404}


def test_app_errors_keep_their_type_title_and_detail(app: FastAPI) -> None:
    @app.get("/api/v1/_invalid")
    def invalid() -> None:
        raise InvalidWindowError("'from' must be on or before 'to'")

    with TestClient(app) as client:
        response = client.get("/api/v1/_invalid")

    assert response.status_code == 422
    assert response.json() == {
        "type": "/problems/invalid-window",
        "title": "Invalid date window",
        "status": 422,
        "detail": "'from' must be on or before 'to'",
    }


def test_bad_parameters_list_every_invalid_field(app: FastAPI) -> None:
    @app.get("/api/v1/_typed")
    def typed(limit: int) -> dict[str, int]:
        return {"limit": limit}

    with TestClient(app) as client:
        response = client.get("/api/v1/_typed", params={"limit": "many"})

    body = response.json()
    assert response.status_code == 422
    assert body["type"] == "/problems/invalid-request"
    assert body["errors"][0]["loc"] == ["query", "limit"]


def test_unexpected_errors_hide_internals(app: FastAPI) -> None:
    @app.get("/api/v1/_crash")
    def crash() -> None:
        raise RuntimeError("secret connection string")

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/api/v1/_crash")

    assert response.status_code == 500
    assert response.json()["title"] == "Internal Server Error"
    assert "secret" not in response.text


class _BrokenRepository:
    """A repository whose database fails the way Postgres does."""

    def __init__(self, error: Exception) -> None:
        self.error = error

    def frame(self, *_: object) -> None:
        raise self.error

    def coverage(self) -> None:
        raise self.error


class _UndefinedTableError(Exception):
    sqlstate = "42P01"


def _client_with(app: FastAPI, error: Exception) -> TestClient:
    app.dependency_overrides[get_forecasts] = lambda: _BrokenRepository(error)
    app.dependency_overrides[get_actuals] = lambda: _BrokenRepository(error)
    return TestClient(app)


def test_a_database_that_is_down_is_a_503_problem(app: FastAPI) -> None:
    error = OperationalError("SELECT 1", {}, ConnectionError("connection refused"))

    response = _client_with(app, error).get("/api/v1/accuracy/lead-time")

    assert response.status_code == 503
    assert response.json()["type"] == "/problems/database-unavailable"
    assert "make db" in response.json()["detail"]


def test_missing_tables_say_to_run_the_migrations(app: FastAPI) -> None:
    error = ProgrammingError("SELECT 1", {}, _UndefinedTableError("relation does not exist"))

    response = _client_with(app, error).get("/api/v1/accuracy/lead-time")

    assert response.status_code == 503
    assert response.json()["type"] == "/problems/database-not-migrated"
    assert "make migrate" in response.json()["detail"]


def test_other_sql_errors_stay_internal(app: FastAPI) -> None:
    error = ProgrammingError("SELECT oops", {}, Exception("syntax error"))

    app.dependency_overrides[get_forecasts] = lambda: _BrokenRepository(error)
    client = TestClient(app, raise_server_exceptions=False)

    body = client.get("/api/v1/accuracy/lead-time").json()

    assert body["status"] == 500
    assert "syntax" not in body["detail"]
