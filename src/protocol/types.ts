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
  ready: info(msg`Ready`, msg`Open for voting: votes are collected and recorded on the chain until the end time.`),
  paused: info(
    msg`Paused`,
    msg`The organizer paused voting. Votes may wait at a sequencer, but none are recorded until voting resumes.`
  ),
  ended: info(msg`Ended`, msg`Voting is closed and the recorded votes are final. The results are not published yet.`),
  canceled: info(msg`Canceled`, msg`The organizer canceled the election. No results will be published.`),
  results: info(
    msg`Results`,
    msg`The results are on the chain, with proof that they count exactly the recorded votes.`
  ),
}

export const CENSUS_ORIGIN_INFO: Record<CensusOriginName, EnumInfo> = {
  unknown: info(msg`Unknown`, msg`Not a kind of list of voters the registry accepts.`),
  'merkle-static': info(
    msg`Fixed list`,
    msg`A list of voters fixed when the election was created. Each voter proves they are on it.`
  ),
  'merkle-dynamic': info(
    msg`Updatable list`,
    msg`A list of voters the organizer can replace while the election is open. Every replacement is recorded on the chain.`
  ),
  'onchain-dynamic': info(
    msg`List kept by a contract`,
    msg`The list of voters is kept by a contract. Every batch must use a version of the list the contract held since the election was created.`
  ),
  csp: info(
    msg`Credential service provider`,
    msg`A credential service signs each voter’s credential, and voters show that signature to vote. The service’s signing address stands for the list.`
  ),
}

export const KEY_MODE_INFO: Record<KeyModeName, EnumInfo> = {
  sequencer: info(
    msg`Sequencer key`,
    msg`One sequencer node holds the key. It could read the ballots, and only it can publish the results, with a proof that they are right.`
  ),
  'dkg-automatic': info(
    msg`Committee, automatic`,
    msg`A key committee holds the key in shares, so nobody can read the ballots alone. Once voting ends, enough members together decrypt the encrypted total, and only that.`
  ),
  'dkg-locked': info(
    msg`Committee, organizer-locked`,
    msg`A key committee’s key plus a secret the organizer keeps. The committee can decrypt the encrypted total only after the organizer reveals that secret.`
  ),
}
