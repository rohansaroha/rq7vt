/** Plain-English definitions shown next to the numbers: one source for every page. */
export const GLOSSARY = {
  mae: 'Mean absolute error: the typical size of an hourly miss, whichever way it went.',
  rmse: 'Root mean square error. Like MAE, but big misses count for more: far above MAE means occasional large surprises.',
  bias: 'The average error with its sign. Positive means the forecast ran above what the wind delivered, so a buyer who relied on it was short.',
  nmae: 'MAE as a share of average wind output, so periods with more or less wind compare fairly.',
  p90: 'Nine hours in ten, the wind fell short of the forecast by less than this. It is the cover a 9:1 cost ratio calls for.',
  coverage:
    'Share of delivery hours that had both a forecast and a metered actual, so could be scored.',
  energy: 'Wind energy over the delivery day (23:00 to 23:00 UK time): each hour’s MW, added up.',
  actual: 'Metered wind output from Elexon FUELHH, half-hour by half-hour.',
  worstShortfall:
    'The hour the wind came in furthest below the forecast: the most power you would have had to buy at short notice.',
  correction:
    'The published forecast times one factor per day, learned from the four weeks known at the gate: metered output divided by forecast output over delivery days D−29 to D−2.',
  leadTime: 'Hours between a forecast run being published and the hour it forecasts.',
  gate: 'When the auction stops taking bids, on the day before delivery. Only runs published before it can be traded on.',
} as const
