#!/usr/bin/env bash
# make doctor: checks what `make dev` needs, in order, and says how to fix each problem.
# Written for the bash 3.2 that ships with macOS.
set -u
cd "$(dirname "$0")/.."

failed=0
ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
bad() { printf '  \033[31m✗\033[0m %s\n      → %s\n' "$1" "$2"; failed=1; }
note() { printf '  \033[33m!\033[0m %s\n      → %s\n' "$1" "$2"; }

echo "Tools"
if command -v uv >/dev/null 2>&1; then ok "uv $(uv --version | cut -d' ' -f2)"; else bad "uv is not installed" "brew install uv"; fi
if command -v node >/dev/null 2>&1; then
  major=$(node -p 'process.versions.node.split(".")[0]')
  if [ "$major" -ge 22 ]; then ok "node $(node --version)"; else bad "node $(node --version) is too old" "install Node 22 or newer (nvm install 22, or brew install node@22)"; fi
else
  bad "node is not installed" "brew install node@22 (or nvm install 22)"
fi
if command -v pnpm >/dev/null 2>&1; then ok "pnpm $(pnpm --version)"; else note "pnpm is not installed" "fine: make runs it through npx (or: corepack enable)"; fi
docker_up=0
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then ok "Docker is running"; docker_up=1; else note "Docker is installed but not running" "open Docker Desktop, or use your own Postgres: make local-db"; fi
else
  note "Docker is not installed" "only needed for make db and make up; without it use: make local-db"
fi

echo "Project"
if [ -f backend/.env ]; then ok "backend/.env exists"; else bad "backend/.env is missing" "make setup"; fi
if [ -d backend/.venv ]; then ok "backend dependencies installed"; else bad "backend dependencies are missing" "make setup"; fi
if [ -d frontend/node_modules ]; then ok "frontend dependencies installed"; else bad "frontend dependencies are missing" "make setup"; fi

echo "Database"
if [ "$docker_up" -eq 1 ] && grep -q 'localhost:54320' backend/.env 2>/dev/null; then
  if docker compose ps --status running --services 2>/dev/null | grep -qx db; then ok "Docker Postgres is running"; else bad "Docker Postgres is not running" "make db"; fi
fi
if [ -d backend/.venv ] && [ -f backend/.env ]; then
  (cd backend && uv run --quiet python -m app.ingestion doctor) || failed=1
fi

echo "App"
if curl -fsS -m 3 http://localhost:8000/api/v1/health >/dev/null 2>&1; then ok "API is answering on http://localhost:8000"; else note "API is not running" "make dev (API and web together) or make api"; fi
if curl -fsS -m 3 -o /dev/null http://localhost:5173 2>/dev/null; then ok "web app is up on http://localhost:5173"; else note "web app is not running" "make dev (or make web)"; fi

echo
if [ "$failed" -eq 0 ]; then echo "Ready. Start everything with: make dev"; else echo "Fix the ✗ items above, top to bottom, then run make doctor again."; exit 1; fi
