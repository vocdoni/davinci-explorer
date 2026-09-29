import { describe, expect, it } from 'vitest'
import { i18n } from '@lingui/core'
import { GLOSSARY, glossaryEntry, glossaryHref, readGlossary } from './glossary'

describe('glossary', () => {
  it('gives every entry a short plain definition and a longer one', () => {
    for (const e of readGlossary(i18n)) {
      expect(e.short.length, e.id).toBeGreaterThan(20)
      // A tooltip, not a paragraph.
      expect(e.short.length, e.id).toBeLessThan(200)
      expect(e.text.length, e.id).toBeGreaterThan(e.short.length / 2)
      expect(e.short.split('`').length % 2, e.id).toBe(1)
    }
  })

  it('finds an entry by id and links to its anchor', () => {
    expect(glossaryEntry('vote-id')).toBe(GLOSSARY.find((e) => e.id === 'vote-id'))
    expect(glossaryHref('state-root')).toBe('/learn/glossary#term-state-root')
  })
})
