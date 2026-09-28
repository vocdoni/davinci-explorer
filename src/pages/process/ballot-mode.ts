// A process's BallotMode in words. The rules are the ones the voter's ballot
// proof enforces (davinci-circom `CheckBallotMode`): every field in
// [minValue, maxValue], no repeated value when uniqueValues is set, and the
// sum of value^costExponent in [minValueSum, maxValueSum], where a zero
// maxValueSum means "up to the voter's census weight". groupSize is only
// checked to be at most numFields; it describes multi-question layouts.

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

/** The bounds on the sum of value^costExponent, one whole sentence per case. */
function sumRule(bm: BallotMode): string {
  const exponent = bm.costExponent
  const most = formatNumber(bm.maxValueSum)
  const least = formatNumber(bm.minValueSum)
  const weight = bm.maxValueSum === 0n
  const floor = bm.minValueSum > 0n
  if (exponent === 1) {
    if (weight) {
      return floor
        ? t`The fields add up to at most the voter's census weight (maxValueSum is 0) and at least ${least}.`
        : t`The fields add up to at most the voter's census weight (maxValueSum is 0).`
    }
    return floor
      ? t`The fields add up to at most ${most} and at least ${least}.`
      : t`The fields add up to at most ${most}.`
  }
  if (exponent === 2) {
    if (weight) {
      return floor
        ? t`The sum of the squares of the values is at most the voter's census weight (maxValueSum is 0) and at least ${least}.`
        : t`The sum of the squares of the values is at most the voter's census weight (maxValueSum is 0).`
    }
    return floor
      ? t`The sum of the squares of the values is at most ${most} and at least ${least}.`
      : t`The sum of the squares of the values is at most ${most}.`
  }
  if (weight) {
    return floor
      ? t`The sum of each value raised to the power ${exponent} is at most the voter's census weight (maxValueSum is 0) and at least ${least}.`
      : t`The sum of each value raised to the power ${exponent} is at most the voter's census weight (maxValueSum is 0).`
  }
  return floor
    ? t`The sum of each value raised to the power ${exponent} is at most ${most} and at least ${least}.`
    : t`The sum of each value raised to the power ${exponent} is at most ${most}.`
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
  if (bm.groupSize > 1) {
    const size = formatNumber(bm.groupSize)
    rules.push(
      t`Fields come in groups of ${size} (a multi-question layout); the ballot proof only checks the group size does not exceed the field count.`
    )
  }
  rules.push(
    t`The tally adds each field over every voter's latest ballot: an option's result is the sum of the values voters gave it.`
  )

  // Unique values need at least as many distinct values as fields.
  const distinct = bm.maxValue - bm.minValue + 1n
  if (bm.uniqueValues && distinct < BigInt(fields)) {
    const allowed = Number(distinct)
    return {
      kind: 'unsatisfiable',
      label: t`Cannot be satisfied`,
      summary: t`No ballot can meet these rules: the ${plural(fields, { one: '# field', other: '# fields' })} must all differ, but only ${plural(allowed, { one: '# value is', other: '# values are' })} allowed.`,
      rules,
    }
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
    BigInt(fields) * bm.maxValue ** BigInt(e) <= bm.maxValueSum
  ) {
    return {
      kind: 'rating',
      label: t`Rating`,
      summary: t`Each voter rates each of ${plural(options, { one: '# option', other: '# options' })} from ${min} to ${max}.`,
      rules,
    }
  }
  if (e >= 2 && bm.maxValue > 1n) {
    const exponent = e
    const cost = e === 2 ? 'v²' : `v^${e}`
    return {
      kind: 'quadratic',
      label: e === 2 ? t`Quadratic voting` : t`Cost exponent ${exponent}`,
      summary:
        bm.maxValueSum > 0n
          ? t`Each voter spends up to ${most} credits across ${plural(options, { one: '# option', other: '# options' })}; putting v votes on one option costs ${cost} credits, at most ${max} votes per option.`
          : t`Each voter spends as many credits as their census weight across ${plural(options, { one: '# option', other: '# options' })}; putting v votes on one option costs ${cost} credits, at most ${max} votes per option.`,
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
      return {
        kind: 'multiple-choice',
        label: t`Multiple choice`,
        summary:
          bm.minValueSum > 0n
            ? t`Each voter picks at least ${least} and up to ${most} of ${plural(options, { one: '# option', other: '# options' })}.`
            : t`Each voter picks up to ${most} of ${plural(options, { one: '# option', other: '# options' })}.`,
        rules,
      }
    }
    return {
      kind: 'approval',
      label: t`Approval`,
      summary:
        bm.maxValueSum === 0n
          ? bm.minValueSum > 0n
            ? t`Each voter approves at least ${least} and up to W of ${plural(options, { one: '# option', other: '# options' })}, W being their census weight.`
            : t`Each voter approves up to W of ${plural(options, { one: '# option', other: '# options' })}, W being their census weight.`
          : bm.minValueSum > 0n
            ? t`Each voter approves at least ${least} of ${plural(options, { one: '# option', other: '# options' })}.`
            : t`Each voter approves any number of ${plural(options, { one: '# option', other: '# options' })}.`,
      rules,
    }
  }
  if (e === 1 && bm.maxValue > 1n && fields > 1) {
    return {
      kind: 'points',
      label: t`Points`,
      summary:
        bm.maxValueSum > 0n
          ? t`Each voter distributes up to ${most} points among ${plural(options, { one: '# option', other: '# options' })}, at most ${max} per option.`
          : t`Each voter distributes as many points as their census weight among ${plural(options, { one: '# option', other: '# options' })}, at most ${max} per option.`,
      rules,
    }
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
