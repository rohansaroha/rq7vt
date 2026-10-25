"""Ingestion jobs: fetch a window from Elexon, clean it, upsert it, record the run.

The fetch half is async (dozens of network calls in parallel); the database half is
plain synchronous SQLAlchemy. `run_ingestion` glues them together for the CLI.
"""

import asyncio
from collections.abc import Awaitable, Callable, Sequence
from contextlib import AbstractAsyncContextManager
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta
from typing import Literal, Protocol

import structlog
from sqlalchemy.orm import Session

from app.integrations.elexon.dto import FuelGenerationRow, WindForecastRow
from app.repositories.actuals import ActualRow, ActualsRepository
from app.repositories.forecasts import ForecastRepository, ForecastRow
from app.repositories.ingestion_runs import IngestionRunRepository

log = structlog.get_logger(__name__)

Dataset = Literal["actuals", "forecasts"]
WIND = "WIND"


class ElexonSource(Protocol):
    """What ingestion needs from Elexon. The real client and test fakes both fit."""

    async def wind_forecasts(self, published_on: date) -> list[WindForecastRow]: ...

    async def wind_actuals(self, settlement_date: date) -> list[FuelGenerationRow]: ...


SourceFactory = Callable[[], AbstractAsyncContextManager[ElexonSource]]


@dataclass(frozen=True)
class Fetched[T]:
    rows: list[T]
    fetched: int  # rows Elexon returned
    skipped: int  # null values and duplicates dropped


@dataclass(frozen=True)
class IngestionResult:
    dataset: Dataset
    days: int
    rows_fetched: int
    rows_skipped: int
    rows_upserted: int


def iter_days(start: date, end: date) -> list[date]:
    """Every day from start to end, both included."""
    if end < start:
        raise ValueError(f"end ({end}) is before start ({start})")
    return [start + timedelta(days=offset) for offset in range((end - start).days + 1)]


async def fetch_forecasts(source: ElexonSource, days: Sequence[date]) -> Fetched[ForecastRow]:
    """All WINDFOR runs published on these days, minus nulls and duplicate keys.

    Duplicates must go before the upsert: Postgres refuses to update the same row twice
    in one INSERT ... ON CONFLICT statement.
    """
    batches = await asyncio.gather(*(source.wind_forecasts(day) for day in days))
    raw = [row for batch in batches for row in batch]
    unique: dict[tuple[datetime, datetime], ForecastRow] = {}
    for row in raw:
        if row.generation is None:
            continue
        unique[(row.start_time, row.publish_time)] = ForecastRow(
            start_time=row.start_time, publish_time=row.publish_time, generation_mw=row.generation
        )
    rows = sorted(unique.values(), key=lambda r: (r["publish_time"], r["start_time"]))
    return Fetched(rows=rows, fetched=len(raw), skipped=len(raw) - len(rows))


async def fetch_actuals(source: ElexonSource, days: Sequence[date]) -> Fetched[ActualRow]:
    """FUELHH wind half-hours for these settlement days; the newest revision of each wins."""
    batches = await asyncio.gather(*(source.wind_actuals(day) for day in days))
    raw = [row for batch in batches for row in batch]
    latest: dict[datetime, ActualRow] = {}
    for row in raw:
        if row.fuel_type != WIND or row.generation is None:
            continue
        current = latest.get(row.start_time)
        if current is None or row.publish_time > current["publish_time"]:
            latest[row.start_time] = ActualRow(
                fuel_type=WIND,
                start_time=row.start_time,
                settlement_date=row.settlement_date,
                settlement_period=row.settlement_period,
                generation_mw=row.generation,
                publish_time=row.publish_time,
            )
    rows = sorted(latest.values(), key=lambda r: r["start_time"])
    return Fetched(rows=rows, fetched=len(raw), skipped=len(raw) - len(rows))


async def _fetch[T](
    open_source: SourceFactory,
    fetcher: Callable[[ElexonSource, Sequence[date]], Awaitable[Fetched[T]]],
    days: Sequence[date],
) -> Fetched[T]:
    async with open_source() as source:
        return await fetcher(source, days)


def run_ingestion(
    session: Session, open_source: SourceFactory, dataset: Dataset, start: date, end: date
) -> IngestionResult:
    """Fetch [start, end] from Elexon and upsert it, recording the run in ingestion_run.

    Safe to re-run: upserts are idempotent, and a failed run is rolled back, recorded
    as failed and re-raised, so the next run simply starts again.
    """
    days = iter_days(start, end)
    runs = IngestionRunRepository(session)
    run = runs.start(dataset, start, end)
    session.commit()  # the audit row survives even if the job fails below
    log.info("ingestion_started", dataset=dataset, start=str(start), end=str(end), days=len(days))
    try:
        if dataset == "forecasts":
            forecasts = asyncio.run(_fetch(open_source, fetch_forecasts, days))
            fetched, skipped = forecasts.fetched, forecasts.skipped
            changed = ForecastRepository(session).upsert(forecasts.rows)
        else:
            actuals = asyncio.run(_fetch(open_source, fetch_actuals, days))
            fetched, skipped = actuals.fetched, actuals.skipped
            changed = ActualsRepository(session).upsert(actuals.rows)
        runs.finish(
            run,
            status="succeeded",
            rows_fetched=fetched,
            rows_skipped=skipped,
            rows_upserted=changed,
        )
        session.commit()
    except Exception as exc:
        session.rollback()
        runs.finish(run, status="failed", error=f"{type(exc).__name__}: {exc}"[:2000])
        session.commit()
        log.exception("ingestion_failed", dataset=dataset)
        raise
    result = IngestionResult(
        dataset=dataset,
        days=len(days),
        rows_fetched=fetched,
        rows_skipped=skipped,
        rows_upserted=changed,
    )
    log.info("ingestion_finished", **asdict(result))
    return result
