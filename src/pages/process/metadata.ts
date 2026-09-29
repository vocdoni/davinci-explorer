// Reading a process's metadata document, once `useMetadataCheck` has
// downloaded it and compared its hash with the registry's. Vocdoni clients write
// `{ title, description, questions: [{ title, choices: [{ title, value }] }] }`
// with multi-language strings (`{ default: "…", en: "…" }`); anything else is
// shown raw. The organizer's text is content, not interface: it is shown in
// the visitor's language when the document carries it, never translated here.

import { i18n } from '@lingui/core'
import type { MetadataVersion } from '~indexer/types'

type Json = unknown

function isObject(v: Json): v is Record<string, Json> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const text = (v: Json): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/**
 * A plain or multi-language string: `"x"`, or from `{ default, en, es, … }` the
 * active language, else `default`, else the first language with text.
 */
export function localized(v: Json, locale: string = i18n.locale): string | null {
  if (typeof v === 'string') return text(v)
  if (!isObject(v)) return null
  return (
    (locale ? text(v[locale]) : null) ??
    text(v.default) ??
    Object.values(v)
      .map(text)
      .find((s) => s != null) ??
    null
  )
}

export function metadataTitle(doc: Json): string | null {
  return isObject(doc) ? localized(doc.title) : null
}

export function metadataDescription(doc: Json): string | null {
  return isObject(doc) ? localized(doc.description) : null
}

/**
 * Option labels for the ballot fields, from the first question's choices.
 * Only when the choices line up with the fields one to one (a field index per
 * choice `value`, or positionally); otherwise null, and the page says "field i".
 */
export function metadataChoices(doc: Json, numFields: number): string[] | null {
  if (!isObject(doc) || !Array.isArray(doc.questions) || doc.questions.length !== 1) return null
  const q = doc.questions[0]
  if (!isObject(q) || !Array.isArray(q.choices) || q.choices.length !== numFields) return null
  const labels: Array<string | null> = new Array(numFields).fill(null)
  q.choices.forEach((c, i) => {
    if (!isObject(c)) return
    const at = typeof c.value === 'number' && c.value >= 0 && c.value < numFields ? c.value : i
    labels[at] = localized(c.title)
  })
  return labels.every((l): l is string => l != null) ? labels : null
}

/**
 * The kind of ballot the organizer declared: `meta.electionPreset.type` as
 * davinci-sdk writes it (`single_choice`, `quadratic`, …), or null. It is a
 * label from the document; the rules that count are the ballot mode on chain.
 */
export function metadataPreset(doc: Json): string | null {
  if (!isObject(doc) || !isObject(doc.meta)) return null
  const preset = doc.meta.electionPreset
  return isObject(preset) ? text(preset.type) : null
}

/**
 * A version the organizer set once voting had opened: votes cast before it
 * were cast under the previous one. Never the version set at creation.
 */
export function changedWhileOpen(v: Pick<MetadataVersion, 'afterStart' | 'atCreation'>): boolean {
  return !v.atCreation && v.afterStart === true
}
