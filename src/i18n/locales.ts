// The languages the explorer speaks, how a first visit picks one and where the
// choice is kept. English is the source: the code carries every message in
// English and src/locales/<locale>/messages.po translates it.

export const LOCALES = ['en', 'es', 'ca'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_STORAGE_KEY = 'davinci-explorer:locale'

/** Each language in its own name, as the selector lists it. Never translated. */
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', es: 'Español', ca: 'Català' }

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/**
 * The first browser language the explorer speaks, by its primary subtag:
 * `ca`, `ca-ES` and `ca-ES-valencia` give Catalan, any `es-*` Spanish, and
 * anything else English.
 */
export function detectLocale(languages: readonly string[]): Locale {
  for (const tag of languages) {
    const primary = tag.trim().toLowerCase().split(/[-_]/)[0]
    if (isLocale(primary)) return primary
  }
  return DEFAULT_LOCALE
}

export function readStoredLocale(storage: Pick<Storage, 'getItem'> | null = safeStorage()): Locale | null {
  try {
    const value = storage?.getItem(LOCALE_STORAGE_KEY)
    return isLocale(value) ? value : null
  } catch {
    return null
  }
}

export function writeStoredLocale(locale: Locale, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // Private mode or storage disabled: the choice lasts for the session.
  }
}

/** The language to start in: the stored choice, else the browser's. */
export function initialLocale(
  storage: Pick<Storage, 'getItem'> | null = safeStorage(),
  languages: readonly string[] = browserLanguages()
): Locale {
  return readStoredLocale(storage) ?? detectLocale(languages)
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return []
  if (navigator.languages?.length) return navigator.languages
  return navigator.language ? [navigator.language] : []
}

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}
