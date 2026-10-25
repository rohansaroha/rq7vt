"""Building blocks shared by the API's response models.

Conventions, kept for the life of /api/v1:

- Instants are ISO 8601 in UTC (`...Z`); delivery days are dates (YYYY-MM-DD).
- Gate times are HH:MM in UK local time, the way the auctions publish them.
- The unit is in the field name: `_mw` (megawatts), `_mwh` (megawatt hours), `_h` (hours).
- Missing is `null`, never 0: "no forecast" and "no wind" are different facts.
- Fields may be added; existing ones never change meaning (breaking changes go to /v2).
"""

from datetime import date
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, PlainSerializer


def _rounded(digits: int) -> PlainSerializer:
    # Round on the way out only: computations keep full precision.
    return PlainSerializer(lambda v: round(v, digits), return_type=float, when_used="json")


MW = Annotated[float, _rounded(1)]
MWh = Annotated[float, _rounded(0)]
Hours = Annotated[float, _rounded(2)]
Share = Annotated[float, Field(ge=0, le=1), _rounded(4)]
Ratio = Annotated[float, Field(ge=0), _rounded(4)]


class ApiModel(BaseModel):
    model_config = ConfigDict(frozen=True)


class Period(ApiModel):
    """The delivery days analysed. Each day runs 23:00 to 23:00 UK time (ADR 0006)."""

    first_day: date
    last_day: date
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    timezone: Literal["Europe/London"] = "Europe/London"


class LeadRange(ApiModel):
    """How far ahead the forecasts were: hours from publication to the hour forecast."""

    min_h: Hours
    max_h: Hours


class Selection(ApiModel):
    """Which forecast is scored for each hour."""

    mode: Literal["gate", "horizon"]
    gate: str | None = Field(
        default=None, description="Gate closure, HH:MM UK time on the day before delivery"
    )
    horizon_h: int | None = Field(
        default=None, description="Hours between the forecast's publication and the hour"
    )
    forecast: Literal["published", "corrected"] = Field(
        default="published",
        description=(
            "published: WINDFOR as issued. corrected: scaled by the recent ratio of actual "
            "to forecast output (ADR 0007)"
        ),
    )
    description: str
