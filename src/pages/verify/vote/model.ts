// The outcome of each check of the vote flow, from what the hooks returned.
// Pure, unit-tested; the cards turn these into sentences.

import type { VoteInclusion } from '~data/queries'
import type { CheckState, RootChain } from '~indexer/selectors'
import type { MetadataStatus } from '~protocol/metadata'
import type { VoteStatus } from '~protocol/sequencer-api'
import { combine, fromCheckState, type VerifyStatus } from '../status'

/**
 * The election exists; it needs attention when its description is not the
 * committed one, or was changed while voting was open. Still looking while
 * the indexer reads, then not found.
 */
export function electionOutcome(input: {
  found: boolean
  indexing: boolean
  metadata: MetadataStatus
  changedWhileOpen: boolean
}): VerifyStatus {
  if (!input.found) return input.indexing ? 'pending' : 'fail'
  return input.metadata === 'differs' || input.changedWhileOpen ? 'attention' : 'pass'
}

export type SettledReason =
  | 'found'
  | 'no-election'
  | 'no-batches'
  | 'none-recorded'
  | 'reading'
  | 'waiting'
  | 'missed'
  | 'refused'
  | 'not-found'
  | 'unreadable'

export interface Settled {
  status: VerifyStatus
  reason: SettledReason
}

/**
 * Is the vote id in a settled batch? A vote a sequencer still holds is
 * pending, one it refused has failed, and blobs nobody serves any more leave
 * the check undecided for good. Once voting is over (`over`) no batch can
 * come, so a vote not found, or still held, was not counted.
 */
export function settledOutcome(
  electionFound: boolean,
  inclusion: VoteInclusion,
  batches: number,
  sequencerStatuses: VoteStatus[],
  over = false
): Settled {
  if (!electionFound) return { status: 'na', reason: 'no-election' }
  if (inclusion.state === 'found') return { status: 'pass', reason: 'found' }
  const queued = sequencerStatuses.some((s) => s === 'pending' || s === 'aggregated' || s === 'processed')
  const held: Settled = over ? { status: 'fail', reason: 'missed' } : { status: 'pending', reason: 'waiting' }
  if (batches === 0)
    return queued
      ? held
      : over
        ? { status: 'fail', reason: 'none-recorded' }
        : { status: 'pending', reason: 'no-batches' }
  if (inclusion.state === 'idle' || inclusion.state === 'searching') return { status: 'pending', reason: 'reading' }
  if (queued) return held
  if (sequencerStatuses.includes('error')) return { status: 'fail', reason: 'refused' }
  if (inclusion.state === 'error') return { status: 'na', reason: 'unreadable' }
  return { status: 'fail', reason: 'not-found' }
}

/** What follows from a settled check that did not pass: wait with it, or nothing to check. */
function downstream(settled: Settled): VerifyStatus {
  return settled.status === 'pending' ? 'pending' : 'na'
}

/** The batch that carries the vote passed every settlement check (`batchChecks`: recomputed and on-chain). */
export function batchOutcome(settled: Settled, checks: CheckState[] | null): VerifyStatus {
  if (settled.status !== 'pass') return downstream(settled)
  if (!checks) return 'pending'
  return combine(checks.map(fromCheckState))
}

/** The roots from the batch after the vote's to the registry's current root are unbroken. */
export function chainFrom(chain: RootChain, index: number): VerifyStatus {
  const links = chain.links.filter((l) => l.index > index)
  if (links.some((l) => l.continuous === false) || chain.headMatches === false) return 'fail'
  if (links.some((l) => l.continuous == null) || chain.headMatches == null) return 'pending'
  return 'pass'
}

export type ResultReason = 'counted' | 'not-yet' | 'canceled' | 'blocked'

/**
 * The published result counts the vote: the state after its batch leads to
 * the root the result was proven against, and the result's own checks hold.
 */
export function resultOutcome(
  settled: Settled,
  hasResults: boolean,
  canceled: boolean,
  chain: VerifyStatus,
  resultChecks: CheckState[]
): { status: VerifyStatus; reason: ResultReason } {
  if (settled.status !== 'pass') return { status: downstream(settled), reason: 'blocked' }
  if (!hasResults) return canceled ? { status: 'na', reason: 'canceled' } : { status: 'pending', reason: 'not-yet' }
  return {
    status: combine([chain, ...(resultChecks.length ? resultChecks.map(fromCheckState) : ['pending' as const])]),
    reason: 'counted',
  }
}

export type TrackerReason = 'no-sequencer' | 'loading' | 'unavailable' | 'unknown-vote' | 'checked'

/** A sequencer's tracker proof, checked in the browser. */
export function trackerOutcome(opts: {
  sequencers: number
  loading: boolean
  error: boolean
  proof: { valid: boolean; rootOnChain: boolean } | null | undefined
  settled: Settled
}): { status: VerifyStatus; reason: TrackerReason } {
  if (opts.sequencers === 0) return { status: 'na', reason: 'no-sequencer' }
  if (opts.loading) return { status: 'pending', reason: 'loading' }
  if (opts.error) return { status: 'pending', reason: 'unavailable' }
  if (!opts.proof) {
    return { status: opts.settled.status === 'pending' ? 'pending' : 'na', reason: 'unknown-vote' }
  }
  return { status: opts.proof.valid && opts.proof.rootOnChain ? 'pass' : 'fail', reason: 'checked' }
}
