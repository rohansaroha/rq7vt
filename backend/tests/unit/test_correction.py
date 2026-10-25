"""The corrected forecast: published x (actual / forecast) over the four weeks known at the gate."""

from datetime import UTC, date, datetime, time, timedelta

import numpy as np
import pandas as pd
import pytest

from app.domain.correction import (
    MIN_DAYS,
    apply_corrections,
    as_corrected,
    corrections,
    daily_totals,
    history_start,
)

DAY = date(2026, 1, 20)


def scored_days(values: dict[date, tuple[float, float]], hours: int = 2) -> pd.DataFrame:
    """Gate-scored rows: `hours` hours per delivery day, each with (forecast, actual) MW.

    In January UK time is UTC, so noon on day X belongs to delivery day X."""
    rows = [
        (datetime.combine(day, time(12 + h), tzinfo=UTC), forecast, actual)
        for day, (forecast, actual) in values.items()
        for h in range(hours)
    ]
    frame = pd.DataFrame(rows, columns=["start_time", "forecast_mw", "actual_mw"])
    frame["start_time"] = pd.to_datetime(frame["start_time"], utc=True)
    frame["error_mw"] = frame["forecast_mw"] - frame["actual_mw"]
    return frame


def history(
    first: date, last: date, forecast: float, actual: float
) -> dict[date, tuple[float, float]]:
    days = (last - first).days + 1
    return {first + timedelta(days=n): (forecast, actual) for n in range(days)}


def test_the_history_for_2_january_starts_on_4_december() -> None:
    assert history_start(date(2026, 1, 2)) == date(2025, 12, 4)


def test_the_factor_is_actual_over_forecast_on_the_28_days_known_at_the_gate() -> None:
    values = history(date(2025, 12, 22), date(2026, 1, 18), forecast=10_000, actual=8_000)

    correction = corrections(scored_days(values), [DAY])[DAY]

    assert correction.factor == pytest.approx(0.8)
    assert (correction.trained_from, correction.trained_to) == (
        date(2025, 12, 22),
        DAY - timedelta(2),
    )
    assert correction.days == 28


def test_days_outside_the_window_are_ignored() -> None:
    values = history(date(2025, 12, 22), date(2026, 1, 18), forecast=10_000, actual=8_000)
    values[date(2025, 12, 21)] = (10_000, 1)  # 30 days before: too old
    values[DAY - timedelta(days=1)] = (10_000, 1)  # D-1: not fully metered at the gate
    values[DAY] = (10_000, 1)  # the day itself: the future

    correction = corrections(scored_days(values), [DAY])[DAY]

    assert correction.factor == pytest.approx(0.8)
    assert correction.days == 28


def test_hours_without_an_actual_are_left_out_of_both_sums() -> None:
    values = history(date(2026, 1, 1), date(2026, 1, 18), forecast=10_000, actual=8_000)
    scored = scored_days(values)
    scored.loc[0, "actual_mw"] = np.nan  # a missing half-hour must not count as zero wind

    totals = daily_totals(scored)

    assert totals.loc[date(2026, 1, 1)].tolist() == [10_000, 8_000]
    assert corrections(scored, [DAY])[DAY].factor == pytest.approx(0.8)


def test_with_less_than_a_week_of_history_there_is_no_correction() -> None:
    values = history(DAY - timedelta(days=MIN_DAYS), DAY - timedelta(2), 10_000, 8_000)
    assert len(values) == MIN_DAYS - 1

    by_day = corrections(scored_days(values), [DAY])
    today = scored_days({DAY: (9_000, 7_000)})
    corrected = apply_corrections(today, by_day)

    assert by_day == {}
    assert corrected["corrected_mw"].tolist() == today["forecast_mw"].tolist()


def test_each_day_is_scaled_by_its_own_factor() -> None:
    values = history(date(2025, 12, 1), date(2026, 1, 19), forecast=10_000, actual=8_000)
    values.update(history(date(2025, 12, 1), date(2025, 12, 31), forecast=10_000, actual=5_000))
    days = [DAY, DAY + timedelta(days=1)]
    scored = scored_days({**values, **dict.fromkeys(days, (9000, 7000))})

    by_day = corrections(scored, days)
    corrected = apply_corrections(scored, by_day)

    # 20 Jan learns from 22 Dec-18 Jan (10 December days at 0.5), 21 Jan from 23 Dec-19 Jan.
    assert by_day[DAY].factor == pytest.approx((10 * 5_000 + 18 * 8_000) / (28 * 10_000))
    assert by_day[days[1]].factor == pytest.approx((9 * 5_000 + 19 * 8_000) / (28 * 10_000))
    for day in days:
        rows = corrected.loc[corrected["start_time"].dt.date == day]
        assert rows["corrected_mw"].tolist() == pytest.approx([9_000 * by_day[day].factor] * 2)
        assert rows["corrected_error_mw"].tolist() == pytest.approx(
            [9_000 * by_day[day].factor - 7_000] * 2
        )


def test_the_corrected_view_swaps_in_the_corrected_forecast() -> None:
    values = history(date(2025, 12, 22), date(2026, 1, 18), forecast=10_000, actual=8_000)
    scored = scored_days({**values, DAY: (9_000, 7_000)})
    corrected = as_corrected(apply_corrections(scored, corrections(scored, [DAY])))

    today = corrected.loc[corrected["start_time"].dt.date == DAY]
    assert today["forecast_mw"].tolist() == pytest.approx([7_200, 7_200])
    assert today["error_mw"].tolist() == pytest.approx([200, 200])
