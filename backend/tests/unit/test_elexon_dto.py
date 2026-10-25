from datetime import UTC, date, datetime

import pytest
from pydantic import ValidationError

from app.integrations.elexon import FuelGenerationRow, WindForecastRow


def test_forecast_rows_map_camel_case_and_normalise_to_utc() -> None:
    row = WindForecastRow.model_validate(
        {
            "dataset": "WINDFOR",
            "publishTime": "2026-01-14T08:30:00Z",
            "startTime": "2026-01-15T00:00:00+01:00",
            "generation": 9123,
        }
    )

    assert row.publish_time == datetime(2026, 1, 14, 8, 30, tzinfo=UTC)
    assert row.start_time == datetime(2026, 1, 14, 23, 0, tzinfo=UTC)
    assert row.start_time.utcoffset() is not None
    assert row.generation == 9123


def test_timestamps_without_a_time_zone_are_rejected() -> None:
    with pytest.raises(ValidationError):
        WindForecastRow.model_validate(
            {
                "publishTime": "2026-01-14T08:30:00",
                "startTime": "2026-01-15T00:00:00Z",
                "generation": 1,
            }
        )


def test_actual_rows_allow_null_generation() -> None:
    row = FuelGenerationRow.model_validate(
        {
            "publishTime": "2026-01-14T00:30:00Z",
            "startTime": "2026-01-14T00:00:00Z",
            "settlementDate": "2026-01-14",
            "settlementPeriod": 1,
            "fuelType": "WIND",
            "generation": None,
        }
    )

    assert row.generation is None
    assert row.settlement_date == date(2026, 1, 14)


@pytest.mark.parametrize("period", [0, 51])
def test_settlement_periods_outside_1_to_50_are_rejected(period: int) -> None:
    with pytest.raises(ValidationError):
        FuelGenerationRow.model_validate(
            {
                "publishTime": "2026-01-14T00:30:00Z",
                "startTime": "2026-01-14T00:00:00Z",
                "settlementDate": "2026-01-14",
                "settlementPeriod": period,
                "fuelType": "WIND",
                "generation": 100,
            }
        )
