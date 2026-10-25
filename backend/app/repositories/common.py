"""Read models shared by the repositories."""

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True, slots=True)
class Coverage:
    """What a table holds: how many rows, which hours, and when it last changed."""

    rows: int
    first_start_time: datetime | None
    last_start_time: datetime | None
    last_ingested_at: datetime | None
    runs: int | None = None  # forecasts only: distinct publish times
