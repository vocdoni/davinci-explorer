import { describe, expect, it } from 'vitest'
import { demoFixture } from '~fixtures/demo'
import { processRow, transitionRows } from '~indexer/selectors'
import type { Hex, ProcessEntity } from '~indexer/types'
import { organizerEnd, votingEnd } from './ending'
import { processLifecycle } from './timeline'

const f = demoFixture()
const pid = f.store.processOrder.find((k) => f.store.processes[k]!.state?.status === 'ended')!
const START = f.store.processes[pid]!.state!.startTime
const tx = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex

/** The ended demo election, ended by the organizer at `endAt` seconds after the start. */
function endedAt(endAt: number, extendedTo?: number): ProcessEntity {
  const p = structuredClone(f.store.processes[pid]!)
  const at = (block: number, timestamp: number, hash: number) => ({ block, tx: tx(hash), timestamp })
  p.durationChanges = [
    ...(extendedTo != null ? [{ ...at(1, START + 60, 1), value: extendedTo }] : []),
    { ...at(2, START + endAt, 2), value: endAt },
  ]
  p.statusChanges = [{ ...at(2, START + endAt, 2), from: 'ready', to: 'ended' }]
  p.decryptionRequest = null
  p.state!.duration = endAt
  return p
}

describe('organizerEnd', () => {
  it('is early before the planned end', () => {
    expect(organizerEnd(endedAt(100), 600)).toMatchObject({ early: true, plannedEnd: START + 600 })
    expect(votingEnd(endedAt(100), { endTime: START + 100 }, 600)).toBe(START + 100)
  })

  it('after the planned end, voting had closed at it', () => {
    const late = endedAt(900)
    expect(organizerEnd(late, 600)).toMatchObject({ early: false, plannedEnd: START + 600 })
    expect(votingEnd(late, { endTime: START + 900 }, 600)).toBe(START + 600)
    // The duration an extension set is the one the end is measured against.
    expect(organizerEnd(endedAt(1_500, 1_200), 600)).toMatchObject({ early: false, plannedEnd: START + 1_200 })
    expect(organizerEnd(endedAt(1_000, 1_200), 600)).toMatchObject({ early: true })
  })

  it('does not know without the planned duration, and leaves the committee request alone', () => {
    expect(organizerEnd(endedAt(900), null)).toMatchObject({ early: null, plannedEnd: null })
    const requested = endedAt(900)
    requested.decryptionRequest = {
      block: 2,
      tx: requested.statusChanges[0]!.tx,
      timestamp: START + 900,
      epochId: `0x${'00'.repeat(12)}`,
      aid: `0x${'00'.repeat(32)}`,
      firstIndex: 1,
      count: 1,
    }
    expect(organizerEnd(requested, 600)).toBeNull()
  })

  it('closes the lifecycle at the planned end when the organizer ended it later', () => {
    const late = endedAt(900)
    const row = processRow(f.store, late)
    const steps = processLifecycle(
      { process: late, row, transitions: transitionRows(f.store, pid) },
      START + 10_000,
      600
    )
    expect(steps[3]).toMatchObject({ detail: 'End time reached', time: START + 600, tx: null })
    const early = endedAt(100)
    const first = processLifecycle(
      { process: early, row: processRow(f.store, early), transitions: [] },
      START + 10_000,
      600
    )
    expect(first[3]).toMatchObject({ detail: 'Ended by the organizer', tx: tx(2) })
  })
})
