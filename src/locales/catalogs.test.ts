// The translated catalogs against the English source: every message is
// translated, and each translation keeps the English placeholders, plural and
// select arguments and rich-text tags. `i18n:check` runs this file after it
// has checked that the catalogs are freshly extracted.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatter } from '@lingui/format-po'
import { compileMessageOrThrow, type CompiledMessage } from '@lingui/message-utils/compileMessage'
import { DEFAULT_LOCALE, LOCALES } from '~i18n/locales'

const po = formatter()

/** A parsed catalog: message id → English source and translation. */
type Catalog = Record<string, { message?: string; translation?: string; obsolete?: boolean }>

async function read(locale: string): Promise<Catalog> {
  const content = readFileSync(resolve(__dirname, locale, 'messages.po'), 'utf8')
  const catalog = ((await po.parse(content, { locale, sourceLocale: 'en', filename: `${locale}/messages.po` })) ??
    {}) as Catalog
  return Object.fromEntries(Object.entries(catalog).filter(([, m]) => !m.obsolete))
}

/** Arguments (`name:type`) and rich-text tags of a message, at any depth. */
function shape(message: string): { args: string[]; tags: string[] } {
  const args = new Set<string>()
  const tags: string[] = []
  const walk = (tokens: CompiledMessage) => {
    for (const token of tokens) {
      if (typeof token === 'string') {
        for (const m of token.matchAll(/<\/?\d+\/?>/g)) tags.push(m[0])
        continue
      }
      const [name, type, format] = token
      args.add(`${name}:${type ?? 'value'}`)
      if (format && typeof format === 'object') {
        for (const [key, branch] of Object.entries(format)) {
          if (key !== 'offset' && Array.isArray(branch)) walk(branch as CompiledMessage)
        }
      }
    }
  }
  walk(compileMessageOrThrow(message))
  return { args: [...args].sort(), tags: tags.sort() }
}

/** Branch keys of every plural in a message. */
function pluralBranches(message: string): string[][] {
  const out: string[][] = []
  const walk = (tokens: CompiledMessage) => {
    for (const token of tokens) {
      if (typeof token === 'string') continue
      const [, type, format] = token
      if (format && typeof format === 'object') {
        if (type === 'plural') out.push(Object.keys(format).filter((k) => k !== 'offset'))
        for (const [key, branch] of Object.entries(format)) {
          if (key !== 'offset' && Array.isArray(branch)) walk(branch as CompiledMessage)
        }
      }
    }
  }
  walk(compileMessageOrThrow(message))
  return out
}

describe('the catalogs', async () => {
  const source = await read(DEFAULT_LOCALE)
  const entries = Object.entries(source)

  it('have English source messages that compile', () => {
    expect(entries.length).toBeGreaterThan(0)
    for (const [id, m] of entries) expect(() => shape(m.message ?? id), m.message ?? id).not.toThrow()
  })

  for (const locale of LOCALES.filter((l) => l !== DEFAULT_LOCALE)) {
    describe(locale, async () => {
      const catalog = await read(locale)

      it('has every message and nothing else', () => {
        expect(Object.keys(catalog).sort()).toEqual(Object.keys(source).sort())
      })

      it('translates every message', () => {
        const missing = entries.filter(([id]) => !catalog[id]?.translation?.trim()).map(([id, m]) => m.message ?? id)
        expect(missing).toEqual([])
      })

      it('keeps the placeholders, plurals and tags of the English', () => {
        const broken: string[] = []
        for (const [id, m] of entries) {
          const translation = catalog[id]?.translation
          if (!translation) continue
          const english = shape(m.message ?? id)
          let translated: { args: string[]; tags: string[] }
          try {
            translated = shape(translation)
          } catch (err) {
            broken.push(`${translation}: ${err instanceof Error ? err.message : String(err)}`)
            continue
          }
          if (JSON.stringify(english) !== JSON.stringify(translated)) broken.push(`${m.message ?? id} → ${translation}`)
          for (const branches of pluralBranches(translation)) {
            if (!branches.includes('one') || !branches.includes('other'))
              broken.push(`plural needs one and other: ${translation}`)
          }
        }
        expect(broken).toEqual([])
      })
    })
  }
})
