// Election titles for the pickers, from each process's metadata document.
// Same query as `useMetadataCheck`, so a document downloaded here is cached
// for the process page and the other way round.

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useServices } from '~data/context'
import { metadataCheckOf, metadataQuery, useDeploymentKey } from '~data/queries'
import type { Hex } from '~indexer/types'
import { metadataTitle } from '~pages/process/metadata'
import { fetchableUri } from '~protocol/metadata'

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
  // One query per document: processes that share a document (or have none)
  // would otherwise ask for the same query twice.
  const documents = useMemo(() => {
    const byKey = new Map<string, { uri: string | null; hash: Hex | null }>()
    for (const r of rows) byKey.set(documentKey(r), { uri: r.metadataURI, hash: r.metadataHash })
    return [...byKey.values()]
  }, [rows])
  // Structurally shared: the same array until a title arrives.
  const titles = useQueries({
    queries: documents.map((d) => metadataQuery(services, deployment, d.uri, d.hash)),
    combine: (results) =>
      results.map((q, i) => {
        const check = metadataCheckOf(documents[i]?.uri, documents[i]?.hash, q)
        const title = metadataTitle(check.doc)
        return title ? { title, verified: check.status === 'matches' } : null
      }),
  })
  return useMemo(() => {
    const byDocument = new Map(documents.map((d, i) => [documentKey({ metadataURI: d.uri, metadataHash: d.hash }), i]))
    const out = new Map<string, ProcessTitle>()
    for (const r of rows) {
      const title = titles[byDocument.get(documentKey(r)) ?? -1]
      if (title) out.set(r.id, title)
    }
    return out
  }, [rows, documents, titles])
}

function documentKey(r: { metadataURI: string | null; metadataHash: Hex | null }): string {
  return `${fetchableUri(r.metadataURI) ?? ''}|${r.metadataHash?.toLowerCase() ?? ''}`
}
