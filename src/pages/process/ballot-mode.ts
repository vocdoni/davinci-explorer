// A process's BallotMode in words. The rules are the ones the voter's ballot
// proof enforces (davinci-circom `CheckBallotMode`): groupSize at most
// numFields, every field in [minValue, maxValue], no repeated value when
// uniqueValues is set, and the sum of value^costExponent in [minValueSum,
// maxValueSum], where a zero maxValueSum means "up to the voter's census
// weight". groupSize has no other meaning in the proof; it describes
// multi-question layouts.
//
// The protocol stores no ballot type, so the kind is read from the
// parameters. The kinds cover the election presets of davinci-sdk
// (`resolveElectionPreset` in src/core/types/ballot.ts: single_choice,
// multiple_choice, approval, rating, ranking, quadratic) and its budget
// recipe (points). Presets with the same parameters read the same way:
// multiple_choice with maxSelections 1 is a single choice, with
// maxSelections = numFields an approval.

import { plural, t } from '@lingui/core/macro'
import type { BallotMode } from '~indexer/types'
import { formatNumber } from '~lib/format'

export type BallotKind =
  | 'single-choice'
  | 'multiple-choice'
  | 'approval'
  | 'ranking'
  | 'quadratic'
  | 'rating'
  | 'points'
  | 'unsatisfiable'
  | 'custom'

/** Every text field is in the active language: build it while rendering. */
export interface BallotModeDescription {
  kind: BallotKind
  /**
   * Short name of the pattern the rules read as, e.g. "Single choice". The
   * protocol has no ballot-type field, so this is a reading, not a fact.
   */
  label: string
  /** One sentence: what a voter can put on the ballot. */
  summary: string
  /** Each rule the ballot proof enforces, in words. */
  rules: string[]
}

const pow = (v: bigint, e: number) => v ** BigInt(e)

/**
 * Lowest and highest sum of value^costExponent a ballot within the field
 * bounds can reach. With unique values the fields take the smallest (or
 * largest) distinct values.
 */
function sumRange(bm: BallotMode): [bigint, bigint] {
  const e = bm.costExponent
  if (!bm.uniqueValues) {
    const n = BigInt(bm.numFields)
    return [n * pow(bm.minValue, e), n * pow(bm.maxValue, e)]
  }
  let lowest = 0n
  let highest = 0n
  for (let k = 0n; k < BigInt(bm.numFields); k++) {
    lowest += pow(bm.minValue + k, e)
    highest += pow(bm.maxValue - k, e)
  }
  return [lowest, highest]
}

/**
 * The most one field can take while the others sit at minValue and the sum
 * stays within maxValueSum; maxValue when the bound is the voter's weight.
 */
function fieldCap(bm: BallotMode): bigint {
  const e = bm.costExponent
  if (bm.maxValueSum === 0n) return bm.maxValue
  const room = bm.maxValueSum - BigInt(bm.numFields - 1) * pow(bm.minValue, e)
  let lo = bm.minValue
  let hi = bm.maxValue
  while (lo < hi) {
    const mid = (lo + hi + 1n) / 2n
    if (pow(mid, e) <= room) lo = mid
    else hi = mid - 1n
  }
  return lo
}

/** The bounds on the sum of value^costExponent, one whole sentence per case. */
function sumRule(bm: BallotMode): string {
  const exponent = bm.costExponent
  const most = formatNumber(bm.maxValueSum)
  const least = formatNumber(bm.minValueSum)
  const weight = bm.maxValueSum === 0n
  const floor = bm.minValueSum > 0n
  const exact = !weight && bm.minValueSum === bm.maxValueSum
  if (exponent === 1) {
    if (exact) return t`The fields add up to exactly ${most}.`
    if (weight) {
      return floor
        ? t`The fields add up to at most the voter's weight on the list of voters (maxValueSum is 0) and at least ${least}.`
        : t`The fields add up to at most the voter's weight on the list of voters (maxValueSum is 0).`
    }
    return floor
      ? t`The fields add up to at most ${most} and at least ${least}.`
      : t`The fields add up to at most ${most}.`
  }
  if (exponent === 2) {
    if (exact) return t`The sum of the squares of the values is exactly ${most}.`
    if (weight) {
      return floor
        ? t`The sum of the squares of the values is at most the voter's weight on the list of voters (maxValueSum is 0) and at least ${least}.`
        : t`The sum of the squares of the values is at most the voter's weight on the list of voters (maxValueSum is 0).`
    }
    return floor
      ? t`The sum of the squares of the values is at most ${most} and at least ${least}.`
      : t`The sum of the squares of the values is at most ${most}.`
  }
  if (exact) return t`The sum of each value raised to the power ${exponent} is exactly ${most}.`
  if (weight) {
    return floor
      ? t`The sum of each value raised to the power ${exponent} is at most the voter's weight on the list of voters (maxValueSum is 0) and at least ${least}.`
      : t`The sum of each value raised to the power ${exponent} is at most the voter's weight on the list of voters (maxValueSum is 0).`
  }
  return floor
    ? t`The sum of each value raised to the power ${exponent} is at most ${most} and at least ${least}.`
    : t`The sum of each value raised to the power ${exponent} is at most ${most}.`
}

/**
 * Why no ballot can meet the rules, or null. It rules out what the bounds
 * alone forbid; gaps between reachable sums of powers are not searched.
 */
function unsatisfiable(bm: BallotMode): string | null {
  const fields = bm.numFields
  const min = formatNumber(bm.minValue)
  const max = formatNumber(bm.maxValue)
  const most = formatNumber(bm.maxValueSum)
  const least = formatNumber(bm.minValueSum)
  const weight = bm.maxValueSum === 0n
  if (bm.groupSize > fields) {
    const size = formatNumber(bm.groupSize)
    const count = formatNumber(fields)
    return t`No ballot can meet these rules: the group size, ${size}, is larger than the number of fields, ${count}.`
  }
  if (bm.minValue > bm.maxValue) {
    return t`No ballot can meet these rules: the lowest value allowed, ${min}, is above the highest, ${max}.`
  }
  // Unique values need at least as many distinct values as fields.
  const distinct = bm.maxValue - bm.minValue + 1n
  if (bm.uniqueValues && distinct < BigInt(fields)) {
    const allowed = Number(distinct)
    return t`No ballot can meet these rules: the ${plural(fields, { one: '# field', other: '# fields' })} must all differ, but only ${plural(allowed, { one: '# value is', other: '# values are' })} allowed.`
  }
  if (!weight && bm.minValueSum > bm.maxValueSum) {
    return t`No ballot can meet these rules: the sum must be at least ${least} and at most ${most}.`
  }
  const [low, high] = sumRange(bm)
  if (!weight && low > bm.maxValueSum) {
    const lowest = formatNumber(low)
    return t`No ballot can meet these rules: the smallest sum the fields can reach is ${lowest}, above the maximum of ${most}.`
  }
  if (bm.minValueSum > high) {
    const highest = formatNumber(high)
    return t`No ballot can meet these rules: the largest sum the fields can reach is ${highest}, below the minimum of ${least}.`
  }
  return null
}

export function describeBallotMode(bm: BallotMode): BallotModeDescription {
  // `fields` and `options` are the same count; the names tell a translator which word goes with it.
  const fields = bm.numFields
  const options = bm.numFields
  const min = formatNumber(bm.minValue)
  const max = formatNumber(bm.maxValue)
  const most = formatNumber(bm.maxValueSum)
  const least = formatNumber(bm.minValueSum)
  const binary = bm.minValue === 0n && bm.maxValue === 1n
  const e = bm.costExponent
  const rules: string[] = []

  rules.push(
    t`The ballot has ${plural(fields, { one: '# field', other: '# fields' })}, usually one per option; each holds a number between ${min} and ${max}.`
  )
  if (bm.uniqueValues) rules.push(t`No two fields may carry the same value.`)
  rules.push(sumRule(bm))
  // A group as large as the ballot (the SDK's default) is one question and says nothing.
  if (bm.groupSize > 1 && bm.groupSize !== fields) {
    const size = formatNumber(bm.groupSize)
    rules.push(
      t`Fields come in groups of ${size}, one group per question. The ballot proof only checks that a group is not larger than the whole ballot.`
    )
  }
  rules.push(
    t`The results add up each field over every voter's latest vote: an option's result is the sum of the values voters gave it.`
  )

  const impossible = unsatisfiable(bm)
  if (impossible) {
    return { kind: 'unsatisfiable', label: t`Cannot be satisfied`, summary: impossible, rules }
  }

  // Common patterns first; anything else is described by its rules.
  if (bm.uniqueValues && fields > 1) {
    return {
      kind: 'ranking',
      label: t`Ranking`,
      summary: t`Each voter ranks ${plural(options, { one: '# option', other: '# options' })}, giving each a different value from ${min} to ${max}.`,
      rules,
    }
  }
  // A budget that every ballot within the per-field bounds already meets never binds.
  if (
    e >= 1 &&
    bm.maxValue > 1n &&
    fields > 1 &&
    bm.maxValueSum > 0n &&
    BigInt(fields) * pow(bm.maxValue, e) <= bm.maxValueSum
  ) {
    return {
      kind: 'rating',
      label: t`Rating`,
      summary: t`Each voter rates each of ${plural(options, { one: '# option', other: '# options' })} from ${min} to ${max}.`,
      rules,
    }
  }
  const capValue = fieldCap(bm)
  const cap = formatNumber(capValue)
  if (e >= 2 && bm.maxValue > 1n) {
    const exponent = e
    // v², v³, …: a superscript, not a caret, in running text.
    const cost = `v${String(e).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]!)}`
    let summary: string
    if (bm.maxValueSum === 0n) {
      summary = t`Each voter spends as many credits as their weight on the list of voters across ${plural(options, { one: '# option', other: '# options' })}; putting v votes on one option costs ${cost} credits, at most ${cap} votes per option.`
    } else if (bm.minValueSum > 0n) {
      summary = t`Each voter spends between ${least} and ${most} credits across ${plural(options, { one: '# option', other: '# options' })}; putting v votes on one option costs ${cost} credits, at most ${cap} votes per option.`
    } else {
      summary = t`Each voter spends up to ${most} credits across ${plural(options, { one: '# option', other: '# options' })}; putting v votes on one option costs ${cost} credits, at most ${cap} votes per option.`
    }
    return {
      kind: 'quadratic',
      label: e === 2 ? t`Quadratic voting` : t`Cost exponent ${exponent}`,
      summary,
      rules,
    }
  }
  if (binary && fields > 1 && e >= 1) {
    if (bm.maxValueSum === 1n) {
      return {
        kind: 'single-choice',
        label: t`Single choice`,
        summary:
          bm.minValueSum > 0n
            ? t`Each voter picks exactly one of ${plural(options, { one: '# option', other: '# options' })}.`
            : t`Each voter picks one of ${plural(options, { one: '# option', other: '# options' })}, or none (a blank ballot).`,
        rules,
      }
    }
    if (bm.maxValueSum > 1n && bm.maxValueSum < BigInt(fields)) {
      let summary: string
      if (bm.minValueSum === bm.maxValueSum) {
        summary = t`Each voter picks exactly ${most} of ${plural(options, { one: '# option', other: '# options' })}.`
      } else if (bm.minValueSum > 0n) {
        summary = t`Each voter picks at least ${least} and up to ${most} of ${plural(options, { one: '# option', other: '# options' })}.`
      } else {
        summary = t`Each voter picks up to ${most} of ${plural(options, { one: '# option', other: '# options' })}.`
      }
      return { kind: 'multiple-choice', label: t`Multiple choice`, summary, rules }
    }
    return {
      kind: 'approval',
      label: t`Approval`,
      summary:
        bm.maxValueSum === 0n
          ? bm.minValueSum > 0n
            ? t`Each voter approves at least ${least} and up to W of ${plural(options, { one: '# option', other: '# options' })}, W being their weight on the list of voters.`
            : t`Each voter approves up to W of ${plural(options, { one: '# option', other: '# options' })}, W being their weight on the list of voters.`
          : bm.minValueSum > 0n
            ? t`Each voter approves at least ${least} of ${plural(options, { one: '# option', other: '# options' })}.`
            : t`Each voter approves any number of ${plural(options, { one: '# option', other: '# options' })}.`,
      rules,
    }
  }
  if (e === 1 && bm.maxValue > 1n && fields > 1) {
    let summary: string
    if (bm.maxValueSum === 0n) {
      summary = t`Each voter distributes as many points as their weight on the list of voters among ${plural(options, { one: '# option', other: '# options' })}, at most ${cap} per option.`
    } else if (capValue < bm.maxValueSum) {
      summary = t`Each voter distributes up to ${most} points among ${plural(options, { one: '# option', other: '# options' })}, at most ${cap} per option.`
    } else {
      summary = t`Each voter distributes up to ${most} points among ${plural(options, { one: '# option', other: '# options' })}.`
    }
    return { kind: 'points', label: t`Points`, summary, rules }
  }
  return {
    kind: 'custom',
    label: fields === 1 ? t`Single field` : t`Custom`,
    summary:
      fields === 1
        ? t`Each voter enters one value between ${min} and ${max}.`
        : t`Each voter fills ${plural(fields, { one: '# field', other: '# fields' })} with values between ${min} and ${max}.`,
    rules,
  }
}
