// What the contracts page says and checks, kept out of the components so it
// can be tested: the explanation of every pinned value, the rows of the
// address table, the wiring checks and the verification commands. The text is
// `msg` descriptors, rendered with `i18n._`; names, commands and hex are not.

import type { MessageDescriptor } from '@lingui/core'
import { msg, plural } from '@lingui/core/macro'
import type { Address, Hex } from 'viem'
import type { DeploymentDetails, DkgVerifierName } from '~data/deployment'
import type { CheckState } from '~indexer/selectors'
import type { ChainMeta } from '~indexer/types'
import { checksum } from '~lib/address'
import { formatNumber } from '~lib/format'
import { processIdPrefix } from '~protocol/process-id'
import type { KnownRelease, PinName, ReleaseMatch } from '~protocol/releases'

export interface PinDetail {
  /** The Solidity name, or how the value is read. Code, never translated. */
  source: string
  what: MessageDescriptor
  why: MessageDescriptor
  /** What a value different from the release would mean, as a whole sentence. */
  mismatch: MessageDescriptor
}

export const PIN_DETAILS: Record<PinName, PinDetail> = {
  batchProgramVK: {
    source: 'registry batchProgramVK()',
    what: msg`The program verification key of the vote-batch guest (davinci-zkvm circuit/elf/circuit.elf): what cargo-zisk setup prints as its root hash.`,
    why: msg`submitStateTransition verifies every batch proof against it. The verifier hashes it into the proof’s public input, so only a proof of this exact program settles a transition.`,
    mismatch: msg`Transitions would be proven by a program other than the released vote-batch guest, so none of the checks that guest makes could be taken for granted.`,
  },
  resultsProgramVK: {
    source: 'registry resultsProgramVK()',
    what: msg`The program verification key of the results guest (circuit-results/elf/results.elf).`,
    why: msg`setProcessResults verifies the tally proof of every sequencer-key process against it: the key and accumulator leaves under the final root and the 16 Chaum–Pedersen decryptions.`,
    mismatch: msg`Sequencer-key tallies would be proven by another program. DKG-key tallies do not use this key: the committee’s proofs replace it.`,
  },
  rootCVadcopFinal: {
    source: 'registry rootCVadcopFinal()',
    what: msg`The root of the ZisK vadcop-final setup the proofs are wrapped with. It moves with the ZisK snark setup, not with the guests.`,
    why: msg`The verifier’s public input is sha256(programVK ‖ publicValues ‖ rootCVadcopFinal), so a proof made under another setup does not verify.`,
    mismatch: msg`The registry would expect proofs from another ZisK setup: proofs from a prover on the released setup would not verify here.`,
  },
  ziskVerifierCodeHash: {
    source: 'keccak256(eth_getCode(ziskVerifier))',
    what: msg`keccak256 of the ZiskVerifier’s runtime code. The contract has no immutables, so this equals the hash of its deployedBytecode in a local forge build.`,
    why: msg`The registry believes whatever this contract says about a proof. The hash shows it is the vendored ZisK verifier and nothing else.`,
    mismatch: msg`The contract that checks every proof would not be the released verifier code, and could accept proofs the real verifier rejects.`,
  },
  ballotVKHash: {
    source: 'registry ballotVKHash()',
    what: msg`sha256 of the ballot proof verification key: the davinci-circom Groth16 key voters’ clients prove their ballots against.`,
    why: msg`The registry writes it into every process’s genesis state as leaf 0x07. The batch guest hashes the key it is given and requires it to equal that leaf, so only ballots proven for this circuit settle.`,
    mismatch: msg`Ballots would be checked against another circuit’s key: ballots from the released client would fail, and ballots from the other circuit would pass.`,
  },
}

export interface ContractRow {
  id: string
  /** The contract's name, never translated. */
  name: string
  role: MessageDescriptor
  address: Address | null
  /** Shown instead of an address when there is none. */
  note?: MessageDescriptor
  group: 'davinci' | 'dkg'
}

export const DKG_VERIFIER_LABELS: Record<DkgVerifierName, { name: string; role: MessageDescriptor }> = {
  contribution: {
    name: 'ContributionVerifier',
    role: msg`Groth16 verifier of each committee member’s contribution, which deals its shares of all 16 pool keys.`,
  },
  finalize: {
    name: 'FinalizeVerifier',
    role: msg`Groth16 verifier of finalizeEpoch, which stores the 16 pool keys and their share roots and makes the epoch Live.`,
  },
  partialDecrypt: {
    name: 'PartialDecryptVerifier',
    role: msg`Groth16 verifier of each member’s partial decryption, checked against its committed share.`,
  },
  decryptCombine: {
    name: 'DecryptCombineVerifier',
    role: msg`Groth16 verifier of the combine that interpolates the partials and recovers a plaintext.`,
  },
}

/** Every contract of the deployment, in reading order; null addresses are still being read. */
export function contractRows(chain: ChainMeta, details: DeploymentDetails | undefined): ContractRow[] {
  const r = chain.registry
  const rows: ContractRow[] = [
    {
      id: 'registry',
      name: 'ProcessRegistry',
      role: msg`Stores the processes, settles every state transition (proof, root continuity, census root, blob openings) and records the results.`,
      address: chain.registryAddress.toLowerCase() as Address,
      group: 'davinci',
    },
    {
      id: 'verifier',
      name: 'ZiskVerifier',
      role: msg`The vendored ZisK PLONK verifier. The registry calls verifySnarkProof on it for every transition and every results proof.`,
      address: r?.ziskVerifier ?? null,
      group: 'davinci',
    },
  ]
  if (r && !r.dkgAdapter) {
    rows.push({
      id: 'adapter',
      name: 'DavinciDKGAdapter',
      role: msg`The registry’s link to davinci-dkg.`,
      address: null,
      note: msg`None: this registry was deployed without a DKG manager, so the DKG key modes are disabled.`,
      group: 'davinci',
    })
    return rows
  }
  rows.push(
    {
      id: 'adapter',
      name: 'DavinciDKGAdapter',
      role: msg`Created by the registry. Registers one DKG application per DKG-mode process, is its only ciphertext submitter, converts keys between the two BabyJubJub forms and reads the plaintexts back.`,
      address: r?.dkgAdapter ?? null,
      group: 'davinci',
    },
    {
      id: 'dkg-manager',
      name: 'DKGManager',
      role: msg`Epochs, pool keys, ciphertexts, partial and combined decryptions.`,
      address: r?.dkgManager ?? null,
      group: 'dkg',
    },
    {
      id: 'dkg-app-manager',
      name: 'DKGAppManager',
      role: msg`Application registration, submission policy and the organizer-secret reveal.`,
      address: r?.dkgAppManager ?? null,
      group: 'dkg',
    },
    {
      id: 'dkg-registry',
      name: 'DKGRegistry',
      role: msg`The committee operators, their encryption keys and liveness.`,
      address: details?.dkg?.operatorRegistry ?? null,
      group: 'dkg',
    }
  )
  for (const v of details?.dkg?.verifiers ?? defaultVerifiers()) {
    rows.push({
      id: `dkg-${v.name}`,
      name: DKG_VERIFIER_LABELS[v.name].name,
      role: DKG_VERIFIER_LABELS[v.name].role,
      address: v.address,
      group: 'dkg',
    })
  }
  return rows
}

function defaultVerifiers(): Array<{ name: DkgVerifierName; address: null }> {
  return (['contribution', 'finalize', 'partialDecrypt', 'decryptCombine'] as const).map((name) => ({
    name,
    address: null,
  }))
}

export interface WiringCheck {
  id: string
  label: MessageDescriptor
  detail: MessageDescriptor
  state: CheckState
}

const hexU32 = (n: number) => `0x${n.toString(16).padStart(8, '0')}`

const same = (a: string | null | undefined, b: string | null | undefined): CheckState =>
  a == null || b == null ? 'unknown' : a.toLowerCase() === b.toLowerCase() ? 'pass' : 'fail'

/** Consistency checks between the contracts, all from values read on chain. */
export function wiringChecks(
  chain: ChainMeta,
  details: DeploymentDetails | undefined,
  expectedChainId: number
): WiringCheck[] {
  const r = chain.registry
  // Identifiers, shown as they are.
  const configured = String(expectedChainId)
  const registryChainId = r ? String(r.chainID) : '…'
  const recomputed = r ? processIdPrefix(r.chainID, chain.registryAddress) : null
  const onChainPrefix = r ? hexU32(r.pidPrefix) : '…'
  const recomputedPrefix = recomputed != null ? hexU32(recomputed) : '…'
  const checks: WiringCheck[] = [
    {
      id: 'chain-id',
      label: msg`The registry’s chainID is the chain the explorer reads`,
      detail: msg`registry chainID() = ${registryChainId}, configured chain ${configured}`,
      state: r ? (r.chainID === expectedChainId ? 'pass' : 'fail') : 'unknown',
    },
    {
      id: 'pid-prefix',
      label: msg`pidPrefix is the low 4 bytes of keccak256(chainID ‖ registry)`,
      detail: r ? msg`on chain ${onChainPrefix}, recomputed ${recomputedPrefix}` : msg`not read yet`,
      state: r ? (recomputed === r.pidPrefix ? 'pass' : 'fail') : 'unknown',
    },
    {
      id: 'verifier-root',
      label: msg`The verifier’s getRootCVadcopFinal() equals the registry’s rootCVadcopFinal`,
      detail: msg`Sequencers check this at boot; a verifier built for another setup would fail it.`,
      state: same(details?.verifierRootC, r?.rootCVadcopFinal),
    },
  ]
  if (r && !r.dkgAdapter) return checks
  const dkg = details?.dkg
  const dkgChainId = dkg?.chainId != null ? String(dkg.chainId) : '…'
  checks.push(
    {
      id: 'adapter-registry',
      label: msg`The adapter’s registry() is this registry`,
      detail: msg`The registry’s constructor creates the adapter, so it must point back at it.`,
      state: same(dkg?.adapterRegistry, chain.registryAddress),
    },
    {
      id: 'app-manager',
      label: msg`The DKGAppManager’s MANAGER() is the DKGManager`,
      detail: msg`The two DKG contracts share one logical storage and must name each other.`,
      state: same(dkg?.appManagerManager, r?.dkgManager),
    },
    {
      id: 'operator-registry',
      label: msg`The DKGRegistry’s manager() is the DKGManager`,
      detail: msg`The committee is drawn from this operator registry.`,
      state: same(dkg?.operatorRegistryManager, r?.dkgManager),
    },
    {
      id: 'dkg-chain',
      label: msg`The DKGManager’s CHAIN_ID is the chain the explorer reads`,
      detail: msg`CHAIN_ID() = ${dkgChainId}, configured chain ${configured}`,
      state: dkg?.chainId == null ? 'unknown' : dkg.chainId === expectedChainId ? 'pass' : 'fail',
    }
  )
  return checks
}

/** The first plain http(s) RPC, for commands run outside the browser. */
export function publicRpc(rpcUrls: string[]): string {
  return rpcUrls.find((u) => /^https?:\/\//.test(u)) ?? '$RPC_URL'
}

export interface VerifyCommandInput {
  rpc: string
  chainId: number
  registry: string
  pins: Partial<Record<'batchProgramVK' | 'resultsProgramVK' | 'rootCVadcopFinal' | 'ballotVKHash', Hex | null>>
}

const orPlaceholder = (v: Hex | null | undefined, name: string) => v ?? `<${name}>`

/** davinci-contracts `script/verify_deployment.py`, filled in. */
export function verifyDeploymentCommand({ rpc, chainId, registry, pins }: VerifyCommandInput): string {
  return [
    `python3 script/verify_deployment.py --rpc ${rpc} --chain-id ${chainId} \\`,
    `    --registry ${checksum(registry)} \\`,
    `    --batch-vk ${orPlaceholder(pins.batchProgramVK, 'batchProgramVK')} \\`,
    `    --results-vk ${orPlaceholder(pins.resultsProgramVK, 'resultsProgramVK')} \\`,
    `    --root-c ${orPlaceholder(pins.rootCVadcopFinal, 'rootCVadcopFinal')} \\`,
    `    --ballot-vk-hash ${orPlaceholder(pins.ballotVKHash, 'ballotVKHash')}`,
  ].join('\n')
}

/** The same pins from a known release, for the command. */
export function releasePins(release: KnownRelease): VerifyCommandInput['pins'] {
  return {
    batchProgramVK: release.batchProgramVK,
    resultsProgramVK: release.resultsProgramVK,
    rootCVadcopFinal: release.rootCVadcopFinal,
    ballotVKHash: release.ballotVKHash,
  }
}

/** Foundry `cast` reads of every pinned value. */
export function castCommands(rpc: string, registry: string, verifier: string | null): string {
  const lines = [
    `RPC=${rpc}`,
    `REGISTRY=${checksum(registry)}`,
    `cast call $REGISTRY "batchProgramVK()(bytes32)" --rpc-url $RPC`,
    `cast call $REGISTRY "resultsProgramVK()(bytes32)" --rpc-url $RPC`,
    `cast call $REGISTRY "rootCVadcopFinal()(bytes32)" --rpc-url $RPC`,
    `cast call $REGISTRY "ballotVKHash()(bytes32)" --rpc-url $RPC`,
    `cast call $REGISTRY "chainID()(uint32)" --rpc-url $RPC`,
    `VERIFIER=$(cast call $REGISTRY "ziskVerifier()(address)" --rpc-url $RPC)`,
    `cast call $VERIFIER "getRootCVadcopFinal()(bytes32)" --rpc-url $RPC`,
    `cast keccak $(cast code $VERIFIER --rpc-url $RPC)`,
  ]
  if (verifier) lines.splice(7, 0, `# ziskVerifier() should print ${checksum(verifier)}`)
  return lines.join('\n')
}

/** DKG explorer links, when one is configured. */
export function dkgExplorerLink(base: string | undefined, kind: 'epoch' | 'operator', id: string): string | null {
  if (!base) return null
  const root = base.replace(/\/+$/, '')
  return kind === 'epoch' ? `${root}/epochs/${id.toLowerCase()}` : `${root}/operators/${id.toLowerCase()}`
}

/** One-line verdict, shared by the page header and the panel. Render `text` with `i18n._`. */
export function releaseVerdict(match: ReleaseMatch): { tone: 'ok' | 'danger' | 'info'; text: MessageDescriptor } {
  const failed = match.checks.filter((c) => c.ok === false).length
  const total = formatNumber(match.checks.length)
  if (match.release) {
    const release = match.release.label
    return { tone: 'ok', text: msg`All five pins match ${release}.` }
  }
  if (!match.closest) return { tone: 'info', text: msg`This explorer carries no known release to compare with.` }
  const closest = match.closest.label
  if (failed > 0) {
    return {
      tone: 'danger',
      text: msg`${plural(failed, {
        one: `# of ${total} pins differs from ${closest}, the closest release this explorer knows.`,
        other: `# of ${total} pins differ from ${closest}, the closest release this explorer knows.`,
      })}`,
    }
  }
  return { tone: 'info', text: msg`Reading the pins from the registry…` }
}
