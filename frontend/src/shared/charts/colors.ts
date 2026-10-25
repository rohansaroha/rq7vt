/**
 * Chart colours by role, defined as CSS variables in app/global.css with separate,
 * validated steps for light and dark mode (dataviz palette checks: lightness band,
 * colour-blind separation, contrast against the panel).
 */
export const chart = {
  ink: 'var(--chart-ink)', // actuals: what really happened
  series1: 'var(--chart-series-1)', // the forecast you bid with / MAE
  series2: 'var(--chart-series-2)', // a comparison run / P90
  corrected: 'var(--chart-corrected)', // the learned correction
  band: 'var(--chart-band)',
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
  text: 'var(--chart-text)',
  surface: 'var(--chart-surface)',
} as const

/** Sequential steps for the heatmap: one hue (the published forecast's blue), light to dark. */
export const SEQUENTIAL = [
  '#cde2fb',
  '#b7d3f6',
  '#9ec5f4',
  '#86b6ef',
  '#5598e7',
  '#2a78d6',
  '#256abf',
  '#184f95',
  '#0d366b',
]
