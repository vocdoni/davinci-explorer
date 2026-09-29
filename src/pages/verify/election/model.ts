// The outcome of each check of the election flow. Pure, unit-tested: the
// per-batch checks come from `transitionDetail`, the chain from `rootChain`
// and the result checks from the results tab's hooks.

import type { DkgApplicationView } from '~data/services'
import type { CheckState, ProcessPhase, RootChain, TransitionDetail } from '~indexer/selectors'
import type { MetadataVersion } from '~indexer/types'
import { changedWhileOpen } from '~pages/process/metadata'
import { reducedToCircom } from '~protocol/babyjubjub'
import type { MetadataStatus } from '~protocol/metadata'
import type { CensusOriginName, KeyModeName } from '~protocol/types'
import { batchChecks, onchainState } from '../batch'
import { combine, fromCheckState, type VerifyStatus } from '../status'

export interface BatchVerdict {
  index: number
  timestamp: number | null
  votes: number
  /** The recomputed settlement checks, in `transitionDetail` order, then the on-chain verification. */
  checks: Array<{ id: string; label: string; state: CheckState }>
  status: VerifyStatus
}

export function batchVerdicts(
  details: TransitionDetail[],
  labels: { onchain: string; onchainCensus: string }
): BatchVerdict[] {
  return details.map((d) => {
    const checks = batchChecks(d, labels)
    return {
      index: d.row.index,
      timestamp: d.row.timestamp,
      votes: d.row.votes,
      checks,
      status: combine(checks.map((c) => fromCheckState(c.state))),
    }
  })
}

/** Phases after which no batch can settle any more. */
const CLOSED: ProcessPhase[] = ['closed', 'ended', 'canceled', 'results']

/** Every batch passed; with no batch, pending while votes may still come and not applicable after. */
export function batchesStatus(verdicts: BatchVerdict[], phase: ProcessPhase): VerifyStatus {
  if (verdicts.length === 0) return CLOSED.includes(phase) ? 'na' : 'pending'
  return combine(verdicts.map((v) => v.status))
}

/** The roots chain from genesis through every batch to the registry's current root. */
export function chainStatus(chain: RootChain, loaded: boolean): VerifyStatus {
  if (!loaded) return 'pending'
  if (chain.gaps > 0 || chain.headMatches === false) return 'fail'
  if (chain.genesisRoot == null || chain.headMatches == null || chain.links.some((l) => l.continuous == null))
    return 'pending'
  return 'pass'
}

/**
 * Every batch was proven against the election's census. The explorer cannot
 * ask an on-chain census contract, so there a settled batch (the registry
 * asked it) is the evidence.
 */
export function censusStatus(origin: CensusOriginName | null, details: TransitionDetail[]): VerifyStatus {
  if (origin == null) return 'pending'
  if (origin === 'onchain-dynamic') return combine(details.map((d) => fromCheckState(onchainState(d))).concat('pass'))
  const states = details.map((d) => d.checks.find((c) => c.id === 'census-root')?.state ?? 'unknown')
  return combine(states.map(fromCheckState).concat('pass'))
}

/** A tally is published; pending before, not applicable for a canceled election. */
export function publishedStatus(hasResults: boolean, phase: ProcessPhase): VerifyStatus {
  if (hasResults) return 'pass'
  return phase === 'canceled' ? 'na' : 'pending'
}

/** A group of result checks, once there is something to check. */
export function resultChecksStatus(states: CheckState[], published: VerifyStatus): VerifyStatus {
  if (states.length === 0) return published === 'pass' ? 'pending' : published
  return combine(states.map(fromCheckState))
}

/** A DKG application's key, in the registry's circomlib form, is the election key (as the key tab checks it). */
export function keyMatches(key: { x: bigint; y: bigint }, app: Pick<DkgApplicationView, 'applicationKey'>): boolean {
  const converted = reducedToCircom(app.applicationKey)
  return converted.x === key.x && converted.y === key.y
}

/** A sequencer key is what the registry stores; a DKG key must be the committee's, and waits until the DKG is read. */
export function keyStatus(
  mode: KeyModeName | null,
  key: { x: bigint; y: bigint } | null,
  app: Pick<DkgApplicationView, 'applicationKey'> | null | undefined
): VerifyStatus {
  if (!mode || !key) return 'pending'
  if (mode === 'sequencer') return 'pass'
  return app ? (keyMatches(key, app) ? 'pass' : 'fail') : 'pending'
}

/** The document served is the committed one; pending while it loads, or when this browser cannot download it. */
export function metadataCheckStatus(status: MetadataStatus): VerifyStatus {
  if (status === 'matches') return 'pass'
  if (status === 'differs') return 'fail'
  return 'pending'
}

/**
 * The organizer's changes to the description: a change once voting had
 * opened needs attention, and waits while a change's time is not known.
 */
export function metadataHistoryStatus(
  history: Array<Pick<MetadataVersion, 'afterStart' | 'atCreation'>>
): VerifyStatus {
  if (history.some(changedWhileOpen)) return 'attention'
  if (history.some((v) => !v.atCreation && v.afterStart == null)) return 'pending'
  return 'pass'
}
