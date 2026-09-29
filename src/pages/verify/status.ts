// The five outcomes a check on the Verify pages can have, and how several
// fold into one. Pure, unit-tested.

import type { CheckState } from '~indexer/selectors'

/**
 * `pass` and `fail` are verdicts; `attention` passed but with something the
 * reader should know (the organizer changed the description while voting
 * was open); `pending` means not decided yet (still reading, or waiting for
 * something that has not happened, like the results); `na` means the check
 * does not apply here.
 */
export type VerifyStatus = 'pass' | 'fail' | 'attention' | 'pending' | 'na'

/** A recomputed check: `unknown` is not decided yet. */
export function fromCheckState(state: CheckState): VerifyStatus {
  return state === 'unknown' ? 'pending' : state
}

/**
 * One status for several: any failure fails, then anything undecided is
 * pending, then anything to note needs attention; only not-applicable is `na`.
 */
export function combine(statuses: VerifyStatus[]): VerifyStatus {
  if (statuses.includes('fail')) return 'fail'
  if (statuses.includes('pending')) return 'pending'
  if (statuses.includes('attention')) return 'attention'
  if (statuses.length > 0 && statuses.every((s) => s === 'na')) return 'na'
  return statuses.length > 0 ? 'pass' : 'na'
}

export type StatusCounts = Record<VerifyStatus, number>

export function countStatuses(statuses: VerifyStatus[]): StatusCounts {
  const out: StatusCounts = { pass: 0, fail: 0, attention: 0, pending: 0, na: 0 }
  for (const s of statuses) out[s] += 1
  return out
}

export type StepId = 'choose' | 'check' | 'redo'
export type StepState = 'done' | 'current' | 'upcoming'

/**
 * Where the reader is in a flow: step 1 until something is chosen, then the
 * checks, then redoing them once every check is decided.
 */
export function stepStates(chosen: boolean, decided: boolean): Record<StepId, StepState> {
  if (!chosen) return { choose: 'current', check: 'upcoming', redo: 'upcoming' }
  if (!decided) return { choose: 'done', check: 'current', redo: 'upcoming' }
  return { choose: 'done', check: 'done', redo: 'current' }
}
