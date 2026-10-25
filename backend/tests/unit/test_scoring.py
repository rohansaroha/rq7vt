from datetime import UTC, datetime

import numpy as np
import pandas as pd

from app.domain.frames import actual_frame, utc
from app.domain.scoring import attach_actuals


def at(text: str) -> datetime:
    return datetime.fromisoformat(text).replace(tzinfo=UTC)


def test_an_hour_is_scored_against_the_half_hour_that_starts_it() -> None:
    selected = pd.DataFrame(
        {"start_time": utc(pd.Series([at("2026-01-14T10:00"), at("2026-01-14T11:00")]))}
    ).assign(forecast_mw=[1000.0, np.nan])
    actuals = actual_frame(
        [
            (at("2026-01-14T10:00"), 800),
            (at("2026-01-14T10:30"), 5000),  # the :30 half-hour is not used for scoring
            (at("2026-01-14T11:00"), 900),
        ]
    )

    scored = attach_actuals(selected, actuals)

    assert scored["actual_mw"].tolist() == [800, 900]
    assert scored.loc[0, "error_mw"] == 200  # forecast above actual: the buyer is short
    assert pd.isna(scored.loc[1, "error_mw"])  # no forecast, so not scored


def test_an_hour_without_an_actual_is_not_scored() -> None:
    selected = pd.DataFrame({"start_time": utc(pd.Series([at("2026-01-14T10:00")]))}).assign(
        forecast_mw=[1000.0]
    )

    scored = attach_actuals(selected, actual_frame([]))

    assert pd.isna(scored.loc[0, "actual_mw"])
    assert pd.isna(scored.loc[0, "error_mw"])
