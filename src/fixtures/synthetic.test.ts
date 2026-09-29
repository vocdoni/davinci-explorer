import { describe, expect, it } from 'vitest'
import { decodeTransitionBlobs, versionedHash } from '~protocol/blob'
import { readServedDocument } from '~protocol/metadata'
import { decodeBatchPublicValues } from '~protocol/publics'
import { verifyTracker } from '~protocol/tracker'
import { networkStats, rootChain, transitionDetail } from '~indexer/selectors'
import { describeBallotMode } from '~pages/process/ballot-mode'
import { ballotPasses, findBallot } from '../test/ballots'
import { buildFixture, demoTransitionBlobs } from './synthetic'
import { createDemoServices, demoFixture } from './demo'
import { presetBallotMode, type ElectionPreset } from './presets'

const fixture = demoFixture()
const { store } = fixture

describe('synthetic network', () => {
  it('is deterministic', () => {
    const again = buildFixture()
    expect(again.store.processOrder).toEqual(store.processOrder)
    expect(again.store.transitionOrder.length).toBe(store.transitionOrder.length)
    const key = store.transitionOrder[5]!
    expect(again.store.transitions[key]).toEqual(store.transitions[key])
  })

  it('covers every status, key mode and census origin', () => {
    const stats = networkStats(store)
    for (const status of ['ready', 'ended', 'canceled', 'paused', 'results'] as const) {
      expect(stats.byStatus[status], status).toBeGreaterThan(0)
    }
    for (const phase of ['upcoming', 'open', 'closing', 'paused', 'ended', 'canceled', 'results'] as const) {
      expect(stats.byPhase[phase], phase).toBeGreaterThan(0)
    }
    for (const mode of ['sequencer', 'dkg-automatic', 'dkg-locked'] as const) {
      expect(stats.byKeyMode[mode], mode).toBeGreaterThan(0)
    }
    for (const origin of ['merkle-static', 'merkle-dynamic', 'onchain-dynamic', 'csp'] as const) {
      expect(stats.byCensusOrigin[origin], origin).toBeGreaterThan(0)
    }
    expect(stats.transitions).toBeGreaterThan(50)
    expect(stats.withResults).toBeGreaterThan(1)
  })

  it('gives every process a ballot a voter can fill, and shows every ballot kind', () => {
    const kinds = new Set<string>()
    for (const pid of store.processOrder) {
      const bm = store.processes[pid]!.state!.ballotMode
      const d = describeBallotMode(bm)
      expect(d.kind, pid).not.toBe('unsatisfiable')
      const ballot = findBallot(bm)
      expect(ballot != null && ballotPasses(bm, ballot), pid).toBe(true)
      kinds.add(d.kind)
    }
    expect([...kinds].sort()).toEqual([
      'approval',
      'custom',
      'multiple-choice',
      'points',
      'quadratic',
      'ranking',
      'rating',
      'single-choice',
    ])
  })

  it('stores the preset in the metadata, and it resolves to the registered ballot mode', () => {
    let presets = 0
    for (const pid of store.processOrder) {
      const s = store.processes[pid]!.state!
      const doc = readServedDocument(fixture.metadata.get(s.metadataURI)!).doc as {
        meta?: { electionPreset?: ElectionPreset }
      }
      const preset = doc.meta?.electionPreset
      if (!preset) continue
      presets += 1
      expect(presetBallotMode(preset, s.ballotMode.numFields), pid).toEqual(s.ballotMode)
    }
    expect(presets).toBe(store.processOrder.length - 1)
  })

  it('serves the committed metadata bytes, except for one tampered document', () => {
    const { metadataTampered, metadataBeforeStart, metadataAfterVotes } = fixture.featured
    for (const pid of store.processOrder) {
      const p = store.processes[pid]!
      const s = p.state!
      const served = readServedDocument(fixture.metadata.get(s.metadataURI)!)
      expect(served.hash === s.metadataHash, pid).toBe(pid !== metadataTampered)
      expect(served.doc, pid).toBeTruthy()
      // The history ends at the version getProcess returns, and every version is served.
      const last = p.metadataHistory[p.metadataHistory.length - 1]!
      expect([last.uri, last.hash], pid).toEqual([s.metadataURI, s.metadataHash])
      expect(p.metadataHistory[0]!.tx, pid).toBe(p.createdTx)
      expect(
        p.metadataHistory.map((v) => v.atCreation),
        pid
      ).toEqual(p.metadataHistory.map((_, i) => i === 0))
      for (const v of p.metadataHistory) expect(fixture.metadata.has(v.uri), pid).toBe(true)
    }
    const flags = (pid: string) => store.processes[pid]!.metadataHistory.map((v) => [v.afterStart, v.afterFirstVote])
    expect(flags(metadataBeforeStart)).toEqual([
      [false, false],
      [false, false],
    ])
    expect(flags(metadataAfterVotes)).toEqual([
      [false, false],
      [true, true],
    ])
    expect(store.processes[metadataTampered]!.metadataHistory).toHaveLength(1)
  })

  it('publishes tallies the ballots could add up to', () => {
    for (const pid of store.processOrder) {
      const p = store.processes[pid]!
      const bm = p.state!.ballotMode
      if (!p.results || bm.costExponent !== 1) continue
      const voters = BigInt(p.state!.votersCount)
      const sum = p.results.values.reduce((a, v) => a + v, 0n)
      expect(sum, pid).toBeGreaterThanOrEqual(voters * bm.minValueSum)
      if (bm.maxValueSum > 0n) expect(sum, pid).toBeLessThanOrEqual(voters * bm.maxValueSum)
      for (const v of p.results.values) expect(v, pid).toBeLessThanOrEqual(voters * bm.maxValue)
    }
  })

  it('keeps every root chain continuous up to the registry root', () => {
    for (const pid of store.processOrder) {
      const chain = rootChain(store, pid)
      expect(chain.gaps, pid).toBe(0)
      if (chain.links.length > 0) expect(chain.headMatches, pid).toBe(true)
    }
  })

  it('carries publics that pass every settlement check', () => {
    for (const key of store.transitionOrder) {
      const t = store.transitions[key]!
      const d = transitionDetail(store, t.processId, t.index)!
      for (const c of d.checks) {
        if (c.id === 'census-root' && d.process.state?.census.origin === 'onchain-dynamic') continue
        expect(c.state, `${key} ${c.id}`).toBe('pass')
      }
    }
  })

  it('generates blobs the real decoder accepts', () => {
    const { processId, index } = fixture.featured.multiBlob
    const data = fixture.transitionData.get(`${processId}:${index}`)!
    const blobs = demoTransitionBlobs(data)
    const t = store.transitions[`${processId}:${index}`]!
    expect(blobs.length).toBe(t.nBlobs)
    expect(blobs.length).toBeGreaterThan(1)
    const decoded = decodeTransitionBlobs(blobs, data.numFields)
    expect(decoded.voteIds.length).toBe(t.newVoters + t.overwrites)
    const publics = decodeBatchPublicValues(store.txDetails[t.tx!]!.publicValues!)
    expect(decoded.voteIds.length).toBe(publics.voters)
  })

  it('has a DKG-locked process whose tally waits for the reveal', () => {
    const pid = fixture.featured.awaitingReveal
    const p = store.processes[pid]!
    expect(p.state?.keyMode).toBe('dkg-locked')
    expect(p.decryptionRequest).not.toBeNull()
    expect(p.results).toBeNull()
    const app = fixture.dkg.get(pid)!
    expect(app.organizerSecret).toBe(0n)
    expect(app.ciphertexts.every((c) => !c.completed)).toBe(true)
  })

  it('serves tracker proofs that verify against the on-chain root', async () => {
    const services = createDemoServices(fixture)
    const { processId, voteId } = fixture.featured.settledVote
    const proof = await services.sequencers[0]!.api.trackerProof(processId, voteId)
    expect(proof.root).toBe(store.processes[processId]!.state!.latestStateRoot)
    expect(verifyTracker(proof, proof.root)).toBe(true)
    expect(await services.sequencers[0]!.api.voteStatus(processId, voteId)).toEqual({ status: 'settled' })
  })

  it('ties each blob to its transaction by versioned hash', () => {
    for (const key of store.transitionOrder.slice(0, 20)) {
      const tx = store.txDetails[store.transitions[key]!.tx!]!
      expect(tx.commitments.map((c) => versionedHash(c))).toEqual(tx.blobVersionedHashes)
    }
  })
})
