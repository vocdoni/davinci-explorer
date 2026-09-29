// How voting ended. An organizer may end an election at any time
// (setProcessStatus to Ended), and the registry then sets the duration to the
// time since the start: before the planned end that is an early end; after
// it, voting had already closed and the recorded end only moves later.

import { useStore } from '~data/hooks'
import type { ProcessRow } from '~indexer/selectors'
import { txKey, type ProcessEntity, type StatusChange, type TxDetails } from '~indexer/types'

export interface OrganizerEnd {
  /** The status change to Ended the organizer sent. */
  change: StatusChange
  /** Start plus the duration before that change; null while unknown. */
  plannedEnd: number | null
  /** The organizer ended voting before its planned end; null while unknown. */
  early: boolean | null
}

/**
 * The organizer's end of voting, if any. Asking the committee to decrypt also
 * moves a process to Ended once its end time passed, in the request's own
 * transaction: that is the end time, not the organizer.
 */
export function organizerEnd(p: ProcessEntity, initialDuration: number | null): OrganizerEnd | null {
  const change = [...p.statusChanges]
    .reverse()
    .find((c) => c.to === 'ended' && !(c.tx && c.tx === p.decryptionRequest?.tx))
  if (!change) return null
  const own = p.durationChanges.findIndex((d) => d.tx != null && d.tx === change.tx)
  const earlier = own >= 0 ? p.durationChanges.slice(0, own) : p.durationChanges.filter((d) => d.block < change.block)
  const duration = earlier.length > 0 ? earlier[earlier.length - 1]!.value : initialDuration
  const start = p.state?.startTime
  const plannedEnd = duration != null && start != null ? start + duration : null
  const early = plannedEnd != null && change.timestamp != null ? change.timestamp < plannedEnd : null
  return { change, plannedEnd, early }
}

/** When voting stopped: the recorded end, unless the organizer ended it after its planned end. */
export function votingEnd(
  p: ProcessEntity,
  row: Pick<ProcessRow, 'endTime'>,
  initialDuration: number | null
): number | null {
  const end = organizerEnd(p, initialDuration)
  return end?.early === false ? end.plannedEnd : row.endTime
}

/** The decoded `newProcess` call: the values the election was created with, once its transaction is read. */
export function useCreation(p: ProcessEntity | null | undefined): TxDetails | null {
  const store = useStore()
  return (p?.createdTx ? store.txDetails[txKey(p.createdTx)] : null) ?? null
}
