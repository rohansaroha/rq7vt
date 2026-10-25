"""Delivery days, auction gates and the UK clock.

GB power is traded in UK local time (Europe/London), while the database stores UTC.
This module is the one place that converts between the two, so clock changes are
handled once: a delivery day has 23, 24 or 25 hours.

A day-ahead delivery day D runs from 23:00 UK time on D-1 to 23:00 on D, the
continental day the GB auctions are coupled to (ADR 0006).
"""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pandas as pd

from app.domain.frames import TIME_UNIT

UK = ZoneInfo("Europe/London")
DAY_STARTS = time(23, 0)  # UK time, on the calendar day before the delivery day


def delivery_start(day: date) -> datetime:
    """When delivery day `day` begins (23:00 UK time the evening before), in UTC."""
    return datetime.combine(day - timedelta(days=1), DAY_STARTS, tzinfo=UK).astimezone(UTC)


def delivery_window(first_day: date, last_day: date) -> tuple[datetime, datetime]:
    """[start, end) of the delivery days `first_day`..`last_day` (inclusive), in UTC."""
    if last_day < first_day:
        raise ValueError(f"last_day {last_day} is before first_day {first_day}")
    return delivery_start(first_day), delivery_start(last_day + timedelta(days=1))


def delivery_hours(first_day: date, last_day: date | None = None) -> pd.DatetimeIndex:
    """The start of every delivery hour of `first_day`..`last_day` (inclusive), in UTC."""
    start, end = delivery_window(first_day, first_day if last_day is None else last_day)
    hours = pd.date_range(start, end, freq="h", inclusive="left", name="start_time")
    return hours.as_unit(TIME_UNIT)


def uk_day_window(day: date) -> tuple[datetime, datetime]:
    """[00:00, 24:00) UK time on calendar day `day`, in UTC."""
    start = datetime.combine(day, time(0), tzinfo=UK)
    end = datetime.combine(day + timedelta(days=1), time(0), tzinfo=UK)
    return start.astimezone(UTC), end.astimezone(UTC)


def gate_closure(day: date, gate: time) -> datetime:
    """When bidding for delivery day `day` closes: `gate` UK time on the day before, in UTC."""
    return datetime.combine(day - timedelta(days=1), gate, tzinfo=UK).astimezone(UTC)


def delivery_days(times: pd.Series | pd.DatetimeIndex) -> list[date]:
    """The delivery day each UTC time belongs to. From 23:00 UK, that is the next day."""
    local = pd.DatetimeIndex(times).tz_convert(UK)
    return [ts.date() + timedelta(days=1) if ts.time() >= DAY_STARTS else ts.date() for ts in local]


def uk_hours(times: pd.Series | pd.DatetimeIndex) -> list[int]:
    """The UK clock hour (0-23) of each UTC time."""
    return [int(hour) for hour in pd.DatetimeIndex(times).tz_convert(UK).hour]
