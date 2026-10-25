from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import __version__
from app.api.deps import get_optional_session
from tests.conftest import FakeSession


def test_health_is_ok_when_the_database_answers(client: TestClient) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok", "version": __version__}
    assert response.headers["cache-control"] == "no-store"


def test_health_is_503_when_the_database_is_down(app: FastAPI, client: TestClient) -> None:
    app.dependency_overrides[get_optional_session] = lambda: FakeSession(fail=True)

    response = client.get("/api/v1/health")

    assert response.status_code == 503
    assert response.json()["status"] == "degraded"
    assert response.json()["database"] == "unavailable"


def test_responses_carry_the_request_id_and_server_timing(client: TestClient) -> None:
    response = client.get("/api/v1/health", headers={"X-Request-ID": "req-123"})

    assert response.headers["x-request-id"] == "req-123"
    assert response.headers["server-timing"].startswith("app;dur=")


def test_a_request_id_is_generated_when_none_is_sent(client: TestClient) -> None:
    response = client.get("/api/v1/health")

    assert len(response.headers["x-request-id"]) == 32
