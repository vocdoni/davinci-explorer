// Pure derivations for the sequencers pages: the on-chain accounts (from the
// selectors) matched with the configured sequencer APIs, and whether a node's
// /info describes this deployment.

import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import type { Address, Hex } from 'viem'
import type { SequencerState } from '~data/queries'
import type { CheckState, SequencerRow } from '~indexer/selectors'
import type { ChainMeta } from '~indexer/types'
import { KNOWN_RELEASES, type KnownRelease } from '~protocol/releases'
import type { SequencerInfo, SequencerProcess } from '~protocol/sequencer-api'

/** One sequencer: an account the chain knows, a configured node, or both. */
export interface SequencerEntry {
  /** Its route key: the settling address, or `node-<n>` for a configured node that reports none. */
  key: string
  address: Address | null
  /** What it did on chain; null when it never settled a transition nor published results. */
  onchain: SequencerRow | null
  /** The configured nodes that report this address, or the one node that reports none. */
  nodes: SequencerState[]
}

/** The route key of configured node `index` (0-based) when it reports no address. */
export const nodeKey = (index: number) => `node-${index + 1}`

/**
 * The on-chain accounts, busiest first, each with the configured nodes that
 * report its address; then every node whose address never settled anything
 * (or that reports none: an observer, or a node that did not answer).
 */
export function sequencerEntries(rows: SequencerRow[], nodes: SequencerState[]): SequencerEntry[] {
  const byAddress = new Map<string, SequencerState[]>()
  const orphans: SequencerState[] = []
  for (const n of nodes) {
    const address = n.info.data?.sequencerAddress?.toLowerCase()
    if (address) byAddress.set(address, [...(byAddress.get(address) ?? []), n])
    else orphans.push(n)
  }
  const entries: SequencerEntry[] = rows.map((r) => ({
    key: r.address,
    address: r.address,
    onchain: r,
    nodes: byAddress.get(r.address) ?? [],
  }))
  const onchain = new Set(rows.map((r) => r.address as string))
  for (const [address, list] of byAddress) {
    if (!onchain.has(address)) entries.push({ key: address, address: address as Address, onchain: null, nodes: list })
  }
  for (const n of orphans) entries.push({ key: nodeKey(n.endpoint.index), address: null, onchain: null, nodes: [n] })
  return entries
}

/** The entry a route key names: an address (any case) or `node-<n>`. */
export function findSequencerEntry(entries: SequencerEntry[], key: string | undefined): SequencerEntry | null {
  if (!key) return null
  const k = key.toLowerCase()
  const node = /^node-(\d+)$/.exec(k)
  if (node) {
    const index = Number(node[1]) - 1
    return entries.find((e) => e.nodes.some((n) => n.endpoint.index === index)) ?? null
  }
  return entries.find((e) => e.address === k) ?? null
}

export type NodeStatus = 'online' | 'offline' | 'checking'

/** Whether a node's /info answered on the last poll. */
export function nodeStatus(node: SequencerState): NodeStatus {
  return node.info.isSuccess ? 'online' : node.info.isError ? 'offline' : 'checking'
}

const same = (a: string | null | undefined, b: string | null | undefined): CheckState =>
  a == null || b == null ? 'unknown' : a.toLowerCase() === b.toLowerCase() ? 'pass' : 'fail'

/** The known release whose program vks and ballot VK hash the node reports; null for none. */
export function nodeRelease(info: SequencerInfo, releases: KnownRelease[] = KNOWN_RELEASES): KnownRelease | null {
  return (
    releases.find(
      (r) =>
        same(info.batchProgramVk, r.batchProgramVK) === 'pass' &&
        same(info.resultsProgramVk, r.resultsProgramVK) === 'pass' &&
        same(info.ballotVkHash, r.ballotVKHash) === 'pass'
    ) ?? null
  )
}

export interface InfoCheck {
  id: string
  /** Render with `i18n._`. */
  label: MessageDescriptor
  state: CheckState
}

/** Whether the node's /info names this chain, this registry and the registry's pins. */
export function infoChecks(info: SequencerInfo, chain: ChainMeta): InfoCheck[] {
  const r = chain.registry
  return [
    { id: 'chain', label: msg`Chain id`, state: info.chainId === chain.chainId ? 'pass' : 'fail' },
    { id: 'registry', label: msg`Registry`, state: same(info.processRegistry, chain.registryAddress) },
    { id: 'ballot-vk', label: msg`Ballot VK hash`, state: same(info.ballotVkHash, r?.ballotVKHash) },
    { id: 'batch-vk', label: msg`Vote-batch program vk`, state: same(info.batchProgramVk, r?.batchProgramVK) },
    { id: 'results-vk', label: msg`Results program vk`, state: same(info.resultsProgramVk, r?.resultsProgramVK) },
  ]
}

export type SyncState = 'in-sync' | 'differs' | 'unknown'

/** The node's committed root against the registry's latest root for the process. */
export function syncState(view: SequencerProcess | undefined, onchainRoot: Hex | null | undefined): SyncState {
  if (!view?.localStateRoot || !onchainRoot) return 'unknown'
  return view.localStateRoot.toLowerCase() === onchainRoot.toLowerCase() ? 'in-sync' : 'differs'
}
