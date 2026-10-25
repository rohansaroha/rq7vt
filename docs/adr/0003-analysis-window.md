# 0003: "Decisions made in January 2026" means delivery days 2 January to 1 February

Status: accepted

## Context
The brief scopes the app to "purchase decisions to be made in January 2026". Decisions on
D-1 are for delivery on D, so a decision made on 31 January is for 1 February.

## Decision
Score delivery days 2 January to 1 February 2026. Ingest 1 December 2025 to 2 February 2026:
the fixed-horizon view (up to 48 hours) and either reading need the days around the window,
and the corrected forecast learns each day's factor from the four weeks before it
(ADR 0007), so 2 January needs history back to 4 December. Both windows are settings
(`ANALYSIS_*`, `INGEST_*`).

## Alternatives
- Delivery days 1 to 31 January: the more casual reading. One setting change switches to it.

## Consequences
- The README and the app's Method page state the assumption.
