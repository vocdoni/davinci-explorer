import { describe, expect, it } from 'vitest'
import type { VoteInclusion } from '~data/queries'
import type { RootChain } from '~indexer/selectors'
import { batchOutcome, chainFrom, resultOutcome, settledOutcome, trackerOutcome, type Settled } from './model'

const inclusion = (state: VoteInclusion['state'], transitionIndex: number | null = null): VoteInclusion => ({
  state,
  transitionIndex,
  checked: 0,
  total: 3,
  errors: [],
})

const found: Settled = { status: 'pass', reason: 'found' }
const waiting: Settled = { status: 'pending', reason: 'waiting' }
const missing: Settled = { status: 'fail', reason: 'not-found' }

describe('settledOutcome', () => {
  it('passes when a batch lists the vote id', () => {
    expect(settledOutcome(true, inclusion('found', 2), 3, [])).toEqual(found)
  })

  it('waits while reading and while a sequencer holds the vote', () => {
    expect(settledOutcome(true, inclusion('searching'), 3, []).reason).toBe('reading')
    expect(settledOutcome(true, inclusion('not-found'), 3, ['aggregated'])).toEqual(waiting)
    expect(settledOutcome(true, inclusion('idle'), 0, ['pending'])).toEqual(waiting)
    expect(settledOutcome(true, inclusion('idle'), 0, [])).toEqual({ status: 'pending', reason: 'no-batches' })
  })

  it('fails when nobody has it or a sequencer refused it', () => {
    expect(settledOutcome(true, inclusion('not-found'), 3, [])).toEqual(missing)
    expect(settledOutcome(true, inclusion('not-found'), 3, ['error'])).toEqual({ status: 'fail', reason: 'refused' })
  })

  it('cannot decide without the blobs or the election', () => {
    expect(settledOutcome(true, inclusion('error'), 3, [])).toEqual({ status: 'na', reason: 'unreadable' })
    expect(settledOutcome(false, inclusion('idle'), 0, [])).toEqual({ status: 'na', reason: 'no-election' })
  })
})

describe('batchOutcome', () => {
  it('follows the settled check, then combines the batch checks', () => {
    expect(batchOutcome(waiting, null)).toBe('pending')
    expect(batchOutcome(missing, null)).toBe('na')
    expect(batchOutcome(found, null)).toBe('pending')
    expect(batchOutcome(found, ['pass', 'pass'])).toBe('pass')
    expect(batchOutcome(found, ['pass', 'unknown'])).toBe('pending')
    expect(batchOutcome(found, ['pass', 'fail'])).toBe('fail')
  })
})

describe('chainFrom and resultOutcome', () => {
  const chain = (continuous: Array<boolean | null>, headMatches: boolean | null): RootChain => ({
    genesisRoot: '0x01',
    links: continuous.map((c, index) => ({
      index,
      expectedBefore: '0x01',
      rootBefore: '0x01',
      rootAfter: '0x02',
      continuous: c,
    })),
    gaps: continuous.filter((c) => c === false).length,
    headMatches,
  })

  it('only looks at the batches after the vote’s', () => {
    expect(chainFrom(chain([false, true, true], true), 0)).toBe('pass')
    expect(chainFrom(chain([true, false, true], true), 0)).toBe('fail')
    expect(chainFrom(chain([true, true], false), 1)).toBe('fail')
    expect(chainFrom(chain([true, null], true), 0)).toBe('pending')
  })

  it('waits for the result and gives up on a canceled election', () => {
    expect(resultOutcome(found, false, false, 'pass', [])).toEqual({ status: 'pending', reason: 'not-yet' })
    expect(resultOutcome(found, false, true, 'pass', [])).toEqual({ status: 'na', reason: 'canceled' })
    expect(resultOutcome(missing, true, false, 'pass', ['pass'])).toEqual({ status: 'na', reason: 'blocked' })
    expect(resultOutcome(found, true, false, 'pass', ['pass', 'pass']).status).toBe('pass')
    expect(resultOutcome(found, true, false, 'fail', ['pass']).status).toBe('fail')
    expect(resultOutcome(found, true, false, 'pass', []).status).toBe('pending')
  })
})

describe('trackerOutcome', () => {
  const base = { sequencers: 1, loading: false, error: false, proof: null, settled: found }

  it('does not apply without a sequencer', () => {
    expect(trackerOutcome({ ...base, sequencers: 0 })).toEqual({ status: 'na', reason: 'no-sequencer' })
  })

  it('checks the path and the root', () => {
    expect(trackerOutcome({ ...base, proof: { valid: true, rootOnChain: true } }).status).toBe('pass')
    expect(trackerOutcome({ ...base, proof: { valid: true, rootOnChain: false } }).status).toBe('fail')
    expect(trackerOutcome({ ...base, proof: { valid: false, rootOnChain: true } }).status).toBe('fail')
  })

  it('waits for an answer or a settlement', () => {
    expect(trackerOutcome({ ...base, loading: true }).status).toBe('pending')
    expect(trackerOutcome({ ...base, error: true })).toEqual({ status: 'pending', reason: 'unavailable' })
    expect(trackerOutcome({ ...base, settled: waiting })).toEqual({ status: 'pending', reason: 'unknown-vote' })
    expect(trackerOutcome(base)).toEqual({ status: 'na', reason: 'unknown-vote' })
  })
})
