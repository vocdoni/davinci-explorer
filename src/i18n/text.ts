import { i18n, type MessageDescriptor } from '@lingui/core'

/**
 * Adds text fields that translate on every read, so `KEY_MODE_INFO.sequencer.label`
 * is a string in the active language each time a component renders it. For the
 * shared tables of `src/protocol`, which pages all over the app read as plain
 * strings. Read such a field while rendering, never at module scope: there it
 * would be read once, in whatever language was active then.
 */
export function withText<T extends object, K extends string>(
  target: T,
  text: Record<K, MessageDescriptor>
): T & { readonly [P in K]: string } {
  for (const key of Object.keys(text) as K[]) {
    Object.defineProperty(target, key, { enumerable: true, get: () => i18n._(text[key]) })
  }
  return target as T & { readonly [P in K]: string }
}
