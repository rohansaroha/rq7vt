"""The Decision screen: what the forecast said when the buyer bid, and what happened."""

from datetime import date, time, timedelta

import pandas as pd

from app.core.config import Settings
from app.domain.calendar import delivery_window, gate_closure, uk_day_window, uk_hours
from app.domain.day import LIKELY_RANGE, day_totals, error_bands, likely_range
from app.domain.scoring import attach_actuals
from app.domain.selection import gate_requests, lead_hours, select_latest
from app.schemas.common import LeadRange
from app.schemas.forecasts import (
    DaySummary,
    DecisionPoint,
    DecisionResponse,
    ForecastRun,
    Gate,
    HalfHour,
    LikelyRange,
    RunPoint,
    RunsResponse,
    RunUsed,
    Shortfall,
)
from app.services.common import (
    as_float,
    as_instant,
    check_in_period,
    load_market_data,
    optional_float,
    optional_instant,
)
from app.services.readers import ActualsReader, ForecastReader


def _within(frame: pd.DataFrame, start: object, end: object) -> pd.DataFrame:
    """Rows whose start_time is in [start, end)."""
    rows = frame.loc[(frame["start_time"] >= start) & (frame["start_time"] < end)]
    return rows.reset_index(drop=True)


class DecisionService:
    def __init__(
        self, forecasts: ForecastReader, actuals: ActualsReader, settings: Settings
    ) -> None:
        self._forecasts = forecasts
        self._actuals = actuals
        self._settings = settings

    def decision(self, day: date, gate: time) -> DecisionResponse:
        """The run available at `gate` on the day before `day`, against the actuals.

        The likely range uses the spread of errors at the same gate across the whole
        analysis period, by hour of day (so by lead time): it describes the month, not
        what was knowable on the day.
        """
        check_in_period(day, self._settings)
        data = load_market_data(
            self._forecasts,
            self._actuals,
            self._settings.analysis_start,
            self._settings.analysis_end,
        )
        scored = attach_actuals(
            select_latest(data.forecasts, gate_requests(data.hours, gate)), data.actuals
        )
        bands = error_bands(scored)
        start, end = delivery_window(day, day)
        rows = _within(scored, start, end)
        half_hours = _within(data.actuals, start, end)
        totals = day_totals(rows, half_hours)

        points = []
        for row, hour in zip(
            rows.itertuples(index=False), uk_hours(rows["start_time"]), strict=True
        ):
            forecast = optional_float(row.forecast_mw)
            low, high = likely_range(forecast, bands.get(hour))
            points.append(
                DecisionPoint(
                    start_time=as_instant(row.start_time),
                    forecast_mw=forecast,
                    actual_mw=optional_float(row.actual_mw),
                    error_mw=optional_float(row.error_mw),
                    publish_time=optional_instant(row.publish_time),
                    lead_h=optional_float(row.lead_h),
                    likely_low_mw=low,
                    likely_high_mw=high,
                )
            )

        used = rows["publish_time"].dropna()
        leads = rows["lead_h"].dropna()
        run = None
        if len(used):
            run = RunUsed(
                publish_time=as_instant(used.max()),
                lead_h=LeadRange(min_h=as_float(leads.min()), max_h=as_float(leads.max())),
            )
        worst = totals.worst_shortfall
        low_q, high_q = LIKELY_RANGE
        return DecisionResponse(
            day=day,
            starts_at=start,
            ends_at=end,
            gate=Gate(time=gate.strftime("%H:%M"), closes_at=gate_closure(day, gate)),
            run=run,
            runs_used=[as_instant(t) for t in sorted(used.unique())],
            summary=DaySummary(
                hours=totals.hours,
                hours_scored=totals.hours_scored,
                forecast_energy_mwh=totals.forecast_energy_mwh,
                actual_energy_mwh=totals.actual_energy_mwh,
                mae_mw=totals.mae_mw,
                bias_mw=totals.bias_mw,
                worst_shortfall=(
                    Shortfall(start_time=worst.start_time, error_mw=worst.error_mw)
                    if worst
                    else None
                ),
            ),
            likely_range=LikelyRange(
                coverage=round(high_q - low_q, 4),
                basis=(
                    f"P{low_q * 100:.0f}-P{high_q * 100:.0f} of errors at this gate over the "
                    "analysis period, by hour of day"
                ),
            ),
            points=points,
            actuals=[
                HalfHour(start_time=as_instant(t), generation_mw=as_float(mw))
                for t, mw in zip(half_hours["start_time"], half_hours["generation_mw"], strict=True)
            ],
        )

    def runs(self, day: date) -> RunsResponse:
        """Every run published on the day before delivery (UK date), scored on the day."""
        check_in_period(day, self._settings)
        start, end = delivery_window(day, day)
        published_on = day - timedelta(days=1)
        published_from, published_to = uk_day_window(published_on)
        forecasts = self._forecasts.frame(start, end)
        actuals = self._actuals.frame(start, end)
        own = forecasts.loc[
            (forecasts["publish_time"] >= published_from)
            & (forecasts["publish_time"] < published_to)
        ].rename(columns={"generation_mw": "forecast_mw"})

        runs = []
        for publish_time, group in own.groupby("publish_time", sort=True):
            scored = attach_actuals(group.reset_index(drop=True), actuals)
            errors = scored["error_mw"].dropna()
            leads = lead_hours(scored["start_time"], scored["publish_time"])
            runs.append(
                ForecastRun(
                    publish_time=as_instant(publish_time),
                    hours=len(scored),
                    hours_scored=len(errors),
                    lead_h=LeadRange(min_h=as_float(leads.min()), max_h=as_float(leads.max())),
                    mae_mw=float(errors.abs().mean()) if len(errors) else None,
                    points=[
                        RunPoint(start_time=as_instant(t), forecast_mw=as_float(mw))
                        for t, mw in zip(scored["start_time"], scored["forecast_mw"], strict=True)
                    ],
                )
            )
        return RunsResponse(day=day, published_on=published_on, runs=runs)
