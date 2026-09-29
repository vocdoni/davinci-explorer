// The outcome of each check of the deployment flow, and the pins' names in
// plain words. Pure, unit-tested; the text is `msg` descriptors.

import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { DKG_CIRCUITS_V6_KEY_HASHES, type DkgDeployment } from '~data/deployment'
import type { CheckState } from '~indexer/selectors'
import type { PinName, ReleaseMatch } from '~protocol/releases'
import { combine, fromCheckState, type VerifyStatus } from '../status'

/**
 * What each pin is for someone who has never heard of a verification key: one
 * sentence under the pin's plain name (`PIN_LABELS`).
 */
export const PIN_PLAIN: Record<PinName, MessageDescriptor> = {
  batchProgramVK: msg`The program that checks every batch of votes. This value is its fingerprint.`,
  resultsProgramVK: msg`The program that checks the results of every election whose key a sequencer holds.`,
  rootCVadcopFinal: msg`The setup the proofs are made with, shared by both programs.`,
  ziskVerifierCodeHash: msg`The contract that verifies every proof, known by the fingerprint of its code.`,
  ballotVKHash: msg`The key every voter’s ballot proof is checked against.`,
}

export function pinState(ok: boolean | null): CheckState {
  return ok == null ? 'unknown' : ok ? 'pass' : 'fail'
}

/** Every pin equals the release's; pending until all are read. */
export function releaseStatus(match: ReleaseMatch): VerifyStatus {
  if (match.checks.length === 0) return 'pending'
  return combine(match.checks.map((c) => fromCheckState(pinState(c.ok))))
}

/** How the contracts point at each other, read back from them. */
export function wiringStatus(states: CheckState[]): VerifyStatus {
  return states.length ? combine(states.map(fromCheckState)) : 'pending'
}

/** Each DKG verifier's proving-key hash against the published circuits. */
export function verifierStates(
  dkg: DkgDeployment
): Array<{ name: DkgDeployment['verifiers'][number]['name']; state: CheckState }> {
  return dkg.verifiers.map((v) => ({
    name: v.name,
    state: v.keyHash == null ? 'unknown' : v.keyHash === DKG_CIRCUITS_V6_KEY_HASHES[v.name] ? 'pass' : 'fail',
  }))
}

/**
 * The committee checks proofs of the published circuits: `na` on a registry
 * without DKG, pending while the contracts are read or could not be.
 */
export function dkgStatus(hasAdapter: boolean | null, dkg: DkgDeployment | null | undefined): VerifyStatus {
  if (hasAdapter === false) return 'na'
  if (!dkg) return 'pending'
  return combine(verifierStates(dkg).map((v) => fromCheckState(v.state)))
}
