from datetime import UTC, date, datetime

import pandas as pd
import pytest
from sqlalchemy.orm import Session

from app.repositories.actuals import ActualRow, ActualsRepository
from app.repositories.forecasts import ForecastRepository, ForecastRow
from app.repositories.ingestion_runs import IngestionRunRepository

pytestmark = pytest.mark.integration

RUN_A = datetime(2026, 1, 13, 8, 30, tzinfo=UTC)
RUN_B = datetime(2026, 1, 13, 10, 30, tzinfo=UTC)


def at(hour: int, day: int = 13, minute: int = 0) -> datetime:
    return datetime(2026, 1, day, hour, minute, tzinfo=UTC)


def forecast_rows() -> list[ForecastRow]:
    return [
        {"start_time": at(22), "publish_time": RUN_A, "generation_mw": 9000},
        {"start_time": at(23), "publish_time": RUN_A, "generation_mw": 9100},
        {"start_time": at(23), "publish_time": RUN_B, "generation_mw": 9300},
        {"start_time": at(0, day=14), "publish_time": RUN_B, "generation_mw": 9400},
    ]


def actual_row(start: datetime, mw: int, fuel: str = "WIND") -> ActualRow:
    return {
        "fuel_type": fuel,
        "start_time": start,
        "settlement_date": start.date(),
        "settlement_period": 2 * start.hour + start.minute // 30 + 1,
        "generation_mw": mw,
        "publish_time": start,
    }


def test_the_forecast_frame_holds_every_run_for_hours_in_the_window(session: Session) -> None:
    repo = ForecastRepository(session)
    repo.upsert(forecast_rows())
    session.commit()

    frame = repo.frame(at(23), at(0, day=14))  # [23:00, 00:00): one hour, two runs

    assert frame["start_time"].tolist() == [pd.Timestamp(at(23))] * 2
    assert frame["publish_time"].tolist() == [pd.Timestamp(RUN_A), pd.Timestamp(RUN_B)]
    assert frame["generation_mw"].tolist() == [9100.0, 9300.0]
    assert str(frame["start_time"].dtype) == "datetime64[us, UTC]"


def test_an_empty_window_still_returns_typed_columns(session: Session) -> None:
    frame = ForecastRepository(session).frame(at(1), at(2))

    assert frame.empty
    assert list(frame.columns) == ["start_time", "publish_time", "generation_mw"]
    assert str(frame["publish_time"].dtype) == "datetime64[us, UTC]"


def test_the_actuals_frame_keeps_wind_in_the_window(session: Session) -> None:
    repo = ActualsRepository(session)
    repo.upsert(
        [
            actual_row(at(22, minute=30), 7000),
            actual_row(at(23), 7100),
            actual_row(at(23, minute=30), 7200),
            actual_row(at(23), 15000, fuel="CCGT"),
        ]
    )
    session.commit()

    frame = repo.frame(at(23), at(0, day=14))

    assert frame["start_time"].tolist() == [pd.Timestamp(at(23)), pd.Timestamp(at(23, minute=30))]
    assert frame["generation_mw"].tolist() == [7100.0, 7200.0]


def test_coverage_describes_each_table(session: Session) -> None:
    ForecastRepository(session).upsert(forecast_rows())
    ActualsRepository(session).upsert([actual_row(at(23), 7100), actual_row(at(23, minute=30), 1)])
    session.commit()

    forecasts = ForecastRepository(session).coverage()
    actuals = ActualsRepository(session).coverage()

    assert (forecasts.rows, forecasts.runs) == (4, 2)
    assert forecasts.first_start_time == at(22)
    assert forecasts.last_start_time == at(0, day=14)
    assert forecasts.last_ingested_at is not None
    assert (actuals.rows, actuals.first_start_time) == (2, at(23))


def test_an_empty_table_has_no_coverage(session: Session) -> None:
    coverage = ActualsRepository(session).coverage()

    assert (coverage.rows, coverage.first_start_time, coverage.last_ingested_at) == (0, None, None)


def test_last_success_ignores_failed_and_running_jobs(session: Session) -> None:
    runs = IngestionRunRepository(session)
    ok = runs.start("actuals", date(2026, 1, 1), date(2026, 1, 2))
    runs.finish(ok, status="succeeded")
    failed = runs.start("actuals", date(2026, 1, 1), date(2026, 1, 2))
    runs.finish(failed, status="failed", error="boom")
    runs.start("actuals", date(2026, 1, 1), date(2026, 1, 2))
    session.commit()

    assert runs.last_success_at("actuals") == ok.finished_at
    assert runs.last_success_at("forecasts") is None
