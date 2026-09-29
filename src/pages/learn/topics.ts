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
    summary: msg`The whole path of a vote, from a new process to its proven results: who does what, and what each step proves.`,
    group: 'protocol',
  },
  {
    slug: 'key-modes',
    title: msg`Who holds the key (key modes)`,
    summary: msg`Who could read the ballots and who publishes the results: one sequencer, a committee, or a committee and the organizer.`,
    group: 'protocol',
  },
  {
    slug: 'census',
    title: msg`Who may vote (census)`,
    summary: msg`The four ways a process lists who may vote, and where each voter’s ballot is kept.`,
    group: 'protocol',
  },
  {
    slug: 'silent-revoting',
    title: msg`Changing your vote, privately`,
    summary: msg`You may vote again while voting is open. How the published data hides who changed their vote, and what stays public.`,
    group: 'protocol',
  },
  {
    slug: 'blobs',
    title: msg`The published data (blobs)`,
    summary: msg`What every batch publishes next to its transaction, how the proof ties it to the batch, and how anyone rebuilds the state from it.`,
    group: 'protocol',
  },
  {
    slug: 'settlement',
    title: msg`What the chain checks for each batch`,
    summary: msg`The checks the registry runs, in order, before it accepts a batch of votes, and what it reads from the proof.`,
    group: 'protocol',
  },
  {
    slug: 'results',
    title: msg`How results are produced`,
    summary: msg`How the encrypted total is decrypted when voting ends, and how each way of doing it is proven.`,
    group: 'protocol',
  },
  {
    slug: 'glossary',
    title: msg`Glossary`,
    summary: msg`Every protocol word the explorer uses, in plain words first and with the exact definition below.`,
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
