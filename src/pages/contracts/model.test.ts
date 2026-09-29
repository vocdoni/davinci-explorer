import { describe, expect, it } from 'vitest'
import { i18n } from '@lingui/core'
import { demoFixture } from '~fixtures/demo'
import { demoDeploymentDetails } from '~data/deployment'
import type { ChainMeta } from '~indexer/types'
import { KNOWN_RELEASES, matchRelease, PIN_NAMES } from '~protocol/releases'
import {
  castCommands,
  contractRows,
  DKG_VERIFIER_LABELS,
  dkgExplorerLink,
  PIN_DETAILS,
  publicRpc,
  releasePins,
  releaseVerdict,
  verifyDeploymentCommand,
  wiringChecks,
} from './model'

const store = demoFixture().store
const chain = store.chain
const details = demoDeploymentDetails(store)
const release = KNOWN_RELEASES[0]!
const allPins = {
  batchProgramVK: release.batchProgramVK,
  resultsProgramVK: release.resultsProgramVK,
  rootCVadcopFinal: release.rootCVadcopFinal,
  ziskVerifierCodeHash: release.ziskVerifierCodeHash,
  ballotVKHash: release.ballotVKHash,
}

describe('the explanations', () => {
  it('explain every pin in whole sentences, plain first, with the code names kept below', () => {
    for (const pin of PIN_NAMES) {
      const d = PIN_DETAILS[pin]
      for (const text of [d.what, d.why, d.detail, d.mismatch].map((m) => i18n._(m))) {
        expect(text.length).toBeGreaterThan(20)
        expect(text.trim().endsWith('.')).toBe(true)
      }
      // The mismatch stands alone after "It differs." or "What a mismatch would mean."
      expect(i18n._(d.mismatch)).toMatch(/^[A-Z]/)
      // The plain layer names no code; the technical one does, in backticks or as a formula.
      expect(i18n._(d.what)).not.toMatch(/`|‖/)
      expect(i18n._(d.detail).split('`').length % 2).toBe(1)
    }
    expect(i18n._(PIN_DETAILS.batchProgramVK.detail)).toContain('submitStateTransition')
    expect(PIN_DETAILS.rootCVadcopFinal.formula).toBe(
      'publicInput = sha256(programVK ‖ publicValues ‖ rootCVadcopFinal) mod r_BN254'
    )
    expect(PIN_DETAILS.ziskVerifierCodeHash.source).toBe('keccak256(eth_getCode(ziskVerifier))')
  })

  it('keep the DKG verifier contract names out of the translated text', () => {
    expect(DKG_VERIFIER_LABELS.finalize.name).toBe('FinalizeVerifier')
    expect(i18n._(DKG_VERIFIER_LABELS.finalize.role)).not.toContain('finalizeEpoch')
    expect(i18n._(DKG_VERIFIER_LABELS.finalize.detail)).toContain('finalizeEpoch')
  })
})

describe('verifyDeploymentCommand', () => {
  it('fills in the script the way the davinci-contracts README runs it', () => {
    const cmd = verifyDeploymentCommand({
      rpc: 'https://rpc.gnosischain.com',
      chainId: 100,
      registry: '0x48a5091b64434a6690aea32455712bd2b7ee3e77',
      pins: releasePins(release),
    })
    expect(cmd).toBe(
      [
        'python3 script/verify_deployment.py --rpc https://rpc.gnosischain.com --chain-id 100 \\',
        '    --registry 0x48a5091B64434a6690AeA32455712Bd2b7EE3E77 \\',
        `    --batch-vk ${release.batchProgramVK} \\`,
        `    --results-vk ${release.resultsProgramVK} \\`,
        `    --root-c ${release.rootCVadcopFinal} \\`,
        `    --ballot-vk-hash ${release.ballotVKHash}`,
      ].join('\n')
    )
  })

  it('leaves a placeholder for a pin not read yet', () => {
    const cmd = verifyDeploymentCommand({ rpc: 'x', chainId: 1, registry: '0x01', pins: {} })
    expect(cmd).toContain('--batch-vk <batchProgramVK>')
  })
})

describe('publicRpc', () => {
  it('prefers a plain http(s) endpoint', () => {
    expect(publicRpc(['/proxy/rpc', 'https://a.example'])).toBe('https://a.example')
    expect(publicRpc(['/proxy/rpc'])).toBe('$RPC_URL')
  })
})

describe('castCommands', () => {
  it('reads every pin and hashes the verifier code', () => {
    const out = castCommands('https://rpc.example', chain.registryAddress, chain.registry!.ziskVerifier)
    expect(out).toContain('cast call $REGISTRY "batchProgramVK()(bytes32)" --rpc-url $RPC')
    expect(out).toContain('cast keccak $(cast code $VERIFIER --rpc-url $RPC)')
    expect(out.split('\n')[0]).toBe('RPC=https://rpc.example')
  })
})

describe('contractRows', () => {
  it('lists the DAVINCI and DKG contracts', () => {
    const rows = contractRows(chain, details)
    expect(rows.map((r) => r.name)).toEqual([
      'ProcessRegistry',
      'ZiskVerifier',
      'DavinciDKGAdapter',
      'DKGManager',
      'DKGAppManager',
      'DKGRegistry',
      'ContributionVerifier',
      'FinalizeVerifier',
      'PartialDecryptVerifier',
      'DecryptCombineVerifier',
    ])
    expect(rows.every((r) => r.address != null)).toBe(true)
    expect(rows.every((r) => i18n._(r.role).length > 0)).toBe(true)
  })

  it('says the DKG modes are off without an adapter', () => {
    const noDkg: ChainMeta = {
      ...chain,
      registry: { ...chain.registry!, dkgAdapter: null, dkgManager: null, dkgAppManager: null },
    }
    const rows = contractRows(noDkg, undefined)
    expect(rows).toHaveLength(3)
    expect(rows[2]!.address).toBeNull()
    expect(i18n._(rows[2]!.note!)).toMatch(/disabled/)
  })

  it('keeps the rows, unread, before the registry is read', () => {
    const rows = contractRows({ ...chain, registry: null }, undefined)
    expect(rows[1]!.address).toBeNull()
    expect(rows.length).toBe(10)
  })
})

describe('wiringChecks', () => {
  it('passes on a consistent deployment', () => {
    const checks = wiringChecks(chain, details, chain.chainId)
    expect(checks.map((c) => c.state)).toEqual(checks.map(() => 'pass'))
    expect(checks).toHaveLength(7)
    const detail = Object.fromEntries(checks.map((c) => [c.id, i18n._(c.detail)]))
    expect(detail['chain-id']).toBe(
      `The registry says chain ${chain.chainId}; this explorer is set up for chain ${chain.chainId}.`
    )
    expect(detail['pid-prefix']).toMatch(
      /: the registry holds 0x[0-9a-f]{8}, the recomputed prefix is 0x[0-9a-f]{8}\.$/
    )
    expect(detail['dkg-chain']).toBe(
      `The committee’s manager contract says chain ${chain.chainId}; this explorer is set up for chain ${chain.chainId}.`
    )
    // The exact relation is code, beside the plain label.
    const formula = Object.fromEntries(checks.map((c) => [c.id, c.formula]))
    expect(formula['pid-prefix']).toBe('pidPrefix = uint32(keccak256(abi.encodePacked(chainID, registry)))')
    expect(formula['verifier-root']).toBe('verifier.getRootCVadcopFinal() = registry.rootCVadcopFinal()')
  })

  it('flags a verifier on another setup and an adapter of another registry', () => {
    const checks = wiringChecks(
      chain,
      {
        verifierRootC: '0x01',
        dkg: { ...details.dkg!, adapterRegistry: '0x0000000000000000000000000000000000000bad' },
      },
      chain.chainId
    )
    const state = Object.fromEntries(checks.map((c) => [c.id, c.state]))
    expect(state['verifier-root']).toBe('fail')
    expect(state['adapter-registry']).toBe('fail')
    expect(state['app-manager']).toBe('pass')
  })

  it('flags a registry deployed for another chain', () => {
    const checks = wiringChecks(chain, details, 1)
    expect(checks.find((c) => c.id === 'chain-id')!.state).toBe('fail')
    expect(checks.find((c) => c.id === 'dkg-chain')!.state).toBe('fail')
  })

  it('is unknown before anything is read', () => {
    const checks = wiringChecks({ ...chain, registry: null }, undefined, chain.chainId)
    expect(checks.every((c) => c.state === 'unknown')).toBe(true)
    const detail = Object.fromEntries(checks.map((c) => [c.id, i18n._(c.detail)]))
    expect(detail['chain-id']).toBe(`The registry says chain …; this explorer is set up for chain ${chain.chainId}.`)
    expect(detail['pid-prefix']).toBe('not read yet')
  })
})

describe('releaseVerdict', () => {
  it('names the release every pin matches', () => {
    const v = releaseVerdict(matchRelease(allPins))
    expect(v.tone).toBe('ok')
    expect(i18n._(v.text)).toBe(`All five pins match ${release.label}.`)
  })

  it('counts the pins that differ, one or several', () => {
    const one = releaseVerdict(matchRelease({ ...allPins, batchProgramVK: '0x00' }))
    expect(one.tone).toBe('danger')
    expect(i18n._(one.text)).toBe(`1 of 5 pins differs from ${release.label}, the closest release this explorer knows.`)
    const two = releaseVerdict(matchRelease({ ...allPins, batchProgramVK: '0x00', ballotVKHash: '0x00' }))
    expect(i18n._(two.text)).toMatch(/^2 of 5 pins differ from /)
  })

  it('waits while nothing is read', () => {
    const v = releaseVerdict(matchRelease({}))
    expect(v.tone).toBe('info')
    expect(i18n._(v.text)).toBe('Reading the pins from the registry…')
  })
})

describe('dkgExplorerLink', () => {
  it('builds epoch and operator links when a DKG explorer is configured', () => {
    expect(dkgExplorerLink('https://dkg.example/', 'epoch', '0xAB')).toBe('https://dkg.example/epochs/0xab')
    expect(dkgExplorerLink('https://dkg.example', 'operator', '0xCD')).toBe('https://dkg.example/operators/0xcd')
    expect(dkgExplorerLink(undefined, 'epoch', '0xab')).toBeNull()
  })
})
