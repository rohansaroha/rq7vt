# Wind Forecast Portal

A web app for a UK energy buyer who purchases power on the day-ahead market. It answers two
questions about national wind generation in January 2026:

1. **What did the wind forecast say when we had to place our order?** The latest Elexon
   WINDFOR run published before the auction's gate closed, next to what actually happened.
2. **How far can we trust that forecast?** Its error, measured several ways, and the buffer
   to hold so that shortfalls are covered as often as the buyer chooses.

Data comes only from Elexon's public Insights API: `FUELHH` (actual generation, fuel type
WIND) and `WINDFOR` (wind forecasts).

**Live app:** link added after deployment.

## Status

| Part | State |
| --- | --- |
| Repo, tooling, Docker | Done |
| Data layer and ingestion (Elexon to Postgres) | Done |
| Forecast selection, accuracy metrics, API endpoints | Done |
| Decision, Accuracy and Method views | Done |
| Deployment (Vercel + Neon) | Next |

## Repository layout

```text
.
├── backend/                     Python 3.12, FastAPI, SQLAlchemy, Alembic
│   ├── app/
│   │   ├── main.py              App factory; `app` is what uvicorn and Vercel load
│   │   ├── core/                Settings, logging, database engine, errors, middleware
│   │   ├── api/v1/              Route handlers (HTTP only, no business logic)
│   │   ├── schemas/             Pydantic response models = the API contract
│   │   ├── services/            Use cases: repositories in, domain logic, response out
│   │   ├── domain/              Pure functions: forecast selection, metrics
│   │   ├── repositories/        Database reads and idempotent upserts
│   │   ├── db/                  Table models and Alembic migrations
│   │   ├── integrations/elexon/ Async Elexon client and row validation (DTOs)
│   │   ├── ingestion/           CLI jobs: probe and backfill
│   │   └── openapi.py           Writes the OpenAPI schema without starting a server
│   ├── tests/                   Unit tests, Postgres integration tests, fixtures
│   ├── pyproject.toml, uv.lock  Dependencies and tool config (Ruff, mypy, pytest)
│   └── Dockerfile               Multi-stage image, non-root
├── frontend/                    React 19, Vite, TypeScript, Radix Themes, TanStack Query + Router
│   ├── src/app/                 Providers, router (loaders, URL state), app shell
│   ├── src/routes/              One component per page; Accuracy and Method load lazily
│   ├── src/features/            decision/, accuracy/, method/, meta/: views, queries, tests
│   ├── src/shared/api/          Typed API client; schema generated from the backend
│   ├── src/shared/charts/       Chart parts: D3 for scales and paths, React for the SVG
│   ├── src/test/                Test setup, the mock API (MSW), fixtures from the real API
│   └── Dockerfile, nginx.conf   Static build served by nginx, /api proxied to the backend
├── docs/adr/                    Architecture decision records
├── docker/postgres-init/        Creates the integration-test database
├── docker-compose.yml           Postgres + API + web, plus a one-off ingest job
├── Makefile                     Every command you need; run `make` to list them
└── vercel.json                  One Vercel project: /api to the FastAPI app, the rest to the web app
```

## Running it locally

You need [uv](https://docs.astral.sh/uv/) (it installs Python 3.12 for you) and Node 22 or
newer. pnpm is optional: `make` falls back to `npx pnpm`. For the database, use either
[Docker Desktop](https://www.docker.com/products/docker-desktop/) or a Postgres you already run.

```bash
make setup      # install dependencies; creates backend/.env
make db         # Postgres in Docker, on port 54320 so it never clashes with another Postgres
                #   no Docker? `make local-db` uses the Postgres already on your machine instead
make migrate    # create the tables
make probe      # optional: what Elexon publishes for 14 January 2026
make ingest     # load 29 Dec 2025 to 2 Feb 2026 from Elexon (about a minute, safe to re-run)
make dev        # API on http://localhost:8000 (docs at /api/v1/docs), app on http://localhost:5173
```

Something not working? `make doctor` checks each piece in order and says how to fix it.

To run the whole stack in Docker instead: `make up`, then `make ingest-docker` in a second
terminal.

## Commands

| Command | What it does |
| --- | --- |
| `make check` | Lint, types and unit tests for both apps |
| `make doctor` | Check tools, database, data and API; say how to fix what is wrong |
| `make test-integration` | Backend tests against a real Postgres (`wind_test` database) |
| `make api-types` | Regenerate the OpenAPI snapshot and the frontend's API types |
| `make web-fixtures` | Regenerate the frontend's test fixtures from real API responses |
| `make fixtures DAY=2026-01-14` | Save Elexon's raw responses for one day as test fixtures |
| `make down` | Stop the Docker stack |

## Deploying (Vercel + Neon)

One Vercel project serves both apps with [Vercel Services](https://vercel.com/docs/services):
`vercel.json` sends `/api/*` to the FastAPI app in `backend/` and everything else to the Vite
build in `frontend/`, so the browser talks to one origin. The data lives in a free Neon
Postgres database ([ADR 0004](docs/adr/0004-hosting-and-storage.md)).

1. Import the repo at [vercel.com/new](https://vercel.com/new) and deploy it. Until a database
   is connected the site loads, and the API answers 503 "Database not configured".
2. In the project, open **Storage**, create a **Neon** database on the free plan and connect it
   to the project. That adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to its settings.
3. Load the data from your machine, through the unpooled (direct) URL:

   ```bash
   DATABASE_URL='<the DATABASE_URL_UNPOOLED value>' make migrate ingest
   ```

4. Redeploy, so the API picks up the new variables and the CDN starts with an empty cache.

Database URLs work as Neon hands them out (`postgres://...`). On Vercel the API keeps no
connection pool of its own and leaves pooling to Neon (`DB_NULL_POOL` is on when `VERCEL=1`).

## API

Interactive docs at `/api/v1/docs`. Errors are RFC 9457 problem documents; data responses
carry `Cache-Control` and an `ETag`, so repeat requests can get an empty `304`.

| Endpoint | Returns |
| --- | --- |
| `GET /api/v1/meta` | The period, the auctions and their gates, horizons, data freshness |
| `GET /api/v1/forecasts/decision?day=2026-01-14&gate=09:20` | The run available at the gate against the actuals for one delivery day, with a likely range |
| `GET /api/v1/forecasts/runs?day=2026-01-14` | Every run published the day before delivery, each scored on the day |
| `GET /api/v1/accuracy/summary?mode=gate&gate=09:20` | MAE, RMSE, bias, nMAE, P10/P50/P90, coverage, error histogram, buffer for each cost ratio |
| `GET /api/v1/accuracy/summary?mode=horizon&horizon_h=24` | The same, for the latest run published at least `horizon_h` hours ahead |
| `GET /api/v1/accuracy/lead-time` | Error against lead time (0 to 48 hours), and by hour of day |
| `GET /api/v1/health` | Liveness and a database check |

## How the numbers are made

- **Which forecast:** for each delivery hour, the latest WINDFOR run published before the
  auction's gate closes on the day before delivery: at the default 09:20 gate, the 07:30 run.
  Nothing published at or after the gate is ever used
  ([ADR 0001](docs/adr/0001-forecast-selection-rule.md)).
- **Delivery day:** 23:00 to 23:00 UK time, as the GB day-ahead auctions define it
  ([ADR 0006](docs/adr/0006-delivery-day-starts-at-23-00.md)).
- **Error:** forecast minus actual, scored on the hour
  ([ADR 0002](docs/adr/0002-hourly-alignment.md)). Positive means the buyer was short.
- **Buffer:** if being short costs `r` times being long, hold the `r / (r + 1)` quantile of
  past errors (the newsvendor rule). At 9:1 that is the P90 shortfall.

## The web app

- **Decision** (`/`): pick a delivery day and an auction. The page shows the forecast you bid
  with, the actuals, an 80% likely range, every run published that day, and the buffer to hold.
- **Accuracy** (`/accuracy`): score the run at a gate or at a fixed lead time. It shows the
  headline metrics, error against lead time, a heatmap by hour and lead time, and a buffer
  sized from the cost of being short.
- **Method** (`/method`): the rule, the measures and the assumptions, in plain words.

Every choice lives in the URL (validated with Zod), so any view can be bookmarked or shared.
Route loaders start each page's requests before it renders, and again when a link is hovered.
TanStack Query caches the responses and keeps the previous chart on screen while new data loads.
Every chart has a table view and uses colours
checked for colour-blind separation and contrast.

## How data gets in

`python -m app.ingestion backfill` fetches day-sized windows from Elexon, at most four
requests at a time, retrying network errors, 429 and 5xx with exponential backoff. Rows are
validated, de-duplicated and upserted, so a second run changes nothing. Every run is
recorded in the `ingestion_run` table, including failed ones. See
[ADR 0005](docs/adr/0005-sync-handlers-async-ingestion.md).

## Key decisions

The decisions behind the numbers, such as which forecast counts as "available at decision
time" and what "January 2026" covers, are in [docs/adr](docs/adr/README.md).

## Use of AI tools

This project was built with help from Claude, an AI assistant by Anthropic, for planning,
scaffolding, writing code, tests and documentation. Every change was reviewed and run, and is
covered by the tests above.
