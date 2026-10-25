from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.domain.frames import forecast_frame
from tests.synthetic import World

URL = "/api/v1/forecasts/decision"


def test_the_decision_uses_the_last_run_before_the_09_20_gate(world_client: TestClient) -> None:
    response = world_client.get(URL, params={"day": "2026-01-14"})

    assert response.status_code == 200
    body = response.json()
    assert body["starts_at"] == "2026-01-13T23:00:00Z"
    assert body["ends_at"] == "2026-01-14T23:00:00Z"
    assert body["gate"] == {"time": "09:20", "closes_at": "2026-01-13T09:20:00Z"}
    assert body["run"] == {
        "publish_time": "2026-01-13T07:30:00Z",
        "lead_h": {"min_h": 15.5, "max_h": 38.5},
    }
    assert body["runs_used"] == ["2026-01-13T07:30:00Z"]
    assert len(body["points"]) == 24
    assert len(body["actuals"]) == 48


def test_a_later_gate_uses_a_later_run(world_client: TestClient) -> None:
    body = world_client.get(URL, params={"day": "2026-01-14", "gate": "09:50"}).json()

    assert body["run"]["publish_time"] == "2026-01-13T09:30:00Z"
    assert body["run"]["lead_h"] == {"min_h": 13.5, "max_h": 36.5}


def test_the_run_published_as_the_1530_gate_closes_is_not_used(world_client: TestClient) -> None:
    body = world_client.get(URL, params={"day": "2026-01-14", "gate": "15:30"}).json()

    assert body["run"]["publish_time"] == "2026-01-13T11:30:00Z"
    assert body["run"]["lead_h"] == {"min_h": 11.5, "max_h": 34.5}


def test_each_point_is_consistent(world_client: TestClient) -> None:
    body = world_client.get(URL, params={"day": "2026-01-14"}).json()

    for point in body["points"]:
        assert point["error_mw"] == pytest.approx(
            point["forecast_mw"] - point["actual_mw"], abs=0.11
        )
        assert point["likely_low_mw"] <= point["likely_high_mw"]
    assert body["points"][0]["start_time"] == "2026-01-13T23:00:00Z"
    assert body["likely_range"]["coverage"] == 0.8


def test_the_day_summary_matches_the_points(world_client: TestClient) -> None:
    body = world_client.get(URL, params={"day": "2026-01-14"}).json()
    points, summary = body["points"], body["summary"]

    errors = [p["error_mw"] for p in points]
    assert summary["hours"] == summary["hours_scored"] == 24
    assert summary["mae_mw"] == pytest.approx(sum(abs(e) for e in errors) / 24, abs=0.1)
    assert summary["forecast_energy_mwh"] == pytest.approx(
        sum(p["forecast_mw"] for p in points), abs=1
    )
    assert summary["actual_energy_mwh"] == pytest.approx(
        sum(a["generation_mw"] for a in body["actuals"]) / 2, abs=1
    )
    worst = max(points, key=lambda p: p["error_mw"])
    assert summary["worst_shortfall"] == {
        "start_time": worst["start_time"],
        "error_mw": worst["error_mw"],
    }


def test_the_corrected_forecast_scales_each_hour_by_the_days_factor(
    world_client: TestClient,
) -> None:
    body = world_client.get(URL, params={"day": "2026-01-14"}).json()

    correction = body["correction"]
    assert (correction["trained_from"], correction["trained_to"]) == ("2025-12-16", "2026-01-12")
    assert correction["days"] == 28
    assert 0.8 < correction["factor"] < 1  # the synthetic forecast runs high
    points = body["points"]
    for point in points:
        assert point["corrected_mw"] == pytest.approx(
            point["forecast_mw"] * correction["factor"], abs=1
        )
    corrected_errors = [p["corrected_mw"] - p["actual_mw"] for p in points]
    summary = body["summary"]
    assert summary["corrected_mae_mw"] == pytest.approx(
        sum(abs(e) for e in corrected_errors) / 24, abs=0.1
    )
    assert summary["corrected_bias_mw"] == pytest.approx(sum(corrected_errors) / 24, abs=0.1)
    assert summary["corrected_forecast_energy_mwh"] == pytest.approx(
        sum(p["corrected_mw"] for p in points), abs=2
    )


@pytest.mark.parametrize("gate", ["9:20", "24:00", "09:60", "0920", "noon"])
def test_a_malformed_gate_is_a_422_problem(world_client: TestClient, gate: str) -> None:
    response = world_client.get(URL, params={"day": "2026-01-14", "gate": gate})

    assert response.status_code == 422
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json()["type"] == "/problems/invalid-request"


def test_a_day_outside_the_period_is_rejected(world_client: TestClient) -> None:
    response = world_client.get(URL, params={"day": "2026-02-02"})

    assert response.status_code == 422
    assert response.json()["type"] == "/problems/out-of-range"
    assert "2026-01-02 to 2026-02-01" in response.json()["detail"]


def test_the_day_is_required(world_client: TestClient) -> None:
    response = world_client.get(URL)

    assert response.status_code == 422
    assert response.json()["errors"][0]["loc"] == ["query", "day"]


@pytest.fixture
def client_without_forecasts(app: FastAPI, world: World) -> Iterator[TestClient]:
    from app.api.deps import get_actuals, get_forecasts
    from tests.fakes import FakeActuals, FakeForecasts

    app.dependency_overrides[get_forecasts] = lambda: FakeForecasts(forecast_frame([]))
    app.dependency_overrides[get_actuals] = lambda: FakeActuals(world.actuals)
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def test_a_day_with_no_forecast_reports_what_is_missing(
    client_without_forecasts: TestClient,
) -> None:
    body = client_without_forecasts.get(URL, params={"day": "2026-01-14"}).json()

    assert body["run"] is None
    assert body["runs_used"] == []
    assert body["summary"]["hours_scored"] == 0
    assert body["summary"]["forecast_energy_mwh"] is None
    assert all(p["forecast_mw"] is None and p["likely_low_mw"] is None for p in body["points"])
    assert body["correction"] is None
    assert all(p["corrected_mw"] is None for p in body["points"])
    assert body["summary"]["corrected_mae_mw"] is None
    assert len(body["actuals"]) == 48  # what happened is still shown


def test_runs_lists_every_run_published_the_day_before(world_client: TestClient) -> None:
    body = world_client.get("/api/v1/forecasts/runs", params={"day": "2026-01-14"}).json()

    assert body["published_on"] == "2026-01-13"
    assert [r["publish_time"][11:16] for r in body["runs"]] == [
        "02:30",
        "04:30",
        "07:30",
        "09:30",
        "11:30",
        "15:30",
        "18:30",
        "22:30",
    ]
    first = body["runs"][0]
    assert (first["hours"], first["hours_scored"], len(first["points"])) == (24, 24, 24)
    assert first["lead_h"] == {"min_h": 20.5, "max_h": 43.5}
    assert first["mae_mw"] > 0


def test_the_run_used_at_the_gate_scores_the_same_in_both_endpoints(
    world_client: TestClient,
) -> None:
    decision = world_client.get(URL, params={"day": "2026-01-20"}).json()
    runs = world_client.get("/api/v1/forecasts/runs", params={"day": "2026-01-20"}).json()

    used = next(r for r in runs["runs"] if r["publish_time"] == decision["run"]["publish_time"])
    assert used["mae_mw"] == decision["summary"]["mae_mw"]
