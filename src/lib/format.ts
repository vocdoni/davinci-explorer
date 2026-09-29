// Pure presentation helpers. Numbers, dates and relative times follow the
// active language (`i18n.locale`) through `Intl`; hex stays as it is.

import { i18n } from '@lingui/core'

/** Truncate a 0x-prefixed hex string to "0xABCD…1234" form. */
export function shortHash(value: string | undefined | null, head = 6, tail = 4): string {
  if (!value) return ''
  if (!value.startsWith('0x')) return value
  if (value.length <= head + tail + 2) return value
  return `${value.slice(0, 2 + head)}…${value.slice(-tail)}`
}

/** Truncate an Ethereum address to "0xABCD…1234" form. */
export function shortAddress(addr: string | undefined | null): string {
  return shortHash(addr, 4, 4)
}

/** A bigint as 0x-prefixed, zero-padded 64-hex-digit string. */
export function bigIntToHex(value: bigint): `0x${string}` {
  return `0x${value.toString(16).padStart(64, '0')}`
}

// ── Intl, per active locale ─────────────────────────────────────────────────

/** The active language, for anything that formats by hand. */
export function currentLocale(): string {
  return i18n.locale || 'en'
}

const formatters = new Map<string, unknown>()

function cached<T>(kind: string, options: object, make: (locale: string) => T): T {
  const locale = currentLocale()
  const key = `${kind}|${locale}|${JSON.stringify(options)}`
  let f = formatters.get(key) as T | undefined
  if (!f) {
    f = make(locale)
    formatters.set(key, f)
  }
  return f
}

const numberFormat = (options: Intl.NumberFormatOptions = {}) =>
  cached('number', options, (l) => new Intl.NumberFormat(l, options))
const dateFormat = (options: Intl.DateTimeFormatOptions) =>
  cached('date', options, (l) => new Intl.DateTimeFormat(l, options))
const relativeFormat = (numeric: 'auto' | 'always' = 'auto') =>
  cached('relative', { numeric }, (l) => new Intl.RelativeTimeFormat(l, { numeric, style: 'short' }))

/** The decimal separator of the active language. */
function decimalSeparator(): string {
  return (
    numberFormat({ minimumFractionDigits: 1 })
      .formatToParts(1.5)
      .find((p) => p.type === 'decimal')?.value ?? '.'
  )
}

// ── numbers ──────────────────────────────────────────────────────────────────

/** Thousands separators; bigints and numbers alike. */
export function formatNumber(value: number | bigint | null | undefined): string {
  if (value == null) return '—'
  return numberFormat().format(value)
}

/** Share as a percentage with one decimal; `null` total gives a dash. */
export function formatShare(part: number, total: number): string {
  if (!(total > 0)) return '—'
  return formatPercent(part / total, 1)
}

/** A fraction as a percentage: 0.4213 → "42.1%" (English), "42,1 %" (Spanish). */
export function formatPercent(fraction: number, digits = 1): string {
  return numberFormat({ style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
    fraction
  )
}

/** Short form for axes and legends: 1234 → "1.2K" (English), "1,2 mil" (Spanish). */
export function formatCompact(value: number): string {
  return numberFormat({ notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

/** Byte counts: "512 B", "1.5 KiB", "128 KiB". */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${formatNumber(bytes)} B`
  const kib = bytes / 1024
  if (kib < 1024) return `${numberFormat({ maximumFractionDigits: 1 }).format(kib)} KiB`
  const mib = kib / 1024
  const digits = mib < 10 ? 2 : 1
  return `${numberFormat({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(mib)} MiB`
}

/**
 * A wei amount in the chain's native unit with up to `digits` fraction
 * digits, trailing zeros trimmed: 123400000000000n → "0.0001234". Exact:
 * the digits come from the bigint, only the separators from the locale.
 */
export function formatWei(wei: bigint | null | undefined, digits = 6): string {
  if (wei == null) return '—'
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const whole = abs / 10n ** 18n
  const frac = (abs % 10n ** 18n).toString().padStart(18, '0').slice(0, digits).replace(/0+$/, '')
  const point = decimalSeparator()
  const text = frac ? `${formatNumber(whole)}${point}${frac}` : formatNumber(whole)
  if (text === '0' && abs > 0n) return `<0${point}${'0'.repeat(Math.max(0, digits - 1))}1`
  return negative ? `-${text}` : text
}

/** A wei price in gwei with two decimals: 1_500_000_000n → "1.50". */
export function formatGwei(wei: bigint | null | undefined): string {
  if (wei == null) return '—'
  const hundredths = (wei + 5_000_000n) / 10_000_000n
  return `${formatNumber(hundredths / 100n)}${decimalSeparator()}${(hundredths % 100n).toString().padStart(2, '0')}`
}

/** "a, b and c" in the active language. */
export function formatList(items: string[], type: 'conjunction' | 'disjunction' = 'conjunction'): string {
  return cached('list', { type }, (l) => new Intl.ListFormat(l, { type })).format(items)
}

// ── time ─────────────────────────────────────────────────────────────────────

/**
 * Seconds as a coarse duration: "45 s", "12 min", "3 h 5 min", "4 d 2 h".
 * The unit symbols are the same in every language; the numbers are not.
 */
export function formatDuration(seconds: number | bigint | null | undefined): string {
  if (seconds == null) return '—'
  const n = (v: number) => formatNumber(v)
  const s = Math.max(0, Math.floor(Number(seconds)))
  if (s < 60) return `${n(s)} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${n(m)} min`
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 ? `${n(h)} h ${n(m % 60)} min` : `${n(h)} h`
  const d = Math.floor(h / 24)
  return h % 24 ? `${n(d)} d ${n(h % 24)} h` : `${n(d)} d`
}

/**
 * Seconds to the second under an hour ("2 min 30 s", "3 min", "45 s"), for
 * the registry's short windows, where `formatDuration` would round down.
 */
export function formatSeconds(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  if (s < 60 || s >= 3600 || s % 60 === 0) return formatDuration(s)
  return `${formatNumber(Math.floor(s / 60))} min ${formatNumber(s % 60)} s`
}

/** Unix seconds as a UTC date and time: "Sep 28, 2026, 14:03 UTC" in English. */
export function formatTimestamp(unixSeconds: number | bigint | null | undefined): string {
  if (unixSeconds == null) return '—'
  const d = new Date(Number(unixSeconds) * 1000)
  if (Number.isNaN(d.getTime())) return '—'
  return dateFormat({
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(d)
}

/** A UTC calendar day, given as unix seconds or `YYYY-MM-DD`: "Sep 28, 2026" in English. */
export function formatDate(value: number | string, style: 'medium' | 'short' = 'medium'): string {
  const d = typeof value === 'string' ? new Date(`${value}T00:00:00Z`) : new Date(value * 1000)
  if (Number.isNaN(d.getTime())) return '—'
  const options: Intl.DateTimeFormatOptions =
    style === 'short' ? { day: 'numeric', month: 'numeric', timeZone: 'UTC' } : { dateStyle: 'medium', timeZone: 'UTC' }
  return dateFormat(options).format(d)
}

/**
 * "5 min. ago", "in 3 hr.", "now": relative to `now` (unix seconds), in the
 * largest unit that fits, rounded to the nearest one (2 days 23 hours is
 * "in 3 days"). Days are always a number: 30 hours ahead may be the day
 * after tomorrow, so never "tomorrow".
 */
export function timeAgo(unixSeconds: number | null | undefined, now = Date.now() / 1000): string {
  if (unixSeconds == null) return '—'
  const delta = Math.round(unixSeconds - now)
  const abs = Math.abs(delta)
  const sign = delta < 0 ? -1 : 1
  const rtf = relativeFormat()
  if (abs < 10) return rtf.format(0, 'second')
  if (abs < 60) return rtf.format(sign * abs, 'second')
  const minutes = Math.round(abs / 60)
  if (minutes < 60) return rtf.format(sign * minutes, 'minute')
  const hours = Math.round(abs / 3600)
  if (hours < 24) return rtf.format(sign * hours, 'hour')
  return relativeFormat('always').format(sign * Math.max(1, Math.round(abs / 86_400)), 'day')
}
