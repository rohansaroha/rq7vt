"""A corrected forecast: the published one, scaled by how the wind compared with it lately.

In January 2026 WINDFOR ran high: at the 09:20 gate the forecast was 1.7 GW above metered
output on average. A buyer can learn that lean from history they already have. For
delivery day D, every hour's forecast is multiplied by

    factor(D) = sum of actuals / sum of forecasts, over delivery days D-29 to D-2

using the forecasts the same gate selected on those days (ADR 0007). Day D-2 is the last
day fully metered when the bid for D is made on D-1, so the correction never sees the
future. With fewer than a week of known days there is no correction: the factor is 1 and
the corrected forecast is the published one.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

import pandas as pd

from app.domain.calendar import delivery_days

ForecastKind = Literal["published", "corrected"]

WINDOW_DAYS = 28
KNOWN_BY_DAYS = 2  # bidding for D happens on D-1, when D-2 is the last fully metered day
MIN_DAYS = 7


@dataclass(frozen=True, slots=True)
class Correction:
    """The factor applied to one delivery day, and the days it was learned from."""

    factor: float
    trained_from: date
    trained_to: date
    days: int


def history_start(first_day: date) -> date:
    """The earliest delivery day the correction for `first_day` learns from."""
    return first_day - timedelta(days=WINDOW_DAYS + KNOWN_BY_DAYS - 1)


def daily_totals(scored: pd.DataFrame) -> pd.DataFrame:
    """Forecast and actual summed per delivery day, over the hours that have both."""
    both = scored.loc[scored["forecast_mw"].notna() & scored["actual_mw"].notna()]
    days = pd.Series(delivery_days(both["start_time"]), index=both.index, name="day")
    return both.groupby(days)[["forecast_mw", "actual_mw"]].sum()


def corrections(scored: pd.DataFrame, days: Iterable[date]) -> dict[date, Correction]:
    """The correction for each of `days`, learned from gate-scored rows of earlier days.

    `scored` holds the gate's hourly rows (forecast_mw, actual_mw) from far enough back:
    see `history_start`. Days without enough history get no entry.
    """
    totals = daily_totals(scored)
    result: dict[date, Correction] = {}
    for day in days:
        first = history_start(day)
        last = day - timedelta(days=KNOWN_BY_DAYS)
        window = totals.loc[[first <= known <= last for known in totals.index]]
        forecast = float(window["forecast_mw"].sum())
        if len(window) < MIN_DAYS or forecast <= 0:
            continue
        result[day] = Correction(
            factor=float(window["actual_mw"].sum()) / forecast,
            trained_from=min(window.index),
            trained_to=max(window.index),
            days=len(window),
        )
    return result


def apply_corrections(scored: pd.DataFrame, by_day: dict[date, Correction]) -> pd.DataFrame:
    """Add `corrected_mw` (forecast x its day's factor) and `corrected_error_mw`.

    A day without a correction keeps its published forecast (factor 1), so the corrected
    forecast covers exactly the hours the published one does.
    """
    factor = {day: correction.factor for day, correction in by_day.items()}
    factors = [factor.get(day, 1.0) for day in delivery_days(scored["start_time"])]
    out = scored.copy()
    out["corrected_mw"] = scored["forecast_mw"] * pd.Series(factors, index=scored.index)
    out["corrected_error_mw"] = out["corrected_mw"] - scored["actual_mw"]
    return out


def as_corrected(scored: pd.DataFrame) -> pd.DataFrame:
    """The same rows with the corrected forecast in place of the published one.

    Everything downstream (day totals, metrics, buffers) then scores the corrected
    forecast without knowing it is corrected.
    """
    return scored.assign(forecast_mw=scored["corrected_mw"], error_mw=scored["corrected_error_mw"])
