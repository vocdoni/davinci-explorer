// Guest output registers. Port of davinci-zkvm `rust-sdk/src/publics.rs`;
// register meanings in `circuit/CIRCUIT.md` §3.
//
// A guest commits 64 u32 registers. The prover serves them as 256 bytes of
// u32 LE (`publics.bin`); the on-chain `publicValues` carries the same 64
// values as u64 LE words (512 bytes, upper half zero). A 256-bit value spans 8
// registers whose LE bytes, concatenated, are its LE32 bytes; for a state root
// that is the raw arbo digest the registry stores.

import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { withText } from '~i18n/text'
import { beToBigInt, reverseBytes, toBytes, toHex, type Hex } from './bytes'

/** Registers the batch guest commits (the rest are zero padding). */
export const BATCH_REGS = 46
/** Registers the results guest commits. */
export const RESULTS_REGS = 43
/** Length of the on-chain `publicValues`. */
export const PUBLIC_VALUES_LENGTH = 512

export class PublicsError extends Error {}

export interface BatchPublics {
  ok: boolean
  failMask: number
  /** Raw arbo root digest before the batch: the registry's `latestStateRoot`. */
  rootBefore: Hex
  rootAfter: Hex
  /** Votes in the batch, overwrites included. */
  voters: number
  overwrites: number
  /** LE32 bytes of the census root, as the registers carry it. */
  censusRootLE: Hex
  /** The census root as the registry stores it: a big-endian integer (CSP: the signer address). */
  censusRoot: bigint
  /** `sha256(com_0 ‖ y_0 ‖ …)`. */
  blobsDigest: Hex
  nBlobs: number
  /** Distinct slots written before the batch; must equal the registry's `votersCount`. */
  occupiedBefore: number
  batchOk: boolean
  ecdsaOk: boolean
  nproofs: number
  nPublic: number
  logN: number
  /** All 64 registers, for the raw view. */
  registers: number[]
}

export interface ResultsPublics {
  ok: boolean
  failMask: number
  stateRoot: Hex
  /** 16 tallies; the registry keeps the first `numFields`. */
  results: bigint[]
  /** First failing Chaum–Pedersen proof, `0xffffffff` if none. */
  cpFailIndex: number
  registers: number[]
}

function u32le(b: Uint8Array, offset: number): number {
  return (b[offset]! | (b[offset + 1]! << 8) | (b[offset + 2]! << 16) | (b[offset + 3]! << 24)) >>> 0
}

/** Registers from the u32 LE view (`publics.bin`, 256 bytes). */
export function registersFromU32View(input: Hex | Uint8Array, min = BATCH_REGS): number[] {
  const b = toBytes(input)
  if (b.length % 4 !== 0 || b.length / 4 < min) {
    throw new PublicsError(`publics: ${b.length} bytes, want >= ${min} u32 registers`)
  }
  const out: number[] = []
  for (let i = 0; i < b.length; i += 4) out.push(u32le(b, i))
  return out
}

/** Registers from the on-chain `publicValues`: one u64 LE word each, upper half zero. */
export function registersFromWords(input: Hex | Uint8Array, min = BATCH_REGS): number[] {
  const b = toBytes(input)
  if (b.length % 8 !== 0 || b.length / 8 < min) {
    throw new PublicsError(`publicValues: ${b.length} bytes, want >= ${min} u64 words`)
  }
  const out: number[] = []
  for (let i = 0; i < b.length; i += 8) {
    if (b[i + 4] || b[i + 5] || b[i + 6] || b[i + 7]) throw new PublicsError('publicValues word above 32 bits')
    out.push(u32le(b, i))
  }
  return out
}

/** The 32 bytes spread over registers base..base+7 (each register's LE bytes, in order). */
export function registerBytes32(regs: number[], base: number): Uint8Array {
  const out = new Uint8Array(32)
  for (let i = 0; i < 8; i++) {
    const r = regs[base + i] ?? 0
    out[i * 4] = r & 0xff
    out[i * 4 + 1] = (r >>> 8) & 0xff
    out[i * 4 + 2] = (r >>> 16) & 0xff
    out[i * 4 + 3] = (r >>> 24) & 0xff
  }
  return out
}

function batchFromRegisters(r: number[]): BatchPublics {
  const census = registerBytes32(r, 20)
  return {
    ok: r[0] === 1,
    failMask: r[1]!,
    rootBefore: toHex(registerBytes32(r, 2)),
    rootAfter: toHex(registerBytes32(r, 10)),
    voters: r[18]!,
    overwrites: r[19]!,
    censusRootLE: toHex(census),
    censusRoot: beToBigInt(reverseBytes(census)),
    blobsDigest: toHex(registerBytes32(r, 28)),
    nBlobs: r[36]!,
    batchOk: r[40] === 1,
    ecdsaOk: r[41] === 1,
    occupiedBefore: r[42]!,
    nproofs: r[43]!,
    nPublic: r[44]!,
    logN: r[45]!,
    registers: r,
  }
}

/** Batch publics from the 512-byte on-chain `publicValues`. */
export function decodeBatchPublicValues(publicValues: Hex | Uint8Array): BatchPublics {
  return batchFromRegisters(registersFromWords(publicValues, BATCH_REGS))
}

/** Batch publics from the prover's u32 view (`publics.bin`). */
export function decodeBatchPublicsRegisters(publics: Hex | Uint8Array): BatchPublics {
  return batchFromRegisters(registersFromU32View(publics, BATCH_REGS))
}

function resultsFromRegisters(r: number[]): ResultsPublics {
  const results: bigint[] = []
  for (let i = 0; i < 16; i++) results.push(BigInt(r[10 + 2 * i]!) | (BigInt(r[11 + 2 * i]!) << 32n))
  return {
    ok: r[0] === 1,
    failMask: r[1]!,
    stateRoot: toHex(registerBytes32(r, 2)),
    results,
    cpFailIndex: r[42]!,
    registers: r,
  }
}

export function decodeResultsPublicValues(publicValues: Hex | Uint8Array): ResultsPublics {
  return resultsFromRegisters(registersFromWords(publicValues, RESULTS_REGS))
}

export function decodeResultsPublicsRegisters(publics: Hex | Uint8Array): ResultsPublics {
  return resultsFromRegisters(registersFromU32View(publics, RESULTS_REGS))
}

/** What a settlement needs: `ok == 1` and an empty fail mask. */
export function publicsPassed(p: { ok: boolean; failMask: number }): boolean {
  return p.ok && p.failMask === 0
}

// ── fail bits ────────────────────────────────────────────────────────────────

export interface FailBit {
  bit: number
  /** The guest's name for the bit; never translated. */
  name: string
  /** What failed, in the active language. */
  readonly description: string
}

const failBit = (bit: number, name: string, description: MessageDescriptor): FailBit =>
  withText({ bit, name }, { description })

/** Batch guest fail bits (CIRCUIT.md §11; names as go-sdk `FailString`). */
export const BATCH_FAIL_BITS: FailBit[] = [
  failBit(1, 'groth16_curve', msg`A ballot proof or VK point is off the curve or the identity`),
  failBit(2, 'pairing', msg`The batched Groth16 pairing check failed`),
  failBit(3, 'ecdsa', msg`A vote signature is missing or does not recover to the voter`),
  failBit(10, 'smt_voteid', msg`The vote-id insertion chain is invalid`),
  failBit(11, 'smt_ballot', msg`The ballot insertion or update chain is invalid`),
  failBit(12, 'smt_results', msg`The results transition is invalid or not an update of key 0x04`),
  failBit(13, 'smt_process', msg`A process config read proof is invalid or missing`),
  failBit(14, 'consistency', msg`Vote-id namespace, upper limbs or proof binding mismatch`),
  failBit(15, 'ballot_ns', msg`Ballot slot namespace, slot binding or a duplicate slot in the batch`),
  failBit(16, 'census', msg`A census proof is invalid or the census roots differ`),
  failBit(17, 'reencryption', msg`Election key invalid, re-encryption mismatch or padded slot not identity`),
  failBit(18, 'kzg', msg`Blob count is zero or not ceil(T / 4096) for the T cells of the data`),
  failBit(19, 'missing_block', msg`A required input block is absent or empty`),
  failBit(20, 'result_accum', msg`The results accumulator does not match the ballots`),
  failBit(21, 'leaf_hash', msg`A ballot leaf hash or ballot count mismatch`),
  failBit(22, 'binding', msg`Cross-block binding mismatch`),
  failBit(23, 'csp', msg`A CSP census entry is malformed, duplicated or does not recover`),
  failBit(24, 'refresh', msg`The silent-refresh chain breaks a rule`),
  failBit(31, 'parse_error', msg`The prover input could not be parsed`),
]

/** Results guest fail bits (circuit-results/RESULTS.md). */
export const RESULTS_FAIL_BITS: FailBit[] = [
  failBit(0, 'parse', msg`The input frame could not be parsed`),
  failBit(1, 'key', msg`The encryption key is invalid`),
  failBit(2, 'incl_key', msg`The key leaf 0x03 is not under the state root`),
  failBit(3, 'incl_results', msg`The accumulator leaf 0x04 is not under the state root`),
  failBit(4, 'cp', msg`A Chaum–Pedersen decryption proof failed`),
  failBit(5, 'range', msg`A coordinate or scalar is out of range`),
]

function names(mask: number, table: FailBit[]): string[] {
  const out = table.filter(({ bit }) => ((mask >>> bit) & 1) === 1).map(({ name }) => name)
  const known = table.reduce((m, { bit }) => (m | (1 << bit)) >>> 0, 0)
  if ((mask & ~known) >>> 0 !== 0) out.push('unknown')
  return out
}

export function failBits(mask: number): string[] {
  return names(mask, BATCH_FAIL_BITS)
}

export function resultsFailBits(mask: number): string[] {
  return names(mask, RESULTS_FAIL_BITS)
}

// ── register table ───────────────────────────────────────────────────────────

export interface RegisterInfo {
  /** First register. */
  index: number
  /** Registers spanned (8 for a 256-bit value). */
  span: number
  key: keyof BatchPublics | null
  /** The register's name in CIRCUIT.md; never translated. */
  name: string
  /** What it holds, in the active language. */
  readonly description: string
  /** Who reads it: the settlement contract, the chained-mode fold guest, or nobody (diagnostic). */
  readBy: Array<'contract' | 'fold' | 'diagnostic'>
}

const register = (r: Omit<RegisterInfo, 'description'>, description: MessageDescriptor): RegisterInfo =>
  withText(r, { description })

/** Batch guest registers, CIRCUIT.md §3, in register order. */
export const BATCH_REGISTERS: RegisterInfo[] = [
  register(
    { index: 0, span: 1, key: 'ok', name: 'overall_ok', readBy: ['contract', 'fold'] },
    msg`1 when every check in the guest passed. The registry refuses anything else.`
  ),
  register(
    { index: 1, span: 1, key: 'failMask', name: 'fail_mask', readBy: ['contract', 'fold'] },
    msg`One bit per failed check; zero on a valid batch.`
  ),
  register(
    { index: 2, span: 8, key: 'rootBefore', name: 'RootHashBefore', readBy: ['contract', 'fold'] },
    msg`State root the batch starts from. Must equal the process root on-chain (root continuity).`
  ),
  register(
    { index: 10, span: 8, key: 'rootAfter', name: 'RootHashAfter', readBy: ['contract', 'fold'] },
    msg`State root after the batch; becomes the new process root.`
  ),
  register(
    { index: 18, span: 1, key: 'voters', name: 'VotersCount', readBy: ['contract', 'fold'] },
    msg`Votes in the batch, overwrites included.`
  ),
  register(
    { index: 19, span: 1, key: 'overwrites', name: 'OverwrittenVotesCount', readBy: ['contract', 'fold'] },
    msg`Votes that replaced an earlier vote of the same voter.`
  ),
  register(
    { index: 20, span: 8, key: 'censusRoot', name: 'CensusRoot', readBy: ['contract', 'fold'] },
    msg`Census root every ballot proved membership against (CSP: the signer address). Checked against the process census.`
  ),
  register(
    { index: 28, span: 8, key: 'blobsDigest', name: 'BlobsDigest', readBy: ['contract'] },
    msg`sha256 over the (commitment, evaluation) pair of every blob; binds the published data to the proof.`
  ),
  register(
    { index: 36, span: 1, key: 'nBlobs', name: 'NBlobs', readBy: ['contract'] },
    msg`Number of EIP-4844 blobs carrying the transition data.`
  ),
  register({ index: 37, span: 3, key: null, name: 'reserved', readBy: ['diagnostic'] }, msg`Always zero.`),
  register(
    { index: 40, span: 1, key: 'batchOk', name: 'batch_ok', readBy: ['diagnostic'] },
    msg`The batched Groth16 check of the ballot proofs passed.`
  ),
  register(
    { index: 41, span: 1, key: 'ecdsaOk', name: 'ecdsa_ok', readBy: ['diagnostic'] },
    msg`Every vote signature verified.`
  ),
  register(
    { index: 42, span: 1, key: 'occupiedBefore', name: 'OccupiedBefore', readBy: ['contract', 'fold'] },
    msg`Distinct ballot slots written before the batch. Must equal votersCount on-chain; it sizes the silent refreshes.`
  ),
  register(
    { index: 43, span: 1, key: 'nproofs', name: 'nproofs', readBy: ['diagnostic'] },
    msg`Ballot proofs in the batch (equals the votes when ok).`
  ),
  register(
    { index: 44, span: 1, key: 'nPublic', name: 'n_public', readBy: ['diagnostic'] },
    msg`Public inputs per ballot proof.`
  ),
  register(
    { index: 45, span: 1, key: 'logN', name: 'log_n', readBy: ['diagnostic'] },
    msg`floor(log2(nproofs)), echoed unchecked.`
  ),
]
