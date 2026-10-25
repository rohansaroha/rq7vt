"""Async client for the two Elexon Insights datasets the app needs.

- Requests are day-sized, so a failure only retries that day.
- At most `max_concurrency` requests are in flight at once (a semaphore), which is
  fast and still polite to a free public API.
- Network errors, 429 and 5xx are retried with exponential backoff; other 4xx mean
  our request is wrong, so they fail immediately.
"""

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import date, timedelta
from typing import Any, cast

import httpx
import structlog
from tenacity import (
    AsyncRetrying,
    RetryCallState,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from app.integrations.elexon.dto import FuelGenerationRow, WindForecastRow

log = structlog.get_logger(__name__)

WINDFOR_PATH = "/datasets/WINDFOR/stream"
FUELHH_PATH = "/datasets/FUELHH/stream"
RETRYABLE_STATUSES = frozenset({429, 500, 502, 503, 504})


class ElexonError(RuntimeError):
    """Elexon answered, but not with something we can use."""


def is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in RETRYABLE_STATUSES
    return isinstance(exc, httpx.TransportError)


class ElexonClient:
    def __init__(
        self,
        http: httpx.AsyncClient,
        *,
        max_concurrency: int = 4,
        max_attempts: int = 4,
        backoff_s: float = 0.5,
    ) -> None:
        self._http = http
        self._limit = asyncio.Semaphore(max_concurrency)
        self._max_attempts = max_attempts
        self._backoff_s = backoff_s

    @classmethod
    @asynccontextmanager
    async def connect(
        cls, base_url: str, *, timeout_s: float = 20.0, max_concurrency: int = 4
    ) -> AsyncIterator["ElexonClient"]:
        headers = {"Accept": "application/json", "User-Agent": "wind-forecast-portal/0.1"}
        async with httpx.AsyncClient(base_url=base_url, timeout=timeout_s, headers=headers) as http:
            yield cls(http, max_concurrency=max_concurrency)

    async def wind_forecasts_raw(self, published_on: date) -> list[dict[str, Any]]:
        """Every WINDFOR run published on this UTC day, as Elexon sent it."""
        next_day = published_on + timedelta(days=1)
        params = {
            "publishDateTimeFrom": f"{published_on.isoformat()}T00:00:00Z",
            "publishDateTimeTo": f"{next_day.isoformat()}T00:00:00Z",
        }
        return await self._get_rows(WINDFOR_PATH, params)

    async def wind_forecasts(self, published_on: date) -> list[WindForecastRow]:
        return [
            WindForecastRow.model_validate(row)
            for row in await self.wind_forecasts_raw(published_on)
        ]

    async def wind_actuals_raw(self, settlement_date: date) -> list[dict[str, Any]]:
        """FUELHH half-hours for one settlement day, wind only, as Elexon sent them."""
        day = settlement_date.isoformat()
        params = {"settlementDateFrom": day, "settlementDateTo": day, "fuelType": "WIND"}
        return await self._get_rows(FUELHH_PATH, params)

    async def wind_actuals(self, settlement_date: date) -> list[FuelGenerationRow]:
        return [
            FuelGenerationRow.model_validate(row)
            for row in await self.wind_actuals_raw(settlement_date)
        ]

    async def _get_rows(self, path: str, params: dict[str, str]) -> list[dict[str, Any]]:
        async with self._limit:
            response = await self._get_with_retry(path, params)
        payload: Any = response.json()
        if not isinstance(payload, list):
            raise ElexonError(f"{path}: expected a JSON array, got {type(payload).__name__}")
        log.debug("elexon_fetched", path=path, params=params, rows=len(payload))
        return cast(list[dict[str, Any]], payload)

    async def _get_with_retry(self, path: str, params: dict[str, str]) -> httpx.Response:
        retrying = AsyncRetrying(
            retry=retry_if_exception(is_retryable),
            stop=stop_after_attempt(self._max_attempts),
            wait=wait_exponential(multiplier=self._backoff_s, max=8),
            before_sleep=self._log_retry,
            reraise=True,
        )
        async for attempt in retrying:
            with attempt:
                response = await self._http.get(path, params=params)
                response.raise_for_status()
                return response
        raise AssertionError("unreachable: tenacity re-raises after the last attempt")

    @staticmethod
    def _log_retry(state: RetryCallState) -> None:
        error = state.outcome.exception() if state.outcome else None
        log.warning("elexon_retry", attempt=state.attempt_number, error=repr(error))
