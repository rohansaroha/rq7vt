"""Which forecast could the buyer have used? The core rule of the app (ADR 0001).

A *request* asks: for the hour starting at `start_time`, what was the latest forecast
published at or before `cutoff`? The two ways of scoring differ only in the cutoff:

- at the gate:          cutoff = just before the auction's gate closure on the day before
                        delivery (a run published as the gate closes is too late to bid on)
- at a fixed horizon h: cutoff = start_time - h hours

Both go through `select_latest`, so "no lookahead" is enforced in exactly one place.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import time
from typing import assert_never

import pandas as pd

from app.domain.calendar import delivery_days, gate_closure
from app.domain.frames import utc


@dataclass(frozen=True, slots=True)
class AtGate:
    """Score the forecast available when the auction's gate closed (D-1, UK time)."""

    gate: time


@dataclass(frozen=True, slots=True)
class AtHorizon:
    """Score the latest forecast published at least `horizon_h` hours before each hour."""

    horizon_h: int


Selection = AtGate | AtHorizon

# WINDFOR publishes a run at 15:30, the moment the EPEX half-hourly gate closes: a run must
# arrive strictly before the gate to count, so the gate's cutoff is the instant before it.
BEFORE_GATE = pd.Timedelta(microseconds=1)


def gate_requests(hours: pd.DatetimeIndex, gate: time) -> pd.DataFrame:
    """One request per delivery hour, cut off just before its auction's gate (day before)."""
    days = delivery_days(hours)
    closures = {day: gate_closure(day, gate) - BEFORE_GATE for day in set(days)}
    requests = pd.DataFrame({"start_time": utc(pd.Series(hours))})
    requests["cutoff"] = utc(pd.Series([closures[day] for day in days], index=requests.index))
    return requests


def horizon_requests(hours: pd.DatetimeIndex, horizons_h: Iterable[int]) -> pd.DataFrame:
    """One request per (delivery hour, horizon), cut off `horizon_h` hours before the hour."""
    grid = pd.MultiIndex.from_product(
        [hours, list(horizons_h)], names=["start_time", "horizon_h"]
    ).to_frame(index=False)
    grid["start_time"] = utc(grid["start_time"])
    grid["cutoff"] = utc(grid["start_time"] - pd.to_timedelta(grid["horizon_h"], unit="h"))
    return grid


def requests_for(selection: Selection, hours: pd.DatetimeIndex) -> pd.DataFrame:
    match selection:
        case AtGate(gate=gate):
            return gate_requests(hours, gate)
        case AtHorizon(horizon_h=horizon_h):
            return horizon_requests(hours, [horizon_h])
        case _:
            assert_never(selection)


def lead_hours(start_time: pd.Series, publish_time: pd.Series) -> pd.Series:
    """Hours from a run's publication to the start of the hour it forecasts."""
    return (start_time - publish_time).dt.total_seconds() / 3600


def select_latest(forecasts: pd.DataFrame, requests: pd.DataFrame) -> pd.DataFrame:
    """Answer each request with the latest forecast published at or before its cutoff.

    `forecasts` has one row per (start_time, publish_time); only rows for the request's
    own start_time are candidates, so a run that does not cover an hour is never used
    for it. Returns `requests` in their original order plus `publish_time`,
    `forecast_mw` and `lead_h` (hours from publication to the start of the hour).
    Where nothing qualifies these are missing (NaT/NaN): the hour is not covered, and
    is reported as such rather than filled in.
    """
    left = requests.reset_index(drop=True)
    left = left.assign(_order=range(len(left))).sort_values("cutoff", kind="stable")
    right = (
        forecasts.loc[:, ["start_time", "publish_time", "generation_mw"]]
        .rename(columns={"generation_mw": "forecast_mw"})
        .sort_values("publish_time", kind="stable")
    )
    # For each request, the last right row with the same start_time whose publish_time
    # is <= cutoff. merge_asof does this in one sorted pass instead of a loop per hour.
    selected = pd.merge_asof(
        left,
        right,
        left_on="cutoff",
        right_on="publish_time",
        by="start_time",
        direction="backward",
        allow_exact_matches=True,
    )
    selected = selected.sort_values("_order").drop(columns="_order").reset_index(drop=True)
    selected["lead_h"] = lead_hours(selected["start_time"], selected["publish_time"])
    return selected
