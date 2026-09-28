import { describe, expect, it } from 'vitest'
import { demoFixture } from '~fixtures/demo'
import { rootChain, transitionDetail, type TransitionDetail } from '~indexer/selectors'
import { processKey } from '~indexer/types'
import { batchChecks } from '../batch'
import {
  batchesStatus,
  batchVerdicts,
  censusStatus,
  chainStatus,
  keyStatus,
  publishedStatus,
  resultChecksStatus,
} from './model'

const fixture = demoFixture()
const store = fixture.store
const labels = { onchain: 'on-chain', onchainCensus: 'census contract' }

function details(pid: string): TransitionDetail[] {
  return store.processes[processKey(pid)]!.transitions.map((_, i) => transitionDetail(store, pid, i)!)
}

describe('batch checks', () => {
  it('pass for every demo batch, the on-chain census one by its settlement', () => {
    const open = details(fixture.featured.openProcess)
    const checks = batchChecks(open[0]!, labels)
    expect(checks.find((c) => c.id === 'census-root')).toMatchObject({ label: 'census contract', state: 'pass' })
    expect(checks[checks.length - 1]).toMatchObject({ id: 'onchain', state: 'pass' })
    const verdicts = batchVerdicts(open, labels)
    expect(verdicts.every((v) => v.status === 'pass')).toBe(true)
    expect(batchesStatus(verdicts, 'open')).toBe('pass')
    expect(censusStatus('onchain-dynamic', open)).toBe('pass')
  })

  it('wait for the settlement transaction', () => {
    const d = details(fixture.featured.resultsProcess)[0]!
    const unread = { ...d, tx: null, checks: d.checks.map((c) => ({ ...c, state: 'unknown' as const })) }
    expect(batchVerdicts([unread], labels)[0]!.status).toBe('pending')
    expect(censusStatus('merkle-static', [unread])).toBe('pending')
    expect(censusStatus('onchain-dynamic', [unread])).toBe('pending')
  })

  it('without batches, wait while votes may come and do not apply after', () => {
    expect(batchesStatus([], 'open')).toBe('pending')
    expect(batchesStatus([], 'ended')).toBe('na')
    expect(censusStatus('merkle-static', [])).toBe('pass')
    expect(censusStatus(null, [])).toBe('pending')
  })
})

describe('chainStatus', () => {
  it('passes a continuous chain that ends at the registry’s root', () => {
    expect(chainStatus(rootChain(store, fixture.featured.resultsProcess), true)).toBe('pass')
    expect(chainStatus(rootChain(store, fixture.featured.resultsProcess), false)).toBe('pending')
    const chain = rootChain(store, fixture.featured.resultsProcess)
    expect(chainStatus({ ...chain, gaps: 1 }, true)).toBe('fail')
    expect(chainStatus({ ...chain, headMatches: false }, true)).toBe('fail')
    expect(chainStatus({ ...chain, headMatches: null }, true)).toBe('pending')
  })
})

describe('results', () => {
  it('waits for a result and gives up on a canceled election', () => {
    expect(publishedStatus(true, 'results')).toBe('pass')
    expect(publishedStatus(false, 'open')).toBe('pending')
    expect(publishedStatus(false, 'canceled')).toBe('na')
    expect(resultChecksStatus([], 'pending')).toBe('pending')
    expect(resultChecksStatus([], 'na')).toBe('na')
    expect(resultChecksStatus([], 'pass')).toBe('pending')
    expect(resultChecksStatus(['pass', 'fail'], 'pass')).toBe('fail')
  })
})

describe('keyStatus', () => {
  const key = { x: 5n, y: 7n }
  it('takes a sequencer key as stored and checks a DKG key against the committee’s', () => {
    expect(keyStatus('sequencer', key, null)).toBe('pass')
    expect(keyStatus('dkg-automatic', key, null)).toBe('pending')
    expect(keyStatus('dkg-automatic', key, { applicationKey: { x: 1n, y: 7n } })).toBe('fail')
    expect(keyStatus(null, null, null)).toBe('pending')
  })
})
