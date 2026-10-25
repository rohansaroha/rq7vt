# 0004: Postgres everywhere; Vercel and Neon in production; Docker locally

Status: accepted

## Context
The brief requires Docker and a deployment on Vercel or Heroku. Heroku moved to a
sustaining-engineering model in February 2026 and has no free tier; Vercel deploys FastAPI as a
single function with zero configuration and has a free tier; Neon offers free Postgres
through the Vercel Marketplace.

## Decision
- One database engine everywhere: Postgres 16 in Docker locally, Neon in production.
  Tests run against Postgres, never SQLite, because upserts (`ON CONFLICT`) and `timestamptz`
  are Postgres features.
- Production: one Vercel project with two [services](https://vercel.com/docs/services): the
  Vite build on Vercel's CDN and the FastAPI app as a Vercel Function, with `/api/*` routed to
  it so the browser sees one origin. The API uses Neon's pooled connection string and
  `NullPool`, which is on by default on Vercel (`VERCEL=1`).
- Both apps have Docker images: `docker compose up` runs the full stack, and the same API
  image could ship to any container host.

## Alternatives
- Heroku with the container stack: Docker would also be the deploy unit, at roughly $10-15 a
  month, on a platform no longer adding features.
- A committed SQLite or Parquet snapshot: simpler hosting, weaker production story.

## Consequences
- Serverless cold starts: keep imports lean and cache immutable responses at the CDN.
- The API's database role should be read-only; only ingestion writes.
- Vercel Services are in beta. If they change, the fallback is two projects, with the web
  project rewriting `/api/*` to the API's URL.
