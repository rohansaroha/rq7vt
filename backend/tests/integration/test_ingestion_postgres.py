from datetime import date

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.models import ActualGeneration, IngestionRun, WindForecast
from app.ingestion.jobs import run_ingestion
from app.integrations.elexon import WindForecastRow
from tests.factories import FakeSource, actual, forecast, opener

pytestmark = pytest.mark.integration

JAN_14 = date(2026, 1, 14)
JAN_15 = date(2026, 1, 15)


def _forecast_source(value_at_20: int = 11234) -> FakeSource:
    return FakeSource(
        forecasts={
            JAN_14: [
                forecast("2026-01-14T08:30:00Z", "2026-01-14T20:00:00Z", value_at_20),
                forecast("2026-01-14T08:30:00Z", "2026-01-14T21:00:00Z", 11510),
                forecast("2026-01-14T10:30:00Z", "2026-01-14T20:00:00Z", 10990),
            ],
            JAN_15: [forecast("2026-01-15T08:30:00Z", "2026-01-15T20:00:00Z", 8700)],
        }
    )


def _count(session: Session, model: type[Base]) -> int:
    return session.scalar(select(func.count()).select_from(model)) or 0


def test_the_schema_matches_the_models(engine: Engine) -> None:
    with engine.connect() as connection:
        diff = compare_metadata(MigrationContext.configure(connection), Base.metadata)

    assert diff == []


def test_a_forecast_backfill_can_run_twice_without_changes(session: Session) -> None:
    first = run_ingestion(session, opener(_forecast_source()), "forecasts", JAN_14, JAN_15)
    second = run_ingestion(session, opener(_forecast_source()), "forecasts", JAN_14, JAN_15)

    assert first.rows_upserted == 4
    assert second.rows_upserted == 0
    assert _count(session, WindForecast) == 4
    runs = session.scalars(select(IngestionRun).order_by(IngestionRun.id)).all()
    assert [(run.status, run.rows_upserted) for run in runs] == [("succeeded", 4), ("succeeded", 0)]


def test_a_changed_forecast_value_is_updated(session: Session) -> None:
    run_ingestion(session, opener(_forecast_source()), "forecasts", JAN_14, JAN_15)

    rerun = run_ingestion(
        session, opener(_forecast_source(value_at_20=12000)), "forecasts", JAN_14, JAN_15
    )

    assert rerun.rows_upserted == 1
    stored = session.scalar(
        select(WindForecast.generation_mw).where(
            WindForecast.publish_time
            == forecast("2026-01-14T08:30:00Z", "2026-01-14T20:00:00Z", 0).publish_time,
            WindForecast.start_time
            == forecast("2026-01-14T08:30:00Z", "2026-01-14T20:00:00Z", 0).start_time,
        )
    )
    assert stored == 12000


def test_only_a_newer_actual_revision_replaces_the_stored_one(session: Session) -> None:
    start = "2026-01-14T00:00:00Z"
    newer = FakeSource(actuals={JAN_14: [actual(start, 1, 9100, published="2026-01-14T06:00:00Z")]})
    older = FakeSource(actuals={JAN_14: [actual(start, 1, 9000, published="2026-01-14T00:30:00Z")]})

    run_ingestion(session, opener(newer), "actuals", JAN_14, JAN_14)
    stale = run_ingestion(session, opener(older), "actuals", JAN_14, JAN_14)

    assert stale.rows_upserted == 0
    assert session.scalar(select(ActualGeneration.generation_mw)) == 9100


def test_a_failed_run_is_recorded_and_leaves_no_partial_data(session: Session) -> None:
    class BrokenSource(FakeSource):
        async def wind_forecasts(self, published_on: date) -> list[WindForecastRow]:
            raise RuntimeError("Elexon is down")

    with pytest.raises(RuntimeError, match="Elexon is down"):
        run_ingestion(session, opener(BrokenSource()), "forecasts", JAN_14, JAN_15)

    run = session.scalars(select(IngestionRun)).one()
    assert run.status == "failed"
    assert run.error == "RuntimeError: Elexon is down"
    assert run.finished_at is not None
    assert _count(session, WindForecast) == 0
