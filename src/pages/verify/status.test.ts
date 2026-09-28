import { describe, expect, it } from 'vitest'
import { combine, countStatuses, fromCheckState, stepStates } from './status'

describe('combine', () => {
  it('fails on any failure, then waits on anything undecided', () => {
    expect(combine(['pass', 'fail', 'pending'])).toBe('fail')
    expect(combine(['pass', 'pending', 'na'])).toBe('pending')
    expect(combine(['pass', 'na'])).toBe('pass')
    expect(combine(['na', 'na'])).toBe('na')
    expect(combine([])).toBe('na')
  })

  it('reads an unknown recomputed check as pending', () => {
    expect(['pass', 'fail', 'unknown'].map((s) => fromCheckState(s as never))).toEqual(['pass', 'fail', 'pending'])
  })

  it('counts', () => {
    expect(countStatuses(['pass', 'pass', 'na', 'fail'])).toEqual({ pass: 2, fail: 1, pending: 0, na: 1 })
  })
})

describe('stepStates', () => {
  it('walks choose, check, redo', () => {
    expect(stepStates(false, false)).toEqual({ choose: 'current', check: 'upcoming', redo: 'upcoming' })
    expect(stepStates(true, false)).toEqual({ choose: 'done', check: 'current', redo: 'upcoming' })
    expect(stepStates(true, true)).toEqual({ choose: 'done', check: 'done', redo: 'current' })
  })
})
