// Reading a process's metadata document. The registry stores only its URI;
// the document is whatever the organizer published. Vocdoni clients write
// `{ title, description, questions: [{ title, choices: [{ title, value }] }] }`
// with multi-language strings (`{ default: "…", en: "…" }`); anything else is
// shown raw. The organizer's text is content, not interface: it is shown in
// the visitor's language when the document carries it, never translated here.

import { i18n } from '@lingui/core'

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

/** An http(s) link for a URI a browser can open; `ipfs://` through a public gateway. */
export function browsableUri(uri: string): string | null {
  const s = uri.trim()
  if (/^https?:\/\//i.test(s)) return s
  if (s.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${s.slice('ipfs://'.length)}`
  return null
}

/** The URI to fetch, when a browser can fetch it (http(s) or ipfs); null otherwise. */
export function fetchableUri(uri: string | null | undefined): string | null {
  return uri && browsableUri(uri) ? uri.trim() : null
}
