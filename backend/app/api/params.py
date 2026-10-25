"""Query parameters shared by the endpoints, validated before a handler runs.

Invalid values never reach a service: FastAPI rejects them with a 422 problem document.
"""

from datetime import date, time
from typing import Annotated, Literal

from fastapi import Query

from app.domain.gates import DEFAULT_GATE
from app.domain.lead_time import HORIZONS_H

DEFAULT_GATE_TIME = DEFAULT_GATE.closes.strftime("%H:%M")
HHMM = r"^([01]\d|2[0-3]):[0-5]\d$"

DayParam = Annotated[
    date,
    Query(
        description="Delivery day (YYYY-MM-DD). It runs from 23:00 UK time the evening before.",
        examples=["2026-01-14"],
    ),
]
GateParam = Annotated[
    str,
    Query(
        pattern=HHMM,
        description="Gate closure in UK time (HH:MM) on the day before delivery.",
        examples=[DEFAULT_GATE_TIME],
    ),
]
ModeParam = Annotated[
    Literal["gate", "horizon"],
    Query(
        description=(
            "gate: score the run available at the gate. horizon: score the latest run "
            "published at least horizon_h hours before each hour."
        )
    ),
]
ForecastParam = Annotated[
    Literal["published", "corrected"],
    Query(
        description=(
            "published: WINDFOR as issued. corrected: scaled by the ratio of actual to "
            "forecast output over the four weeks known at the gate (mode=gate only)."
        )
    ),
]
HorizonParam = Annotated[
    int,
    Query(
        ge=HORIZONS_H[0],
        le=HORIZONS_H[-1],
        description="Hours ahead, used when mode=horizon.",
    ),
]


def parse_gate(value: str) -> time:
    """'09:20' -> time(9, 20). The pattern above has already checked the format."""
    return time.fromisoformat(value)
