# Run from the repo root. `make` lists the targets.
.DEFAULT_GOAL := help
BACKEND := backend
FRONTEND := frontend
DAY ?= 2026-01-14
# pnpm if it is installed, else the pinned version through npx: only Node is required.
PNPM := $(shell command -v pnpm >/dev/null 2>&1 && echo pnpm || echo npx --yes pnpm@10.34.8)
# Integration tests: TEST_DATABASE_URL from backend/.env (make local-db sets it), else Docker's.
TEST_DATABASE_URL ?= $(or $(shell sed -n 's/^TEST_DATABASE_URL=//p' $(BACKEND)/.env 2>/dev/null),postgresql+psycopg://postgres:postgres@localhost:54320/wind_test)

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

setup: ## Install dependencies (and create backend/.env if missing)
	@test -f $(BACKEND)/.env || { cp $(BACKEND)/.env.example $(BACKEND)/.env && echo "created backend/.env"; }
	cd $(BACKEND) && uv sync
	cd $(FRONTEND) && $(PNPM) install

db: ## Start Postgres in Docker (port 54320) and wait until it is ready
	docker compose up -d --wait db

local-db: ## No Docker? Use the Postgres already on your machine
	cd $(BACKEND) && uv run python -m app.ingestion local-db

doctor: ## Check tools, database, data and API, and say how to fix what is wrong
	@./scripts/doctor.sh

up: ## Run db, api and web in Docker (web on :5173, api on :8000)
	docker compose up --build

down: ## Stop the Docker stack
	docker compose down

migrate: ## Apply database migrations
	cd $(BACKEND) && uv run alembic upgrade head

probe: ## Show what Elexon publishes for one day, e.g. make probe DAY=2026-01-14
	cd $(BACKEND) && uv run python -m app.ingestion probe --day $(DAY)

fixtures: ## Save Elexon's raw responses for one day as test fixtures
	cd $(BACKEND) && uv run python -m app.ingestion probe --day $(DAY) --save-to tests/fixtures/recorded

ingest: ## Backfill actuals and forecasts for the configured window
	cd $(BACKEND) && uv run python -m app.ingestion backfill

ingest-docker: ## Same backfill, run inside the Docker stack
	docker compose run --rm ingest

api: ## Run the API with auto-reload on :8000
	cd $(BACKEND) && uv run uvicorn app.main:app --reload --port 8000

web: ## Run the web app with hot reload on :5173
	cd $(FRONTEND) && $(PNPM) dev

dev: ## Run the API and the web app together (Ctrl-C stops both)
	@$(MAKE) --no-print-directory -j2 api web

lint: ## Lint and format-check both apps
	cd $(BACKEND) && uv run ruff check . && uv run ruff format --check .
	cd $(FRONTEND) && $(PNPM) lint && $(PNPM) format:check

typecheck: ## Type-check both apps
	cd $(BACKEND) && uv run mypy
	cd $(FRONTEND) && $(PNPM) typecheck

test: ## Unit tests for both apps
	cd $(BACKEND) && uv run pytest
	cd $(FRONTEND) && $(PNPM) test

test-integration: ## Postgres integration tests against the wind_test database
	cd $(BACKEND) && TEST_DATABASE_URL=$(TEST_DATABASE_URL) uv run pytest -m integration

api-types: ## Regenerate the OpenAPI snapshot and the frontend's API types
	cd $(BACKEND) && uv run python -m app.openapi ../$(FRONTEND)/src/shared/api/openapi.json
	cd $(FRONTEND) && $(PNPM) api:types

web-fixtures: ## Regenerate the frontend's test fixtures from real API responses
	cd $(BACKEND) && uv run python -m tests.export_web_fixtures ../$(FRONTEND)/src/test/fixtures

check: lint typecheck test ## Lint, types and unit tests for both apps

.PHONY: help setup db local-db doctor up down migrate probe fixtures ingest ingest-docker api web dev lint typecheck test test-integration api-types web-fixtures check
