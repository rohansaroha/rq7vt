/**
 * Chart colours by role, defined as CSS variables in app/global.css with separate,
 * validated steps for light and dark mode (dataviz palette checks: lightness band,
 * colour-blind separation, contrast against the panel).
 */
export const chart = {
  ink: 'var(--chart-ink)', // actuals: what really happened
  series1: 'var(--chart-series-1)', // the forecast you bid with / MAE
  series2: 'var(--chart-series-2)', // a comparison run / P90
  band: 'var(--chart-band)',
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
  text: 'var(--chart-text)',
  surface: 'var(--chart-surface)',
} as const

/** Sequential steps for the heatmap: one hue, light to dark (flips in dark mode). */
export const SEQUENTIAL = [3, 4, 5, 6, 7, 8, 9, 10, 11].map((step) => `var(--indigo-${step})`)
