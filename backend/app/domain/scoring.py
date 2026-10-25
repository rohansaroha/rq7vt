"""Line forecasts up with what actually happened, and measure the miss.

Error = forecast - actual, in MW. Positive means the wind came in below the forecast:
a buyer who relied on it is short and must buy the gap at short notice.
"""

import pandas as pd


def attach_actuals(selected: pd.DataFrame, actuals: pd.DataFrame) -> pd.DataFrame:
    """Add `actual_mw` and `error_mw` to each hourly row.

    Forecasts are hourly and actuals half-hourly; an hour is scored against the
    half-hour that starts with it (ADR 0002). Rows without a forecast or an actual get
    a missing error, so they count as "not scored" downstream.
    """
    on_the_hour = actuals.loc[:, ["start_time", "generation_mw"]].rename(
        columns={"generation_mw": "actual_mw"}
    )
    scored = selected.merge(on_the_hour, on="start_time", how="left", validate="many_to_one")
    scored["error_mw"] = scored["forecast_mw"] - scored["actual_mw"]
    return scored
