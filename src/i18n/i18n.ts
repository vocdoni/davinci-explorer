// Loading and switching the active language. The app uses the one global
// `i18n` of @lingui/core: the macros, `i18n._`, the formatters in
// `~lib/format` and the getters of the protocol tables all read it.

import { i18n, type Messages } from '@lingui/core'
import { compileMessage } from '@lingui/message-utils/compileMessage'
import { writeStoredLocale, type Locale } from './locales'

// Text added since the last `i18n:extract` is not in the catalogs yet. In
// development and in the unit tests it falls back to its English source,
// compiled on the fly; production builds only ever read compiled catalogs.
if (import.meta.env.DEV) i18n.setMessagesCompiler(compileMessage)

/** One chunk per language: a visitor downloads only the catalog they read. */
export async function loadMessages(locale: Locale): Promise<Messages> {
  const { messages } = await import(`../locales/${locale}/messages.po`)
  return messages
}

let latest = 0

/**
 * Loads a language and makes it the active one: the messages, every number
 * and date formatter, and `<html lang>`. When calls overlap, the last one
 * wins.
 */
export async function activateLocale(locale: Locale): Promise<void> {
  const call = ++latest
  const messages = await loadMessages(locale)
  if (call !== latest) return
  i18n.loadAndActivate({ locale, messages })
  if (typeof document !== 'undefined') document.documentElement.lang = locale
}

/** The language selector's action: remember the choice and switch to it. */
export function switchLocale(locale: Locale): Promise<void> {
  writeStoredLocale(locale)
  return activateLocale(locale)
}
