// Every URL the explorer renders, in one place. Build links with these
// helpers, never from string literals, so a rename is a one-file change.

import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

export const PROCESS_TABS = ['overview', 'key', 'transitions', 'votes', 'results', 'raw'] as const
export type ProcessTab = (typeof PROCESS_TABS)[number]

export function isProcessTab(value: string | undefined): value is ProcessTab {
  return value != null && (PROCESS_TABS as readonly string[]).includes(value)
}

export const patterns = {
  home: '/',
  processes: '/processes',
  process: '/processes/:pid',
  processTab: '/processes/:pid/:tab',
  transition: '/processes/:pid/transitions/:index',
  tx: '/tx/:hash',
  verify: '/verify',
  verifyVote: '/verify/vote',
  verifyElection: '/verify/election',
  verifyElectionProcess: '/verify/election/:pid',
  verifyDeployment: '/verify/deployment',
  contracts: '/contracts',
  sequencers: '/sequencers',
  sequencer: '/sequencers/:address',
  learn: '/learn',
  learnTopic: '/learn/:topic',
  kit: '/kit',
  /** Old vote lookup URLs; they redirect to the vote check. */
  legacyVotes: '/votes',
  legacyVote: '/votes/:pid/:voteId',
} as const

export interface ProcessListFilter {
  status?: string
  keyMode?: string
  census?: string
  organizer?: string
  q?: string
}

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) search.set(k, v)
  const qs = search.toString()
  return qs ? `${path}?${qs}` : path
}

export const paths = {
  home: () => patterns.home,
  processes: (filter: ProcessListFilter = {}) => withQuery(patterns.processes, { ...filter }),
  process: (pid: string, tab?: ProcessTab) =>
    tab && tab !== 'overview' ? `/processes/${pid}/${tab}` : `/processes/${pid}`,
  transition: (pid: string, index: number) => `/processes/${pid}/transitions/${index}`,
  tx: (hash: string) => `/tx/${hash}`,
  verify: () => patterns.verify,
  /** The vote check (Verify → My vote), with the lookup filled in when given. */
  votes: (params: { pid?: string; voteId?: string } = {}) => withQuery(patterns.verifyVote, params),
  /** The vote check of one vote. */
  vote: (pid: string, voteId: string) => withQuery(patterns.verifyVote, { pid, voteId }),
  /** The election check; without a pid, its process picker. */
  verifyElection: (pid?: string) => (pid ? `/verify/election/${pid}` : patterns.verifyElection),
  verifyDeployment: () => patterns.verifyDeployment,
  contracts: () => patterns.contracts,
  sequencers: () => patterns.sequencers,
  sequencer: (address: string) => `/sequencers/${address.toLowerCase()}`,
  learn: (topic?: string) => (topic ? `/learn/${topic}` : patterns.learn),
  kit: () => patterns.kit,
} as const

export interface NavItem {
  /** Render with `i18n._(item.label)`. */
  label: MessageDescriptor
  to: string
  /** Marks the item active for any path under this prefix. */
  match: string
  /** The bar's call to action, drawn as a pill. */
  primary?: boolean
}

/** Primary navigation, in bar order. */
export const NAV_ITEMS: NavItem[] = [
  { label: msg`Overview`, to: patterns.home, match: '/' },
  { label: msg`Processes`, to: patterns.processes, match: '/processes' },
  { label: msg`Sequencers`, to: patterns.sequencers, match: '/sequencers' },
  { label: msg`Contracts`, to: patterns.contracts, match: '/contracts' },
  { label: msg`Learn`, to: patterns.learn, match: '/learn' },
  { label: msg`Verify`, to: patterns.verify, match: '/verify', primary: true },
]
