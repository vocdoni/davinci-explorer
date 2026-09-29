// A process's metadata document against its on-chain hash. The registry
// stores the document's URI and the SHA-256 of the exact bytes served there
// (no JSON canonicalisation), so the check hashes the bytes as downloaded and
// the JSON is parsed from those same bytes: what a page shows is what was
// checked. Pure; the download is `fetchBytes` in `~data/services`.

import { sha256, type Hex } from 'viem'

export interface ServedDocument {
  /** SHA-256 of the bytes as served. */
  hash: Hex
  /** Bytes served. */
  size: number
  /** The JSON parsed from those bytes; undefined when they are not UTF-8 JSON. */
  doc: unknown
  /** Why the bytes are not JSON, when they are not. */
  parseError: string | null
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

/** Hashes the served bytes and parses the JSON from the same bytes. */
export function readServedDocument(bytes: Uint8Array): ServedDocument {
  const hash = sha256(bytes)
  try {
    // A leading byte-order mark is dropped, as a JSON reader would; the hash covers it.
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return { hash, size: bytes.length, doc: JSON.parse(text), parseError: null }
  } catch (err) {
    return { hash, size: bytes.length, doc: undefined, parseError: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * `matches` and `differs` are verdicts on the bytes the URI served;
 * `unreachable` means the download failed (offline, blocked cross-origin,
 * an HTTP error); `not-browsable` means a browser cannot fetch the URI (only
 * http, https and ipfs are read); `loading` is everything before a verdict.
 */
export type MetadataStatus = 'loading' | 'matches' | 'differs' | 'unreachable' | 'not-browsable'

/** Two 32-byte hashes, whatever the hex case. */
export function sameHash(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/** The verdict from what is known so far. */
export function metadataStatus(input: {
  /** The URI is http(s) or ipfs. */
  fetchable: boolean
  /** The on-chain hash of the current version; null until the process is read. */
  committed: string | null
  served: ServedDocument | null
  /** The download failed. */
  failed: boolean
}): MetadataStatus {
  if (!input.fetchable) return 'not-browsable'
  if (input.committed == null) return 'loading'
  if (input.served) return sameHash(input.served.hash, input.committed) ? 'matches' : 'differs'
  return input.failed ? 'unreachable' : 'loading'
}
