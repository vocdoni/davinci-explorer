// On-chain enums of davinci-contracts `DAVINCITypes`, with the words the
// explorer uses for them. The words translate on read (`withText`).

import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { withText } from '~i18n/text'

export type ProcessStatusName = 'ready' | 'ended' | 'canceled' | 'paused' | 'results'
export type CensusOriginName = 'unknown' | 'merkle-static' | 'merkle-dynamic' | 'onchain-dynamic' | 'csp'
export type KeyModeName = 'sequencer' | 'dkg-automatic' | 'dkg-locked'

/** `DAVINCITypes.ProcessStatus`, by ordinal. */
export const PROCESS_STATUSES: ProcessStatusName[] = ['ready', 'ended', 'canceled', 'paused', 'results']
/** `DAVINCITypes.CensusOrigin`, by ordinal. */
export const CENSUS_ORIGINS: CensusOriginName[] = [
  'unknown',
  'merkle-static',
  'merkle-dynamic',
  'onchain-dynamic',
  'csp',
]
/** `DAVINCITypes.KeyMode`, by ordinal. */
export const KEY_MODES: KeyModeName[] = ['sequencer', 'dkg-automatic', 'dkg-locked']

export function processStatusName(v: number | bigint): ProcessStatusName {
  return PROCESS_STATUSES[Number(v)] ?? 'ready'
}

export function censusOriginName(v: number | bigint): CensusOriginName {
  return CENSUS_ORIGINS[Number(v)] ?? 'unknown'
}

export function keyModeName(v: number | bigint): KeyModeName {
  return KEY_MODES[Number(v)] ?? 'sequencer'
}

/** A label and a one-line explanation; both read in the active language. */
export interface EnumInfo {
  readonly label: string
  readonly description: string
}

const info = (label: MessageDescriptor, description: MessageDescriptor): EnumInfo =>
  withText({}, { label, description })

export const PROCESS_STATUS_INFO: Record<ProcessStatusName, EnumInfo> = {
  ready: info(msg`Ready`, msg`Open: sequencers accept votes and settle batches until the end time.`),
  paused: info(
    msg`Paused`,
    msg`Paused by the organizer. Votes may queue at a sequencer but no batch settles until it resumes.`
  ),
  ended: info(msg`Ended`, msg`Closed to votes. The final state root is fixed; the results are pending.`),
  canceled: info(msg`Canceled`, msg`Canceled by the organizer. No results will be published.`),
  results: info(msg`Results`, msg`The tally is on-chain, proven against the final state root.`),
}

export const CENSUS_ORIGIN_INFO: Record<CensusOriginName, EnumInfo> = {
  unknown: info(msg`Unknown`, msg`Not a census origin the registry accepts.`),
  'merkle-static': info(
    msg`Merkle tree, fixed`,
    msg`A lean-IMT census root published at creation and never changed. Voters prove membership against it.`
  ),
  'merkle-dynamic': info(
    msg`Merkle tree, updatable`,
    msg`A lean-IMT census root the organizer can replace while the process is open (CensusUpdated).`
  ),
  'onchain-dynamic': info(
    msg`On-chain census contract`,
    msg`The census lives in a contract; every batch must use a root the contract held since the process was created.`
  ),
  csp: info(
    msg`Credential service provider`,
    msg`Voters present a signature from the CSP signer whose address is the census root.`
  ),
}

export const KEY_MODE_INFO: Record<KeyModeName, EnumInfo> = {
  sequencer: info(
    msg`Sequencer key`,
    msg`One sequencer node holds the election key: it could open the ballots and alone publishes the tally, with a zkVM results proof.`
  ),
  'dkg-automatic': info(
    msg`DKG, automatic`,
    msg`A davinci-dkg committee key. No sequencer and no organizer holds the secret; each committee member holds one share, and a threshold of them decrypts the final tally once asked.`
  ),
  'dkg-locked': info(
    msg`DKG, organizer-locked`,
    msg`A davinci-dkg committee key combined with an organizer key. The tally is decrypted only after the organizer reveals its secret.`
  ),
}
