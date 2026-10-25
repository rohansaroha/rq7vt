"""The GB day-ahead auctions a buyer can bid in, and when each one closes.

All three run on the day before delivery; the times are UK local time.
"""

from dataclasses import dataclass
from datetime import time


@dataclass(frozen=True, slots=True)
class Gate:
    id: str
    closes: time
    label: str
    description: str


GATES: tuple[Gate, ...] = (
    Gate("epex-hourly", time(9, 20), "EPEX hourly", "EPEX SPOT GB day-ahead 60-minute auction"),
    Gate("n2ex", time(9, 50), "N2EX", "Nord Pool N2EX GB day-ahead hourly auction"),
    Gate(
        "epex-half-hourly",
        time(15, 30),
        "EPEX half-hourly",
        "EPEX SPOT GB day-ahead 30-minute auction",
    ),
)
DEFAULT_GATE = GATES[0]
