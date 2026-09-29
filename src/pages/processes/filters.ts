// The processes list's filter lives in the URL query (`paths.processes`).
// Unknown values are dropped rather than matched, so a stale link shows the
// full list instead of an empty one.

import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import type { ProcessFilter, ProcessPhase } from '~indexer/selectors'
import type { ProcessListFilter } from '~routes/paths'
import type { CensusOriginName, KeyModeName } from '~protocol/types'

export interface FilterOption<T extends string> {
  value: T
  /** Render with `i18n._(option.label)`. */
  label: MessageDescriptor
}

/**
 * Phases a user filters by, in lifecycle order. `ready` is the on-chain
 * status: upcoming, open, and past the end until someone ends the election
 * or publishes its results.
 */
export const PHASE_OPTIONS: FilterOption<ProcessPhase | 'ready'>[] = [
  { value: 'upcoming', label: msg`Upcoming` },
  { value: 'open', label: msg`Open` },
  { value: 'paused', label: msg`Paused` },
  { value: 'closing', label: msg`Closing` },
  { value: 'ready', label: msg`Ready (any time)` },
  { value: 'ended', label: msg`Ended, results pending` },
  { value: 'results', label: msg`Results` },
  { value: 'canceled', label: msg`Canceled` },
]

/** Key modes and census origins a user filters by; their labels are `KEY_MODE_INFO` and `CENSUS_ORIGIN_INFO`. */
export const KEY_MODE_OPTIONS: KeyModeName[] = ['sequencer', 'dkg-automatic', 'dkg-locked']
export const CENSUS_OPTIONS: CensusOriginName[] = ['merkle-static', 'merkle-dynamic', 'onchain-dynamic', 'csp']

const pick = <T extends string>(values: readonly T[], raw: string | null): T | undefined =>
  values.find((v) => v === raw)

/** The URL query as a list filter (for links) and a selector filter (for `useProcesses`). */
export function readProcessFilter(params: URLSearchParams): { list: ProcessListFilter; filter: ProcessFilter } {
  const status = pick(
    PHASE_OPTIONS.map((o) => o.value),
    params.get('status')
  )
  const keyMode = pick(KEY_MODE_OPTIONS, params.get('keyMode'))
  const census = pick(CENSUS_OPTIONS, params.get('census'))
  const organizer = /^0x[0-9a-fA-F]{40}$/.test(params.get('organizer')?.trim() ?? '')
    ? params.get('organizer')!.trim().toLowerCase()
    : undefined
  const q = params.get('q')?.trim() || undefined
  return {
    list: { status, keyMode, census, organizer, q },
    filter: { status, keyMode, censusOrigin: census, organizer, query: q },
  }
}

/** True when any filter narrows the list. */
export function isFiltered(list: ProcessListFilter): boolean {
  return Object.values(list).some((v) => v != null && v !== '')
}
