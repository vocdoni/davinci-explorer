// The lifecycle strip of a process page: created → start → batches → end
// → grace window → results, each step done, in progress, still ahead, or
// skipped (a canceled process never ends normally and never gets results).

import { plural, t } from '@lingui/core/macro'
import type { ProcessView } from '~data/hooks'
import { votingOver } from '~indexer/selectors'
import type { Hex, ProcessEntity, ValueChange } from '~indexer/types'
import { organizerEnd } from './ending'
import { formatNumber, formatSeconds } from '~lib/format'

export type StepState = 'done' | 'current' | 'upcoming' | 'skipped'

/** `label` and `detail` are in the active language: build the steps while rendering. */
export interface LifecycleStep {
  id: 'created' | 'start' | 'transitions' | 'end' | 'grace' | 'results'
  label: string
  state: StepState
  /** Unix seconds, when the step has a time. */
  time: number | null
  detail: string
  tx: Hex | null
}

/** `initialDuration` is the duration the election was created with, when known. */
export function processLifecycle(
  view: Pick<ProcessView, 'process' | 'row' | 'transitions'>,
  now: number | null,
  initialDuration: number | null = null
) {
  const { process: p, row, transitions } = view
  const phase = row.phase
  const canceled = phase === 'canceled'
  const cancel = canceled ? [...p.statusChanges].reverse().find((c) => c.to === 'canceled') : undefined
  const started = row.startTime != null && now != null && now >= row.startTime
  const last = transitions[transitions.length - 1]
  const ballots = transitions.reduce((sum, t) => sum + t.votes, 0)
  // The voting time is over; the grace window may still be open.
  const ended = phase === 'closing' || phase === 'ended' || phase === 'results'
  // The grace window has closed too: no batch can come.
  const over = votingOver(row)
  // An organizer end after the planned end only moved the recorded end: voting had closed.
  const end = organizerEnd(p, initialDuration)
  const endChange = end && end.early !== false ? end.change : null
  const earlier = !endChange ? endMovedEarlier(p, initialDuration) : null
  const block = formatNumber(p.createdBlock)
  const batches = transitions.length
  const grace = row.grace != null ? formatSeconds(row.grace) : null
  const graceBatches = row.graceBatches

  const steps: LifecycleStep[] = [
    {
      id: 'created',
      label: t`Created`,
      state: 'done',
      time: row.createdAt,
      detail: t`Block ${block}`,
      tx: p.createdTx,
    },
    {
      id: 'start',
      label: started ? t`Voting opened` : t`Voting opens`,
      state: canceled && !started ? 'skipped' : started ? 'done' : 'upcoming',
      time: row.startTime,
      detail: canceled && !started ? t`Canceled before the start` : started ? t`Start time reached` : t`Start time`,
      tx: null,
    },
    {
      id: 'transitions',
      label: t`Batches`,
      state:
        phase === 'open' || phase === 'paused'
          ? 'current'
          : transitions.length > 0
            ? 'done'
            : over
              ? 'skipped'
              : 'upcoming',
      time: last?.timestamp ?? null,
      detail:
        batches > 0
          ? t`${plural(batches, { one: '# batch', other: '# batches' })}, ${plural(ballots, { one: '# vote', other: '# votes' })}`
          : over
            ? t`No batch recorded`
            : t`No batch recorded yet`,
      tx: last?.tx ?? null,
    },
    {
      id: 'end',
      label: canceled ? t`Canceled` : ended ? t`Voting closed` : t`Voting closes`,
      state: canceled ? 'skipped' : ended ? 'done' : 'upcoming',
      time: canceled ? (cancel?.timestamp ?? null) : end?.early === false ? end.plannedEnd : row.endTime,
      detail: canceled
        ? t`Canceled by the organizer`
        : phase === 'paused'
          ? t`Paused by the organizer`
          : endChange
            ? t`Ended by the organizer`
            : earlier
              ? t`Moved earlier by the organizer`
              : ended
                ? t`End time reached`
                : t`End time`,
      tx: canceled ? (cancel?.tx ?? null) : (endChange?.tx ?? earlier?.tx ?? null),
    },
    {
      id: 'grace',
      label: t`Grace window`,
      state: canceled ? 'skipped' : over ? 'done' : ended ? 'current' : 'upcoming',
      time: canceled || !ended ? null : row.graceEnd,
      detail: canceled
        ? t`None: canceled`
        : over
          ? graceBatches > 0
            ? t`${plural(graceBatches, { one: '# batch recorded in it', other: '# batches recorded in it' })}`
            : t`No batch after the end`
          : ended
            ? t`Recording the last batches`
            : grace
              ? t`${grace} for batches still on their way`
              : t`For batches still on their way`,
      tx: null,
    },
  ]

  const results = p.results
  steps.push(
    results
      ? {
          id: 'results',
          label: t`Results`,
          state: 'done',
          time: results.timestamp,
          detail: t`Published on the chain`,
          tx: results.tx,
        }
      : canceled
        ? { id: 'results', label: t`Results`, state: 'skipped', time: null, detail: t`None: canceled`, tx: null }
        : p.decryptionRequest
          ? {
              id: 'results',
              label: t`Results`,
              state: 'current',
              time: p.decryptionRequest.timestamp,
              detail: t`Sent to the committee to decrypt`,
              tx: p.decryptionRequest.tx,
            }
          : {
              id: 'results',
              label: t`Results`,
              state: over ? 'current' : 'upcoming',
              time: null,
              detail: over ? t`Pending` : t`After the grace window`,
              tx: null,
            }
  )
  return steps
}

/**
 * The organizer's latest move of the end to an earlier time, with notice
 * (`setProcessDuration` with a shorter duration); an end by status is
 * `organizerEnd`. Null when the end only ever moved later.
 */
export function endMovedEarlier(p: ProcessEntity, initialDuration: number | null): ValueChange<number> | null {
  let before = initialDuration
  let out: ValueChange<number> | null = null
  for (const c of p.durationChanges) {
    if (before != null && c.value < before) out = c
    before = c.value
  }
  return out
}
