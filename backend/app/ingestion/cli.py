"""Ingestion command line.

uv run python -m app.ingestion backfill                     # both datasets, default window
uv run python -m app.ingestion backfill --dataset forecasts --start 2026-01-01 --end 2026-01-07
uv run python -m app.ingestion probe --day 2026-01-14       # what does Elexon publish?
uv run python -m app.ingestion doctor                       # is the database ready?
uv run python -m app.ingestion local-db                     # use the Postgres you already run
"""

import asyncio
import getpass
import itertools
import json
from collections import Counter
from contextlib import AbstractAsyncContextManager
from datetime import date, datetime
from enum import StrEnum
from pathlib import Path
from statistics import mean
from typing import Annotated, Any, cast

import psycopg
import typer
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from psycopg import sql
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.core.db import get_engine, get_sessionmaker
from app.core.logging import configure_logging
from app.db.models import ActualGeneration, IngestionRun, WindForecast
from app.ingestion.jobs import Dataset, ElexonSource, run_ingestion
from app.integrations.elexon import ElexonClient, FuelGenerationRow, WindForecastRow

cli = typer.Typer(
    help="Load Elexon wind data into the database.", no_args_is_help=True, add_completion=False
)


class DatasetChoice(StrEnum):
    all = "all"
    actuals = "actuals"
    forecasts = "forecasts"


@cli.callback()
def _configure() -> None:
    try:
        settings = get_settings()
    except ValidationError:  # no DATABASE_URL yet: `local-db` is about to write it
        configure_logging("INFO", json_logs=False)
        return
    configure_logging(settings.log_level, json_logs=settings.log_json)


@cli.command()
def backfill(
    dataset: Annotated[DatasetChoice, typer.Option(help="Which dataset to load.")] = (
        DatasetChoice.all
    ),
    start: Annotated[
        datetime | None,
        typer.Option(formats=["%Y-%m-%d"], help="First day, UTC (default: INGEST_START)."),
    ] = None,
    end: Annotated[
        datetime | None,
        typer.Option(formats=["%Y-%m-%d"], help="Last day, included (default: INGEST_END)."),
    ] = None,
) -> None:
    """Fetch the window from Elexon and upsert it. Safe to run again."""
    _database_url()
    settings = get_settings()
    first = start.date() if start else settings.ingest_start
    last = end.date() if end else settings.ingest_end
    datasets: list[Dataset] = (
        ["actuals", "forecasts"] if dataset is DatasetChoice.all else [cast(Dataset, dataset.value)]
    )

    def open_source() -> AbstractAsyncContextManager[ElexonSource]:
        return ElexonClient.connect(
            settings.elexon_base_url,
            timeout_s=settings.elexon_timeout_s,
            max_concurrency=settings.elexon_max_concurrency,
        )

    with get_sessionmaker()() as session:
        for name in datasets:
            result = run_ingestion(session, open_source, name, first, last)
            typer.echo(
                f"{result.dataset}: {result.days} days, {result.rows_fetched} rows fetched, "
                f"{result.rows_skipped} skipped, {result.rows_upserted} inserted or changed"
            )


@cli.command()
def probe(
    day: Annotated[datetime, typer.Option(formats=["%Y-%m-%d"], help="UTC day to inspect.")],
    save_to: Annotated[
        Path | None, typer.Option(help="Also write the raw JSON responses into this folder.")
    ] = None,
) -> None:
    """Show what Elexon publishes for one day: the forecast runs, their horizon, the actuals."""
    settings = get_settings()
    the_day = day.date()
    forecasts_raw, actuals_raw = asyncio.run(_probe(settings.elexon_base_url, the_day))
    if save_to:
        save_to.mkdir(parents=True, exist_ok=True)
        for name, rows in (("windfor", forecasts_raw), ("fuelhh_wind", actuals_raw)):
            target = save_to / f"{name}_{the_day.isoformat()}.json"
            target.write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")
            typer.echo(f"saved {target}")
    _print_forecast_runs(the_day, [WindForecastRow.model_validate(r) for r in forecasts_raw])
    _print_actuals(the_day, [FuelGenerationRow.model_validate(r) for r in actuals_raw])


async def _probe(base_url: str, day: date) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    async with ElexonClient.connect(base_url) as client:
        return await asyncio.gather(client.wind_forecasts_raw(day), client.wind_actuals_raw(day))


def _hours(seconds: float) -> float:
    return round(seconds / 3600, 2)


def _print_forecast_runs(day: date, rows: list[WindForecastRow]) -> None:
    typer.echo(f"\nWINDFOR runs published on {day} (UTC): {len(rows)} values")
    runs: dict[datetime, list[WindForecastRow]] = {}
    for row in rows:
        runs.setdefault(row.publish_time, []).append(row)
    typer.echo(
        f"{'published':<18}{'values':>7}  {'first target':<18}{'last target':<18}"
        f"{'step (h)':>9}{'lead (h)':>14}"
    )
    for published, values in sorted(runs.items()):
        starts = sorted(v.start_time for v in values)
        steps = Counter(_hours((b - a).total_seconds()) for a, b in itertools.pairwise(starts))
        step = steps.most_common(1)[0][0] if steps else "-"
        leads = [_hours((s - published).total_seconds()) for s in starts]
        typer.echo(
            f"{published:%Y-%m-%d %H:%M}  {len(values):>7}  {starts[0]:%Y-%m-%d %H:%M}  "
            f"{starts[-1]:%Y-%m-%d %H:%M}  {step!s:>8}{f'{min(leads)} to {max(leads)}':>14}"
        )


def _print_actuals(day: date, rows: list[FuelGenerationRow]) -> None:
    wind = sorted((r for r in rows if r.fuel_type == "WIND"), key=lambda r: r.start_time)
    typer.echo(f"\nFUELHH WIND for settlement day {day}: {len(wind)} half-hours (expect 48)")
    if not wind:
        return
    values = [r.generation for r in wind if r.generation is not None]
    periods = sorted(r.settlement_period for r in wind)
    typer.echo(
        f"  start times {wind[0].start_time:%Y-%m-%d %H:%M} "
        f"to {wind[-1].start_time:%Y-%m-%d %H:%M} UTC"
    )
    typer.echo(
        f"  settlement periods {periods[0]} to {periods[-1]}, "
        f"null values: {len(wind) - len(values)}"
    )
    if values:
        typer.echo(
            f"  generation MW: min {min(values)}, mean {mean(values):.0f}, max {max(values)}"
        )


BACKEND_DIR = Path(__file__).resolve().parents[2]


def _ok(message: str) -> None:
    typer.echo(f"  ✓ {message}")


def _problem(message: str, fix: str) -> None:
    typer.echo(f"  ✗ {message}\n      → {fix}")


def _database_url() -> str:
    """The configured database URL, or a clear message and exit code 1."""
    url = get_settings().database_url
    if url is None:
        _problem("DATABASE_URL is not set", "run `make setup`, or export DATABASE_URL")
        raise typer.Exit(1)
    return url


@cli.command()
def doctor() -> None:
    """Check the database: can we connect, are the tables there, is there data?"""
    url = make_url(_database_url())
    typer.echo(f"Database {url.render_as_string(hide_password=True)}")
    try:
        with get_engine().connect() as connection:
            current = MigrationContext.configure(connection).get_current_revision()
    except SQLAlchemyError as exc:
        reason = str(getattr(exc, "orig", exc)).strip().splitlines()[0]
        fix = "start it with `make db` (Docker), or `make local-db` to use your own Postgres"
        if "does not exist" in reason:
            fix = "a different Postgres answered: run `make local-db` to set it up for this app"
        _problem(f"cannot connect: {reason}", fix)
        raise typer.Exit(1) from None
    _ok("connected")

    head = ScriptDirectory.from_config(Config(str(BACKEND_DIR / "alembic.ini"))).get_current_head()
    if current != head:
        _problem(f"schema is at revision {current or 'none'}, code expects {head}", "make migrate")
        raise typer.Exit(1)
    _ok(f"schema is up to date (revision {head})")

    with get_sessionmaker()() as session:
        actuals = session.scalar(select(func.count()).select_from(ActualGeneration)) or 0
        forecasts = session.scalar(select(func.count()).select_from(WindForecast)) or 0
        last_run = session.scalars(
            select(IngestionRun).order_by(IngestionRun.started_at.desc()).limit(1)
        ).first()
    if not actuals or not forecasts:
        _problem(
            f"no data yet ({actuals} actual half-hours, {forecasts} forecast values)",
            "make ingest  (fetches 29 Dec 2025 to 2 Feb 2026 from Elexon, about a minute)",
        )
        raise typer.Exit(1)
    _ok(f"{actuals:,} actual half-hours and {forecasts:,} forecast values")
    if last_run is not None and last_run.status != "succeeded":
        _problem(
            f"the last ingestion ({last_run.dataset}) {last_run.status}: {last_run.error or ''}",
            "run `make ingest` again; it is safe to repeat",
        )
        raise typer.Exit(1)


DATABASES = ("wind", "wind_test")


def _set_env(path: Path, values: dict[str, str]) -> None:
    """Set KEY=value lines in a .env file, keeping every other line as it is."""
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    pending = dict(values)
    for i, line in enumerate(lines):
        key = line.split("=", 1)[0].strip()
        if key in pending:
            lines[i] = f"{key}={pending.pop(key)}"
    lines += [f"{key}={value}" for key, value in pending.items()]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


@cli.command("local-db")
def local_db(
    server: Annotated[
        str | None,
        typer.Option(help="Your Postgres server (default: you, on localhost:5432)."),
    ] = None,
) -> None:
    """No Docker? Use the Postgres already on this machine.

    Creates the `wind` and `wind_test` databases if they are missing, and points
    DATABASE_URL and TEST_DATABASE_URL in backend/.env at them.
    """
    url = make_url(server or f"postgresql://{getpass.getuser()}@localhost:5432/postgres")
    admin = url.set(drivername="postgresql", database="postgres")
    typer.echo(f"Postgres at {admin.render_as_string(hide_password=True)}")
    try:
        with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as db:
            existing = {row[0] for row in db.execute("SELECT datname FROM pg_database")}
            for name in DATABASES:
                if name in existing:
                    _ok(f"database {name} already exists")
                else:
                    db.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
                    _ok(f"created database {name}")
    except psycopg.Error as exc:
        _problem(
            f"cannot set up: {str(exc).strip().splitlines()[0]}",
            "is it running? Pass --server postgresql://USER:PASSWORD@HOST:PORT",
        )
        raise typer.Exit(1) from None

    app_url = url.set(drivername="postgresql+psycopg", database="wind")
    _set_env(
        BACKEND_DIR / ".env",
        {
            "DATABASE_URL": app_url.render_as_string(hide_password=False),
            "TEST_DATABASE_URL": app_url.set(database="wind_test").render_as_string(
                hide_password=False
            ),
        },
    )
    _ok("backend/.env now points at them")
    typer.echo("\nNext: make migrate && make ingest && make dev")
