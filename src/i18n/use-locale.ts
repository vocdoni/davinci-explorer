import { useLingui } from '@lingui/react'
import { switchLocale } from './i18n'
import { DEFAULT_LOCALE, isLocale, type Locale } from './locales'

/** The active language and the switch the language selector calls. */
export function useLocale(): { locale: Locale; setLocale: (locale: Locale) => Promise<void> } {
  const { i18n } = useLingui()
  return { locale: isLocale(i18n.locale) ? i18n.locale : DEFAULT_LOCALE, setLocale: switchLocale }
}
