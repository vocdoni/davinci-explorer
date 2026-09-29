// The registry's grace window (davinci-contracts `ProcessRegistry._graceEnd`).
// Past the end, batches still settle until
//
//   graceEnd = min(end + graceMaxTotal, max(end, lastVoteAt) + grace)
//
// and the results calls open at that second. Every settled batch sets
// `lastVoteAt` to its block time, so the window slides while batches keep
// landing at most `grace` apart, and never runs past the cap.

export interface GraceInput {
  /** Unix seconds. */
  startTime: number
  /** Seconds. */
  duration: number
  /** Seconds. */
  grace: number
  /** Unix seconds of the last settled batch; 0 before the first. */
  lastVoteAt: number
}

/**
 * The contract's grace end, in unix seconds. An end too far away to count
 * exactly never closes in practice: `Infinity`, as the contract returns the
 * largest integer when the cap would overflow.
 */
export function graceEnd(p: GraceInput, graceMaxTotal: number): number {
  const end = p.startTime + p.duration
  const cap = end + graceMaxTotal
  if (!Number.isSafeInteger(cap)) return Number.POSITIVE_INFINITY
  return Math.min(cap, Math.max(end, p.lastVoteAt) + p.grace)
}

/** The latest the window can close, however many batches land: `end + graceMaxTotal`. */
export function graceCap(p: Pick<GraceInput, 'startTime' | 'duration'>, graceMaxTotal: number): number {
  const cap = p.startTime + p.duration + graceMaxTotal
  return Number.isSafeInteger(cap) ? cap : Number.POSITIVE_INFINITY
}
