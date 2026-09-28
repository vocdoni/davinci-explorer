import { describe, expect, it } from 'vitest'
import {
  detectLocale,
  initialLocale,
  isLocale,
  LOCALE_STORAGE_KEY,
  readStoredLocale,
  writeStoredLocale,
} from './locales'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  }
}

describe('detectLocale', () => {
  it('maps Catalan and Spanish tags by their primary subtag', () => {
    expect(detectLocale(['ca'])).toBe('ca')
    expect(detectLocale(['ca-ES'])).toBe('ca')
    expect(detectLocale(['ca-ES-valencia'])).toBe('ca')
    expect(detectLocale(['es'])).toBe('es')
    expect(detectLocale(['es-ES'])).toBe('es')
    expect(detectLocale(['es-419'])).toBe('es')
    expect(detectLocale(['ES_mx'])).toBe('es')
  })

  it('takes the first language it speaks, else English', () => {
    expect(detectLocale(['fr-FR', 'ca-ES', 'es-ES'])).toBe('ca')
    expect(detectLocale(['de', 'en-GB', 'es'])).toBe('en')
    expect(detectLocale(['fr', 'de'])).toBe('en')
    expect(detectLocale([])).toBe('en')
  })
})

describe('the stored choice', () => {
  it('round-trips through storage under its key', () => {
    const storage = memoryStorage()
    writeStoredLocale('ca', storage)
    expect(storage.data.get(LOCALE_STORAGE_KEY)).toBe('ca')
    expect(readStoredLocale(storage)).toBe('ca')
  })

  it('ignores values it does not know and storage that throws', () => {
    expect(readStoredLocale(memoryStorage({ [LOCALE_STORAGE_KEY]: 'fr' }))).toBeNull()
    const broken = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    }
    expect(readStoredLocale(broken)).toBeNull()
    expect(() => writeStoredLocale('es', broken)).not.toThrow()
  })

  it('wins over the browser languages', () => {
    expect(initialLocale(memoryStorage({ [LOCALE_STORAGE_KEY]: 'es' }), ['ca-ES'])).toBe('es')
    expect(initialLocale(memoryStorage(), ['ca-ES'])).toBe('ca')
    expect(initialLocale(null, ['en-US'])).toBe('en')
  })

  it('knows its locales', () => {
    expect(isLocale('ca')).toBe(true)
    expect(isLocale('fr')).toBe(false)
    expect(isLocale(null)).toBe(false)
  })
})
