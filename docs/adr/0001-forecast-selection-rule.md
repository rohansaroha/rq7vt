# 0001: The forecast at decision time is the last run before the gate

Status: accepted

## Context
The buying team bids in the GB day-ahead auctions on the day before delivery (D-1). In January
2026 WINDFOR published eight runs a day, at 02:30, 04:30, 07:30, 09:30, 11:30, 15:30, 18:30
and 22:30 UTC (UK time in winter); once, on 15 January, the 11:30 run came at 12:25. All the
runs published on a day cover the same 73 hours, 21:00 the evening before to 21:00 two days
after, so the first run of the day looks 66.5 hours ahead and the last 46.5. The brief asks
what the latest forecast was "when they need to make decisions", but not when that is.

## Decision
For delivery day D, the forecast is the latest WINDFOR run with `publishTime < gate closure on D-1`:
strictly before, because a run that arrives as the gate closes is too late to bid on.
The default gate is 09:20 UK (EPEX GB hourly auction); 09:50 (Nord Pool N2EX) and 15:30
(EPEX GB half-hourly auction) are presets. For analysis we also support a fixed horizon:
for target hour T, the latest run published at or before `T - h`, among runs that cover T.

## Alternatives
- One fixed time with no choice: simpler, but wrong for teams in the afternoon auction.
- "Latest run published before delivery": leaks information the buyer did not have.
- `publishTime <= gate closure`: the same runs at 09:20 and 09:50, but at 15:30 it would pick
  the run stamped 15:30:00, the instant the gate closes, on every day in January.
- The timetable instead of each run's `publishTime`: wrong whenever a run is late.

## Consequences
- No lookahead: a run published at or after the gate is never used. This is unit-tested and
  property-tested.
- In January the 09:20 gate always used the 07:30 run and the 09:50 gate the 09:30 run, two
  hours fresher, so the choice of auction changes the results. The 15:30 gate used the 11:30
  run, or the late 12:25 run on 15 January.
- At a fixed horizon the realised lead time is 0.5 to 3.5 hours longer than `h`, because runs
  come every 2 to 4 hours, at half past. The API reports the lead times used.
- Every hour is reachable up to 43 hours ahead. Beyond that, the late-evening and night hours
  (22:00 to 02:00) start to fall past the last hour of every run published early enough, so
  they are reported as not scored rather than filled in.
