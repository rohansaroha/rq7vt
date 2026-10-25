# 0007: A learned correction scales each day's forecast by the recent ratio of actual to forecast

Status: accepted

## Context
In January 2026 WINDFOR ran high at every gate: at 09:20 the forecast sat about 1.7 GW above
metered output on average, against a typical miss of about 2 GW. A lean that steady can be
learned from data the buyer already holds when they bid, and taking it out shrinks both the
typical miss and the cover they need to buy.

## Decision
For delivery day D, every hour of the gate's forecast is multiplied by one factor:

    factor(D) = sum of actuals / sum of forecasts, over delivery days D-29 to D-2

The sums use the forecasts the same gate selected on those days, over the hours that have
both a forecast and an actual. D-2 is the last day fully metered when the bid for D is made
on D-1, so nothing published or metered after the gate is used: every corrected number is
out of sample. With fewer than 7 known days there is no correction (the factor is 1).

The correction is computed on request from the stored data, in `app/domain/correction.py`.
The API exposes it as `forecast=corrected` on `/accuracy/summary` (gate mode only), as the
`correction` block and the `corrected_*` fields of `/forecasts/decision`, and per day on
`/accuracy/days`. The app calls it the "learned correction".

## Alternatives
Compared out of sample on January at the 09:20 gate, training only on days up to D-2. Each
was worse than the 28-day ratio on both the typical miss and the P90 shortfall:
- The same ratio over 14 or 7 days.
- Subtracting the mean error of the last 28 days (an additive correction). A fixed offset can
  also push a calm day's forecast below zero, which a factor never does.
- Subtracting the median error for each hour of the day, over 14 days.
- No correction: the published forecast, which the app always shows alongside.

## Consequences
- Ingestion starts on 1 December 2025, so that 2 January has four weeks of history (ADR 0003).
- One factor per day removes a level bias. It cannot fix timing errors, such as a front that
  arrives hours late, and a four-week window lags if the lean changes sign. Per-lead-time
  factors, or weighting recent days more, are the natural next steps; a new ADR would
  supersede this one.
- The likely range and the buffer describe the whole period (in sample). The correction is
  the one number built only from what was known at the gate, and the Method page says so.
