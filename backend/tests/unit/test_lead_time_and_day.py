from datetime import UTC, datetime

import numpy as np
import pandas as pd
import pytest

from app.domain.day import day_totals, error_bands, likely_range
from app.domain.frames import actual_frame, utc
from app.domain.lead_time import heatmap, lead_time_curve


def at(text: str) -> datetime:
    return datetime.fromisoformat(text).replace(tzinfo=UTC)


def horizon_scores() -> pd.DataFrame:
    """Two delivery hours (09:00 and 10:00 UK) scored at horizons 0, 1 and 5 hours."""
    starts = [at("2026-01-14T09:00")] * 3 + [at("2026-01-14T10:00")] * 3
    return pd.DataFrame(
        {
            "start_time": utc(pd.Series(starts)),
            "horizon_h": [0, 1, 5] * 2,
            "error_mw": [100.0, -200.0, 400.0, 300.0, np.nan, -600.0],
            "lead_h": [0.5, 1.5, 5.5, 0.5, np.nan, 7.5],
        }
    )


def test_the_curve_has_one_point_per_horizon() -> None:
    curve = lead_time_curve(horizon_scores())

    assert [p.horizon_h for p in curve] == [0, 1, 5]
    assert curve[0].mae_mw == pytest.approx(200)
    assert (curve[1].hours, curve[1].hours_scored, curve[1].mae_mw) == (2, 1, 200)
    assert curve[2].median_lead_h == pytest.approx(6.5)


def test_the_heatmap_is_hour_of_day_by_lead_bucket() -> None:
    grid = heatmap(horizon_scores(), bucket_h=4, max_horizon_h=8)

    assert grid.buckets == [(0, 3), (4, 7)]
    assert len(grid.mae_mw) == 24
    assert grid.mae_mw[9] == [pytest.approx(150), pytest.approx(400)]
    assert grid.hours_scored[10] == [1, 1]
    assert grid.mae_mw[0] == [None, None]


def test_day_totals_and_the_worst_shortfall() -> None:
    scored_day = pd.DataFrame(
        {
            "start_time": utc(pd.Series([at("2026-01-14T00:00"), at("2026-01-14T01:00")])),
            "forecast_mw": [1000.0, 2000.0],
            "error_mw": [-100.0, 300.0],
        }
    )
    half_hours = actual_frame([(at("2026-01-14T00:00"), 1100), (at("2026-01-14T00:30"), 1200)])

    totals = day_totals(scored_day, half_hours)

    assert (totals.hours, totals.hours_scored) == (2, 2)
    assert totals.forecast_energy_mwh == 3000
    assert totals.actual_energy_mwh == 1150
    assert totals.mae_mw == 200
    assert totals.bias_mw == 100
    assert totals.worst_shortfall is not None
    assert totals.worst_shortfall.start_time == at("2026-01-14T01:00")
    assert totals.worst_shortfall.error_mw == 300


def test_a_day_with_no_shortfall_has_no_worst_hour() -> None:
    scored_day = pd.DataFrame(
        {
            "start_time": utc(pd.Series([at("2026-01-14T00:00")])),
            "forecast_mw": [1000.0],
            "error_mw": [-50.0],
        }
    )

    assert day_totals(scored_day, actual_frame([])).worst_shortfall is None


def test_error_bands_group_errors_by_uk_hour() -> None:
    bands = error_bands(horizon_scores(), quantiles=(0.0, 1.0))

    assert bands == {9: (-200.0, 400.0), 10: (-600.0, 300.0)}


@pytest.mark.parametrize(
    ("forecast", "band", "expected"),
    [
        (1000.0, (-200.0, 300.0), (700.0, 1200.0)),
        (100.0, (-50.0, 300.0), (0.0, 150.0)),  # wind output is never negative
        (1000.0, None, (None, None)),
        (float("nan"), (-1.0, 1.0), (None, None)),
    ],
)
def test_the_likely_range_for_the_actual(
    forecast: float,
    band: tuple[float, float] | None,
    expected: tuple[float | None, float | None],
) -> None:
    assert likely_range(forecast, band) == expected
