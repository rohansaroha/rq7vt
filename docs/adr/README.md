# Architecture decision records

Short notes on decisions a reviewer might question: the context, what we chose, what we
rejected, and what follows from it. New decisions get the next number; a reversed decision
gets a new record that supersedes the old one.

| ADR | Decision |
| --- | --- |
| [0001](0001-forecast-selection-rule.md) | The forecast "available at decision time" is the latest run published before the auction's gate closes |
| [0002](0002-hourly-alignment.md) | Accuracy is scored on the hour, joining forecasts and actuals on startTime |
| [0003](0003-analysis-window.md) | "Decisions made in January 2026" means delivery days 2 January to 1 February |
| [0004](0004-hosting-and-storage.md) | Postgres everywhere; Vercel (web + API) and Neon in production; Docker locally |
| [0005](0005-sync-handlers-async-ingestion.md) | Async where the waiting is (ingestion), plain `def` route handlers for CPU-bound analytics |
| [0006](0006-delivery-day-starts-at-23-00.md) | A delivery day runs 23:00 to 23:00 UK time, as the GB day-ahead auctions define it |
| [0007](0007-learned-correction.md) | A learned correction scales each day's forecast by the recent ratio of actual to forecast |
