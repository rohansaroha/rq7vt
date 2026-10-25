# 0002: Score accuracy on the hour

Status: accepted

## Context
WINDFOR values are hourly; FUELHH actuals are half-hourly averages. The brief describes both
`startTime` fields as "similar", which suggests matching on them.

## Decision
Join forecasts and actuals on `startTime` and score each hour where both exist. Charts still
show actuals at their full half-hourly resolution.

## Alternatives
- Average the two half-hours of each hour: smoother, but it compares a forecast value with a
  window it may not describe, and departs from the brief's hint.
- Interpolate forecasts to half-hours: invents data.

## Consequences
- 24 scored points per day; half-hours at :30 do not enter the metrics.
- Easy to change later: alignment is one pure function in the domain layer.
