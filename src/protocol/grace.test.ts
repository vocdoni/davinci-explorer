import { describe, expect, it } from 'vitest'
import { graceCap, graceEnd } from './grace'

// The cases of davinci-contracts `test/Grace.t.sol`: production bounds
// (grace 180, cap 1800) and the anvil ones (grace 60, cap 60).
const START = 1_000_000
const DURATION = 3_600
const END = START + DURATION
const process = (grace: number, lastVoteAt = 0) => ({ startTime: START, duration: DURATION, grace, lastVoteAt })

describe('graceEnd', () => {
  it('is the end plus the grace until a batch lands after the end', () => {
    expect(graceEnd(process(180), 1_800)).toBe(END + 180)
    // A batch before the end does not move it.
    expect(graceEnd(process(180, END - 10), 1_800)).toBe(END + 180)
  })

  it('restarts from every batch recorded after the end', () => {
    expect(graceEnd(process(180, END + 100), 1_800)).toBe(END + 100 + 180)
    expect(graceEnd(process(180, END + 180 + 50), 1_800)).toBe(END + 180 + 50 + 180)
  })

  it('never runs past the cap after the end', () => {
    expect(graceEnd(process(60, END + 30), 60)).toBe(END + 60)
    expect(graceEnd(process(60, END + 59), 60)).toBe(END + 60)
    expect(graceCap(process(60), 60)).toBe(END + 60)
  })

  it('matches the contract over a range of values', () => {
    for (const grace of [150, 180, 600]) {
      for (const last of [0, END - 1, END, END + 1, END + 900, END + 1_700, END + 1_800]) {
        const idle = Math.max(END, last) + grace
        expect(graceEnd(process(grace, last), 1_800)).toBe(Math.min(END + 1_800, idle))
      }
    }
  })

  it('never closes for an end too far away to count', () => {
    expect(graceEnd({ startTime: START, duration: 2 ** 80, grace: 180, lastVoteAt: 0 }, 1_800)).toBe(Infinity)
  })
})
