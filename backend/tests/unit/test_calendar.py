from datetime import UTC, date, datetime, time

import pandas as pd
import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.domain.calendar import (
    delivery_days,
    delivery_hours,
    delivery_start,
    delivery_window,
    gate_closure,
    uk_hours,
)


def utc(*parts: int) -> datetime:
    return datetime(*parts, tzinfo=UTC)


def test_a_winter_delivery_day_runs_from_23_00_the_evening_before() -> None:
    hours = delivery_hours(date(2026, 1, 14))

    assert len(hours) == 24
    assert hours[0] == pd.Timestamp("2026-01-13T23:00Z")
    assert hours[-1] == pd.Timestamp("2026-01-14T22:00Z")


@pytest.mark.parametrize(
    ("day", "hours"),
    [(date(2026, 3, 29), 23), (date(2026, 10, 25), 25), (date(2026, 7, 1), 24)],
)
def test_clock_changes_give_23_and_25_hour_days(day: date, hours: int) -> None:
    assert len(delivery_hours(day)) == hours


def test_a_summer_day_starts_at_22_00_utc() -> None:
    assert delivery_start(date(2026, 7, 1)) == utc(2026, 6, 30, 22)


def test_the_gate_closes_on_the_day_before_in_uk_time() -> None:
    assert gate_closure(date(2026, 1, 14), time(9, 20)) == utc(2026, 1, 13, 9, 20)
    assert gate_closure(date(2026, 7, 1), time(9, 20)) == utc(2026, 6, 30, 8, 20)


def test_times_from_23_00_belong_to_the_next_delivery_day() -> None:
    times = pd.DatetimeIndex(
        ["2026-01-13T22:00Z", "2026-01-13T22:30Z", "2026-01-13T23:00Z", "2026-01-14T22:30Z"]
    )

    assert delivery_days(times) == [
        date(2026, 1, 13),
        date(2026, 1, 13),
        date(2026, 1, 14),
        date(2026, 1, 14),
    ]


def test_a_window_includes_both_end_days() -> None:
    assert delivery_window(date(2026, 1, 2), date(2026, 2, 1)) == (
        utc(2026, 1, 1, 23),
        utc(2026, 2, 1, 23),
    )
    assert len(delivery_hours(date(2026, 1, 2), date(2026, 2, 1))) == 31 * 24


def test_a_reversed_window_is_rejected() -> None:
    with pytest.raises(ValueError, match="before"):
        delivery_window(date(2026, 1, 2), date(2026, 1, 1))


def test_uk_hours_follow_the_local_clock() -> None:
    assert uk_hours(pd.DatetimeIndex(["2026-01-14T09:00Z", "2026-07-01T09:00Z"])) == [9, 10]


@given(st.dates(min_value=date(2000, 1, 2), max_value=date(2100, 12, 31)))
def test_every_hour_of_a_delivery_day_maps_back_to_that_day(day: date) -> None:
    hours = delivery_hours(day)

    assert len(hours) in (23, 24, 25)
    assert hours[0] == delivery_start(day)
    assert set(delivery_days(hours)) == {day}
