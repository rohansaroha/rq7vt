"""One delivery day as the buyer saw it: totals, the worst shortfall, the likely range."""

import math
from dataclasses import dataclass
from datetime import datetime

import numpy as np
import pandas as pd

from app.domain.calendar import uk_hours

HALF_HOUR_H = 0.5
LIKELY_RANGE = (0.1, 0.9)  # an 80% range


@dataclass(frozen=True, slots=True)
class Shortfall:
    start_time: datetime
    error_mw: float


@dataclass(frozen=True, slots=True)
class DayTotals:
    hours: int
    hours_scored: int
    forecast_energy_mwh: float | None
    actual_energy_mwh: float | None
    mae_mw: float | None
    bias_mw: float | None
    worst_shortfall: Shortfall | None


def day_totals(scored_day: pd.DataFrame, half_hours: pd.DataFrame) -> DayTotals:
    """Totals for one delivery day.

    `scored_day` holds the day's hourly rows (forecast, actual, error); `half_hours`
    the day's metered half-hours, which give the actual energy at full resolution.
    Energy is MW x hours: each forecast value covers an hour, each actual a half-hour.
    """
    forecasts = scored_day["forecast_mw"].dropna()
    errors = scored_day["error_mw"].to_numpy(dtype=np.float64)
    scored = errors[~np.isnan(errors)]
    worst = None
    if scored.size and np.nanmax(errors) > 0:
        i = int(np.nanargmax(errors))
        start = pd.Timestamp(scored_day["start_time"].iloc[i])
        worst = Shortfall(start.to_pydatetime(), float(errors[i]))
    return DayTotals(
        hours=len(scored_day),
        hours_scored=int(scored.size),
        forecast_energy_mwh=float(forecasts.sum()) if len(forecasts) else None,
        actual_energy_mwh=(
            float(half_hours["generation_mw"].sum()) * HALF_HOUR_H if len(half_hours) else None
        ),
        mae_mw=float(np.mean(np.abs(scored))) if scored.size else None,
        bias_mw=float(np.mean(scored)) if scored.size else None,
        worst_shortfall=worst,
    )


def error_bands(
    scored: pd.DataFrame, quantiles: tuple[float, float] = LIKELY_RANGE
) -> dict[int, tuple[float, float]]:
    """The low and high error percentiles for each UK hour of day.

    For gate scoring each hour of day has a fixed lead time, so this is the spread of
    errors at that lead time across the whole analysis window.
    """
    valid = scored.loc[scored["error_mw"].notna()]
    hours = pd.Series(uk_hours(valid["start_time"]), index=valid.index)
    low, high = quantiles
    bands = {}
    for hour, errors in valid["error_mw"].groupby(hours):
        bands[int(hour)] = (float(errors.quantile(low)), float(errors.quantile(high)))
    return bands


def likely_range(
    forecast_mw: float | None, band: tuple[float, float] | None
) -> tuple[float | None, float | None]:
    """Where the actual is likely to land, given the forecast and the error band.

    error = forecast - actual, so actual = forecast - error: the range for the actual
    is [forecast - high, forecast - low], floored at zero (output is never negative).
    """
    if band is None or forecast_mw is None or math.isnan(forecast_mw):
        return None, None
    low, high = band
    return max(0.0, forecast_mw - high), max(0.0, forecast_mw - low)
