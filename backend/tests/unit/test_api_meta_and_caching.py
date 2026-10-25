from fastapi.testclient import TestClient

DECISION = "/api/v1/forecasts/decision?day=2026-01-14"


def test_meta_describes_the_period_auctions_and_data(world_client: TestClient) -> None:
    response = world_client.get("/api/v1/meta")

    body = response.json()
    assert body["period"] == {
        "first_day": "2026-01-02",
        "last_day": "2026-02-01",
        "starts_at": "2026-01-01T23:00:00Z",
        "ends_at": "2026-02-01T23:00:00Z",
        "timezone": "Europe/London",
    }
    assert [g["time"] for g in body["gates"]] == ["09:20", "09:50", "15:30"]
    assert body["default_gate"] == "09:20"
    assert body["horizon"] == {"min_h": 0, "max_h": 48, "default_h": 24}
    forecasts = next(d for d in body["datasets"] if d["name"] == "forecasts")
    assert forecasts["runs"] == 64 * 8  # 1 Dec to 2 Feb, eight runs a day
    assert body["data_as_of"] == "2026-02-03T06:00:00Z"
    assert response.headers["cache-control"] == "public, max-age=60, s-maxage=60"


def test_data_responses_can_be_cached_and_revalidated(world_client: TestClient) -> None:
    first = world_client.get(DECISION)

    assert first.headers["cache-control"].startswith("public, max-age=300, s-maxage=86400")
    etag = first.headers["etag"]
    assert etag.startswith('W/"')

    again = world_client.get(DECISION, headers={"If-None-Match": etag})

    assert again.status_code == 304
    assert again.content == b""
    assert again.headers["etag"] == etag
    assert "content-type" not in again.headers
    assert "x-request-id" in again.headers  # still traceable


def test_a_different_query_gets_a_different_etag(world_client: TestClient) -> None:
    a = world_client.get(DECISION).headers["etag"]
    b = world_client.get(DECISION + "&gate=15:30").headers["etag"]

    assert a != b
    assert world_client.get(DECISION, headers={"If-None-Match": b}).status_code == 200


def test_errors_and_health_are_never_cached(world_client: TestClient, client: TestClient) -> None:
    error = world_client.get("/api/v1/forecasts/decision?day=1999-01-01")
    health = client.get("/api/v1/health")

    assert "etag" not in error.headers
    assert "public" not in error.headers.get("cache-control", "")
    assert "etag" not in health.headers
    assert health.headers["cache-control"] == "no-store"
