from pydantic import Field

from app.schemas.common import MW, ApiModel, Hours, Period, Ratio, Selection, Share


class Metrics(ApiModel):
    hours: int = Field(description="Delivery hours in the period")
    hours_scored: int = Field(description="Hours with both a forecast and an actual")
    coverage: Share | None
    mae_mw: MW | None = Field(description="Typical miss: mean absolute error")
    rmse_mw: MW | None = Field(description="Root mean square error; weighs big misses more")
    bias_mw: MW | None = Field(description="Mean error; positive means forecasts ran high")
    mean_actual_mw: MW | None
    nmae: Ratio | None = Field(description="MAE as a share of mean actual output")
    p10_mw: MW | None
    p50_mw: MW | None
    p90_mw: MW | None = Field(description="9 in 10 hours were short by less than this")


class LeadStats(ApiModel):
    min_h: Hours
    median_h: Hours
    max_h: Hours


class HistogramBin(ApiModel):
    lower_mw: MW
    upper_mw: MW
    count: int


class Histogram(ApiModel):
    bin_mw: MW
    bins: list[HistogramBin]


class BufferOption(ApiModel):
    cost_ratio: float = Field(description="Cost of being short divided by cost of being long")
    quantile: Share = Field(description="q* = ratio / (ratio + 1)")
    buffer_mw: MW = Field(description="Cover to hold: the q*-quantile of the errors")
    covered_share: Share = Field(description="Share of scored hours the buffer would have covered")


class AccuracySummary(ApiModel):
    period: Period
    selection: Selection
    metrics: Metrics
    lead_h: LeadStats | None = Field(description="Realised lead times of the hours scored")
    histogram: Histogram
    buffers: list[BufferOption]


class LeadTimePoint(ApiModel):
    horizon_h: int
    hours: int
    hours_scored: int
    mae_mw: MW | None
    p90_mw: MW | None
    median_lead_h: Hours | None = Field(
        description="Realised lead time: the run used can be older than the horizon"
    )


class LeadBucket(ApiModel):
    from_h: int
    to_h: int


class Heatmap(ApiModel):
    hours_of_day: list[int] = Field(description="Rows: UK clock hour of delivery")
    buckets: list[LeadBucket] = Field(description="Columns: lead-time ranges, inclusive")
    mae_mw: list[list[MW | None]] = Field(description="[hour of day][bucket]")
    hours_scored: list[list[int]]


class LeadTimeResponse(ApiModel):
    period: Period
    curve: list[LeadTimePoint]
    heatmap: Heatmap
