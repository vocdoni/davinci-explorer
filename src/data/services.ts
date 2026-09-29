// On-demand reads that do not belong in the indexed store: blob bytes (large,
// fetched per transition), sequencer node APIs, DKG application state and
// metadata documents. The live implementation talks to the beacon API, the
// configured sequencers and the chain; the demo one serves the fixture.

import { i18n, type MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import type { Address, PublicClient } from 'viem'
import { dkgAppManagerAbi, dkgManagerAbi } from '~contracts/abis'
import type { Point } from '~protocol/babyjubjub'
import { BeaconClient, BlobFetchError, type FetchedBlob } from '~protocol/beacon'
import type { Hex } from '~protocol/bytes'
import { browsableUri } from '~protocol/metadata'
import { SequencerClient } from '~protocol/sequencer-api'
import { isRangeError, MIN_CHUNK } from '~indexer/scan'
import type { ProcessEntity, RegistryInfo } from '~indexer/types'
import type { RuntimeConfig } from '~config/runtime-config'

/** The sequencer API surface the explorer uses; the demo implements it too. */
export type SequencerApi = Pick<
  SequencerClient,
  'ping' | 'info' | 'processes' | 'process' | 'transitions' | 'transitionBlobs' | 'voteStatus' | 'trackerProof'
>

export interface SequencerEndpoint {
  index: number
  /** URL the browser calls (may be a same-origin proxy path). */
  url: string
  /** The node's own URL, for display. */
  upstream: string
  api: SequencerApi
}

export interface BlobRequest {
  processId: Hex
  /** 0-based transition index. */
  index: number
  /** Unix seconds of the settlement block. */
  timestamp: number | null
  /** The settlement transaction's `blobVersionedHashes`, in order. */
  versionedHashes: Hex[]
}

export interface BlobAttempt {
  source: 'beacon' | 'sequencer'
  url: string
  error: string
}

export interface TransitionBlobs {
  blobs: FetchedBlob[]
  source: 'beacon' | 'sequencer' | 'demo'
  sourceUrl: string
  /** Sources tried before the one that answered. */
  attempts: BlobAttempt[]
}

export interface DkgCiphertextView {
  /** DKG ciphertext index. */
  index: number
  /** Ballot field this ciphertext carries. */
  field: number
  completed: boolean
  plaintext: bigint
}

export interface DkgReveal {
  block: number
  tx: Hex | null
  /** Unix seconds; null when the block could not be read. */
  timestamp: number | null
}

export interface DkgApplicationView {
  manager: Address
  appManager: Address
  epochId: Hex
  aid: Hex
  creator: Address
  poolIndex: number
  poolKey: Point | null
  /** PK_org in the DKG's reduced form; the identity (0, 1) when automatic. */
  organizerPK: Point
  /** Revealed organizer secret; 0 while sealed and always for automatic. */
  organizerSecret: bigint
  revealed: boolean
  /**
   * When the organizer revealed its secret (the `OrganizerSecretRevealed`
   * log); null while sealed, for an automatic key, or when no RPC returned it.
   */
  reveal: DkgReveal | null
  /** Key the ballots are encrypted to, in the DKG's reduced form. */
  applicationKey: Point
  createdAtBlock: number
  /** The decryption requests of the tally, when requested. */
  ciphertexts: DkgCiphertextView[]
}

export interface ExplorerServices {
  kind: 'live' | 'demo'
  sequencers: SequencerEndpoint[]
  /** The blobs of a transition: the beacon first, then each sequencer. */
  fetchTransitionBlobs(request: BlobRequest, signal?: AbortSignal): Promise<TransitionBlobs>
  /** DKG application state of a DKG-mode process; null in sequencer mode. */
  readDkgApplication(
    process: ProcessEntity,
    registry: RegistryInfo | null,
    signal?: AbortSignal
  ): Promise<DkgApplicationView | null>
  /** The bytes a URI serves, as they are (a process's metadata document); `ipfs://` through a public gateway. */
  fetchBytes(url: string, signal?: AbortSignal): Promise<Uint8Array>
}

/**
 * A failure the pages show as its message. Give it a `msg` descriptor when
 * the text is for people: the message then translates on every read, so a
 * cached error follows a language switch. A plain string (a URL and an HTTP
 * status, a node's own answer) is shown as it is.
 */
export class ServiceError extends Error {
  constructor(message: string | MessageDescriptor) {
    super(typeof message === 'string' ? message : (message.message ?? message.id))
    if (typeof message !== 'string') {
      Object.defineProperty(this, 'message', { configurable: true, get: () => i18n._(message) })
    }
  }
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))

export function createLiveServices(config: RuntimeConfig, client: PublicClient | null): ExplorerServices {
  const beacon = config.beaconUrl ? new BeaconClient(config.beaconUrl) : null
  const sequencers: SequencerEndpoint[] = config.sequencers.map((s, index) => ({
    index,
    url: s.url,
    upstream: s.upstream ?? s.url,
    api: new SequencerClient(s.url),
  }))
  // A reveal never changes once found: search the logs for it once per session, not on every refetch.
  const reveals = new Map<string, DkgReveal>()
  const revealOf = async (appManager: Address, epochId: Hex, aid: Hex, fromBlock: number) => {
    const key = `${appManager}:${epochId}:${aid}`.toLowerCase()
    const known = reveals.get(key)
    if (known || !client) return known ?? null
    // A failed search leaves the time of the reveal unknown, not the application.
    const found = await findReveal(client, appManager, epochId, aid, fromBlock).catch(() => null)
    if (found?.timestamp != null) reveals.set(key, found)
    return found
  }

  return {
    kind: 'live',
    sequencers,

    async fetchTransitionBlobs(request, signal) {
      const attempts: BlobAttempt[] = []
      if (beacon && request.timestamp != null && request.versionedHashes.length > 0) {
        try {
          const blobs = await beacon.fetchBlobs(
            { timestamp: request.timestamp, versionedHashes: request.versionedHashes },
            signal
          )
          return { blobs, source: 'beacon', sourceUrl: beacon.baseUrl, attempts }
        } catch (err) {
          attempts.push({ source: 'beacon', url: beacon.baseUrl, error: errorText(err) })
        }
      }
      for (const s of sequencers) {
        try {
          const data = await s.api.transitionBlobs(request.processId, request.index, signal)
          if (data.length !== request.versionedHashes.length && request.versionedHashes.length > 0) {
            throw new BlobFetchError(`${data.length} blobs, the transaction carries ${request.versionedHashes.length}`)
          }
          const blobs: FetchedBlob[] = data.map((bytes, i) => ({
            index: i,
            versionedHash: request.versionedHashes[i] ?? ('0x' as Hex),
            commitment: null,
            data: bytes,
            binding: 'sequencer',
            source: s.upstream,
          }))
          return { blobs, source: 'sequencer', sourceUrl: s.upstream, attempts }
        } catch (err) {
          attempts.push({ source: 'sequencer', url: s.upstream, error: errorText(err) })
        }
      }
      if (!beacon && sequencers.length === 0) throw new ServiceError(msg`No beacon API or sequencer is configured`)
      if (attempts.length === 0) throw new ServiceError(msg`No blob source`)
      throw new ServiceError(attempts.map((a) => `${a.source} ${a.url}: ${a.error}`).join('; '))
    },

    async readDkgApplication(process, registry) {
      const dkg = process.state?.dkg
      if (!dkg || !client) return null
      if (!registry?.dkgManager || !registry.dkgAppManager)
        throw new ServiceError(msg`The registry has no key committee adapter`)
      const manager = registry.dkgManager
      const appManager = registry.dkgAppManager
      const epochId = dkg.epochId
      const aid = dkg.aid
      const [app, key] = await Promise.all([
        client.readContract({
          address: appManager,
          abi: dkgAppManagerAbi,
          functionName: 'getApplication',
          args: [epochId, aid],
        }),
        client.readContract({
          address: appManager,
          abi: dkgAppManagerAbi,
          functionName: 'getApplicationKey',
          args: [epochId, aid],
        }),
      ])
      let poolKey: Point | null = null
      try {
        const [x, y] = await client.readContract({
          address: manager,
          abi: dkgManagerAbi,
          functionName: 'getPoolKey',
          args: [epochId, app.poolIndex],
        })
        poolKey = { x, y }
      } catch {
        poolKey = null
      }
      const ciphertexts: DkgCiphertextView[] = []
      if (dkg.resultsRequested && dkg.count > 0) {
        const zeroSkipped = dkg.zeroSkipped
        if (zeroSkipped == null) throw new ServiceError(msg`The skipped ballot fields are not known yet`)
        const fields = Array.from({ length: process.state!.ballotMode.numFields }, (_, i) => i).filter(
          (i) => ((zeroSkipped >> i) & 1) === 0
        )
        const records = await Promise.all(
          fields.slice(0, dkg.count).map((_, j) =>
            client.readContract({
              address: manager,
              abi: dkgManagerAbi,
              functionName: 'getCombinedDecryption',
              args: [epochId, aid, dkg.firstIndex + j],
            })
          )
        )
        records.forEach((r, j) =>
          ciphertexts.push({
            index: dkg.firstIndex + j,
            field: fields[j]!,
            completed: r.completed,
            plaintext: r.plaintext,
          })
        )
      }
      return {
        manager,
        appManager,
        epochId,
        aid,
        creator: app.creator.toLowerCase() as Address,
        poolIndex: app.poolIndex,
        poolKey,
        organizerPK: { x: app.organizerPK.x, y: app.organizerPK.y },
        organizerSecret: app.organizerSecret,
        revealed: app.organizerSecret !== 0n,
        reveal:
          app.organizerSecret !== 0n ? await revealOf(appManager, epochId, aid, Number(app.createdAtBlock)) : null,
        applicationKey: { x: key[0], y: key[1] },
        createdAtBlock: Number(app.createdAtBlock),
        ciphertexts,
      }
    },

    async fetchBytes(url, signal) {
      // No Accept header: the bytes must be the ones anyone else gets from the URI.
      const res = await fetch(resolveUri(url), { signal })
      if (!res.ok) throw new ServiceError(`${url}: HTTP ${res.status}`)
      return readCapped(res, MAX_DOCUMENT_BYTES, url)
    },
  }
}

/** getLogs windows that fit public RPCs (publicnode takes 50,000 blocks). */
const REVEAL_CHUNK = 50_000
/** Windows tried before giving up on finding the reveal: about 70 days of Gnosis Chain. */
const REVEAL_MAX_REQUESTS = 24

/**
 * The organizer's `OrganizerSecretRevealed` log for an application, searched
 * forward from the block the application was registered in.
 */
export async function findReveal(
  client: PublicClient,
  appManager: Address,
  epochId: Hex,
  aid: Hex,
  fromBlock: number
): Promise<DkgReveal | null> {
  const event = dkgAppManagerAbi.find((item) => item.type === 'event' && item.name === 'OrganizerSecretRevealed')
  if (!event || event.type !== 'event') return null
  const head = Number(await client.getBlockNumber())
  let span = REVEAL_CHUNK
  let from = fromBlock
  for (let requests = 0; from <= head && requests < REVEAL_MAX_REQUESTS; requests++) {
    const to = Math.min(head, from + span - 1)
    let logs
    try {
      logs = await client.getLogs({
        address: appManager,
        event,
        args: { epochId, aid },
        fromBlock: BigInt(from),
        toBlock: BigInt(to),
      })
    } catch (err) {
      if (!isRangeError(err) || span <= MIN_CHUNK) throw err
      span = Math.floor(span / 2)
      continue
    }
    const log = logs[0]
    if (log?.blockNumber != null) {
      const block = Number(log.blockNumber)
      const timestamp = await client
        .getBlock({ blockNumber: log.blockNumber })
        .then((b) => Number(b.timestamp))
        .catch(() => null)
      return { block, tx: log.transactionHash ?? null, timestamp }
    }
    from = to + 1
  }
  return null
}

/**
 * The most a metadata document may weigh. Every processes-list row downloads
 * and hashes one, so an organizer serving something huge must not hang the
 * page; a real document is a few kilobytes.
 */
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024

/** A response body, stopping (and failing) as soon as it passes `max` bytes. */
export async function readCapped(res: Response, max: number, url: string): Promise<Uint8Array> {
  const tooLarge = () => new ServiceError(`${url}: more than ${max} bytes`)
  if (Number(res.headers.get('content-length') ?? 0) > max) throw tooLarge()
  if (!res.body) {
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.length > max) throw tooLarge()
    return bytes
  }
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > max) {
      await reader.cancel()
      throw tooLarge()
    }
    chunks.push(value)
  }
  const out = new Uint8Array(size)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}

/** ipfs:// URIs through a public gateway; everything else unchanged. */
export function resolveUri(uri: string): string {
  return browsableUri(uri) ?? uri
}
