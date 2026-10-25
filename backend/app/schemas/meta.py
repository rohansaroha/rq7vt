from typing import Literal

from pydantic import AwareDatetime, Field

from app.schemas.common import ApiModel, Period


class GatePreset(ApiModel):
    id: str
    time: str = Field(description="HH:MM, UK time, on the day before delivery")
    label: str
    description: str


class HorizonRange(ApiModel):
    min_h: int
    max_h: int
    default_h: int


class DatasetStatus(ApiModel):
    name: Literal["actuals", "forecasts"]
    source: str
    rows: int
    runs: int | None = Field(default=None, description="Forecast runs held (forecasts only)")
    first_start_time: AwareDatetime | None
    last_start_time: AwareDatetime | None
    last_ingested_at: AwareDatetime | None
    last_success_at: AwareDatetime | None = Field(
        description="When an ingestion job for this dataset last finished successfully"
    )


class MetaResponse(ApiModel):
    version: str
    period: Period
    gates: list[GatePreset]
    default_gate: str
    horizon: HorizonRange
    datasets: list[DatasetStatus]
    data_as_of: AwareDatetime | None = Field(
        description="The latest successful ingestion across datasets"
    )
