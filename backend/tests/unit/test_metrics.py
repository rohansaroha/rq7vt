import itertools
import math

import numpy as np
import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.domain.metrics import (
    buffer_options,
    histogram,
    newsvendor_quantile,
    summarise,
)

finite_mw = st.floats(min_value=-30_000, max_value=30_000, allow_nan=False)
error_lists = st.lists(finite_mw, min_size=1, max_size=200)


def test_summarise_a_worked_example() -> None:
    summary = summarise([100, -100, 300, np.nan], [1000, 1000, 1000, 1000])

    assert (summary.hours, summary.hours_scored, summary.coverage) == (4, 3, 0.75)
    assert summary.mae_mw == pytest.approx(500 / 3)
    assert summary.rmse_mw == pytest.approx(math.sqrt(110_000 / 3))
    assert summary.bias_mw == pytest.approx(100)
    assert summary.nmae == pytest.approx(1 / 6)
    assert summary.p50_mw == pytest.approx(100)


def test_summarise_with_nothing_scored_reports_no_metrics() -> None:
    summary = summarise([np.nan, np.nan], [np.nan, 500])

    assert (summary.hours, summary.hours_scored, summary.mae_mw, summary.p90_mw) == (
        2,
        0,
        None,
        None,
    )


def test_summarise_needs_aligned_inputs() -> None:
    with pytest.raises(ValueError, match="same length"):
        summarise([1, 2], [1])


@pytest.mark.parametrize(("ratio", "q"), [(1, 0.5), (9, 0.9), (3, 0.75)])
def test_the_newsvendor_quantile(ratio: float, q: float) -> None:
    assert newsvendor_quantile(ratio) == pytest.approx(q)


def test_a_cost_ratio_must_be_positive() -> None:
    with pytest.raises(ValueError, match="positive"):
        newsvendor_quantile(0)


def test_the_buffer_for_a_9_to_1_cost_ratio_is_the_p90_error() -> None:
    errors = np.arange(1, 101, dtype=float)

    (option,) = buffer_options(errors, cost_ratios=[9])

    assert option.quantile == pytest.approx(0.9)
    assert option.buffer_mw == pytest.approx(np.quantile(errors, 0.9))
    assert option.covered_share == pytest.approx(0.9)


def test_histogram_bins_align_to_multiples_of_the_width() -> None:
    bins = histogram([-600, -1, 0, 499, 500], bin_mw=500)

    assert [(b.lower_mw, b.upper_mw, b.count) for b in bins] == [
        (-1000, -500, 1),
        (-500, 0, 1),
        (0, 500, 2),
        (500, 1000, 1),
    ]


def test_no_errors_means_no_buffers_or_bins() -> None:
    assert buffer_options([np.nan]) == []
    assert histogram([]) == []


@given(error_lists, st.lists(st.floats(1, 30_000), min_size=200, max_size=200))
def test_metric_invariants_hold(errors: list[float], actuals: list[float]) -> None:
    s = summarise(errors, actuals[: len(errors)])

    assert s.mae_mw is not None
    assert s.rmse_mw is not None
    assert s.bias_mw is not None
    assert s.p10_mw is not None
    assert s.p50_mw is not None
    assert s.p90_mw is not None
    tolerance = 1e-9 * (1 + s.mae_mw)
    assert s.mae_mw >= 0
    assert s.rmse_mw >= s.mae_mw - tolerance  # RMSE is never below MAE
    assert abs(s.bias_mw) <= s.mae_mw + tolerance  # the lean can't exceed the typical miss
    assert min(errors) <= s.p10_mw <= s.p50_mw <= s.p90_mw <= max(errors)


@given(error_lists)
def test_buffers_grow_with_the_cost_of_being_short(errors: list[float]) -> None:
    options = buffer_options(errors)

    buffers = [o.buffer_mw for o in options]
    assert buffers == sorted(buffers)
    for o in options:
        # By construction of the quantile, the buffer covers at least q* of the hours
        # (up to one sample of rounding).
        assert o.covered_share >= o.quantile - 1 / len(errors) - 1e-12


@given(error_lists, st.sampled_from([100.0, 250.0, 500.0]))
def test_histogram_counts_every_error_once(errors: list[float], width: float) -> None:
    bins = histogram(errors, bin_mw=width)

    assert sum(b.count for b in bins) == len(errors)
    assert all(math.isclose(b.upper_mw - b.lower_mw, width) for b in bins)
    assert all(a.upper_mw == b.lower_mw for a, b in itertools.pairwise(bins))
    assert bins[0].lower_mw <= min(errors)
    assert max(errors) < bins[-1].upper_mw
