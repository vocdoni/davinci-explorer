// When the organizer of a locked committee key revealed its secret, against
// the end of voting: a secret revealed before the end unlocked the key while
// ballots could still arrive.

import type { DkgReveal } from '~data/services'

/** True when the reveal came before the end of voting; null while either time is unknown. */
export function revealedBeforeEnd(reveal: DkgReveal | null | undefined, endTime: number | null): boolean | null {
  if (reveal?.timestamp == null || endTime == null) return null
  return reveal.timestamp < endTime
}
