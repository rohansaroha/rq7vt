"""Column contracts for the frames the domain works on.

Data enters the domain through these constructors, so every function can rely on the
same column names and dtypes: UTC timestamps in one unit, and float MW values where NaN
means "missing".
"""

from collections.abc import Iterable, Sequence
from typing import Final

import pandas as pd

# pandas' default resolution for Python datetimes. Using one unit everywhere matters:
# merge_asof refuses to match timestamps stored in different units.
TIME_UNIT: Final = "us"

FORECAST_COLUMNS = ["start_time", "publish_time", "generation_mw"]
ACTUAL_COLUMNS = ["start_time", "generation_mw"]


def utc(column: pd.Series) -> pd.Series:
    """Aware datetimes (or ISO strings with an offset) as UTC timestamps in TIME_UNIT."""
    return pd.to_datetime(column, utc=True).dt.as_unit(TIME_UNIT)


def forecast_frame(records: Iterable[Sequence[object]]) -> pd.DataFrame:
    """One row per forecast value: (start_time, publish_time, generation_mw).

    `start_time` is the hour forecast, `publish_time` identifies the run.
    """
    frame = pd.DataFrame(list(records), columns=FORECAST_COLUMNS)
    return frame.assign(
        start_time=utc(frame["start_time"]),
        publish_time=utc(frame["publish_time"]),
        generation_mw=frame["generation_mw"].astype("float64"),
    )


def actual_frame(records: Iterable[Sequence[object]]) -> pd.DataFrame:
    """One row per half-hour of metered generation: (start_time, generation_mw)."""
    frame = pd.DataFrame(list(records), columns=ACTUAL_COLUMNS)
    return frame.assign(
        start_time=utc(frame["start_time"]),
        generation_mw=frame["generation_mw"].astype("float64"),
    )
