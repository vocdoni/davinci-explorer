import { describe, expect, it } from 'vitest'
import { i18n } from '@lingui/core'
import { demoFixture } from '~fixtures/demo'
import type { SequencerInfo, SequencerProcess } from '~protocol/sequencer-api'
import type { SequencerState } from '~data/queries'
import { sequencerRows } from '~indexer/selectors'
import { KNOWN_RELEASES } from '~protocol/releases'
import { findSequencerEntry, infoChecks, nodeRelease, nodeStatus, sequencerEntries, syncState } from './model'

const fixture = demoFixture()
const store = fixture.store

type Info = Partial<SequencerInfo> | null
const node = (index: number, info: Info, state: 'ok' | 'error' | 'loading' = info ? 'ok' : 'loading') =>
  ({
    endpoint: { index, url: `demo://sequencer/${index}`, upstream: `https://node-${index}.example` },
    info: {
      data: info ?? undefined,
      isSuccess: state === 'ok',
      isError: state === 'error',
      isLoading: state === 'loading',
    },
    processes: { data: undefined, isLoading: true, isError: false },
  }) as unknown as SequencerState

describe('sequencerEntries', () => {
  const rows = sequencerRows(store)
  const busiest = rows[0]!

  it('lists the on-chain accounts first, each with the nodes that report its address', () => {
    const signer = node(0, { sequencerAddress: busiest.address.toUpperCase().replace('0X', '0x') as `0x${string}` })
    const entries = sequencerEntries(rows, [signer])
    expect(entries.map((e) => e.address)).toEqual(rows.map((r) => r.address))
    expect(entries[0]!.nodes).toEqual([signer])
    expect(entries[0]!.key).toBe(busiest.address)
    expect(entries.slice(1).every((e) => e.nodes.length === 0)).toBe(true)
  })

  it('keeps a node whose account never settled, and one that reports no account', () => {
    const idle = '0x00000000000000000000000000000000000000bb'
    const entries = sequencerEntries(rows, [
      node(0, { sequencerAddress: idle, observer: false }),
      node(1, { sequencerAddress: null, observer: true }),
      node(2, null, 'error'),
    ])
    const extra = entries.slice(rows.length)
    expect(extra.map((e) => [e.key, e.address, e.onchain])).toEqual([
      [idle, idle, null],
      ['node-2', null, null],
      ['node-3', null, null],
    ])
  })

  it('is empty with nothing on chain and nothing configured', () => {
    expect(sequencerEntries([], [])).toEqual([])
  })
})

describe('findSequencerEntry', () => {
  const rows = sequencerRows(store)
  const entries = sequencerEntries(rows, [
    node(0, { sequencerAddress: rows[0]!.address }),
    node(1, { sequencerAddress: null, observer: true }),
  ])

  it('finds an entry by address, in any case, or by node key', () => {
    expect(findSequencerEntry(entries, rows[1]!.address.toUpperCase().replace('0X', '0x'))!.onchain).toEqual(rows[1])
    expect(findSequencerEntry(entries, 'node-2')!.nodes[0]!.endpoint.index).toBe(1)
    // A node that reports an address is found through it and through its key.
    expect(findSequencerEntry(entries, 'node-1')).toBe(entries[0])
  })

  it('finds nothing for an unknown key', () => {
    expect(findSequencerEntry(entries, '0x0000000000000000000000000000000000000001')).toBeNull()
    expect(findSequencerEntry(entries, 'node-9')).toBeNull()
    expect(findSequencerEntry(entries, undefined)).toBeNull()
  })
})

describe('nodeStatus and nodeRelease', () => {
  it('reads the last /info poll', () => {
    expect(nodeStatus(node(0, {}))).toBe('online')
    expect(nodeStatus(node(0, null, 'error'))).toBe('offline')
    expect(nodeStatus(node(0, null))).toBe('checking')
  })

  it('names the release whose keys the node reports', () => {
    const release = KNOWN_RELEASES[0]!
    const info = {
      batchProgramVk: release.batchProgramVK.toUpperCase().replace('0X', '0x'),
      resultsProgramVk: release.resultsProgramVK,
      ballotVkHash: release.ballotVKHash,
    } as SequencerInfo
    expect(nodeRelease(info)).toBe(release)
    expect(nodeRelease({ ...info, resultsProgramVk: '0x00' })).toBeNull()
  })
})

describe('infoChecks', () => {
  const r = store.chain.registry!
  const info: SequencerInfo = {
    sequencerAddress: null,
    chainId: store.chain.chainId,
    processRegistry: store.chain.registryAddress.toUpperCase().replace('0X', '0x') as `0x${string}`,
    ballotVkHash: r.ballotVKHash,
    batchProgramVk: r.batchProgramVK,
    resultsProgramVk: r.resultsProgramVK,
    observer: true,
    settledBySelf: 0,
    syncedFromOthers: 0,
    lostRaces: 0,
  }

  it('passes for a node of this deployment', () => {
    const checks = infoChecks(info, store.chain)
    expect(checks.every((c) => c.state === 'pass')).toBe(true)
    expect(checks.map((c) => i18n._(c.label))).toEqual([
      'Chain id',
      'Registry',
      'Ballot VK hash',
      'Vote-batch program vk',
      'Results program vk',
    ])
  })

  it('fails the fields of another deployment', () => {
    const checks = infoChecks({ ...info, chainId: 1, batchProgramVk: '0x00' }, store.chain)
    const state = Object.fromEntries(checks.map((c) => [c.id, c.state]))
    expect(state).toMatchObject({ chain: 'fail', 'batch-vk': 'fail', registry: 'pass' })
  })

  it('is unknown before the registry is read', () => {
    const checks = infoChecks(info, { ...store.chain, registry: null })
    expect(checks.find((c) => c.id === 'batch-vk')!.state).toBe('unknown')
  })
})

describe('syncState', () => {
  const view = { localStateRoot: '0xAB' } as unknown as SequencerProcess
  it('compares the node’s root with the registry’s', () => {
    expect(syncState(view, '0xab')).toBe('in-sync')
    expect(syncState(view, '0xcd')).toBe('differs')
    expect(syncState(undefined, '0xab')).toBe('unknown')
    expect(syncState(view, null)).toBe('unknown')
  })
})
