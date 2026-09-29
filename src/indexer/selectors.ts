// Pure selectors over the entity store. Pages read the store only through
// these (via the hooks in `~data/hooks`), so every derived number has one
// definition and one test. Their text (check labels, feed lines, search hits)
// is made in the active language when they run, which is during a render.

import { plural, t } from '@lingui/core/macro'
import type { Address, Hex } from 'viem'
import { formatNumber } from '~lib/format'
import { blobsDigest, parseVoteId, versionedHash } from '~protocol/blob'
import { isProcessId } from '~protocol/process-id'
import { decodeBatchPublicValues, publicsPassed, type BatchPublics } from '~protocol/publics'
import { matchRelease, type DeploymentPins, type ReleaseMatch } from '~protocol/releases'
import { PROCESS_STATUS_INFO, type CensusOriginName, type KeyModeName, type ProcessStatusName } from '~protocol/types'
import { paths } from '~routes/paths'
import {
  processKey,
  transitionKey,
  txKey,
  type IndexedEvent,
  type IndexerStore,
  type ProcessEntity,
  type TransitionEntity,
  type TxDetails,
} from './types'

// ── time ─────────────────────────────────────────────────────────────────────

/** Unix seconds of a block: known exactly, or estimated from the head and the block time. */
export function blockTimestamp(store: IndexerStore, block: number): number | null {
  const known = store.blockTimes[block]
  if (known != null) return known
  const { headBlock, headTimestamp, blockTimeSeconds } = store.chain
  if (headTimestamp == null) return null
  return headTimestamp - (headBlock - block) * blockTimeSeconds
}

/** "Now" on chain: the head block's time. */
export function chainNow(store: IndexerStore): number | null {
  return store.chain.headTimestamp
}

// ── processes ────────────────────────────────────────────────────────────────

/**
 * Where a process stands, combining the on-chain status with the clock: the
 * registry leaves a process READY after its end time until someone ends it
 * or posts results, so `closed` means "READY but past the end".
 */
export type ProcessPhase = 'loading' | 'upcoming' | 'open' | 'paused' | 'closed' | 'ended' | 'canceled' | 'results'

export function processPhase(p: ProcessEntity, now: number | null): ProcessPhase {
  const s = p.state
  if (!s) return 'loading'
  switch (s.status) {
    case 'results':
      return 'results'
    case 'canceled':
      return 'canceled'
    case 'ended':
      return 'ended'
    case 'paused':
      return 'paused'
    case 'ready':
      if (now != null && now < s.startTime) return 'upcoming'
      if (now != null && now >= s.startTime + s.duration) return 'closed'
      return 'open'
  }
}

export interface ProcessRow {
  id: Hex
  organizer: Address
  status: ProcessStatusName | null
  phase: ProcessPhase
  keyMode: KeyModeName | null
  censusOrigin: CensusOriginName | null
  numFields: number | null
  /** The organizer's metadata document, as the registry stores it. */
  metadataURI: string | null
  /** SHA-256 of that document's bytes, as committed on-chain. */
  metadataHash: Hex | null
  /** Distinct voters (slots written). */
  votersCount: number
  overwrittenVotesCount: number
  maxVoters: number | null
  startTime: number | null
  endTime: number | null
  createdBlock: number
  createdAt: number | null
  transitions: number
  hasResults: boolean
  lastActivityBlock: number
}

export function processRow(store: IndexerStore, p: ProcessEntity): ProcessRow {
  const s = p.state
  const last = p.transitions.length ? store.transitions[p.transitions[p.transitions.length - 1]!] : undefined
  return {
    id: p.id,
    organizer: p.organizer,
    status: s?.status ?? null,
    phase: processPhase(p, chainNow(store)),
    keyMode: s?.keyMode ?? null,
    censusOrigin: s?.census.origin ?? null,
    numFields: s?.ballotMode.numFields ?? null,
    metadataURI: s?.metadataURI || null,
    metadataHash: s?.metadataHash ?? null,
    votersCount: Math.max(s?.votersCount ?? 0, last?.votersCount ?? 0),
    overwrittenVotesCount: Math.max(s?.overwrittenVotesCount ?? 0, last?.overwrittenVotesCount ?? 0),
    maxVoters: s?.maxVoters ?? null,
    startTime: s?.startTime ?? null,
    endTime: s ? s.startTime + s.duration : null,
    createdBlock: p.createdBlock,
    createdAt: p.createdAt ?? blockTimestamp(store, p.createdBlock),
    transitions: p.transitions.length,
    hasResults: p.results != null || s?.status === 'results',
    lastActivityBlock: p.lastActivityBlock,
  }
}

export interface ProcessFilter {
  status?: ProcessStatusName | ProcessPhase
  keyMode?: KeyModeName
  censusOrigin?: CensusOriginName
  organizer?: string
  /** Substring of the id or the organizer. */
  query?: string
}

/** Every process, newest first, filtered. */
export function processRows(store: IndexerStore, filter: ProcessFilter = {}): ProcessRow[] {
  const organizer = filter.organizer?.toLowerCase()
  const query = filter.query?.trim().toLowerCase()
  const out: ProcessRow[] = []
  for (let i = store.processOrder.length - 1; i >= 0; i--) {
    const row = processRow(store, store.processes[store.processOrder[i]!]!)
    if (filter.status && row.status !== filter.status && row.phase !== filter.status) continue
    if (filter.keyMode && row.keyMode !== filter.keyMode) continue
    if (filter.censusOrigin && row.censusOrigin !== filter.censusOrigin) continue
    if (organizer && row.organizer !== organizer) continue
    if (query && !row.id.includes(query) && !row.organizer.includes(query)) continue
    out.push(row)
  }
  return out
}

// ── transitions ──────────────────────────────────────────────────────────────

export interface TransitionRow {
  key: string
  processId: Hex
  index: number
  block: number
  tx: Hex | null
  timestamp: number | null
  sender: Address
  rootBefore: Hex
  rootAfter: Hex
  newVoters: number
  overwrites: number
  /** Ballots in the batch: new voters plus overwrites. */
  votes: number
  nBlobs: number
  gasUsed: bigint | null
  blobGasUsed: bigint | null
  fee: bigint | null
  /** Root continuity with the previous transition (or the genesis root); null when unknown. */
  continuous: boolean | null
}

export function transitionRow(store: IndexerStore, t: TransitionEntity, expectedBefore: Hex | null): TransitionRow {
  const tx = t.tx ? store.txDetails[txKey(t.tx)] : undefined
  return {
    key: t.key,
    processId: t.processId,
    index: t.index,
    block: t.block,
    tx: t.tx,
    timestamp: t.timestamp ?? blockTimestamp(store, t.block),
    sender: t.sender,
    rootBefore: t.rootBefore,
    rootAfter: t.rootAfter,
    newVoters: t.newVoters,
    overwrites: t.overwrites,
    votes: t.newVoters + t.overwrites,
    nBlobs: t.nBlobs,
    gasUsed: tx?.gasUsed ?? null,
    blobGasUsed: tx?.blobGasUsed ?? null,
    fee: tx?.fee ?? null,
    continuous: expectedBefore == null ? null : expectedBefore === t.rootBefore,
  }
}

/** A process's transitions in index order. */
export function transitionRows(store: IndexerStore, pid: string): TransitionRow[] {
  const p = store.processes[processKey(pid)]
  if (!p) return []
  const rows: TransitionRow[] = []
  let expected: Hex | null = p.genesisRoot
  for (const key of p.transitions) {
    const t = store.transitions[key]!
    rows.push(transitionRow(store, t, expected))
    expected = t.rootAfter
  }
  return rows
}

export interface RootLink {
  index: number
  expectedBefore: Hex | null
  rootBefore: Hex
  rootAfter: Hex
  continuous: boolean | null
}

export interface RootChain {
  genesisRoot: Hex | null
  links: RootLink[]
  /** Transitions whose root-before is not the previous root-after. */
  gaps: number
  /** The last root equals the registry's `latestStateRoot`; null when unknown. */
  headMatches: boolean | null
}

/** The state-root chain: genesis → every transition → the latest root. */
export function rootChain(store: IndexerStore, pid: string): RootChain {
  const p = store.processes[processKey(pid)]
  if (!p) return { genesisRoot: null, links: [], gaps: 0, headMatches: null }
  const links = transitionRows(store, pid).map((r) => ({
    index: r.index,
    expectedBefore:
      r.index === 0 ? p.genesisRoot : (store.transitions[transitionKey(pid, r.index - 1)]?.rootAfter ?? null),
    rootBefore: r.rootBefore,
    rootAfter: r.rootAfter,
    continuous: r.continuous,
  }))
  const last = links[links.length - 1]?.rootAfter ?? p.genesisRoot
  return {
    genesisRoot: p.genesisRoot,
    links,
    gaps: links.filter((l) => l.continuous === false).length,
    headMatches: p.state && last ? p.state.latestStateRoot === last : null,
  }
}

/** The transition a settlement transaction created. */
export function transitionByTx(store: IndexerStore, hash: string): TransitionEntity | null {
  const h = hash.toLowerCase()
  for (const key of store.transitionOrder) {
    const t = store.transitions[key]!
    if (t.tx === h) return t
  }
  return null
}

// ── transition detail and the checks the contract ran ───────────────────────

export type CheckState = 'pass' | 'fail' | 'unknown'

export interface TransitionCheck {
  id:
    | 'guest-ok'
    | 'root-continuity'
    | 'root-after'
    | 'census-root'
    | 'occupied-before'
    | 'blob-count'
    | 'blob-hashes'
    | 'blobs-digest'
    | 'voters'
  /** What is checked, as a plain statement. */
  label: string
  state: CheckState
  /** What was compared, in plain words (the values, or why it is not decided yet). */
  detail: string
  /** The rule as an expression, for `Formula`; never translated. */
  formula?: string
}

export interface TransitionDetail {
  transition: TransitionEntity
  row: TransitionRow
  process: ProcessEntity
  previous: TransitionEntity | null
  next: TransitionEntity | null
  tx: TxDetails | null
  publics: BatchPublics | null
  publicsError: string | null
  checks: TransitionCheck[]
}

function check(
  id: TransitionCheck['id'],
  label: string,
  ok: boolean | null,
  detail: string,
  formula?: string
): TransitionCheck {
  const state = ok == null ? 'unknown' : ok ? 'pass' : 'fail'
  return formula ? { id, label, state, detail, formula } : { id, label, state, detail }
}

/**
 * Everything about one transition, with the settlement checks recomputed from
 * public data: the ones `submitStateTransition` enforces on-chain, redone
 * here from the event, the calldata and the previous transition.
 */
export function transitionDetail(store: IndexerStore, pid: string, index: number): TransitionDetail | null {
  const tr = store.transitions[transitionKey(pid, index)]
  const p = store.processes[processKey(pid)]
  if (!tr || !p) return null
  const previous = index > 0 ? (store.transitions[transitionKey(pid, index - 1)] ?? null) : null
  const next = store.transitions[transitionKey(pid, index + 1)] ?? null
  const expectedBefore = previous ? previous.rootAfter : p.genesisRoot
  const row = transitionRow(store, tr, expectedBefore)
  const tx = tr.tx ? (store.txDetails[txKey(tr.tx)] ?? null) : null

  let publics: BatchPublics | null = null
  let publicsError: string | null = null
  if (tx?.publicValues) {
    try {
      publics = decodeBatchPublicValues(tx.publicValues)
    } catch (err) {
      publicsError = err instanceof Error ? err.message : String(err)
    }
  } else if (tx?.decodeError) {
    publicsError = tx.decodeError
  }

  const checks: TransitionCheck[] = []
  const ok = publics?.ok ? 1 : 0
  const failMask = publics?.failMask ?? 0
  checks.push(
    check(
      'guest-ok',
      t`The batch passed every check inside the proof`,
      publics ? publicsPassed(publics) : null,
      publics
        ? publicsPassed(publics)
          ? t`The proof reports that no check failed.`
          : t`The proof reports a failed check.`
        : t`Waiting for the transaction’s data.`,
      publics ? `ok = ${ok}, fail_mask = ${failMask}` : undefined
    )
  )
  const previousIndex = previous?.index ?? 0
  checks.push(
    check(
      'root-continuity',
      t`It starts where the previous batch ended`,
      expectedBefore == null
        ? null
        : expectedBefore === tr.rootBefore && (!publics || publics.rootBefore === tr.rootBefore),
      previous
        ? t`Batch #${previousIndex} ended at the state this one starts from.`
        : t`The first batch starts from the election’s starting state.`,
      previous ? `RootHashBefore = rootAfter(#${previousIndex})` : 'RootHashBefore = genesisRoot'
    )
  )
  checks.push(
    check(
      'root-after',
      t`The new state is the one that was proven`,
      publics ? publics.rootAfter === tr.rootAfter : null,
      t`The state the proof ends at, against the one the registry stored.`,
      'RootHashAfter = newStateRoot'
    )
  )
  const census = p.state?.census
  let censusOk: boolean | null = null
  if (publics && census && census.origin !== 'onchain-dynamic') {
    // An updatable census may have used a root replaced since; the ones the
    // explorer knows are the current root and every CensusUpdated root.
    const initial = p.createdTx ? store.txDetails[txKey(p.createdTx)]?.initialCensusRoot : null
    const known = [census.root, ...p.censusUpdates.map((u) => u.value.root), ...(initial ? [initial] : [])].map((r) =>
      BigInt(r)
    )
    censusOk = known.includes(publics.censusRoot)
      ? true
      : census.origin === 'merkle-dynamic' && p.censusUpdates.length > 0
        ? null
        : false
  }
  const onchainCensus = census?.origin === 'onchain-dynamic'
  checks.push(
    check(
      'census-root',
      t`The voters were checked against this election’s list`,
      censusOk,
      onchainCensus
        ? t`The explorer cannot redo this one: the registry asked the contract that keeps the list of voters when it recorded the batch.`
        : t`The list the proof used, against the one the election accepts.`,
      onchainCensus ? 'createdBlock ≤ getRootBlockNumber(CensusRoot) ≤ block' : 'CensusRoot = census.censusRoot'
    )
  )
  const occupiedExpected = previous ? previous.votersCount : 0
  const occupiedBefore = publics?.occupiedBefore ?? '…'
  checks.push(
    check(
      'occupied-before',
      t`The number of earlier voters matches the registry`,
      publics ? publics.occupiedBefore === occupiedExpected : null,
      t`Voters before this batch, as the proof and the registry count them.`,
      `OccupiedBefore = ${occupiedBefore}, votersCount = ${occupiedExpected}`
    )
  )
  const newVoters = tr.newVoters
  const overwrites = tr.overwrites
  checks.push(
    check(
      'voters',
      t`The vote counts match what the registry recorded`,
      publics ? publics.voters - publics.overwrites === newVoters && publics.overwrites === overwrites : null,
      t`${plural(newVoters, { one: '# new voter', other: '# new voters' })}, ${plural(overwrites, {
        one: '# changed vote',
        other: '# changed votes',
      })}.`,
      'VotersCount − OverwrittenVotesCount = newVoters'
    )
  )
  // Null when the RPC left the field out: nothing to compare, not a mismatch.
  const hashes = tx?.blobVersionedHashes ?? null
  const nBlobs = tr.nBlobs
  checks.push(
    check(
      'blob-count',
      t`The transaction carries every data blob the proof counts`,
      hashes ? hashes.length === nBlobs && (!publics || publics.nBlobs === nBlobs) : null,
      t`${plural(nBlobs, { one: '# data blob', other: '# data blobs' })}.`,
      'NBlobs = nBlobs = count(blobVersionedHashes)'
    )
  )
  checks.push(
    check(
      'blob-hashes',
      t`The published data is the data this transaction carries`,
      tx && hashes && tx.commitments.length > 0
        ? tx.commitments.length === hashes.length && tx.commitments.every((c, i) => versionedHash(c) === hashes[i])
        : null,
      t`The fingerprint of each data blob in the call, against the ones the transaction carries.`,
      'versionedHash = 0x01 ‖ sha256(commitment)[1..]'
    )
  )
  checks.push(
    check(
      'blobs-digest',
      t`The proof covers exactly this published data`,
      tx && publics && tx.commitments.length > 0 ? blobsDigest(tx.commitments, tx.ys) === publics.blobsDigest : null,
      t`One fingerprint over all the published data, recomputed here, against the one in the proof.`,
      'sha256(commitment₀ ‖ y₀ ‖ commitment₁ ‖ y₁ ‖ …) = BlobsDigest'
    )
  )

  return { transition: tr, row, process: p, previous, next, tx, publics, publicsError, checks }
}

// ── network ──────────────────────────────────────────────────────────────────

export interface NetworkStats {
  processes: number
  byStatus: Record<ProcessStatusName | 'unknown', number>
  byPhase: Record<ProcessPhase, number>
  byKeyMode: Record<KeyModeName, number>
  byCensusOrigin: Record<CensusOriginName, number>
  organizers: number
  /** Distinct voters across processes. */
  voters: number
  overwrites: number
  /** Ballots settled: voters plus overwrites. */
  ballots: number
  transitions: number
  blobs: number
  withResults: number
  lastActivity: { block: number; timestamp: number | null } | null
}

export function networkStats(store: IndexerStore): NetworkStats {
  const byStatus: NetworkStats['byStatus'] = { ready: 0, ended: 0, canceled: 0, paused: 0, results: 0, unknown: 0 }
  const byPhase: NetworkStats['byPhase'] = {
    loading: 0,
    upcoming: 0,
    open: 0,
    paused: 0,
    closed: 0,
    ended: 0,
    canceled: 0,
    results: 0,
  }
  const byKeyMode: NetworkStats['byKeyMode'] = { sequencer: 0, 'dkg-automatic': 0, 'dkg-locked': 0 }
  const byCensusOrigin: NetworkStats['byCensusOrigin'] = {
    unknown: 0,
    'merkle-static': 0,
    'merkle-dynamic': 0,
    'onchain-dynamic': 0,
    csp: 0,
  }
  const organizers = new Set<string>()
  let voters = 0
  let overwrites = 0
  let withResults = 0
  for (const key of store.processOrder) {
    const row = processRow(store, store.processes[key]!)
    byStatus[row.status ?? 'unknown'] += 1
    byPhase[row.phase] += 1
    if (row.keyMode) byKeyMode[row.keyMode] += 1
    if (row.censusOrigin) byCensusOrigin[row.censusOrigin] += 1
    organizers.add(row.organizer)
    voters += row.votersCount
    overwrites += row.overwrittenVotesCount
    if (row.hasResults) withResults += 1
  }
  let blobs = 0
  for (const key of store.transitionOrder) blobs += store.transitions[key]!.nBlobs
  const last = store.events[store.events.length - 1]
  return {
    processes: store.processOrder.length,
    byStatus,
    byPhase,
    byKeyMode,
    byCensusOrigin,
    organizers: organizers.size,
    voters,
    overwrites,
    ballots: voters + overwrites,
    transitions: store.transitionOrder.length,
    blobs,
    withResults,
    lastActivity: last ? { block: last.block, timestamp: last.timestamp ?? blockTimestamp(store, last.block) } : null,
  }
}

// ── activity ─────────────────────────────────────────────────────────────────

export type FeedKind =
  'created' | 'transition' | 'results' | 'status' | 'decryption' | 'census' | 'metadata' | 'duration' | 'max-voters'

export interface FeedEntry {
  key: string
  kind: FeedKind
  processId: Hex
  block: number
  tx: Hex | null
  timestamp: number | null
  /** One plain line: "Batch #3: 12 votes in 1 data blob". */
  label: string
  href: string
}

/** Null for an event the feed leaves out: the metadata set by the creation, which "created" already says. */
function feedEntry(store: IndexerStore, ev: IndexedEvent): FeedEntry | null {
  const base = {
    key: `${ev.block}:${ev.logIndex}`,
    processId: ev.processId,
    block: ev.block,
    tx: ev.tx,
    timestamp: ev.timestamp ?? blockTimestamp(store, ev.block),
    href: paths.process(ev.processId),
  }
  switch (ev.name) {
    case 'ProcessCreated':
      return { ...base, kind: 'created', label: t`Process created` }
    case 'ProcessStateTransitioned': {
      const tr = transitionByTx(store, ev.tx ?? '') ?? null
      const index = tr?.index ?? '?'
      const votes = tr ? tr.newVoters + tr.overwrites : 0
      const nBlobs = ev.data.nBlobs
      return {
        ...base,
        kind: 'transition',
        label: tr
          ? t`Batch #${index}: ${plural(votes, { one: '# vote', other: '# votes' })} in ${plural(nBlobs, {
              one: '# data blob',
              other: '# data blobs',
            })}`
          : t`Batch #${index} in ${plural(nBlobs, { one: '# data blob', other: '# data blobs' })}`,
        href: tr ? paths.transition(ev.processId, tr.index) : base.href,
      }
    }
    case 'ProcessResultsSet':
      return { ...base, kind: 'results', label: t`Results published`, href: paths.process(ev.processId, 'results') }
    case 'ProcessStatusChanged': {
      const from = PROCESS_STATUS_INFO[ev.data.oldStatus].label
      const to = PROCESS_STATUS_INFO[ev.data.newStatus].label
      return { ...base, kind: 'status', label: t`Status changed from ${from} to ${to}` }
    }
    case 'ResultsDecryptionRequested': {
      const count = ev.data.count
      return {
        ...base,
        kind: 'decryption',
        label:
          count === 0
            ? t`Results requested with nothing to decrypt: no ballot was counted`
            : t`Encrypted total sent to the key committee to decrypt (${plural(count, { one: '# field', other: '# fields' })})`,
        href: paths.process(ev.processId, 'results'),
      }
    }
    case 'CensusUpdated':
      return { ...base, kind: 'census', label: t`List of voters replaced` }
    case 'ProcessMetadataUpdated': {
      const created = store.processes[processKey(ev.processId)]?.createdTx
      if (ev.tx != null && ev.tx === created) return null
      return { ...base, kind: 'metadata', label: t`New description published` }
    }
    case 'ProcessDurationChanged':
      return { ...base, kind: 'duration', label: t`End time changed` }
    case 'ProcessMaxVotersChanged': {
      const maxVoters = formatNumber(ev.data.maxVoters)
      return { ...base, kind: 'max-voters', label: t`Voter limit set to ${maxVoters}` }
    }
  }
}

/** The newest `limit` events as feed entries, newest first. Pass a pid for one process. */
export function activityFeed(store: IndexerStore, limit = 20, pid?: string): FeedEntry[] {
  const out: FeedEntry[] = []
  const events = pid ? (store.processes[processKey(pid)]?.events ?? []).map((i) => store.events[i]!) : store.events
  for (let i = events.length - 1; i >= 0 && out.length < limit; i--) {
    const entry = feedEntry(store, events[i]!)
    if (entry) out.push(entry)
  }
  return out
}

export interface DayBucket {
  /** YYYY-MM-DD (UTC). */
  day: string
  ballots: number
  newVoters: number
  overwrites: number
  transitions: number
}

/** Settled votes per UTC day over the last `days` days (oldest first), up to the chain's now. */
export function votesPerDay(store: IndexerStore, days = 30): DayBucket[] {
  const now = chainNow(store)
  if (now == null) return []
  const dayOf = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10)
  const buckets = new Map<string, DayBucket>()
  const end = Math.floor(now / 86400)
  for (let d = end - days + 1; d <= end; d++) {
    const day = dayOf(d * 86400)
    buckets.set(day, { day, ballots: 0, newVoters: 0, overwrites: 0, transitions: 0 })
  }
  for (const key of store.transitionOrder) {
    const t = store.transitions[key]!
    const ts = t.timestamp ?? blockTimestamp(store, t.block)
    if (ts == null) continue
    const b = buckets.get(dayOf(ts))
    if (!b) continue
    b.newVoters += t.newVoters
    b.overwrites += t.overwrites
    b.ballots += t.newVoters + t.overwrites
    b.transitions += 1
  }
  return [...buckets.values()]
}

// ── contracts ────────────────────────────────────────────────────────────────

/** The deployment's pins as far as they are known, for `matchRelease`. */
export function deploymentPins(store: IndexerStore): DeploymentPins {
  const r = store.chain.registry
  return {
    batchProgramVK: r?.batchProgramVK ?? null,
    resultsProgramVK: r?.resultsProgramVK ?? null,
    rootCVadcopFinal: r?.rootCVadcopFinal ?? null,
    ballotVKHash: r?.ballotVKHash ?? null,
    ziskVerifierCodeHash: r?.ziskVerifierCodeHash ?? null,
  }
}

export function releaseCheck(store: IndexerStore): ReleaseMatch {
  return matchRelease(deploymentPins(store))
}

/** Every root the registry has held for a process: genesis and each root after. */
export function onchainRoots(store: IndexerStore, pid: string): Set<Hex> {
  const p = store.processes[processKey(pid)]
  const out = new Set<Hex>()
  if (!p) return out
  if (p.genesisRoot) out.add(p.genesisRoot)
  for (const key of p.transitions) out.add(store.transitions[key]!.rootAfter)
  if (p.state) out.add(p.state.latestStateRoot)
  return out
}

// ── search ───────────────────────────────────────────────────────────────────

export interface SearchHit {
  kind: 'process' | 'transition' | 'organizer' | 'sequencer' | 'contract' | 'vote' | 'block'
  label: string
  href: string
}

/**
 * What the store knows about a query: a process id, a settlement or creation
 * transaction, an organizer, sequencer or contract address, a vote id, or a
 * block with a transition. Shape-only routing (and the block-explorer fallback) is the
 * shell's `resolveSearch`; this runs first.
 */
export function searchStore(store: IndexerStore, raw: string, limit = 8): SearchHit[] {
  const q = raw.trim().toLowerCase()
  if (!q) return []
  const hits: SearchHit[] = []
  const push = (h: SearchHit) => {
    if (hits.length < limit && !hits.some((x) => x.href === h.href)) hits.push(h)
  }

  if (isProcessId(q) && store.processes[q]) {
    const pid = q
    push({ kind: 'process', label: t`Process ${pid}`, href: paths.process(pid) })
  }

  if (/^0x[0-9a-f]{64}$/.test(q)) {
    const tr = transitionByTx(store, q)
    if (tr) {
      const index = tr.index
      push({ kind: 'transition', label: t`Batch #${index}`, href: paths.transition(tr.processId, index) })
    }
    for (const key of store.processOrder) {
      const p = store.processes[key]!
      if (p.createdTx === q) push({ kind: 'process', label: t`Process creation`, href: paths.process(p.id) })
      if (p.results?.tx === q) push({ kind: 'process', label: t`Results`, href: paths.process(p.id, 'results') })
    }
  }

  if (/^0x[0-9a-f]{40}$/.test(q)) {
    const chain = store.chain
    const contracts = [chain.registryAddress, chain.registry?.ziskVerifier, chain.registry?.dkgAdapter].filter(Boolean)
    if (contracts.includes(q as Address)) push({ kind: 'contract', label: t`Contract`, href: paths.contracts() })
    const owned = store.processOrder.filter((k) => store.processes[k]!.organizer === q).length
    if (owned > 0) {
      push({
        kind: 'organizer',
        label: t`Organizer of ${plural(owned, { one: '# process', other: '# processes' })}`,
        href: paths.processes({ organizer: q }),
      })
    }
    // An account that settled a batch or published results is a sequencer, whoever it is.
    const settled = store.transitionOrder.filter((k) => store.transitions[k]!.sender.toLowerCase() === q).length
    const published = store.processOrder.some((k) => store.processes[k]!.results?.sender.toLowerCase() === q)
    if (settled > 0 || published) {
      push({
        kind: 'sequencer',
        label:
          settled > 0
            ? t`Sequencer that recorded ${plural(settled, { one: '# batch', other: '# batches' })}`
            : t`Sequencer that published results`,
        href: paths.sequencer(q),
      })
    }
  }

  const voteId = parseVoteId(q)
  if (voteId != null && (q.startsWith('0x') || q.length >= 19)) {
    push({ kind: 'vote', label: t`Vote id`, href: paths.votes({ voteId: q }) })
  }

  if (/^\d+$/.test(q) && q.length < 12) {
    const block = Number(q)
    for (const key of store.transitionOrder) {
      const tr = store.transitions[key]!
      const index = tr.index
      if (tr.block === block)
        push({
          kind: 'block',
          label: t`Batch #${index} in block ${block}`,
          href: paths.transition(tr.processId, index),
        })
    }
  }

  // A prefix of a process id.
  if (/^0x[0-9a-f]{6,61}$/.test(q)) {
    for (const pid of store.processOrder) {
      if (pid.startsWith(q)) push({ kind: 'process', label: t`Process ${pid}`, href: paths.process(pid) })
    }
  }
  return hits
}

// ── sequencers ───────────────────────────────────────────────────────────────

/** A block and its time (exact, or estimated from the head). */
export interface BlockTime {
  block: number
  timestamp: number | null
}

/** One account that settled transitions or published results, from the registry events. */
export interface SequencerRow {
  address: Address
  /** State transitions it settled. */
  transitions: number
  /** Ballots in them: new votes plus overwrites. */
  ballots: number
  newVoters: number
  overwrites: number
  /** Distinct processes it settled a transition or published results for. */
  processes: number
  /** EIP-4844 blobs its transitions carried. */
  blobs: number
  /** `ProcessResultsSet` events it sent. */
  results: number
  /**
   * What its settlement and results transactions paid, in wei (execution plus
   * blob gas), over the receipts read so far. Reverted transactions (a lost
   * race) leave no registry event and are not in it.
   */
  fees: bigint
  /** Its transactions whose receipt is not read yet; `fees` is a lower bound until this is 0. */
  feesPending: number
  first: BlockTime
  last: BlockTime
}

interface SequencerAcc extends SequencerRow {
  pids: Set<string>
  txs: Set<string>
}

function sequencerAcc(address: Address): SequencerAcc {
  return {
    address,
    transitions: 0,
    ballots: 0,
    newVoters: 0,
    overwrites: 0,
    processes: 0,
    blobs: 0,
    results: 0,
    fees: 0n,
    feesPending: 0,
    first: { block: Number.MAX_SAFE_INTEGER, timestamp: null },
    last: { block: -1, timestamp: null },
    pids: new Set(),
    txs: new Set(),
  }
}

function touch(store: IndexerStore, acc: SequencerAcc, block: number, timestamp: number | null) {
  const at = { block, timestamp: timestamp ?? blockTimestamp(store, block) }
  if (block < acc.first.block) acc.first = at
  if (block >= acc.last.block) acc.last = at
}

/**
 * Every account that settled a transition or published results, busiest
 * first (transitions, then results, then the latest activity). Anyone may
 * settle: an account here is a sequencer because the registry accepted its
 * proofs, not because it is listed anywhere.
 */
export function sequencerRows(store: IndexerStore): SequencerRow[] {
  const by = new Map<string, SequencerAcc>()
  const acc = (sender: Address) => {
    const address = sender.toLowerCase() as Address
    let a = by.get(address)
    if (!a) by.set(address, (a = sequencerAcc(address)))
    return a
  }
  for (const key of store.transitionOrder) {
    const t = store.transitions[key]
    if (!t) continue
    const a = acc(t.sender)
    a.transitions += 1
    a.newVoters += t.newVoters
    a.overwrites += t.overwrites
    a.ballots += t.newVoters + t.overwrites
    a.blobs += t.nBlobs
    a.pids.add(t.processId.toLowerCase())
    if (t.tx) a.txs.add(txKey(t.tx))
    touch(store, a, t.block, t.timestamp)
  }
  for (const key of store.processOrder) {
    const r = store.processes[key]?.results
    if (!r) continue
    const a = acc(r.sender)
    a.results += 1
    a.pids.add(key)
    if (r.tx) a.txs.add(txKey(r.tx))
    touch(store, a, r.block, r.timestamp)
  }
  return [...by.values()]
    .map(({ pids, txs, ...row }) => {
      let fees = 0n
      let feesPending = 0
      for (const tx of txs) {
        const d = store.txDetails[tx]
        if (d) fees += d.fee
        else feesPending += 1
      }
      return { ...row, processes: pids.size, fees, feesPending }
    })
    .sort((a, b) => b.transitions - a.transitions || b.results - a.results || b.last.block - a.last.block)
}

/** One account's row; null when it never settled a transition nor published results. */
export function sequencerRow(store: IndexerStore, address: string): SequencerRow | null {
  const a = address.toLowerCase()
  return sequencerRows(store).find((r) => r.address === a) ?? null
}

export interface SequencerDay {
  /** YYYY-MM-DD (UTC). */
  day: string
  transitions: number
  ballots: number
  newVoters: number
  overwrites: number
  blobs: number
  results: number
}

/** One account's work per UTC day over the last `days` days (oldest first), up to the chain's now. */
export function sequencerActivity(store: IndexerStore, address: string, days = 30): SequencerDay[] {
  const now = chainNow(store)
  if (now == null) return []
  const a = address.toLowerCase()
  const dayOf = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10)
  const buckets = new Map<string, SequencerDay>()
  const end = Math.floor(now / 86400)
  for (let d = end - days + 1; d <= end; d++) {
    const day = dayOf(d * 86400)
    buckets.set(day, { day, transitions: 0, ballots: 0, newVoters: 0, overwrites: 0, blobs: 0, results: 0 })
  }
  const bucket = (block: number, timestamp: number | null) => {
    const ts = timestamp ?? blockTimestamp(store, block)
    return ts == null ? undefined : buckets.get(dayOf(ts))
  }
  for (const key of store.transitionOrder) {
    const t = store.transitions[key]!
    if (t.sender.toLowerCase() !== a) continue
    const b = bucket(t.block, t.timestamp)
    if (!b) continue
    b.transitions += 1
    b.newVoters += t.newVoters
    b.overwrites += t.overwrites
    b.ballots += t.newVoters + t.overwrites
    b.blobs += t.nBlobs
  }
  for (const key of store.processOrder) {
    const r = store.processes[key]!.results
    if (!r || r.sender.toLowerCase() !== a) continue
    const b = bucket(r.block, r.timestamp)
    if (b) b.results += 1
  }
  return [...buckets.values()]
}

/** The transitions one account settled, newest first. */
export function sequencerTransitions(store: IndexerStore, address: string): TransitionRow[] {
  const a = address.toLowerCase()
  const out: TransitionRow[] = []
  for (let i = store.transitionOrder.length - 1; i >= 0; i--) {
    const t = store.transitions[store.transitionOrder[i]!]!
    if (t.sender.toLowerCase() !== a) continue
    const before =
      t.index === 0
        ? (store.processes[processKey(t.processId)]?.genesisRoot ?? null)
        : (store.transitions[transitionKey(t.processId, t.index - 1)]?.rootAfter ?? null)
    out.push(transitionRow(store, t, before))
  }
  return out
}

export interface SequencerResult {
  processId: Hex
  block: number
  tx: Hex | null
  timestamp: number | null
  /** Null until the receipt is read. */
  fee: bigint | null
}

/** The results one account published, newest first. */
export function sequencerResults(store: IndexerStore, address: string): SequencerResult[] {
  const a = address.toLowerCase()
  const out: SequencerResult[] = []
  for (const key of store.processOrder) {
    const p = store.processes[key]!
    const r = p.results
    if (!r || r.sender.toLowerCase() !== a) continue
    out.push({
      processId: p.id,
      block: r.block,
      tx: r.tx,
      timestamp: r.timestamp ?? blockTimestamp(store, r.block),
      fee: r.tx ? (store.txDetails[txKey(r.tx)]?.fee ?? null) : null,
    })
  }
  return out.sort((x, y) => y.block - x.block)
}
