// Input checks and status words of the vote lookup. Pure, unit-tested. The
// errors come out in the active language; the status table is `msg`
// descriptors, translated where it is rendered (`i18n._`).

import type { MessageDescriptor } from '@lingui/core'
import { msg, t } from '@lingui/core/macro'
import { parseVoteId } from '~protocol/blob'
import type { Hex } from '~protocol/bytes'
import { U64_MAX, VOTE_ID_MIN } from '~protocol/limits'
import { isProcessId, normalizeProcessId } from '~protocol/process-id'
import type { VoteStatus } from '~protocol/sequencer-api'

export interface LookupQuery {
  pid: Hex | null
  voteId: bigint | null
  pidError: string | null
  voteError: string | null
}

/** Validates the two fields; each error is a sentence for the form, in the active language. */
export function validateLookup(pidInput: string, voteInput: string): LookupQuery {
  const p = pidInput.trim()
  const v = voteInput.trim()
  let pidError: string | null = null
  if (!p) pidError = t`Enter the process id.`
  else if (!isProcessId(p)) pidError = t`A process id is 0x followed by 62 hex digits (31 bytes).`

  const voteId = v ? parseVoteId(v) : null
  let voteError: string | null = null
  if (!v) voteError = t`Enter the vote id.`
  else if (voteId == null) {
    const n = /^0x[0-9a-fA-F]{1,16}$/.test(v) || /^\d{1,20}$/.test(v) ? BigInt(v) : null
    voteError =
      n != null && n < VOTE_ID_MIN
        ? t`Vote ids start at 0x8000000000000000 (2^63).`
        : n != null && n > U64_MAX
          ? t`A vote id fits in 64 bits.`
          : t`A vote id is 0x followed by 16 hex digits, or its decimal value.`
  }
  return { pid: pidError ? null : normalizeProcessId(p), voteId, pidError, voteError }
}

/** The happy path a vote walks at a sequencer. */
export const STATUS_STEPS: Array<Exclude<VoteStatus, 'error'>> = ['pending', 'aggregated', 'processed', 'settled']

/** Position on the happy path; -1 for an error. */
export function statusStep(status: VoteStatus): number {
  return status === 'error' ? -1 : STATUS_STEPS.indexOf(status)
}

/** What each status means (https://github.com/vocdoni/davinci-sequencer#http-api). */
export const STATUS_INFO: Record<VoteStatus, { label: MessageDescriptor; description: MessageDescriptor }> = {
  pending: {
    label: msg`Pending`,
    description: msg`Queued at the sequencer, waiting for a batch. A batch that another node beats to the chain puts its votes back here.`,
  },
  aggregated: {
    label: msg`Aggregated`,
    description: msg`In a batch that is being proved.`,
  },
  processed: {
    label: msg`Processed`,
    description: msg`The batch’s proof is ready; the transaction that records it is on its way.`,
  },
  settled: {
    label: msg`Settled`,
    description: msg`On the chain: the batch carrying the vote is recorded on the registry.`,
  },
  error: {
    label: msg`Error`,
    description: msg`The vote will not be recorded: a check inside the proof failed, the process closed, the transaction failed or the prover refused the batch.`,
  },
}
