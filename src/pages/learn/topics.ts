// The guide's table of contents. Slugs are the `/learn/:topic` URLs; keep
// them stable, other pages link to them. Titles, summaries and group labels
// are descriptors: render them with `i18n._`. The first topic is what `/learn`
// opens on.

import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { paths } from '~routes/paths'

export type TopicGroup = 'protocol' | 'reference'

export interface TopicMeta {
  slug: string
  title: MessageDescriptor
  /** One sentence for the index and the page header. */
  summary: MessageDescriptor
  group: TopicGroup
}

export const TOPIC_GROUPS: Array<{ id: TopicGroup; label: MessageDescriptor }> = [
  { id: 'protocol', label: msg`How it works` },
  { id: 'reference', label: msg`Reference` },
]

export const TOPICS: TopicMeta[] = [
  {
    slug: 'how-it-works',
    title: msg`How DAVINCI works`,
    summary: msg`From a new process to a proven tally: ballots and their proofs, sequencers and batches, the zkVM proof, blobs, settlement and results.`,
    group: 'protocol',
  },
  {
    slug: 'key-modes',
    title: msg`Key modes and whom you trust`,
    summary: msg`Sequencer key, DKG automatic or DKG locked: who can open the ballots, who publishes the tally and what can go wrong.`,
    group: 'protocol',
  },
  {
    slug: 'census',
    title: msg`Census origins and ballot slots`,
    summary: msg`The four ways a process says who may vote, and where each voter’s ballot lives in the state tree.`,
    group: 'protocol',
  },
  {
    slug: 'silent-revoting',
    title: msg`Revoting, re-encryption and silent refreshes`,
    summary: msg`Why an overwrite looks like a routine refresh, what stays public, and what re-encryption does to a stored ballot.`,
    group: 'protocol',
  },
  {
    slug: 'blobs',
    title: msg`Data availability: the blobs`,
    summary: msg`What every transition publishes in its EIP-4844 blobs, how the proof binds them and how anyone rebuilds the state.`,
    group: 'protocol',
  },
  {
    slug: 'settlement',
    title: msg`What the registry checks per transition`,
    summary: msg`The checks submitStateTransition runs, in order, and the public values it reads from the proof.`,
    group: 'protocol',
  },
  {
    slug: 'results',
    title: msg`How results are produced`,
    summary: msg`A results proof for a sequencer key, threshold decryption for a DKG key, and what each is checked against.`,
    group: 'protocol',
  },
  {
    slug: 'glossary',
    title: msg`Glossary`,
    summary: msg`Process id, vote id, state root, slot, program vk, blob, epoch and the rest, in a sentence or two each.`,
    group: 'reference',
  },
]

export function findTopic(slug: string | undefined): TopicMeta | null {
  return TOPICS.find((t) => t.slug === slug) ?? null
}

/** The topics before and after `slug` in reading order. */
export function neighbours(slug: string): { prev: TopicMeta | null; next: TopicMeta | null } {
  const i = TOPICS.findIndex((t) => t.slug === slug)
  if (i < 0) return { prev: null, next: null }
  return { prev: TOPICS[i - 1] ?? null, next: TOPICS[i + 1] ?? null }
}

/** Guides that became the Verify flows: their old URLs land on the flow. */
export const MOVED_TOPICS: Record<string, string> = {
  'verify-voter': paths.votes(),
  'verify-organizer': paths.verifyElection(),
  'verify-auditor': paths.verifyDeployment(),
}
