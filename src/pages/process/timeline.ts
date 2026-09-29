// The lifecycle strip of a process page: created → start → batches → end
// → results, each step done, in progress, still ahead, or skipped (a canceled
// process never ends normally and never gets results).

import { plural, t } from '@lingui/core/macro'
import type { ProcessView } from '~data/hooks'
import { votingOver } from '~indexer/selectors'
import type { Hex } from '~indexer/types'
import { formatNumber } from '~lib/format'

export type StepState = 'done' | 'current' | 'upcoming' | 'skipped'

/** `label` and `detail` are in the active language: build the steps while rendering. */
export interface LifecycleStep {
  id: 'created' | 'start' | 'transitions' | 'end' | 'results'
  label: string
  state: StepState
  /** Unix seconds, when the step has a time. */
  time: number | null
  detail: string
  tx: Hex | null
}

export function processLifecycle(view: Pick<ProcessView, 'process' | 'row' | 'transitions'>, now: number | null) {
  const { process: p, row, transitions } = view
  const phase = row.phase
  const canceled = phase === 'canceled'
  const cancel = canceled ? [...p.statusChanges].reverse().find((c) => c.to === 'canceled') : undefined
  const started = row.startTime != null && now != null && now >= row.startTime
  const last = transitions[transitions.length - 1]
  const ballots = transitions.reduce((sum, t) => sum + t.votes, 0)
  const ended = phase === 'ended' || phase === 'results' || phase === 'closed'
  const over = votingOver(row, now)
  // Asking the committee to decrypt moves a process whose end time passed to
  // Ended in the same transaction: that is the end time, not the organizer.
  const endChange = [...p.statusChanges]
    .reverse()
    .find((c) => c.to === 'ended' && !(c.tx && c.tx === p.decryptionRequest?.tx))
  const block = formatNumber(p.createdBlock)
  const batches = transitions.length

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
        !over && (phase === 'open' || phase === 'paused')
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
      time: canceled ? (cancel?.timestamp ?? null) : row.endTime,
      detail: canceled
        ? t`Canceled by the organizer`
        : phase === 'closed'
          ? t`End time passed; the chain still reads Ready`
          : phase === 'paused'
            ? t`Paused by the organizer`
            : endChange
              ? t`Ended by the organizer`
              : ended
                ? t`End time reached`
                : t`End time`,
      tx: canceled ? (cancel?.tx ?? null) : (endChange?.tx ?? null),
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
              state: ended ? 'current' : 'upcoming',
              time: null,
              detail: ended ? t`Pending` : t`After the end`,
              tx: null,
            }
  )
  return steps
}
