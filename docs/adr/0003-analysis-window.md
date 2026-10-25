# 0003: "Decisions made in January 2026" means delivery days 2 January to 1 February

Status: accepted

## Context
The brief scopes the app to "purchase decisions to be made in January 2026". Decisions on
D-1 are for delivery on D, so a decision made on 31 January is for 1 February.

## Decision
Score delivery days 2 January to 1 February 2026. Ingest 29 December 2025 to 2 February 2026
so the fixed-horizon view (up to 48 hours) and either reading have data. Both windows are
settings (`ANALYSIS_*`, `INGEST_*`).

## Alternatives
- Delivery days 1 to 31 January: the more casual reading. One setting change switches to it.

## Consequences
- The README and the app's Method page state the assumption.
