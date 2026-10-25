"""In-memory stand-ins for the repositories, satisfying the services' reader protocols."""

from datetime import datetime

import pandas as pd

from app.repositories.common import Coverage


def _window(frame: pd.DataFrame, start_from: datetime, start_to: datetime) -> pd.DataFrame:
    rows = frame.loc[(frame["start_time"] >= start_from) & (frame["start_time"] < start_to)]
    return rows.reset_index(drop=True)


def _coverage(frame: pd.DataFrame, runs: int | None = None) -> Coverage:
    if frame.empty:
        return Coverage(0, None, None, None, runs=runs)
    return Coverage(
        rows=len(frame),
        first_start_time=frame["start_time"].min().to_pydatetime(),
        last_start_time=frame["start_time"].max().to_pydatetime(),
        last_ingested_at=None,
        runs=runs,
    )


class FakeForecasts:
    def __init__(self, frame: pd.DataFrame) -> None:
        self._frame = frame

    def frame(self, start_from: datetime, start_to: datetime) -> pd.DataFrame:
        return _window(self._frame, start_from, start_to)

    def coverage(self) -> Coverage:
        return _coverage(self._frame, runs=self._frame["publish_time"].nunique())


class FakeActuals:
    def __init__(self, frame: pd.DataFrame) -> None:
        self._frame = frame

    def frame(self, start_from: datetime, start_to: datetime) -> pd.DataFrame:
        return _window(self._frame, start_from, start_to)

    def coverage(self) -> Coverage:
        return _coverage(self._frame)


class FakeIngestionLog:
    def __init__(self, successes: dict[str, datetime] | None = None) -> None:
        self._successes = successes or {}

    def last_success_at(self, dataset: str) -> datetime | None:
        return self._successes.get(dataset)
