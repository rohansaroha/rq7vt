"""The shape of Elexon's rows (DTOs), validated as they arrive.

Elexon sends camelCase JSON; the aliases map it to snake_case. Anything unexpected
(a missing timestamp, a timestamp without a time zone) fails here, before it can
reach the database.
"""

from datetime import UTC, date, datetime

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator


class _ElexonRow(BaseModel):
    model_config = ConfigDict(frozen=True, extra="ignore")

    publish_time: AwareDatetime = Field(alias="publishTime")
    start_time: AwareDatetime = Field(alias="startTime")
    # Elexon's schema allows null values; ingestion skips and counts those rows.
    generation: int | None = None

    @field_validator("publish_time", "start_time")
    @classmethod
    def _to_utc(cls, value: datetime) -> datetime:
        return value.astimezone(UTC)


class WindForecastRow(_ElexonRow):
    """One hourly value of one WINDFOR forecast run."""


class FuelGenerationRow(_ElexonRow):
    """One half-hour of FUELHH generation for one fuel type."""

    settlement_date: date = Field(alias="settlementDate")
    settlement_period: int = Field(alias="settlementPeriod", ge=1, le=50)
    fuel_type: str = Field(alias="fuelType")
