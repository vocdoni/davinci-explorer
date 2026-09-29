// @vitest-environment node
// Opt-in: indexes the deployment in public/config.json over its public RPCs
// and checks every transition the way the transition page does.
//   EXPLORER_LIVE=1 pnpm test src/indexer/live.test.ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseRuntimeConfig } from '~config/runtime-config'
import { createChainClient } from '~data/client'
import { Indexer } from './indexer'
import { readServedDocument, fetchableUri } from '~protocol/metadata'
import { resolveUri } from '~data/services'
import { releaseCheck, rootChain, transitionDetail } from './selectors'

const live = process.env.EXPLORER_LIVE === '1'

describe.runIf(live)('live deployment', () => {
  it('indexes the registry and every transition passes its checks', async () => {
    const file = parseRuntimeConfig(JSON.parse(readFileSync(resolve(__dirname, '../../public/config.json'), 'utf8')))
    const config = { ...file, demo: false }
    const ix = new Indexer({
      client: createChainClient(config),
      chainId: config.chainId,
      registryAddress: config.registryAddress,
      startBlock: config.startBlock,
      kv: null,
      txPerTick: 500,
      blocksPerTick: 500,
    })
    await ix.refresh()
    await ix.refresh()
    const { store, status } = ix.getSnapshot()
    expect(status.chainMismatch).toBeNull()
    expect(status.errors).toEqual([])
    console.log(
      `${store.processOrder.length} processes, ${store.transitionOrder.length} transitions, head ${store.chain.headBlock}`
    )
    console.log('release', releaseCheck(store).release?.label ?? 'none')
    expect(store.processOrder.length).toBeGreaterThan(0)
    for (const pid of store.processOrder) {
      const p = store.processes[pid]!
      expect(p.state, pid).not.toBeNull()
      expect(rootChain(store, pid).gaps, pid).toBe(0)
      // The metadata log ends at the version getProcess returns.
      const last = p.metadataHistory[p.metadataHistory.length - 1]
      expect([last?.uri, last?.hash], pid).toEqual([p.state!.metadataURI, p.state!.metadataHash])
      // The documents are the organizers' and may move, so their check is reported, not asserted.
      const url = fetchableUri(p.state!.metadataURI)
      let verdict = 'not fetchable'
      if (url) {
        try {
          const res = await fetch(resolveUri(url))
          const served = readServedDocument(new Uint8Array(await res.arrayBuffer()))
          verdict = !res.ok ? `HTTP ${res.status}` : served.hash === p.state!.metadataHash ? 'matches' : 'differs'
        } catch (err) {
          verdict = `unreachable: ${err instanceof Error ? err.message : String(err)}`
        }
      }
      console.log(pid, `metadata v${p.metadataHistory.length}`, verdict)
    }
    for (const key of store.transitionOrder) {
      const t = store.transitions[key]!
      const d = transitionDetail(store, t.processId, t.index)!
      const failed = d.checks.filter((c) => c.state === 'fail').map((c) => c.id)
      const unknown = d.checks.filter((c) => c.state === 'unknown').map((c) => c.id)
      expect(failed, key).toEqual([])
      if (unknown.length) console.log(key, 'unknown:', unknown.join(', '))
    }
  }, 300_000)
})
