// The voter's ballot proof, davinci-circom `CheckBallotMode`, as a plain
// check, and a search for a ballot that passes it.

import type { BallotMode } from '~indexer/types'

/** Whether a ballot of `numFields` values passes the ballot proof's checks. */
export function ballotPasses(bm: BallotMode, fields: bigint[], weight = 1n): boolean {
  if (fields.length !== bm.numFields || bm.groupSize > bm.numFields) return false
  if (fields.some((v) => v < bm.minValue || v > bm.maxValue)) return false
  if (bm.uniqueValues && new Set(fields).size !== fields.length) return false
  const sum = fields.reduce((a, v) => a + v ** BigInt(bm.costExponent), 0n)
  const max = bm.maxValueSum === 0n ? weight : bm.maxValueSum
  return sum <= max && sum >= bm.minValueSum
}

/**
 * A ballot that passes, found by a depth-first search over values near both
 * ends of the field range; null when there is none within `budget` steps.
 */
export function findBallot(bm: BallotMode, weight = 1n, budget = 200_000): bigint[] | null {
  const n = bm.numFields
  const e = BigInt(bm.costExponent)
  const reach = BigInt(n + 2)
  const candidates: bigint[] = []
  for (let v = bm.minValue; v <= bm.maxValue && v <= bm.minValue + reach; v++) candidates.push(v)
  for (let v = bm.maxValue; v >= bm.minValue && v > bm.minValue + reach && v >= bm.maxValue - reach; v--) {
    candidates.push(v)
  }
  if (candidates.length === 0) return null
  const cheapest = candidates[0]! ** e
  const dearest = candidates.reduce((m, v) => (v ** e > m ? v ** e : m), 0n)
  const max = bm.maxValueSum === 0n ? weight : bm.maxValueSum
  const ballot: bigint[] = []
  let steps = 0
  const search = (sum: bigint): boolean => {
    if (++steps > budget) return false
    const left = BigInt(n - ballot.length)
    if (sum + left * cheapest > max || sum + left * dearest < bm.minValueSum) return false
    if (left === 0n) return ballotPasses(bm, ballot, weight)
    for (const v of candidates) {
      if (bm.uniqueValues && ballot.includes(v)) continue
      ballot.push(v)
      if (search(sum + v ** e)) return true
      ballot.pop()
    }
    return false
  }
  return search(0n) ? [...ballot] : null
}
