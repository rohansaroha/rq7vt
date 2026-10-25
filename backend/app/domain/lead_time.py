"""How accuracy changes with lead time (fixed-horizon scoring, ADR 0001).

Both views take the output of horizon scoring: one row per (delivery hour, horizon),
from `horizon_requests` -> `select_latest` -> `attach_actuals`.
"""

from dataclasses import dataclass
from typing import cast

import numpy as np
import pandas as pd

from app.domain.calendar import uk_hours

HORIZONS_H: tuple[int, ...] = tuple(range(49))  # the curve: 0 to 48 hours ahead
BUCKET_H = 4  # heatmap columns: 0-3 h, 4-7 h, ..., 44-47 h
HEATMAP_MAX_H = 48


@dataclass(frozen=True, slots=True)
class LeadTimePoint:
    horizon_h: int
    hours: int
    hours_scored: int
    mae_mw: float | None
    p90_mw: float | None
    # The run used can be older than the horizon (runs come every 2-4 hours and do not
    # all cover every hour), so the realised lead time is reported too.
    median_lead_h: float | None


def lead_time_curve(scored: pd.DataFrame) -> list[LeadTimePoint]:
    """Typical miss and P90 shortfall for each horizon in `scored`."""
    points = []
    for horizon, group in scored.groupby("horizon_h", sort=True):
        errors = group["error_mw"].to_numpy(dtype=np.float64)
        ok = ~np.isnan(errors)
        e = errors[ok]
        leads = group["lead_h"].to_numpy(dtype=np.float64)[ok]
        points.append(
            LeadTimePoint(
                horizon_h=int(cast(int, horizon)),
                hours=len(group),
                hours_scored=int(ok.sum()),
                mae_mw=float(np.mean(np.abs(e))) if e.size else None,
                p90_mw=float(np.quantile(e, 0.9)) if e.size else None,
                median_lead_h=float(np.median(leads)) if leads.size else None,
            )
        )
    return points


@dataclass(frozen=True, slots=True)
class Heatmap:
    hours_of_day: list[int]
    buckets: list[tuple[int, int]]  # inclusive hour ranges, e.g. (0, 3)
    mae_mw: list[list[float | None]]  # [hour of day][bucket]
    hours_scored: list[list[int]]


def heatmap(
    scored: pd.DataFrame, bucket_h: int = BUCKET_H, max_horizon_h: int = HEATMAP_MAX_H
) -> Heatmap:
    """Typical miss (MAE) by UK hour of day (rows) and lead-time bucket (columns)."""
    n_buckets = max_horizon_h // bucket_h
    rows = scored.loc[scored["horizon_h"] < n_buckets * bucket_h]
    rows = rows.assign(
        hour=uk_hours(rows["start_time"]),
        bucket=rows["horizon_h"] // bucket_h,
        abs_error=rows["error_mw"].abs(),
    )
    stats = rows.groupby(["hour", "bucket"])["abs_error"].agg(["mean", "count"])

    hours_of_day = list(range(24))
    mae: list[list[float | None]] = [[None] * n_buckets for _ in hours_of_day]
    counts = [[0] * n_buckets for _ in hours_of_day]
    for (hour, bucket), mean, count in zip(stats.index, stats["mean"], stats["count"], strict=True):
        counts[hour][bucket] = int(count)
        mae[hour][bucket] = float(mean) if count else None
    return Heatmap(
        hours_of_day=hours_of_day,
        buckets=[(b * bucket_h, b * bucket_h + bucket_h - 1) for b in range(n_buckets)],
        mae_mw=mae,
        hours_scored=counts,
    )
