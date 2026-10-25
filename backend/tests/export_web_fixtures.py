"""Write real API responses, computed on the synthetic month, as frontend test fixtures.

    uv run python -m tests.export_web_fixtures ../frontend/src/test/fixtures

The frontend's tests then run against exactly what this API returns, and the type
checker flags any fixture that drifts from the OpenAPI contract.
"""

import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

# The app needs a database URL to start; these responses never touch a database.
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://unused@localhost/unused")

from fastapi.testclient import TestClient

from app.api.deps import get_actuals, get_forecasts, get_ingestion_log
from app.main import create_app
from tests.fakes import FakeActuals, FakeForecasts, FakeIngestionLog
from tests.synthetic import build_world

FIXTURES = {
    "meta.json": "/api/v1/meta",
    "decision-2026-01-14.json": "/api/v1/forecasts/decision?day=2026-01-14&gate=09:20",
    "decision-2026-01-14-1530.json": "/api/v1/forecasts/decision?day=2026-01-14&gate=15:30",
    "runs-2026-01-14.json": "/api/v1/forecasts/runs?day=2026-01-14",
    "accuracy-gate-0920.json": "/api/v1/accuracy/summary?mode=gate&gate=09:20",
    "accuracy-horizon-6.json": "/api/v1/accuracy/summary?mode=horizon&horizon_h=6",
    "lead-time.json": "/api/v1/accuracy/lead-time",
}


def main(out_dir: Path) -> None:
    world = build_world()
    app = create_app()
    app.dependency_overrides[get_forecasts] = lambda: FakeForecasts(world.forecasts)
    app.dependency_overrides[get_actuals] = lambda: FakeActuals(world.actuals)
    ingested = datetime(2026, 2, 3, 6, 0, tzinfo=UTC)
    app.dependency_overrides[get_ingestion_log] = lambda: FakeIngestionLog(
        {"actuals": ingested, "forecasts": ingested}
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    with TestClient(app) as client:
        for name, url in FIXTURES.items():
            response = client.get(url)
            response.raise_for_status()
            (out_dir / name).write_text(json.dumps(response.json(), indent=2) + "\n")
            print(f"{name}: {len(response.content):,} bytes")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
