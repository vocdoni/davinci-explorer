// What `submitStateTransition` enforced for each check, and how to read the
// recheck command's output. From davinci-contracts `ProcessRegistry.sol`
// and its README "State transitions". The text is `msg` descriptors,
// translated where it is rendered (`i18n._`, through `RichText` so the
// `backtick` names show as code); expressions sit in their own fields, for
// `Formula`, and are never translated.

import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import type { CensusOriginName } from '~protocol/types'
import type { RecheckId } from './commands'

export interface CheckCopy {
  /** Why the check matters, in everyday words. */
  meaning: MessageDescriptor
  /** What the registry enforces: the mechanism, with the names from the contract. */
  enforced: MessageDescriptor
  /** The rule `enforced` describes, as an expression; never translated. */
  formula?: string
  /** How to read the recheck command's output. */
  recheck: MessageDescriptor
  /** An expression the recheck explanation refers to; never translated. */
  recheckFormula?: string
}

/** Contract order: the order `submitStateTransition` runs them in. */
export const CHECK_ORDER: RecheckId[] = [
  'guest-ok',
  'root-continuity',
  'census-root',
  'occupied-before',
  'voters',
  'blob-count',
  'blobs-digest',
  'plonk',
  'blob-hashes',
  'kzg-openings',
  'root-after',
]

/** The two checks only the chain runs: plain statements, like the recomputed ones. */
export const ONCHAIN_LABELS: Record<'plonk' | 'kzg-openings', MessageDescriptor> = {
  plonk: msg`The proof itself is valid`,
  'kzg-openings': msg`Each blob holds the data the proof describes`,
}

export function checkCopy(id: RecheckId, censusOrigin: CensusOriginName | null): CheckCopy {
  switch (id) {
    case 'guest-ok':
      return {
        meaning: msg`Inside the proof, every vote was checked: its proof, its signature, the voter’s place on the list and how it was stored. A batch with a single failed check is refused.`,
        enforced: msg({
          message:
            'The public values (`publicValues`) must be exactly 512 bytes and report that every check passed, or the call reverts with `CircuitFailed`. A batch the proven program rejected can still be proven, but it can never be recorded.',
        }),
        formula: 'ok = 1, fail_mask = 0',
        recheck: msg({
          message:
            'Decode the call’s data. The second value is `publicValues`, one 8-byte little-endian word per register, so it opens with the words below: `ok` is 1, then an empty fail mask.',
        }),
        recheckFormula: '0100000000000000 ‖ 0000000000000000 ‖ …',
      }
    case 'root-continuity':
      return {
        meaning: msg`Each batch builds on the one before, so no batch can be skipped, replayed or forked.`,
        enforced: msg({
          message:
            'The state before the batch (registers 2 to 9) must be the process’s `latestStateRoot`, or the call reverts with `InvalidStateRoot`. The first batch starts at the starting state (the genesis root) the registry computed when the process was created.',
        }),
        formula: 'RootHashBefore = latestStateRoot',
        recheck: msg({
          message:
            'Read the registry one block before the batch was recorded: `latestStateRoot`, the fourth value, is where this batch had to start. Reading a past block needs an RPC node that keeps old state.',
        }),
      }
    case 'census-root':
      return censusOrigin === 'onchain-dynamic'
        ? {
            meaning: msg`Every voter in the batch was on this election’s list of voters. Here a contract keeps the list, so the registry asks it.`,
            enforced: msg({
              message:
                'The registry asks the census contract for `getRootBlockNumber(root)`, with the list fingerprint in registers 20 to 27. The answer must be non-zero, no later than the block of the batch and no earlier than the block the process was created in, or the call reverts with `InvalidCensusRoot`.',
            }),
            formula: 'createdBlock ≤ getRootBlockNumber(CensusRoot) ≤ block',
            recheck: msg`Ask the census contract yourself, at the block the batch was recorded in. The explorer cannot recompute this one from the registry’s events.`,
          }
        : {
            meaning: msg`Every voter in the batch was on this election’s list of voters, and on no other list.`,
            enforced: msg({
              message:
                'Registers 20 to 27, read as a big-endian integer, must equal the census root stored for the process, or the call reverts with `InvalidCensusRoot`. For a credential service (CSP) the root is the service’s signing address. An updatable list accepts only its current root, so a batch proven against a replaced list stops being accepted.',
            }),
            formula: 'CensusRoot = census.censusRoot',
            recheck: msg`In the same registry read, the census is the sixteenth value; its second field is the root this batch had to be proven against.`,
          }
    case 'occupied-before':
      return {
        meaning: msg`The proof and the registry agree on how many people had voted before this batch. That number sets how many ballots the batch must re-encrypt to hide who changed their vote.`,
        enforced: msg({
          message:
            'Register 42 must equal `votersCount`, the ballot slots written before this batch, or the call reverts with `InvalidOccupiedBefore`. The proven program cannot see the whole state, so it takes this number as input to size the silent refreshes; the registry pins it to its own count.',
        }),
        formula: 'OccupiedBefore = votersCount',
        recheck: msg({
          message: '`votersCount` is the ninth value of the registry read one block before the batch was recorded.',
        }),
      }
    case 'voters':
      return {
        meaning: msg`The registry’s counts of voters and changed votes move exactly as the proof says.`,
        enforced: msg({
          message:
            'The registry adds the new voters (votes minus changed votes, registers 18 and 19) to `votersCount` and refuses a batch that would pass `maxVoters` (`MaxVotersReached`). It adds the changed votes to `overwrittenVotesCount` and emits the new totals in `ProcessStateTransitioned`.',
        }),
        formula: 'votersCount += VotersCount − OverwrittenVotesCount',
        recheck: msg({
          message:
            'List the process’s batch events. Each log’s data is `oldStateRoot`, `newStateRoot`, `newVotersCount`, `newOverwrittenVotesCount` and `nBlobs`, 32 bytes each: from one log to the next, `newVotersCount` grows by the batch’s new voters, and the same list shows each batch starting where the last one ended.',
        }),
      }
    case 'blob-count':
      return {
        meaning: msg`Everything the batch needs to publish is attached to the transaction, with nothing missing and nothing extra.`,
        enforced: msg({
          message:
            '`NBlobs` (register 36) must be non-zero; the commitment, evaluation and proof arrays must each hold that many entries, and the transaction may carry no blob past them (`NoBlobs`, `BlobCountMismatch`).',
        }),
        formula: 'NBlobs = count(commitments) = count(blobVersionedHashes)',
        recheck: msg({ message: 'The transaction’s `blobVersionedHashes` lists one hash per blob.' }),
      }
    case 'blobs-digest':
      return {
        meaning: msg`The data the transaction publishes is the data that was proven, not something swapped in afterwards.`,
        enforced: msg({
          message:
            'One fingerprint over the commitments and evaluations in the call must equal the blobs digest in registers 28 to 35, or the call reverts with `InvalidBlobsDigest`. That ties what the transaction carries to what the proven program computed from the data it checked.',
        }),
        formula: 'sha256(commitment₀ ‖ y₀ ‖ commitment₁ ‖ y₁ ‖ …) = BlobsDigest',
        recheck: msg`Hash the commitments and evaluations in order: the result is the blobs digest in the public values.`,
      }
    case 'plonk':
      return {
        meaning: msg`The proof was made by the published program, for exactly these values. A proof of any other program, or with any value changed, is refused.`,
        enforced: msg({
          message:
            'The verifier contract (`ZiskVerifier`, its `verifySnarkProof`) must accept the proof under the two keys fixed in the registry, `batchProgramVK` and `rootCVadcopFinal`, or the call reverts with `InvalidProof`. The verifier hashes both keys with the public values into the one input the proof must match.',
        }),
        formula: 'publicInput = sha256(programVK ‖ publicValues ‖ rootCVadcopFinal)',
        recheck: msg({ message: 'Make the same call: it returns `0x` when the proof verifies and reverts otherwise.' }),
      }
    case 'blob-hashes':
      return {
        meaning: msg`The blob fingerprints the proof used are the fingerprints of the blobs this transaction really carries.`,
        enforced: msg({
          message:
            'A blob’s versioned hash, what `BLOBHASH` returns, is built from its commitment as below. The point-evaluation precompile rejects a commitment that does not match the transaction’s hash.',
        }),
        formula: 'versionedHash = 0x01 ‖ sha256(commitment)[1..]',
        recheck: msg`Hash each commitment and replace the first byte with 01: that is the transaction’s versioned hash.`,
      }
    case 'kzg-openings':
      return {
        meaning: msg`Each blob on the chain holds the data the proof was made for, checked at a point nobody could choose in advance.`,
        enforced: msg({
          message:
            'For every blob the registry calls the point-evaluation precompile with the versioned hash, the point `z` below, the evaluation `y` and the KZG proof, or the call reverts with `InvalidBlobOpening`. The proven program evaluated the blob it laid out itself at the same point, so the blobs on the chain are the ones the proof covers.',
        }),
        formula: 'z = sha256(processId ‖ rootBefore ‖ commitment) mod r_BLS',
        recheck: msg`Send the same 192 bytes to the precompile: it answers 4096 and the BLS12-381 modulus when the opening holds, and fails otherwise.`,
      }
    case 'root-after':
      return {
        meaning: msg`The election’s new state is the one the proof arrived at; the next batch has to start from it.`,
        enforced: msg({
          message:
            'Once every check above passed, the registry stores registers 10 to 17 as the new `latestStateRoot` and emits it as `newStateRoot`.',
        }),
        formula: 'latestStateRoot ← RootHashAfter',
        recheck: msg({
          message:
            'The `ProcessStateTransitioned` log in the receipt carries `newStateRoot` as the second 32-byte word of its data.',
        }),
      }
  }
}
