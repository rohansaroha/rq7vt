"""Helpers shared by the services: loading and scoring a window of data, converting values."""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any

import pandas as pd

from app.core.config import Settings
from app.core.errors import OutOfRangeError
from app.domain.calendar import delivery_hours, delivery_window
from app.domain.correction import Correction, apply_corrections, corrections, history_start
from app.domain.day import DayTotals
from app.domain.scoring import attach_actuals
from app.domain.selection import gate_requests, select_latest
from app.schemas.common import Period
from app.schemas.forecasts import Shortfall
from app.services.readers import ActualsReader, ForecastReader


@dataclass(frozen=True, slots=True)
class MarketData:
    """Everything the analysis needs for a window of delivery days."""

    hours: pd.DatetimeIndex  # every delivery hour of the window, UTC
    forecasts: pd.DataFrame  # every run's value for those hours
    actuals: pd.DataFrame  # metered half-hours in the window


def load_market_data(
    forecasts: ForecastReader, actuals: ActualsReader, first_day: date, last_day: date
) -> MarketData:
    start, end = delivery_window(first_day, last_day)
    return MarketData(
        hours=delivery_hours(first_day, last_day),
        forecasts=forecasts.frame(start, end),
        actuals=actuals.frame(start, end),
    )


def within(frame: pd.DataFrame, start: object, end: object) -> pd.DataFrame:
    """Rows whose start_time is in [start, end)."""
    rows = frame.loc[(frame["start_time"] >= start) & (frame["start_time"] < end)]
    return rows.reset_index(drop=True)


def days_between(first_day: date, last_day: date) -> list[date]:
    """Every day from `first_day` to `last_day`, both included."""
    return [first_day + timedelta(days=n) for n in range((last_day - first_day).days + 1)]


@dataclass(frozen=True, slots=True)
class GateScores:
    """The analysis period scored at one gate, with the corrected forecast alongside."""

    scored: pd.DataFrame  # hourly: forecast, actual, error, corrected_mw, corrected_error_mw
    actuals: pd.DataFrame  # the period's metered half-hours
    corrections: dict[date, Correction]  # by delivery day; missing where history was short


def score_at_gate(
    forecasts: ForecastReader, actuals: ActualsReader, settings: Settings, gate: time
) -> GateScores:
    """Score every hour of the analysis period with the run available at `gate`.

    Each day's correction learns from the same gate's forecasts on the days known by
    then, so the four weeks before the period are loaded and scored too (ADR 0007).
    Only the period itself is returned.
    """
    first, last = settings.analysis_start, settings.analysis_end
    data = load_market_data(forecasts, actuals, history_start(first), last)
    scored = attach_actuals(
        select_latest(data.forecasts, gate_requests(data.hours, gate)), data.actuals
    )
    by_day = corrections(scored, days_between(first, last))
    start, end = delivery_window(first, last)
    return GateScores(
        scored=within(apply_corrections(scored, by_day), start, end),
        actuals=within(data.actuals, start, end),
        corrections=by_day,
    )


def analysis_period(settings: Settings) -> Period:
    start, end = delivery_window(settings.analysis_start, settings.analysis_end)
    return Period(
        first_day=settings.analysis_start,
        last_day=settings.analysis_end,
        starts_at=start,
        ends_at=end,
    )


def check_in_period(day: date, settings: Settings) -> None:
    if not settings.analysis_start <= day <= settings.analysis_end:
        raise OutOfRangeError(
            f"{day} is outside the analysis period. Pick a delivery day from "
            f"{settings.analysis_start} to {settings.analysis_end}."
        )


def shortfall(totals: DayTotals) -> Shortfall | None:
    """The day's worst shortfall as the API reports it."""
    worst = totals.worst_shortfall
    return Shortfall(start_time=worst.start_time, error_mw=worst.error_mw) if worst else None


def optional_float(value: Any) -> float | None:
    """A float, or None where the frame holds NaN (missing)."""
    return None if value is None or pd.isna(value) else float(value)


def optional_instant(value: Any) -> datetime | None:
    """A UTC datetime, or None for NaT."""
    if value is None or pd.isna(value):
        return None
    return pd.Timestamp(value).to_pydatetime()


def as_instant(value: Any) -> datetime:
    result = optional_instant(value)
    if result is None:
        raise ValueError("expected a timestamp")
    return result


def as_float(value: Any) -> float:
    result = optional_float(value)
    if result is None:
        raise ValueError("expected a number")
    return result
