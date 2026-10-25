from datetime import UTC, date, datetime, time, timedelta

import numpy as np
import pytest
from fastapi.testclient import TestClient

from tests.synthetic import World

URL = "/api/v1/accuracy/summary"


def brute_force_gate_rows(
    world: World, gate: time, first_day: date = date(2026, 1, 2), last_day: date = date(2026, 2, 1)
) -> list[tuple[date, float, float]]:
    """(delivery day, forecast, actual) for each hour at the gate, the slow obvious way:
    the last run published before the gate.

    In December and January UK time is UTC."""
    by_hour = dict(list(world.forecasts.groupby("start_time")))
    actual = world.actuals.set_index("start_time")["generation_mw"]
    rows = []
    day = first_day
    while day <= last_day:
        cutoff = datetime.combine(day - timedelta(days=1), gate, tzinfo=UTC)
        first_hour = datetime.combine(day - timedelta(days=1), time(23), tzinfo=UTC)
        for h in range(24):
            t = first_hour + timedelta(hours=h)
            runs = by_hour[t]
            usable = runs[runs["publish_time"] < cutoff].sort_values("publish_time")
            rows.append((day, float(usable["generation_mw"].iloc[-1]), float(actual[t])))
        day += timedelta(days=1)
    return rows


def brute_force_gate_errors(world: World, gate: time) -> list[float]:
    return [forecast - actual for _, forecast, actual in brute_force_gate_rows(world, gate)]


def brute_force_corrected_errors(world: World, gate: time) -> list[float]:
    """Corrected errors: each day's forecasts x (actual / forecast) over days D-29 to D-2."""
    sums: dict[date, list[float]] = {}
    for day, forecast, actual in brute_force_gate_rows(
        world, gate, date(2025, 12, 4), date(2026, 2, 1)
    ):
        total = sums.setdefault(day, [0.0, 0.0])
        total[0] += forecast
        total[1] += actual

    def factor(day: date) -> float:
        window = [sums[day - timedelta(days=n)] for n in range(2, 30)]
        return sum(a for _, a in window) / sum(f for f, _ in window)

    return [
        forecast * factor(day) - actual
        for day, forecast, actual in brute_force_gate_rows(world, gate)
    ]


def test_gate_scoring_matches_a_brute_force_calculation(
    world_client: TestClient, world: World
) -> None:
    errors = np.array(brute_force_gate_errors(world, time(9, 20)))

    body = world_client.get(URL, params={"mode": "gate", "gate": "09:20"}).json()

    metrics = body["metrics"]
    assert (metrics["hours"], metrics["hours_scored"], metrics["coverage"]) == (744, 744, 1.0)
    assert metrics["mae_mw"] == pytest.approx(np.mean(np.abs(errors)), abs=0.06)
    assert metrics["rmse_mw"] == pytest.approx(np.sqrt(np.mean(errors**2)), abs=0.06)
    assert metrics["bias_mw"] == pytest.approx(np.mean(errors), abs=0.06)
    assert metrics["p90_mw"] == pytest.approx(np.quantile(errors, 0.9), abs=0.06)
    assert body["selection"]["mode"] == "gate"
    assert body["lead_h"] == {"min_h": 15.5, "median_h": 27.0, "max_h": 38.5}


def test_the_buffer_for_9_to_1_is_the_p90_shortfall(world_client: TestClient) -> None:
    body = world_client.get(URL).json()

    buffers = {b["cost_ratio"]: b for b in body["buffers"]}
    assert sorted(buffers) == list(range(1, 21))
    assert buffers[9]["quantile"] == 0.9
    assert buffers[9]["buffer_mw"] == body["metrics"]["p90_mw"]
    assert buffers[9]["covered_share"] >= 0.89
    assert [b["buffer_mw"] for b in body["buffers"]] == sorted(
        b["buffer_mw"] for b in body["buffers"]
    )


def test_the_histogram_counts_every_scored_hour(world_client: TestClient) -> None:
    body = world_client.get(URL).json()

    bins = body["histogram"]["bins"]
    assert body["histogram"]["bin_mw"] == 500
    assert sum(b["count"] for b in bins) == body["metrics"]["hours_scored"]


def test_horizon_scoring_never_uses_a_run_younger_than_the_horizon(
    world_client: TestClient,
) -> None:
    body = world_client.get(URL, params={"mode": "horizon", "horizon_h": 6}).json()

    assert body["selection"] == {
        "mode": "horizon",
        "gate": None,
        "horizon_h": 6,
        "forecast": "published",
        "description": "Latest run published at least 6 hours before each hour",
    }
    assert body["lead_h"]["min_h"] >= 6
    assert body["metrics"]["coverage"] == 1.0


def test_shorter_horizons_are_more_accurate(world_client: TestClient) -> None:
    near = world_client.get(URL, params={"mode": "horizon", "horizon_h": 2}).json()
    far = world_client.get(URL, params={"mode": "horizon", "horizon_h": 40}).json()

    assert near["metrics"]["mae_mw"] < far["metrics"]["mae_mw"]


@pytest.mark.parametrize(
    "params",
    [
        {"mode": "later"},
        {"mode": "horizon", "horizon_h": 49},
        {"horizon_h": -1},
        {"forecast": "adjusted"},
        {"mode": "horizon", "horizon_h": 6, "forecast": "corrected"},
    ],
)
def test_invalid_parameters_are_422_problems(
    world_client: TestClient, params: dict[str, object]
) -> None:
    response = world_client.get(URL, params=params)

    assert response.status_code == 422
    assert response.json()["type"] == "/problems/invalid-request"


def test_the_lead_time_curve_and_heatmap(world_client: TestClient) -> None:
    body = world_client.get("/api/v1/accuracy/lead-time").json()

    curve = body["curve"]
    assert [p["horizon_h"] for p in curve] == list(range(49))
    assert curve[0]["mae_mw"] < curve[24]["mae_mw"] < curve[48]["mae_mw"]
    assert all(p["median_lead_h"] >= p["horizon_h"] for p in curve)
    heatmap = body["heatmap"]
    assert heatmap["hours_of_day"] == list(range(24))
    assert heatmap["buckets"][0] == {"from_h": 0, "to_h": 3}
    assert len(heatmap["buckets"]) == 12
    assert all(len(row) == 12 for row in heatmap["mae_mw"])
    assert heatmap["hours_scored"][9][0] == 31 * 4  # 31 days x 4 horizons per bucket


def test_the_corrected_forecast_matches_a_brute_force_calculation(
    world_client: TestClient, world: World
) -> None:
    errors = np.array(brute_force_corrected_errors(world, time(9, 20)))

    body = world_client.get(URL, params={"gate": "09:20", "forecast": "corrected"}).json()

    metrics = body["metrics"]
    assert (metrics["hours"], metrics["hours_scored"]) == (744, 744)
    assert metrics["mae_mw"] == pytest.approx(np.mean(np.abs(errors)), abs=0.06)
    assert metrics["bias_mw"] == pytest.approx(np.mean(errors), abs=0.06)
    assert metrics["p90_mw"] == pytest.approx(np.quantile(errors, 0.9), abs=0.06)
    assert body["selection"]["forecast"] == "corrected"
    assert "28 days known at the time" in body["selection"]["description"]
    assert sum(b["count"] for b in body["histogram"]["bins"]) == 744


def test_the_correction_takes_out_most_of_the_lean(world_client: TestClient) -> None:
    published = world_client.get(URL).json()["metrics"]
    corrected = world_client.get(URL, params={"forecast": "corrected"}).json()["metrics"]

    assert published["bias_mw"] > 300  # the synthetic forecast runs high, like WINDFOR did
    assert abs(corrected["bias_mw"]) < published["bias_mw"] / 3
    assert corrected["mae_mw"] < published["mae_mw"]


def test_every_delivery_day_has_a_row(world_client: TestClient) -> None:
    body = world_client.get("/api/v1/accuracy/days", params={"gate": "09:20"}).json()

    days = body["days"]
    assert len(days) == 31
    assert (days[0]["day"], days[-1]["day"]) == ("2026-01-02", "2026-02-01")
    assert all(d["hours_scored"] == 24 and d["correction_factor"] for d in days)
    assert body["selection"]["gate"] == "09:20"
    summary = world_client.get(URL, params={"gate": "09:20"}).json()["metrics"]
    assert np.mean([d["mae_mw"] for d in days]) == pytest.approx(summary["mae_mw"], abs=0.1)


def test_a_day_row_agrees_with_the_decision_screen(world_client: TestClient) -> None:
    days = world_client.get("/api/v1/accuracy/days", params={"gate": "15:30"}).json()["days"]
    row = next(d for d in days if d["day"] == "2026-01-14")
    decision = world_client.get(
        "/api/v1/forecasts/decision", params={"day": "2026-01-14", "gate": "15:30"}
    ).json()

    summary = decision["summary"]
    assert row["mae_mw"] == summary["mae_mw"]
    assert row["bias_mw"] == summary["bias_mw"]
    assert row["forecast_energy_mwh"] == summary["forecast_energy_mwh"]
    assert row["worst_shortfall"] == summary["worst_shortfall"]
    assert row["corrected_mae_mw"] == summary["corrected_mae_mw"]
    assert row["correction_factor"] == decision["correction"]["factor"]
    assert row["hours_short"] == sum(p["error_mw"] > 0 for p in decision["points"])
