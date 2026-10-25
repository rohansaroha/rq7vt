"""What the services need from storage, as structural interfaces ("ports").

The repositories satisfy these without inheriting from them, and tests pass in-memory
fakes instead, so no service imports SQLAlchemy.
"""

from datetime import datetime
from typing import Protocol

import pandas as pd

from app.repositories.common import Coverage


class ForecastReader(Protocol):
    def frame(self, start_from: datetime, start_to: datetime) -> pd.DataFrame: ...

    def coverage(self) -> Coverage: ...


class ActualsReader(Protocol):
    def frame(self, start_from: datetime, start_to: datetime) -> pd.DataFrame: ...

    def coverage(self) -> Coverage: ...


class IngestionLog(Protocol):
    def last_success_at(self, dataset: str) -> datetime | None: ...
