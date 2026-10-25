"""The selection rule: worked examples, then properties checked on random inputs."""

from datetime import UTC, date, datetime, time, timedelta

import pandas as pd
from hypothesis import given
from hypothesis import strategies as st

from app.domain.calendar import delivery_hours
from app.domain.frames import forecast_frame, utc
from app.domain.selection import (
    BEFORE_GATE,
    AtGate,
    AtHorizon,
    gate_requests,
    horizon_requests,
    requests_for,
    select_latest,
)

T0 = datetime(2026, 1, 14, tzinfo=UTC)


def hour(n: int) -> datetime:
    return T0 + timedelta(hours=n)


def half_hour(n: int) -> datetime:
    return T0 + timedelta(minutes=30 * n)


def requests(*pairs: tuple[datetime, datetime]) -> pd.DataFrame:
    frame = pd.DataFrame(pairs, columns=["start_time", "cutoff"])
    return frame.assign(start_time=utc(frame["start_time"]), cutoff=utc(frame["cutoff"]))


def test_it_picks_the_latest_run_published_at_or_before_the_cutoff() -> None:
    forecasts = forecast_frame(
        [
            (hour(10), half_hour(-20), 100),
            (hour(10), half_hour(-10), 200),  # published exactly at the cutoff: allowed
            (hour(10), half_hour(-9), 300),  # 30 minutes too late
        ]
    )

    selected = select_latest(forecasts, requests((hour(10), half_hour(-10))))

    assert selected.loc[0, "forecast_mw"] == 200
    assert selected.loc[0, "publish_time"] == pd.Timestamp(half_hour(-10))
    assert selected.loc[0, "lead_h"] == 15.0


def test_a_run_published_after_the_cutoff_is_never_used() -> None:
    forecasts = forecast_frame([(hour(10), half_hour(1), 100)])

    selected = select_latest(forecasts, requests((hour(10), half_hour(0))))

    assert pd.isna(selected.loc[0, "forecast_mw"])
    assert pd.isna(selected.loc[0, "publish_time"])


def test_a_newer_run_that_does_not_cover_the_hour_is_skipped() -> None:
    forecasts = forecast_frame(
        [
            (hour(10), half_hour(-20), 100),
            (hour(11), half_hour(-4), 999),  # newer, but only covers 11:00
        ]
    )

    selected = select_latest(forecasts, requests((hour(10), half_hour(0))))

    assert selected.loc[0, "forecast_mw"] == 100


def test_results_come_back_in_request_order() -> None:
    forecasts = forecast_frame([(hour(1), half_hour(-10), 1), (hour(2), half_hour(-10), 2)])

    selected = select_latest(forecasts, requests((hour(2), half_hour(0)), (hour(1), half_hour(-1))))

    assert selected["forecast_mw"].tolist() == [2, 1]


def test_gate_requests_cut_off_each_hour_just_before_its_own_auction() -> None:
    hours = delivery_hours(date(2026, 1, 14), date(2026, 1, 15))

    cutoffs = gate_requests(hours, time(9, 20)).set_index("start_time")["cutoff"]

    # 23:00 on the 14th is the first hour of delivery day 15 January.
    assert (
        cutoffs[pd.Timestamp("2026-01-14T22:00Z")]
        == pd.Timestamp("2026-01-13T09:20Z") - BEFORE_GATE
    )
    assert (
        cutoffs[pd.Timestamp("2026-01-14T23:00Z")]
        == pd.Timestamp("2026-01-14T09:20Z") - BEFORE_GATE
    )


def test_a_run_published_as_the_gate_closes_is_too_late() -> None:
    hours = delivery_hours(date(2026, 1, 14))
    on_the_gate = datetime(2026, 1, 13, 15, 30, tzinfo=UTC)
    earlier = datetime(2026, 1, 13, 11, 30, tzinfo=UTC)
    forecasts = forecast_frame(
        [
            (t.to_pydatetime(), p, mw)
            for t in hours
            for p, mw in ((earlier, 1.0), (on_the_gate, 2.0))
        ]
    )

    selected = select_latest(forecasts, gate_requests(hours, time(15, 30)))

    assert (selected["forecast_mw"] == 1.0).all()


def test_horizon_requests_cut_off_h_hours_before_each_hour() -> None:
    hours = delivery_hours(date(2026, 1, 14))

    grid = horizon_requests(hours, [0, 6])

    assert len(grid) == 48
    assert ((grid["start_time"] - grid["cutoff"]) / pd.Timedelta(hours=1)).tolist() == [0, 6] * 24


def test_requests_for_dispatches_on_the_selection() -> None:
    hours = delivery_hours(date(2026, 1, 14))

    assert requests_for(AtGate(time(9, 20)), hours)["cutoff"].nunique() == 1
    assert (requests_for(AtHorizon(3), hours)["horizon_h"] == 3).all()


# Property tests. Small grids make collisions (same hour, same publish time) likely,
# which is where selection bugs hide.
forecast_rows = st.lists(
    st.tuples(st.integers(0, 5), st.integers(-60, 10), st.integers(0, 20_000)),
    max_size=40,
    unique_by=lambda row: (row[0], row[1]),
)
request_rows = st.lists(st.tuples(st.integers(0, 6), st.integers(-60, 12)), min_size=1, max_size=20)


@given(forecast_rows, request_rows)
def test_it_agrees_with_a_brute_force_search(
    rows: list[tuple[int, int, int]], asks: list[tuple[int, int]]
) -> None:
    forecasts = forecast_frame([(hour(s), half_hour(p), mw) for s, p, mw in rows])

    selected = select_latest(forecasts, requests(*[(hour(s), half_hour(c)) for s, c in asks]))

    for i, (start, cutoff) in enumerate(asks):
        candidates = [(p, mw) for s, p, mw in rows if s == start and p <= cutoff]
        if candidates:
            published, mw = max(candidates)
            assert selected.loc[i, "publish_time"] == pd.Timestamp(half_hour(published))
            assert selected.loc[i, "forecast_mw"] == mw
        else:
            assert pd.isna(selected.loc[i, "forecast_mw"])


@given(forecast_rows, request_rows)
def test_there_is_never_any_lookahead(
    rows: list[tuple[int, int, int]], asks: list[tuple[int, int]]
) -> None:
    forecasts = forecast_frame([(hour(s), half_hour(p), mw) for s, p, mw in rows])

    selected = select_latest(forecasts, requests(*[(hour(s), half_hour(c)) for s, c in asks]))

    used = selected.dropna(subset=["publish_time"])
    assert (used["publish_time"] <= used["cutoff"]).all()


@given(forecast_rows, st.integers(0, 5), st.lists(st.integers(-60, 12), min_size=2, max_size=10))
def test_a_later_cutoff_never_selects_an_older_run(
    rows: list[tuple[int, int, int]], start: int, cutoffs: list[int]
) -> None:
    forecasts = forecast_frame([(hour(s), half_hour(p), mw) for s, p, mw in rows])
    asks = [(hour(start), half_hour(c)) for c in sorted(cutoffs)]

    published = select_latest(forecasts, requests(*asks))["publish_time"]

    covered = published.dropna().tolist()
    assert covered == sorted(covered)
    # Once an hour is covered, a later cutoff keeps it covered.
    assert published.isna().tolist() == sorted(published.isna().tolist(), reverse=True)
