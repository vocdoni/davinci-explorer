import { describe, expect, it } from 'vitest'
import { demoFixture } from '~fixtures/demo'
import {
  blockTimestamp,
  sequencerActivity,
  sequencerResults,
  sequencerRow,
  sequencerRows,
  sequencerTransitions,
} from './selectors'
import { txKey, type Address, type IndexerStore } from './types'

const store = demoFixture().store
const clone = (s: IndexerStore): IndexerStore => structuredClone(s)
const transitions = store.transitionOrder.map((k) => store.transitions[k]!)
const results = store.processOrder.map((k) => store.processes[k]!.results).filter((r) => r != null)

describe('sequencerRows', () => {
  const rows = sequencerRows(store)

  it('has one row per account that settled a transition or published results', () => {
    const senders = new Set([...transitions.map((t) => t.sender), ...results.map((r) => r.sender)])
    expect(rows.map((r) => r.address).sort()).toEqual([...senders].sort())
    expect(rows.length).toBeGreaterThan(1)
  })

  it('splits every transition, ballot, blob and result between them', () => {
    const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((n, r) => n + f(r), 0)
    expect(sum((r) => r.transitions)).toBe(transitions.length)
    expect(sum((r) => r.ballots)).toBe(transitions.reduce((n, t) => n + t.newVoters + t.overwrites, 0))
    expect(sum((r) => r.newVoters + r.overwrites)).toBe(sum((r) => r.ballots))
    expect(sum((r) => r.blobs)).toBe(transitions.reduce((n, t) => n + t.nBlobs, 0))
    expect(sum((r) => r.results)).toBe(results.length)
  })

  it('counts each process once per account, whether it settled or published results', () => {
    for (const r of rows) {
      const pids = new Set([
        ...transitions.filter((t) => t.sender === r.address).map((t) => t.processId),
        ...store.processOrder.filter((k) => store.processes[k]!.results?.sender === r.address),
      ])
      expect(r.processes).toBe(pids.size)
    }
  })

  it('adds the fees of its settlement and results transactions', () => {
    for (const r of rows) {
      const txs = new Set([
        ...transitions.filter((t) => t.sender === r.address).map((t) => txKey(t.tx!)),
        ...results.filter((x) => x.sender === r.address).map((x) => txKey(x.tx!)),
      ])
      const fee = [...txs].reduce((n, tx) => n + store.txDetails[tx]!.fee, 0n)
      expect(r.fees).toBe(fee)
      expect(r.feesPending).toBe(0)
    }
  })

  it('counts a transaction whose receipt is not read as pending, not as zero', () => {
    const s = clone(store)
    const first = sequencerRows(s)[0]!
    const tx = txKey(transitions.find((t) => t.sender === first.address)!.tx!)
    const fee = s.txDetails[tx]!.fee
    delete s.txDetails[tx]
    const row = sequencerRow(s, first.address)!
    expect(row.feesPending).toBe(1)
    expect(row.fees).toBe(first.fees - fee)
  })

  it('spans the first and the last activity', () => {
    for (const r of rows) {
      const blocks = [
        ...transitions.filter((t) => t.sender === r.address).map((t) => t.block),
        ...results.filter((x) => x.sender === r.address).map((x) => x.block),
      ]
      expect(r.first.block).toBe(Math.min(...blocks))
      expect(r.last.block).toBe(Math.max(...blocks))
      expect(r.last.timestamp).toBe(blockTimestamp(store, r.last.block))
    }
  })

  it('lists an account that only published results', () => {
    const s = clone(store)
    const pid = store.processOrder.find((k) => store.processes[k]!.results)!
    const publisher = '0x00000000000000000000000000000000000000aa' as Address
    s.processes[pid]!.results!.sender = publisher
    const row = sequencerRow(s, publisher.toUpperCase().replace('0X', '0x'))!
    expect(row).toMatchObject({ transitions: 0, ballots: 0, blobs: 0, results: 1, processes: 1 })
    expect(row.first.block).toBe(s.processes[pid]!.results!.block)
    expect(row.first).toEqual(row.last)
    expect(sequencerRows(s).at(-1)!.address).toBe(publisher)
  })

  it('sorts the busiest first and is empty for an empty registry', () => {
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1]!.transitions).toBeGreaterThanOrEqual(rows[i]!.transitions)
    expect(sequencerRows({ ...store, transitionOrder: [], transitions: {}, processOrder: [], processes: {} })).toEqual(
      []
    )
    expect(sequencerRow(store, '0x0000000000000000000000000000000000000001')).toBeNull()
  })
})

describe('sequencerActivity', () => {
  const address = sequencerRows(store)[0]!.address

  it('buckets its work per UTC day, oldest first, ending on the chain’s today', () => {
    const days = sequencerActivity(store, address, 45)
    expect(days).toHaveLength(45)
    const today = new Date(store.chain.headTimestamp! * 1000).toISOString().slice(0, 10)
    expect(days.at(-1)!.day).toBe(today)
    for (let i = 1; i < days.length; i++) {
      expect(Date.parse(days[i]!.day) - Date.parse(days[i - 1]!.day)).toBe(86_400_000)
    }
  })

  it('adds up to its row over a window that covers everything', () => {
    const row = sequencerRow(store, address)!
    const days = sequencerActivity(store, address, 3650)
    const sum = (f: (d: (typeof days)[number]) => number) => days.reduce((n, d) => n + f(d), 0)
    expect(sum((d) => d.transitions)).toBe(row.transitions)
    expect(sum((d) => d.ballots)).toBe(row.ballots)
    expect(sum((d) => d.newVoters)).toBe(row.newVoters)
    expect(sum((d) => d.blobs)).toBe(row.blobs)
    expect(sum((d) => d.results)).toBe(row.results)
  })

  it('leaves out what is older than the window', () => {
    const one = sequencerActivity(store, address, 1)
    const today = one[0]!.day
    const expected = transitions.filter(
      (t) =>
        t.sender === address &&
        new Date((t.timestamp ?? blockTimestamp(store, t.block)!) * 1000).toISOString().slice(0, 10) === today
    ).length
    expect(one[0]!.transitions).toBe(expected)
  })

  it('is empty before the chain head has a time', () => {
    expect(sequencerActivity({ ...store, chain: { ...store.chain, headTimestamp: null } }, address)).toEqual([])
  })
})

describe('sequencerTransitions and sequencerResults', () => {
  const rows = sequencerRows(store)

  it('lists the transitions of one account, newest first, with their fees and continuity', () => {
    for (const r of rows) {
      const list = sequencerTransitions(store, r.address.toUpperCase().replace('0X', '0x'))
      expect(list).toHaveLength(r.transitions)
      expect(list.every((t) => t.sender === r.address)).toBe(true)
      for (let i = 1; i < list.length; i++) expect(list[i - 1]!.block).toBeGreaterThanOrEqual(list[i]!.block)
      expect(list.every((t) => t.fee != null && t.continuous === true)).toBe(true)
    }
  })

  it('lists the results one account published, newest first', () => {
    for (const r of rows) {
      const list = sequencerResults(store, r.address)
      expect(list).toHaveLength(r.results)
      for (let i = 1; i < list.length; i++) expect(list[i - 1]!.block).toBeGreaterThanOrEqual(list[i]!.block)
      for (const x of list) {
        expect(store.processes[x.processId]!.results!.sender).toBe(r.address)
        expect(x.fee).toBe(store.txDetails[txKey(x.tx!)]!.fee)
      }
    }
  })
})
