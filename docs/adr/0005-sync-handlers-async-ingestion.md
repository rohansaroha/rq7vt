# 0005: Async where the waiting is; plain `def` handlers for analytics

Status: accepted

## Context
Ingestion makes about 72 HTTP calls (36 days x 2 datasets) and mostly waits on the network.
API requests read a small window from Postgres and then run pandas and NumPy, which is
CPU-bound.

## Decision
- Ingestion uses `httpx.AsyncClient` with a semaphore (at most 4 requests in flight),
  timeouts, and retries with exponential backoff for network errors, 429 and 5xx.
- Route handlers are plain `def`: FastAPI runs them in its threadpool, so pandas work never
  blocks the event loop. Database access is synchronous SQLAlchemy.

## Alternatives
- `async def` handlers with an async driver: CPU-bound pandas inside them would stall every
  other request unless pushed to a thread anyway.
- Sequential ingestion: simpler, but several times slower and no less polite with the limit.

## Consequences
- The ingestion job is a plain function, so it can later run as a Celery task, a Kubernetes
  CronJob or a Vercel Cron call without changes.
