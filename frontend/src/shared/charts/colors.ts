/**
 * Chart colours by role, defined as CSS variables in app/global.css with separate,
 * validated steps for light and dark mode (dataviz palette checks: lightness band,
 * colour-blind separation, contrast against the panel).
 */
export const chart = {
  ink: 'var(--chart-ink)', // actuals: what really happened
  series1: 'var(--chart-series-1)', // amber: the forecast you bid with / MAE
  series2: 'var(--chart-series-2)', // recessive gray: a comparison run / P90
  corrected: 'var(--chart-corrected)', // deep green: the learned correction
  beyond: 'var(--chart-beyond)', // ink: shortfalls beyond the buffer
  band: 'var(--chart-band)', // amber tint: the likely range around the forecast
  zone: 'var(--chart-zone)', // green tint: a window of time (the delivery day, your lead times)
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
  text: 'var(--chart-text)',
  surface: 'var(--chart-surface)',
} as const

/**
 * Sequential steps for the heatmap: one hue (the published forecast's amber), light to
 * dark. Validated as an ordinal ramp: monotone lightness, a visible step between
 * neighbours, and a light end that still clears the white panel (2:1).
 */
export const SEQUENTIAL = [
  '#dcaa5f',
  '#d38e2e',
  '#c77100',
  '#b45700',
  '#9a4300',
  '#7d3404',
  '#612607',
]
