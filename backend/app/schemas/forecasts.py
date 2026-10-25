from datetime import date

from pydantic import AwareDatetime, Field

from app.schemas.common import MW, ApiModel, Hours, LeadRange, MWh, Ratio, Share


class Gate(ApiModel):
    time: str = Field(description="HH:MM, UK time, on the day before delivery")
    closes_at: AwareDatetime


class RunUsed(ApiModel):
    """The forecast run the buyer had at the gate."""

    publish_time: AwareDatetime
    lead_h: LeadRange


class DecisionPoint(ApiModel):
    """One delivery hour: the forecast at the gate against what happened."""

    start_time: AwareDatetime
    forecast_mw: MW | None
    actual_mw: MW | None = Field(description="Metered output in the half-hour starting the hour")
    error_mw: MW | None = Field(description="forecast - actual; positive means the buyer was short")
    publish_time: AwareDatetime | None = Field(description="The run this hour's forecast came from")
    lead_h: Hours | None
    likely_low_mw: MW | None
    likely_high_mw: MW | None
    corrected_mw: MW | None = Field(
        description="The forecast times the day's correction factor (ADR 0007)"
    )


class HalfHour(ApiModel):
    start_time: AwareDatetime
    generation_mw: MW


class Shortfall(ApiModel):
    start_time: AwareDatetime
    error_mw: MW


class DaySummary(ApiModel):
    hours: int
    hours_scored: int
    forecast_energy_mwh: MWh | None
    actual_energy_mwh: MWh | None
    mae_mw: MW | None
    bias_mw: MW | None
    worst_shortfall: Shortfall | None = Field(
        description="The hour the wind fell furthest below the forecast; null if it never did"
    )
    corrected_forecast_energy_mwh: MWh | None
    corrected_mae_mw: MW | None
    corrected_bias_mw: MW | None


class Correction(ApiModel):
    """How the corrected forecast was made for one delivery day (ADR 0007)."""

    factor: Ratio = Field(description="Every hour's forecast was multiplied by this")
    trained_from: date = Field(description="First delivery day the factor was learned from")
    trained_to: date = Field(description="Last delivery day it was learned from (D-2)")
    days: int = Field(description="Delivery days it was learned from")


class LikelyRange(ApiModel):
    coverage: Share
    basis: str


class DecisionResponse(ApiModel):
    day: date
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    gate: Gate
    run: RunUsed | None = Field(description="Null when no forecast was published before the gate")
    runs_used: list[AwareDatetime] = Field(
        description="Publish times of every run used; more than one only if a run was partial"
    )
    summary: DaySummary
    correction: Correction | None = Field(
        description="Null when fewer than 7 earlier days were known: no correction was made"
    )
    likely_range: LikelyRange
    points: list[DecisionPoint]
    actuals: list[HalfHour] = Field(description="Every metered half-hour of the day")


class RunPoint(ApiModel):
    start_time: AwareDatetime
    forecast_mw: MW


class ForecastRun(ApiModel):
    publish_time: AwareDatetime
    hours: int = Field(description="Delivery hours of the day this run covers")
    hours_scored: int
    lead_h: LeadRange
    mae_mw: MW | None
    points: list[RunPoint]


class RunsResponse(ApiModel):
    day: date
    published_on: date = Field(description="The UK calendar day the runs were published")
    runs: list[ForecastRun]
