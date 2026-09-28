import { afterEach, describe, expect, it } from 'vitest'
import { presetBallotMode, type ElectionPreset } from '~fixtures/presets'
import { activateLocale } from '~i18n/i18n'
import type { BallotMode } from '~indexer/types'
import { ballotPasses, findBallot } from '../../test/ballots'
import { describeBallotMode, type BallotKind } from './ballot-mode'

// Tests read English; one that switches language switches back.
afterEach(() => activateLocale('en'))

const mode = (over: Partial<BallotMode>): BallotMode => ({
  uniqueValues: false,
  numFields: 4,
  groupSize: 0,
  costExponent: 1,
  maxValue: 1n,
  minValue: 0n,
  maxValueSum: 1n,
  minValueSum: 0n,
  ...over,
})

/** A ballot mode written the SDK's way: bounds as decimal strings. */
const sdk = (m: {
  numFields: number
  groupSize: number
  minValue: string
  maxValue: string
  uniqueValues: boolean
  costExponent: number
  minValueSum: string
  maxValueSum: string
}): BallotMode => ({
  ...m,
  minValue: BigInt(m.minValue),
  maxValue: BigInt(m.maxValue),
  minValueSum: BigInt(m.minValueSum),
  maxValueSum: BigInt(m.maxValueSum),
})

describe('davinci-sdk ballot kinds', () => {
  // The SDK's own expectations for resolveElectionPreset (test/core/unit/ElectionPreset.test.ts).
  it('resolves presets to the ballot modes the SDK builds', () => {
    expect(presetBallotMode({ type: 'single_choice' }, 5)).toEqual(
      sdk({
        numFields: 5,
        groupSize: 5,
        minValue: '0',
        maxValue: '1',
        uniqueValues: false,
        costExponent: 1,
        minValueSum: '1',
        maxValueSum: '1',
      })
    )
    expect(presetBallotMode({ type: 'single_choice', allowAbstain: true }, 3).minValueSum).toBe(0n)
    expect(presetBallotMode({ type: 'multiple_choice', maxSelections: 3 }, 5)).toEqual(
      sdk({
        numFields: 5,
        groupSize: 5,
        minValue: '0',
        maxValue: '1',
        uniqueValues: false,
        costExponent: 1,
        minValueSum: '0',
        maxValueSum: '3',
      })
    )
    expect(presetBallotMode({ type: 'multiple_choice', minSelections: 2, maxSelections: 4 }, 5)).toMatchObject({
      minValueSum: 2n,
      maxValueSum: 4n,
    })
    expect(presetBallotMode({ type: 'approval' }, 4)).toEqual(
      sdk({
        numFields: 4,
        groupSize: 4,
        minValue: '0',
        maxValue: '1',
        uniqueValues: false,
        costExponent: 1,
        minValueSum: '0',
        maxValueSum: '4',
      })
    )
    expect(presetBallotMode({ type: 'rating', maxValue: 5 }, 3)).toEqual(
      sdk({
        numFields: 3,
        groupSize: 3,
        minValue: '0',
        maxValue: '5',
        uniqueValues: false,
        costExponent: 1,
        minValueSum: '0',
        maxValueSum: '15',
      })
    )
    expect(presetBallotMode({ type: 'rating', minValue: 1, maxValue: 10 }, 2)).toMatchObject({
      minValue: 1n,
      maxValue: 10n,
      minValueSum: 2n,
      maxValueSum: 20n,
    })
    expect(presetBallotMode({ type: 'ranking' }, 3)).toEqual(
      sdk({
        numFields: 3,
        groupSize: 3,
        minValue: '1',
        maxValue: '3',
        uniqueValues: true,
        costExponent: 1,
        minValueSum: '6',
        maxValueSum: '6',
      })
    )
    expect(presetBallotMode({ type: 'ranking' }, 10)).toMatchObject({ minValueSum: 55n, maxValueSum: 55n })
    expect(presetBallotMode({ type: 'quadratic', budget: 100 }, 4)).toEqual(
      sdk({
        numFields: 4,
        groupSize: 4,
        minValue: '0',
        maxValue: '100',
        uniqueValues: false,
        costExponent: 2,
        minValueSum: '0',
        maxValueSum: '100',
      })
    )
    expect(presetBallotMode({ type: 'quadratic', budget: 50, minValueSum: 10 }, 3).minValueSum).toBe(10n)
  })

  it('reads every preset as its kind, for 2 to 16 options, and each can be filled', () => {
    for (let n = 2; n <= 16; n++) {
      const cases: Array<[ElectionPreset, BallotKind]> = [
        [{ type: 'single_choice' }, 'single-choice'],
        [{ type: 'single_choice', allowAbstain: true }, 'single-choice'],
        [{ type: 'multiple_choice', maxSelections: 1 }, 'single-choice'],
        [{ type: 'multiple_choice', maxSelections: n }, 'approval'],
        [{ type: 'multiple_choice', minSelections: 1, maxSelections: n }, 'approval'],
        [{ type: 'approval' }, 'approval'],
        [{ type: 'rating', maxValue: 5 }, 'rating'],
        [{ type: 'rating', minValue: 1, maxValue: 10 }, 'rating'],
        [{ type: 'ranking' }, 'ranking'],
        [{ type: 'quadratic', budget: 100 }, 'quadratic'],
        [{ type: 'quadratic', budget: 50, minValueSum: 10 }, 'quadratic'],
        // Fields of 0 or 1 cost the same squared: a budget of 1 is one pick.
        [{ type: 'quadratic', budget: 1 }, 'single-choice'],
      ]
      for (let m = 2; m < n; m++) {
        cases.push([{ type: 'multiple_choice', maxSelections: m }, 'multiple-choice'])
        cases.push([{ type: 'multiple_choice', minSelections: 1, maxSelections: m }, 'multiple-choice'])
        cases.push([{ type: 'multiple_choice', minSelections: m, maxSelections: m }, 'multiple-choice'])
      }
      for (const [preset, kind] of cases) {
        const bm = presetBallotMode(preset, n)
        const label = `${JSON.stringify(preset)} over ${n}`
        expect(describeBallotMode(bm).kind, label).toBe(kind)
        const ballot = findBallot(bm)
        expect(ballot, label).not.toBeNull()
        expect(ballotPasses(bm, ballot!), label).toBe(true)
      }
    }
  })

  it('tells voters what each preset allows', () => {
    const summary = (preset: ElectionPreset, n: number) => describeBallotMode(presetBallotMode(preset, n)).summary
    expect(summary({ type: 'single_choice' }, 4)).toBe('Each voter picks exactly one of 4 options.')
    expect(summary({ type: 'single_choice', allowAbstain: true }, 2)).toBe(
      'Each voter picks one of 2 options, or none (a blank ballot).'
    )
    expect(summary({ type: 'multiple_choice', maxSelections: 2 }, 5)).toBe('Each voter picks up to 2 of 5 options.')
    expect(summary({ type: 'multiple_choice', minSelections: 1, maxSelections: 2 }, 3)).toBe(
      'Each voter picks at least 1 and up to 2 of 3 options.'
    )
    expect(summary({ type: 'multiple_choice', minSelections: 3, maxSelections: 3 }, 8)).toBe(
      'Each voter picks exactly 3 of 8 options.'
    )
    expect(summary({ type: 'approval' }, 8)).toBe('Each voter approves any number of 8 options.')
    expect(summary({ type: 'rating', minValue: 1, maxValue: 5 }, 3)).toBe(
      'Each voter rates each of 3 options from 1 to 5.'
    )
    expect(summary({ type: 'ranking' }, 4)).toBe(
      'Each voter ranks 4 options, giving each a different value from 1 to 4.'
    )
    // The SDK sets maxValue to the budget; the budget itself caps a field at its square root.
    expect(summary({ type: 'quadratic', budget: 100 }, 16)).toBe(
      'Each voter spends up to 100 credits across 16 options; putting v votes on one option costs v² credits, at most 10 votes per option.'
    )
    expect(summary({ type: 'quadratic', budget: 50, minValueSum: 10 }, 3)).toBe(
      'Each voter spends between 10 and 50 credits across 3 options; putting v votes on one option costs v² credits, at most 7 votes per option.'
    )
  })

  it('reads the raw ballot modes of the SDK docs and examples', () => {
    // Budget voting, from the davinci-sdk ballot-modes reference.
    const budget = describeBallotMode(
      sdk({
        numFields: 6,
        groupSize: 6,
        minValue: '0',
        maxValue: '50',
        uniqueValues: false,
        costExponent: 1,
        minValueSum: '0',
        maxValueSum: '100',
      })
    )
    expect(budget.kind).toBe('points')
    expect(budget.summary).toBe('Each voter distributes up to 100 points among 6 options, at most 50 per option.')
    // "Weighted" single choice, from the davinci-sdk examples (script and token-census recipe):
    // the weight goes in one field, but nothing stops a voter from splitting it.
    const weighted = describeBallotMode(
      sdk({
        numFields: 4,
        groupSize: 4,
        minValue: '0',
        maxValue: '1000000',
        uniqueValues: false,
        costExponent: 1,
        minValueSum: '0',
        maxValueSum: '1000000',
      })
    )
    expect(weighted.kind).toBe('points')
    expect(weighted.summary).toBe('Each voter distributes up to 1,000,000 points among 4 options.')
    // examples/script/src/onchain.ts:367-385: a sum bound that never binds.
    const onchain = sdk({
      numFields: 2,
      groupSize: 2,
      minValue: '0',
      maxValue: '3',
      uniqueValues: false,
      costExponent: 1,
      minValueSum: '0',
      maxValueSum: '6',
    })
    expect(describeBallotMode(onchain).kind).toBe('rating')
    // README.md:119-127: one field holding the index of the chosen option.
    const readme = sdk({
      numFields: 1,
      groupSize: 1,
      minValue: '0',
      maxValue: '2',
      uniqueValues: false,
      costExponent: 1,
      minValueSum: '0',
      maxValueSum: '2',
    })
    expect(describeBallotMode(readme)).toMatchObject({ kind: 'custom', label: 'Single field' })
  })

  it('does not call the SDK default group size a multi-question layout', () => {
    const rules = describeBallotMode(presetBallotMode({ type: 'approval' }, 4)).rules
    expect(rules.some((r) => r.includes('groups of'))).toBe(false)
    expect(describeBallotMode(mode({ groupSize: 2 })).rules.some((r) => r.includes('groups of 2'))).toBe(true)
  })
})

describe('describeBallotMode', () => {
  it('single choice, blank allowed or not', () => {
    expect(describeBallotMode(mode({})).kind).toBe('single-choice')
    expect(describeBallotMode(mode({})).summary).toContain('or none')
    expect(describeBallotMode(mode({ minValueSum: 1n })).summary).toBe('Each voter picks exactly one of 4 options.')
  })

  it('multiple choice and approval', () => {
    expect(describeBallotMode(mode({ maxValueSum: 2n })).summary).toBe('Each voter picks up to 2 of 4 options.')
    expect(describeBallotMode(mode({ maxValueSum: 4n })).kind).toBe('approval')
    expect(describeBallotMode(mode({ maxValueSum: 0n })).summary).toContain('census weight')
  })

  it('points, quadratic and ranking', () => {
    const points = describeBallotMode(mode({ maxValue: 10n, maxValueSum: 20n }))
    expect(points.kind).toBe('points')
    expect(points.summary).toBe('Each voter distributes up to 20 points among 4 options, at most 10 per option.')
    const quad = describeBallotMode(mode({ costExponent: 2, maxValue: 10n, maxValueSum: 100n }))
    expect(quad.kind).toBe('quadratic')
    expect(quad.summary).toContain('v² credits')
    expect(quad.rules.join(' ')).toContain('sum of the squares of the values is at most 100')
    const rank = describeBallotMode(mode({ uniqueValues: true, minValue: 1n, maxValue: 4n, maxValueSum: 10n }))
    expect(rank.kind).toBe('ranking')
    expect(rank.rules).toContain('No two fields may carry the same value.')
  })

  it('a budget that never binds reads as a rating', () => {
    const rating = describeBallotMode(mode({ maxValue: 5n, maxValueSum: 20n }))
    expect(rating.kind).toBe('rating')
    expect(rating.summary).toBe('Each voter rates each of 4 options from 0 to 5.')
    expect(describeBallotMode(mode({ costExponent: 2, maxValue: 3n, maxValueSum: 36n })).kind).toBe('rating')
    expect(describeBallotMode(mode({ costExponent: 2, maxValue: 3n, maxValueSum: 35n })).kind).toBe('quadratic')
  })

  it('unique values with fewer allowed values than fields cannot be satisfied', () => {
    const d = describeBallotMode(mode({ uniqueValues: true }))
    expect(d.kind).toBe('unsatisfiable')
    expect(d.label).toBe('Cannot be satisfied')
    expect(d.summary).toBe(
      'No ballot can meet these rules: the 4 fields must all differ, but only 2 values are allowed.'
    )
    expect(describeBallotMode(mode({ uniqueValues: true, numFields: 2 })).kind).toBe('ranking')
  })

  it('finds the other bounds no ballot can meet', () => {
    const why = (over: Partial<BallotMode>) => {
      const d = describeBallotMode(mode(over))
      expect(d.kind).toBe('unsatisfiable')
      return d.summary
    }
    expect(why({ groupSize: 5 })).toBe(
      'No ballot can meet these rules: the group size, 5, is larger than the number of fields, 4.'
    )
    expect(why({ minValue: 3n, maxValue: 2n, maxValueSum: 20n })).toBe(
      'No ballot can meet these rules: the lowest value allowed, 3, is above the highest, 2.'
    )
    expect(why({ minValueSum: 3n, maxValueSum: 2n })).toBe(
      'No ballot can meet these rules: the sum must be at least 3 and at most 2.'
    )
    expect(why({ minValue: 1n, maxValue: 5n, maxValueSum: 3n })).toBe(
      'No ballot can meet these rules: the smallest sum the fields can reach is 4, above the maximum of 3.'
    )
    expect(why({ minValueSum: 5n, maxValueSum: 8n })).toBe(
      'No ballot can meet these rules: the largest sum the fields can reach is 4, below the minimum of 5.'
    )
    // Unique values take the smallest distinct values: 1 + 2 + 3 + 4 = 10.
    expect(why({ uniqueValues: true, minValue: 1n, maxValue: 9n, maxValueSum: 9n })).toBe(
      'No ballot can meet these rules: the smallest sum the fields can reach is 10, above the maximum of 9.'
    )
    // A zero maxValueSum is the voter's weight, unknown here: never unsatisfiable on its own.
    expect(describeBallotMode(mode({ minValue: 1n, maxValue: 5n, maxValueSum: 0n })).kind).toBe('points')
  })

  it('always states the bounds and the tally rule', () => {
    const d = describeBallotMode(mode({ numFields: 1, maxValue: 5n, maxValueSum: 5n }))
    expect(d.kind).toBe('custom')
    expect(d.rules[0]).toContain('between 0 and 5')
    expect(describeBallotMode(mode({ maxValue: 5n, maxValueSum: 0n })).summary).toBe(
      'Each voter distributes as many points as their census weight among 4 options, at most 5 per option.'
    )
    expect(d.rules[d.rules.length - 1]).toContain('sum of the values voters gave it')
  })

  it('states the sum bounds as one sentence per case', () => {
    const sum = (over: Partial<BallotMode>) => describeBallotMode(mode(over)).rules[1]
    expect(sum({ maxValueSum: 3n })).toBe('The fields add up to at most 3.')
    expect(sum({ maxValueSum: 3n, minValueSum: 1n })).toBe('The fields add up to at most 3 and at least 1.')
    expect(sum({ maxValueSum: 1n, minValueSum: 1n })).toBe('The fields add up to exactly 1.')
    expect(sum({ costExponent: 2, maxValue: 10n, maxValueSum: 25n, minValueSum: 25n })).toBe(
      'The sum of the squares of the values is exactly 25.'
    )
    expect(sum({ maxValueSum: 0n })).toBe("The fields add up to at most the voter's census weight (maxValueSum is 0).")
    expect(sum({ maxValueSum: 0n, minValueSum: 2n })).toBe(
      "The fields add up to at most the voter's census weight (maxValueSum is 0) and at least 2."
    )
    expect(sum({ costExponent: 2, maxValue: 10n, maxValueSum: 100n, minValueSum: 4n })).toBe(
      'The sum of the squares of the values is at most 100 and at least 4.'
    )
    expect(sum({ costExponent: 3, maxValue: 10n, maxValueSum: 0n })).toBe(
      "The sum of each value raised to the power 3 is at most the voter's census weight (maxValueSum is 0)."
    )
  })

  it('names the quadratic cost and counts in whole sentences', () => {
    const cubic = describeBallotMode(mode({ costExponent: 3, maxValue: 10n, maxValueSum: 50n }))
    expect(cubic.label).toBe('Cost exponent 3')
    // 3³ = 27 fits in 50 credits, 4³ = 64 does not.
    expect(cubic.summary).toBe(
      'Each voter spends up to 50 credits across 4 options; putting v votes on one option costs v^3 credits, at most 3 votes per option.'
    )
    expect(describeBallotMode(mode({ numFields: 1, maxValue: 1n })).summary).toBe(
      'Each voter enters one value between 0 and 1.'
    )
    expect(describeBallotMode(mode({ numFields: 1, maxValue: 5n, maxValueSum: 5n })).rules[0]).toBe(
      'The ballot has 1 field, usually one per option; each holds a number between 0 and 5.'
    )
    expect(describeBallotMode(mode({ maxValueSum: 0n, minValueSum: 1n })).summary).toBe(
      'Each voter approves at least 1 and up to W of 4 options, W being their census weight.'
    )
  })

  it('formats its numbers in the active language', async () => {
    const points = mode({ maxValue: 20_000n, maxValueSum: 50_000n })
    expect(describeBallotMode(points).summary).toBe(
      'Each voter distributes up to 50,000 points among 4 options, at most 20,000 per option.'
    )
    await activateLocale('es')
    const summary = describeBallotMode(points).summary
    expect(summary).toContain('50.000')
    expect(summary).toContain('20.000')
  })
})
