"""A deterministic, realistic-looking stretch of WINDFOR runs and FUELHH actuals.

Runs follow WINDFOR's real schedule in January 2026: eight a day (02:30, 04:30, 07:30,
09:30, 11:30, 15:30, 18:30, 22:30 UTC), and every run published on day X covers the same
73 hours, 21:00 on X-1 to 21:00 on X+2. Forecast error has a bias and a spread that both grow with
lead time, so tests can check that the app recovers that structure. Times are UTC; in
January UK time is UTC, which keeps the expected values easy to read.
"""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta

import numpy as np
import pandas as pd

from app.domain.frames import actual_frame, forecast_frame

RUN_TIMES = tuple(time(h, 30) for h in (2, 4, 7, 9, 11, 15, 18, 22))  # 02:30, 04:30, 07:30, ...
EPOCH = datetime(2025, 12, 1, tzinfo=UTC)


@dataclass(frozen=True)
class World:
    forecasts: pd.DataFrame
    actuals: pd.DataFrame


def _level(times: pd.DatetimeIndex) -> np.ndarray:
    """The 'true' national wind output: a weather cycle of a few days plus a daily wiggle."""
    hours = np.asarray((times - EPOCH) / pd.Timedelta(hours=1), dtype=np.float64)
    return 9000 + 4500 * np.sin(2 * np.pi * hours / 130) + 1200 * np.sin(2 * np.pi * hours / 24)


def build_world(
    first_day: date = date(2025, 12, 29), last_day: date = date(2026, 2, 2), seed: int = 7
) -> World:
    rng = np.random.default_rng(seed)
    start = datetime.combine(first_day, time(0), tzinfo=UTC)
    end = datetime.combine(last_day + timedelta(days=1), time(0), tzinfo=UTC)

    half_hours = pd.date_range(start, end, freq="30min", inclusive="left")
    actual = _level(half_hours) + rng.normal(0, 150, len(half_hours))
    actuals = actual_frame(zip(half_hours, np.round(actual), strict=True))

    rows: list[tuple[datetime, datetime, float]] = []
    day = first_day
    while day <= last_day:
        for run_time in RUN_TIMES:
            published = datetime.combine(day, run_time, tzinfo=UTC)
            covers = pd.date_range(
                datetime.combine(day - timedelta(days=1), time(21), tzinfo=UTC),
                datetime.combine(day + timedelta(days=2), time(21), tzinfo=UTC),
                freq="h",
            )
            lead = np.asarray((covers - published) / pd.Timedelta(hours=1), dtype=np.float64)
            error = 80 + 12 * lead + rng.normal(0, 1, len(covers)) * (250 + 30 * np.abs(lead))
            values = np.clip(np.round(_level(covers) + error), 0, None)
            rows.extend(
                (t.to_pydatetime(), published, float(v))
                for t, v in zip(covers, values, strict=True)
            )
        day += timedelta(days=1)
    return World(forecasts=forecast_frame(rows), actuals=actuals)
