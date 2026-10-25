"""Builders for Elexon rows and a fake Elexon source, shared by unit and integration tests."""

import json
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from datetime import date
from pathlib import Path
from typing import Any

from app.ingestion.jobs import ElexonSource
from app.integrations.elexon import FuelGenerationRow, WindForecastRow

FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> list[dict[str, Any]]:
    data: list[dict[str, Any]] = json.loads((FIXTURES / name).read_text(encoding="utf-8"))
    return data


def forecast(published: str, start: str, mw: int | None) -> WindForecastRow:
    return WindForecastRow.model_validate(
        {"dataset": "WINDFOR", "publishTime": published, "startTime": start, "generation": mw}
    )


def actual(
    start: str, period: int, mw: int | None, *, published: str, fuel: str = "WIND"
) -> FuelGenerationRow:
    return FuelGenerationRow.model_validate(
        {
            "dataset": "FUELHH",
            "publishTime": published,
            "startTime": start,
            "settlementDate": start[:10],
            "settlementPeriod": period,
            "fuelType": fuel,
            "generation": mw,
        }
    )


class FakeSource:
    """An in-memory Elexon: returns whatever rows each test gives it, per day."""

    def __init__(
        self,
        *,
        forecasts: dict[date, list[WindForecastRow]] | None = None,
        actuals: dict[date, list[FuelGenerationRow]] | None = None,
    ) -> None:
        self.forecasts = forecasts or {}
        self.actuals = actuals or {}

    async def wind_forecasts(self, published_on: date) -> list[WindForecastRow]:
        return self.forecasts.get(published_on, [])

    async def wind_actuals(self, settlement_date: date) -> list[FuelGenerationRow]:
        return self.actuals.get(settlement_date, [])


def opener(source: ElexonSource) -> Callable[[], AbstractAsyncContextManager[ElexonSource]]:
    """Wrap a source the way ElexonClient.connect is wrapped in production."""

    @asynccontextmanager
    async def open_source() -> AsyncIterator[ElexonSource]:
        yield source

    return open_source
