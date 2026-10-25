import asyncio
from collections.abc import AsyncIterator
from datetime import date

import httpx
import pytest
import respx

from app.integrations.elexon import ElexonClient, ElexonError
from tests.factories import load_fixture

BASE = "https://elexon.test/bmrs/api/v1"
WINDFOR = f"{BASE}/datasets/WINDFOR/stream"
FUELHH = f"{BASE}/datasets/FUELHH/stream"


@pytest.fixture
async def elexon() -> AsyncIterator[ElexonClient]:
    async with httpx.AsyncClient(base_url=BASE) as http:
        yield ElexonClient(http, max_concurrency=2, backoff_s=0)


async def test_forecasts_are_requested_by_publish_day(
    elexon: ElexonClient, respx_mock: respx.MockRouter
) -> None:
    route = respx_mock.get(WINDFOR).mock(
        return_value=httpx.Response(200, json=load_fixture("windfor_sample.json"))
    )

    rows = await elexon.wind_forecasts(date(2026, 1, 14))

    params = route.calls.last.request.url.params
    assert params["publishDateTimeFrom"] == "2026-01-14T00:00:00Z"
    assert params["publishDateTimeTo"] == "2026-01-15T00:00:00Z"
    assert len(rows) == 6
    assert {row.publish_time.hour for row in rows} == {8, 10}


async def test_actuals_are_requested_for_one_settlement_day_wind_only(
    elexon: ElexonClient, respx_mock: respx.MockRouter
) -> None:
    route = respx_mock.get(FUELHH).mock(
        return_value=httpx.Response(200, json=load_fixture("fuelhh_wind_sample.json"))
    )

    rows = await elexon.wind_actuals(date(2026, 1, 14))

    params = route.calls.last.request.url.params
    assert params["settlementDateFrom"] == params["settlementDateTo"] == "2026-01-14"
    assert params["fuelType"] == "WIND"
    assert [row.settlement_period for row in rows] == [1, 2, 3, 4]


async def test_server_errors_are_retried(
    elexon: ElexonClient, respx_mock: respx.MockRouter
) -> None:
    route = respx_mock.get(WINDFOR).mock(
        side_effect=[httpx.Response(503), httpx.Response(429), httpx.Response(200, json=[])]
    )

    assert await elexon.wind_forecasts(date(2026, 1, 14)) == []
    assert route.call_count == 3


async def test_it_gives_up_after_four_attempts(
    elexon: ElexonClient, respx_mock: respx.MockRouter
) -> None:
    route = respx_mock.get(WINDFOR).mock(return_value=httpx.Response(502))

    with pytest.raises(httpx.HTTPStatusError):
        await elexon.wind_forecasts(date(2026, 1, 14))
    assert route.call_count == 4


async def test_client_errors_are_not_retried(
    elexon: ElexonClient, respx_mock: respx.MockRouter
) -> None:
    route = respx_mock.get(WINDFOR).mock(return_value=httpx.Response(400, json={"error": "bad"}))

    with pytest.raises(httpx.HTTPStatusError):
        await elexon.wind_forecasts(date(2026, 1, 14))
    assert route.call_count == 1


async def test_network_errors_are_retried(
    elexon: ElexonClient, respx_mock: respx.MockRouter
) -> None:
    route = respx_mock.get(FUELHH).mock(
        side_effect=[httpx.ConnectTimeout("slow"), httpx.Response(200, json=[])]
    )

    assert await elexon.wind_actuals(date(2026, 1, 14)) == []
    assert route.call_count == 2


async def test_a_payload_that_is_not_a_list_is_an_error(
    elexon: ElexonClient, respx_mock: respx.MockRouter
) -> None:
    respx_mock.get(WINDFOR).mock(return_value=httpx.Response(200, json={"data": []}))

    with pytest.raises(ElexonError):
        await elexon.wind_forecasts(date(2026, 1, 14))


async def test_requests_in_flight_never_exceed_the_limit(respx_mock: respx.MockRouter) -> None:
    in_flight = 0
    peak = 0

    async def slow_response(_: httpx.Request) -> httpx.Response:
        nonlocal in_flight, peak
        in_flight += 1
        peak = max(peak, in_flight)
        await asyncio.sleep(0.01)
        in_flight -= 1
        return httpx.Response(200, json=[])

    respx_mock.get(WINDFOR).mock(side_effect=slow_response)
    async with httpx.AsyncClient(base_url=BASE) as http:
        elexon = ElexonClient(http, max_concurrency=2, backoff_s=0)
        await asyncio.gather(*(elexon.wind_forecasts(date(2026, 1, day)) for day in range(1, 9)))

    assert peak == 2
