from datetime import date

import pytest

from app.ingestion.jobs import fetch_actuals, fetch_forecasts, iter_days
from tests.factories import FakeSource, actual, forecast

JAN_14 = date(2026, 1, 14)
JAN_15 = date(2026, 1, 15)


def test_iter_days_includes_both_ends() -> None:
    assert iter_days(JAN_14, JAN_15) == [JAN_14, JAN_15]
    assert iter_days(JAN_14, JAN_14) == [JAN_14]


def test_iter_days_rejects_a_reversed_window() -> None:
    with pytest.raises(ValueError, match="before start"):
        iter_days(JAN_15, JAN_14)


async def test_forecasts_skip_nulls_and_drop_duplicate_keys() -> None:
    # A run published exactly at midnight can come back in two days' responses.
    midnight_run = forecast("2026-01-15T00:00:00Z", "2026-01-15T20:00:00Z", 900)
    source = FakeSource(
        forecasts={
            JAN_14: [
                forecast("2026-01-14T08:30:00Z", "2026-01-14T20:00:00Z", 1000),
                forecast("2026-01-14T08:30:00Z", "2026-01-14T21:00:00Z", None),
                midnight_run,
            ],
            JAN_15: [midnight_run],
        }
    )

    result = await fetch_forecasts(source, [JAN_14, JAN_15])

    assert result.fetched == 4
    assert result.skipped == 2
    assert [row["generation_mw"] for row in result.rows] == [1000, 900]


async def test_actuals_keep_the_newest_revision_and_wind_only() -> None:
    start = "2026-01-14T00:00:00Z"
    source = FakeSource(
        actuals={
            JAN_14: [
                actual(start, 1, 9000, published="2026-01-14T00:30:00Z"),
                actual(start, 1, 9100, published="2026-01-14T06:00:00Z"),  # revision
                actual(start, 1, 500, published="2026-01-14T00:30:00Z", fuel="CCGT"),
                actual("2026-01-14T00:30:00Z", 2, None, published="2026-01-14T01:00:00Z"),
            ]
        }
    )

    result = await fetch_actuals(source, [JAN_14])

    assert len(result.rows) == 1
    assert result.rows[0]["generation_mw"] == 9100
    assert result.fetched == 4
    assert result.skipped == 3
