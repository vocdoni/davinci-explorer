// Short forms of URIs for display.

const middle = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 6)}…${s.slice(-5)}` : s)

/**
 * Where a URI points, short enough for a line: the host, `ipfs · bafy…wxyz`,
 * or for a URI without a host its scheme and last path segment
 * (`file · census.json`).
 */
export function uriHost(uri: string): string {
  const s = uri.trim()
  const ipfs = /^ipfs:\/\/(?:ipfs\/)?([^/?#]+)/i.exec(s)
  if (ipfs) return `ipfs · ${middle(ipfs[1]!, 14)}`
  try {
    const url = new URL(s)
    if (url.host) return url.host
    const scheme = url.protocol.replace(/:$/, '')
    const last = url.pathname.split('/').filter(Boolean).pop()
    return last ? `${scheme} · ${middle(decodeURIComponent(last), 32)}` : scheme
  } catch {
    return middle(s, 24)
  }
}
