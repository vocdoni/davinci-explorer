import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '@lingui/core'
import { messages } from '../locales/en/messages.po'
import {
  bigIntToHex,
  formatBytes,
  formatCompact,
  formatDate,
  formatDuration,
  formatSeconds,
  formatGwei,
  formatList,
  formatNumber,
  formatPercent,
  formatShare,
  formatTimestamp,
  formatWei,
  shortAddress,
  shortHash,
  timeAgo,
} from './format'

/** Formatting only reads the locale; no catalog needed. */
function inLocale(locale: 'es' | 'ca') {
  i18n.loadAndActivate({ locale, messages: {} })
}

afterEach(() => i18n.loadAndActivate({ locale: 'en', messages }))

describe('shortHash', () => {
  it('is empty-safe and leaves non-hex alone', () => {
    expect(shortHash(null)).toBe('')
    expect(shortHash('hello')).toBe('hello')
    expect(shortHash('0xabcd')).toBe('0xabcd')
  })

  it('truncates in the middle', () => {
    expect(shortHash(`0x${'a'.repeat(62)}`)).toBe('0xaaaaaa…aaaa')
    expect(shortAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234…5678')
  })
})

describe('numbers and units', () => {
  it('formats counts', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatNumber(10n ** 12n)).toBe('1,000,000,000,000')
    expect(formatNumber(null)).toBe('—')
  })

  it('pads a bigint to 32 bytes', () => {
    expect(bigIntToHex(255n)).toBe(`0x${'0'.repeat(62)}ff`)
  })

  it('formats durations', () => {
    expect(formatDuration(42)).toBe('42 s')
    expect(formatDuration(600)).toBe('10 min')
    expect(formatDuration(3600 + 300)).toBe('1 h 5 min')
    expect(formatDuration(86400 * 2)).toBe('2 d')
    expect(formatSeconds(150)).toBe('2 min 30 s')
    expect(formatSeconds(180)).toBe('3 min')
    expect(formatSeconds(45)).toBe('45 s')
    expect(formatSeconds(3600 + 90)).toBe('1 h 1 min')
    expect(formatDuration(86400 + 3600 * 3)).toBe('1 d 3 h')
  })

  it('formats timestamps in UTC', () => {
    expect(formatTimestamp(0)).toBe('Jan 1, 1970, 00:00 UTC')
    expect(formatTimestamp(1_790_600_000)).toBe('Sep 28, 2026, 12:53 UTC')
    expect(formatTimestamp(null)).toBe('—')
    expect(formatDate('2026-09-28')).toBe('Sep 28, 2026')
    expect(formatDate('2026-09-28', 'short')).toBe('9/28')
  })

  it('reads relative times both ways', () => {
    expect(timeAgo(1000, 1000)).toBe('now')
    expect(timeAgo(1000, 1045)).toBe('45 sec. ago')
    expect(timeAgo(1000, 1600)).toBe('10 min. ago')
    expect(timeAgo(1600, 1000)).toBe('in 10 min.')
    expect(timeAgo(0, 3 * 86400)).toBe('3 days ago')
  })

  it('rounds a relative time to the nearest unit, and never says tomorrow', () => {
    const hour = 3600
    const day = 24 * hour
    expect(timeAgo(2 * day + 23 * hour, 0)).toBe('in 3 days')
    expect(timeAgo(0, 4 * day + 22 * hour)).toBe('5 days ago')
    expect(timeAgo(38 * hour, 0)).toBe('in 2 days')
    expect(timeAgo(30 * hour, 0)).toBe('in 1 day')
    expect(timeAgo(0, 30 * hour)).toBe('1 day ago')
    expect(timeAgo(22 * hour + 40 * 60, 0)).toBe('in 23 hr.')
    expect(timeAgo(23 * hour + 40 * 60, 0)).toBe('in 1 day')
    expect(timeAgo(59 * 60 + 40, 0)).toBe('in 1 hr.')
  })

  it('formats byte counts', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(131072)).toBe('128 KiB')
    expect(formatBytes(1536)).toBe('1.5 KiB')
  })

  it('formats wei and gwei', () => {
    expect(formatWei(10n ** 18n)).toBe('1')
    expect(formatWei(1234n * 10n ** 14n)).toBe('0.1234')
    expect(formatWei(12_345n * 10n ** 18n)).toBe('12,345')
    expect(formatWei(1n)).toBe('<0.000001')
    expect(formatWei(0n)).toBe('0')
    expect(formatGwei(1_500_000_000n)).toBe('1.50')
  })

  it('formats shares, percentages, compact numbers and lists', () => {
    expect(formatShare(1, 3)).toBe('33.3%')
    expect(formatShare(1, 0)).toBe('—')
    expect(formatPercent(0.5, 0)).toBe('50%')
    expect(formatCompact(1200)).toBe('1.2K')
    expect(formatList(['a', 'b', 'c'])).toBe('a, b, and c')
  })
})

describe('in Spanish', () => {
  it('uses Spanish separators, dates and relative times', () => {
    inLocale('es')
    expect(formatNumber(1234)).toBe('1234')
    expect(formatNumber(1234567)).toBe('1.234.567')
    expect(formatWei(1234n * 10n ** 14n)).toBe('0,1234')
    expect(formatWei(1n)).toBe('<0,000001')
    expect(formatGwei(1_500_000_000n)).toBe('1,50')
    expect(formatBytes(1536)).toBe('1,5 KiB')
    expect(formatShare(1, 3)).toBe('33,3\u00a0%')
    expect(formatDuration(86400 * 1500)).toBe('1500 d')
    expect(formatTimestamp(1_790_600_000)).toBe('28 sept 2026, 12:53 UTC')
    expect(formatDate('2026-09-28', 'short')).toBe('28/9')
    expect(timeAgo(1000, 1600)).toBe('hace 10 min')
    expect(timeAgo(1600, 1000)).toBe('dentro de 10 min')
    expect(timeAgo(1000, 1000)).toBe('ahora')
    expect(formatList(['a', 'b', 'c'])).toBe('a, b y c')
  })
})

describe('in Catalan', () => {
  it('uses Catalan separators, dates and relative times', () => {
    inLocale('ca')
    expect(formatNumber(1234)).toBe('1.234')
    expect(formatWei(12_345n * 10n ** 18n + 5n * 10n ** 17n)).toBe('12.345,5')
    expect(formatShare(1, 3)).toBe('33,3\u00a0%')
    expect(formatTimestamp(1_790_600_000)).toBe('28 de set. del 2026, 12:53 UTC')
    expect(timeAgo(1000, 1600)).toBe('fa 10 min')
    expect(timeAgo(0, 86400)).toBe('fa 1 dia')
    expect(formatList(['a', 'b', 'c'])).toBe('a, b i c')
  })
})
