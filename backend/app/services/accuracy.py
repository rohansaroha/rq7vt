"""The Accuracy screen: how good the forecasts were over the analysis period."""

from typing import assert_never

import numpy as np

from app.core.config import Settings
from app.domain.lead_time import HORIZONS_H, heatmap, lead_time_curve
from app.domain.metrics import HISTOGRAM_BIN_MW, buffer_options, histogram, summarise
from app.domain.scoring import attach_actuals
from app.domain.selection import (
    AtGate,
    AtHorizon,
    Selection,
    horizon_requests,
    requests_for,
    select_latest,
)
from app.schemas import accuracy as out
from app.schemas.common import Selection as SelectionOut
from app.services.common import MarketData, analysis_period, as_float, load_market_data
from app.services.readers import ActualsReader, ForecastReader


def describe(selection: Selection) -> SelectionOut:
    match selection:
        case AtGate(gate=gate):
            hhmm = gate.strftime("%H:%M")
            return SelectionOut(
                mode="gate",
                gate=hhmm,
                description=(
                    f"Latest run published before the {hhmm} gate on the day before delivery"
                ),
            )
        case AtHorizon(horizon_h=h):
            return SelectionOut(
                mode="horizon",
                horizon_h=h,
                description=f"Latest run published at least {h} hours before each hour",
            )
        case _:
            assert_never(selection)


class AccuracyService:
    def __init__(
        self, forecasts: ForecastReader, actuals: ActualsReader, settings: Settings
    ) -> None:
        self._forecasts = forecasts
        self._actuals = actuals
        self._settings = settings

    def _load(self) -> MarketData:
        return load_market_data(
            self._forecasts,
            self._actuals,
            self._settings.analysis_start,
            self._settings.analysis_end,
        )

    def summary(self, selection: Selection) -> out.AccuracySummary:
        data = self._load()
        scored = attach_actuals(
            select_latest(data.forecasts, requests_for(selection, data.hours)), data.actuals
        )
        errors = scored["error_mw"].to_numpy(dtype=np.float64)
        stats = summarise(errors, scored["actual_mw"].to_numpy(dtype=np.float64))
        leads = scored.loc[scored["error_mw"].notna(), "lead_h"]
        return out.AccuracySummary(
            period=analysis_period(self._settings),
            selection=describe(selection),
            metrics=out.Metrics(
                hours=stats.hours,
                hours_scored=stats.hours_scored,
                coverage=stats.coverage,
                mae_mw=stats.mae_mw,
                rmse_mw=stats.rmse_mw,
                bias_mw=stats.bias_mw,
                mean_actual_mw=stats.mean_actual_mw,
                nmae=stats.nmae,
                p10_mw=stats.p10_mw,
                p50_mw=stats.p50_mw,
                p90_mw=stats.p90_mw,
            ),
            lead_h=(
                out.LeadStats(
                    min_h=as_float(leads.min()),
                    median_h=as_float(leads.median()),
                    max_h=as_float(leads.max()),
                )
                if len(leads)
                else None
            ),
            histogram=out.Histogram(
                bin_mw=HISTOGRAM_BIN_MW,
                bins=[
                    out.HistogramBin(lower_mw=b.lower_mw, upper_mw=b.upper_mw, count=b.count)
                    for b in histogram(errors)
                ],
            ),
            buffers=[
                out.BufferOption(
                    cost_ratio=o.cost_ratio,
                    quantile=o.quantile,
                    buffer_mw=o.buffer_mw,
                    covered_share=o.covered_share,
                )
                for o in buffer_options(errors)
            ],
        )

    def lead_time(self) -> out.LeadTimeResponse:
        data = self._load()
        scored = attach_actuals(
            select_latest(data.forecasts, horizon_requests(data.hours, HORIZONS_H)), data.actuals
        )
        grid = heatmap(scored)
        return out.LeadTimeResponse(
            period=analysis_period(self._settings),
            curve=[
                out.LeadTimePoint(
                    horizon_h=p.horizon_h,
                    hours=p.hours,
                    hours_scored=p.hours_scored,
                    mae_mw=p.mae_mw,
                    p90_mw=p.p90_mw,
                    median_lead_h=p.median_lead_h,
                )
                for p in lead_time_curve(scored)
            ],
            heatmap=out.Heatmap(
                hours_of_day=grid.hours_of_day,
                buckets=[out.LeadBucket(from_h=lo, to_h=hi) for lo, hi in grid.buckets],
                mae_mw=grid.mae_mw,
                hours_scored=grid.hours_scored,
            ),
        )
