// Election titles for the pickers, from each process's metadata document.
// Same query as `useMetadataCheck`, so a document downloaded here is cached
// for the process page and the other way round.

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useServices } from '~data/context'
import { metadataCheckOf, metadataQuery, useDeploymentKey } from '~data/queries'
import type { Hex } from '~indexer/types'
import { metadataTitle } from '~pages/process/metadata'

export interface ProcessTitle {
  title: string
  /** False when the document does not match the on-chain hash: show the title as unverified. */
  verified: boolean
}

/** Titles by process id, for as many of `rows` as have loaded one. */
export function useProcessTitles(
  rows: Array<{ id: string; metadataURI: string | null; metadataHash: Hex | null }>
): Map<string, ProcessTitle> {
  const services = useServices()
  const deployment = useDeploymentKey()
  // Structurally shared: the same array until a title arrives.
  const titles = useQueries({
    queries: rows.map((r) => metadataQuery(services, deployment, r.metadataURI, r.metadataHash)),
    combine: (results) =>
      results.map((q, i) => {
        const check = metadataCheckOf(rows[i]?.metadataURI, rows[i]?.metadataHash, q)
        const title = metadataTitle(check.doc)
        return title ? { title, verified: check.status === 'matches' } : null
      }),
  })
  return useMemo(() => {
    const out = new Map<string, ProcessTitle>()
    rows.forEach((r, i) => {
      const title = titles[i]
      if (title) out.set(r.id, title)
    })
    return out
  }, [rows, titles])
}
