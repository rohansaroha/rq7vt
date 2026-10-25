/** Shared mark geometry for the charts (dataviz mark specs). */

const RADIUS = 4

/** Dash patterns: the second encoding (after hue) that tells the forecast lines apart. */
export const DASH = { corrected: '7 4', compare: '2 4' } as const

/** A column with a rounded data end and a square foot on the baseline. */
export function column(x: number, y: number, width: number, height: number): string {
  const r = Math.min(RADIUS, width / 2, height)
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`
}
