// Chart palette. Marks reference the theme tokens as CSS variables, so a chart
// drawn once follows the light/dark switch without re-rendering. The hex
// helpers remain for callers that need to interpolate between two literal
// colours (a CSS variable cannot be interpolated in JavaScript).

import type { BadgeTone } from '../Badge'

export const CHART_COLORS = {
  emerald: 'var(--color-series-1)',
  teal: 'var(--color-series-2)',
  slate: 'var(--color-series-3)',
  warmGray: 'var(--color-series-4)',
  pewter: 'var(--color-series-5)',
  grid: 'var(--color-charcoal)',
  axis: 'var(--color-ash)',
  hover: 'var(--color-onyx)',
  text: 'var(--color-ghost)',
  amber: 'var(--color-amber)',
  red: 'var(--color-red)',
  /** The status hues of `Badge`, for a chart whose slices are the same states as a row of badges. */
  blue: 'var(--color-blue)',
  green: 'var(--color-green)',
  neutral: 'var(--color-pewter)',
} as const

/** The colour of a `Badge` tone, for chart marks that stand for the same states as a row of tags. */
export const TONE_COLORS: Readonly<Record<BadgeTone, string>> = {
  ok: CHART_COLORS.emerald,
  accent: CHART_COLORS.emerald,
  done: CHART_COLORS.green,
  info: CHART_COLORS.blue,
  warn: CHART_COLORS.amber,
  danger: CHART_COLORS.red,
  neutral: CHART_COLORS.neutral,
  slate: 'var(--color-slate)',
  violet: 'var(--color-violet)',
}

/** Series order: emerald first, then the companions, then the greys. */
export const SERIES_COLORS: string[] = [
  CHART_COLORS.emerald,
  CHART_COLORS.teal,
  CHART_COLORS.slate,
  CHART_COLORS.warmGray,
  CHART_COLORS.pewter,
]

export function seriesColor(index: number): string {
  return SERIES_COLORS[((index % SERIES_COLORS.length) + SERIES_COLORS.length) % SERIES_COLORS.length] as string
}

interface Rgb {
  r: number
  g: number
  b: number
}

export function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '')
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value
  const int = Number.parseInt(full, 16)
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const hex = (n: number) =>
    Math.round(Math.min(Math.max(n, 0), 255))
      .toString(16)
      .padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/** Linear mix of two hex colours; `t=0` → `a`, `t=1` → `b`. */
export function mix(a: string, b: string, t: number): string {
  const clamped = Math.min(Math.max(t, 0), 1)
  const from = hexToRgb(a)
  const to = hexToRgb(b)
  return rgbToHex({
    r: from.r + (to.r - from.r) * clamped,
    g: from.g + (to.g - from.g) * clamped,
    b: from.b + (to.b - from.b) * clamped,
  })
}
