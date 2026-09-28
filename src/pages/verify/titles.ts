// Election titles for the pickers, from each process's metadata document.
// Same query key as `useJsonDocument`, so a title fetched here is cached for
// the process page and the other way round.

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useServices } from '~data/context'
import { fetchableUri, metadataTitle } from '~pages/process/metadata'

/** Titles by process id, for as many of `rows` as have loaded one. */
export function useProcessTitles(rows: Array<{ id: string; metadataURI: string | null }>): Map<string, string> {
  const services = useServices()
  const urls = rows.map((r) => fetchableUri(r.metadataURI))
  // Structurally shared: the same array until a title arrives.
  const titles = useQueries({
    queries: urls.map((url) => ({
      queryKey: ['json-document', url],
      enabled: !!url,
      queryFn: ({ signal }: { signal: AbortSignal }) => services.fetchJson(url!, signal),
      staleTime: 10 * 60_000,
      retry: 1,
    })),
    combine: (results) => results.map((r) => metadataTitle(r.data)),
  })
  return useMemo(() => {
    const out = new Map<string, string>()
    rows.forEach((r, i) => {
      const title = titles[i]
      if (title) out.set(r.id, title)
    })
    return out
  }, [rows, titles])
}
