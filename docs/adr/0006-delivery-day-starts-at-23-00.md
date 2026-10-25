# 0006: A delivery day runs 23:00 to 23:00 UK time

Status: accepted

## Context
The GB day-ahead auctions sell the next delivery day hour by hour (or half-hour by
half-hour). Nord Pool's GB day-ahead market regulations say each price calculation "relates
to the following day starting from 23:00 UK time": the GB day is aligned with the
continental day it is coupled to. FUELHH, by contrast, reports by settlement day, 00:00 to
24:00 UK time.

## Decision
Delivery day D runs from 23:00 UK time on D-1 to 23:00 on D. Its hours are the ones bought
in the auctions that close on D-1, so all of them are scored against the forecast available
at that gate. Every conversion between UK time and UTC lives in `app/domain/calendar.py`
(Europe/London), so days have 23, 24 or 25 hours across clock changes.

## Alternatives
- The settlement day, 00:00 to 24:00: matches FUELHH, but scores the 23:00 hour of each day
  against the wrong auction's forecast (1 hour in 24).

## Consequences
- In January (GMT) the 09:20 gate on D-1 uses the 07:30 run, which looks 15.5 to 38.5 hours
  ahead across the day.
- A day's chart runs from 23:00 to 23:00, and the app says so.
- Nord Pool states the 23:00 start explicitly; we assume the EPEX GB auctions use the same day.
