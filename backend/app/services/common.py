"""Helpers shared by the services: loading a window of data, and converting values."""

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

import pandas as pd

from app.core.config import Settings
from app.core.errors import OutOfRangeError
from app.domain.calendar import delivery_hours, delivery_window
from app.schemas.common import Period
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
