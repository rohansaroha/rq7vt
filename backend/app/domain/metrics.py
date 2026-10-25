"""Accuracy metrics, and the cover a buyer should hold because of them.

Errors are forecast minus actual, in MW: positive means the wind came in below the
forecast, so a buyer who relied on it is short. Missing values (NaN) mark hours without
a forecast or an actual; they are counted as not scored and otherwise ignored.
"""

import math
from collections.abc import Iterable
from dataclasses import dataclass

import numpy as np
import numpy.typing as npt

FloatArray = npt.NDArray[np.float64]

# The cost ratios offered for sizing a buffer: being short costs 1x to 20x being long.
COST_RATIOS: tuple[int, ...] = tuple(range(1, 21))
HISTOGRAM_BIN_MW = 500.0


def as_array(values: npt.ArrayLike) -> FloatArray:
    return np.asarray(values, dtype=np.float64)


def scored_only(errors: npt.ArrayLike) -> FloatArray:
    values = as_array(errors)
    return values[~np.isnan(values)]


@dataclass(frozen=True, slots=True)
class ErrorSummary:
    hours: int
    hours_scored: int
    mae_mw: float | None
    rmse_mw: float | None
    bias_mw: float | None
    mean_actual_mw: float | None
    nmae: float | None
    p10_mw: float | None
    p50_mw: float | None
    p90_mw: float | None

    @property
    def coverage(self) -> float | None:
        """Share of the hours asked about that could be scored."""
        return self.hours_scored / self.hours if self.hours else None


def summarise(errors: npt.ArrayLike, actuals: npt.ArrayLike) -> ErrorSummary:
    """Summarise hourly errors. `actuals` (same length) gives nMAE its scale.

    MAE is the typical miss, RMSE weighs big misses more, bias shows a systematic lean,
    and the percentiles describe the spread (P90: 9 in 10 hours were short by less).
    """
    e = as_array(errors)
    a = as_array(actuals)
    if e.shape != a.shape:
        raise ValueError("errors and actuals must have the same length")
    scored = ~np.isnan(e)
    n = int(scored.sum())
    if n == 0:
        return ErrorSummary(
            hours=int(e.size),
            hours_scored=0,
            mae_mw=None,
            rmse_mw=None,
            bias_mw=None,
            mean_actual_mw=None,
            nmae=None,
            p10_mw=None,
            p50_mw=None,
            p90_mw=None,
        )
    es = e[scored]
    mae = float(np.mean(np.abs(es)))
    mean_actual = float(np.mean(a[scored]))
    p10, p50, p90 = (float(v) for v in np.quantile(es, [0.1, 0.5, 0.9]))
    return ErrorSummary(
        hours=int(e.size),
        hours_scored=n,
        mae_mw=mae,
        rmse_mw=float(np.sqrt(np.mean(es**2))),
        bias_mw=float(np.mean(es)),
        mean_actual_mw=mean_actual,
        nmae=mae / mean_actual if mean_actual > 0 else None,
        p10_mw=p10,
        p50_mw=p50,
        p90_mw=p90,
    )


def newsvendor_quantile(cost_ratio: float) -> float:
    """The cover level that minimises expected cost: q* = c_short / (c_short + c_long).

    With cost_ratio = c_short / c_long this is r / (r + 1). If being short costs nine
    times as much as being long, hold enough cover for 90% of hours.
    """
    if not cost_ratio > 0:
        raise ValueError(f"cost_ratio must be positive, got {cost_ratio}")
    return cost_ratio / (cost_ratio + 1.0)


@dataclass(frozen=True, slots=True)
class BufferOption:
    cost_ratio: float
    quantile: float
    buffer_mw: float
    covered_share: float


def buffer_options(
    errors: npt.ArrayLike, cost_ratios: Iterable[float] = COST_RATIOS
) -> list[BufferOption]:
    """The cover to hold for each cost ratio, and how often it would have been enough.

    Holding a buffer B means relying on (forecast - B) MW of wind, so a shortfall is
    covered when error <= B. The B with the lowest expected cost is the q*-quantile of
    the errors (the newsvendor result).
    """
    e = scored_only(errors)
    if e.size == 0:
        return []
    options = []
    for ratio in cost_ratios:
        q = newsvendor_quantile(ratio)
        buffer = float(np.quantile(e, q))
        options.append(BufferOption(float(ratio), q, buffer, float(np.mean(e <= buffer))))
    return options


@dataclass(frozen=True, slots=True)
class HistogramBin:
    lower_mw: float
    upper_mw: float
    count: int


def histogram(errors: npt.ArrayLike, bin_mw: float = HISTOGRAM_BIN_MW) -> list[HistogramBin]:
    """Counts of errors in bins of `bin_mw`, aligned to multiples of it (e.g. 0 to 500)."""
    e = scored_only(errors)
    if e.size == 0:
        return []
    first = math.floor(float(e.min()) / bin_mw)
    last = math.floor(float(e.max()) / bin_mw)
    edges = np.arange(first, last + 2, dtype=np.float64) * bin_mw
    counts, _ = np.histogram(e, bins=edges)
    return [
        HistogramBin(float(lo), float(hi), int(count))
        for lo, hi, count in zip(edges[:-1], edges[1:], counts, strict=True)
    ]
