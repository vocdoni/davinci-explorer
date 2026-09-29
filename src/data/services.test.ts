// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { PublicClient } from 'viem'
import { findReveal, readCapped } from './services'

const body = (n: number, chunk = 1024) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (let sent = 0; sent < n; sent += chunk) controller.enqueue(new Uint8Array(Math.min(chunk, n - sent)).fill(7))
      controller.close()
    },
  })

describe('readCapped', () => {
  it('reads a body up to the limit, byte for byte', async () => {
    const bytes = await readCapped(new Response(body(3000)), 3000, 'https://x.org/a.json')
    expect(bytes).toHaveLength(3000)
    expect(bytes.every((b) => b === 7)).toBe(true)
  })

  it('stops at the first byte past the limit, or at a larger declared length', async () => {
    await expect(readCapped(new Response(body(3001)), 3000, 'https://x.org/a.json')).rejects.toThrow(
      'https://x.org/a.json: more than 3000 bytes'
    )
    const declared = new Response('{}', { headers: { 'content-length': '5000' } })
    await expect(readCapped(declared, 3000, 'https://x.org/a.json')).rejects.toThrow(/more than 3000 bytes/)
  })
})

describe('findReveal', () => {
  const epochId = `0x${'aa'.repeat(12)}` as const
  const aid = `0x${'bb'.repeat(32)}` as const
  const appManager = `0x${'cc'.repeat(20)}` as const

  /** A chain whose RPC takes at most `maxRange` blocks per getLogs and holds one reveal at `at`. */
  function chain(at: number | null, maxRange: number) {
    const ranges: Array<[number, number]> = []
    const client = {
      getBlockNumber: async () => 300_000n,
      getBlock: async ({ blockNumber }: { blockNumber: bigint }) => ({ timestamp: 1_000n + blockNumber }),
      getLogs: async ({ fromBlock, toBlock, args }: { fromBlock: bigint; toBlock: bigint; args: unknown }) => {
        expect(args).toEqual({ epochId, aid })
        const [from, to] = [Number(fromBlock), Number(toBlock)]
        if (to - from + 1 > maxRange) throw new Error(`exceed maximum block range: ${maxRange}`)
        ranges.push([from, to])
        return at != null && at >= from && at <= to ? [{ blockNumber: BigInt(at), transactionHash: '0xfeed' }] : []
      },
    }
    return { client: client as unknown as PublicClient, ranges }
  }

  it('walks forward from the registration and returns the reveal with its time', async () => {
    const { client, ranges } = chain(160_000, 50_000)
    expect(await findReveal(client, appManager, epochId, aid, 100_000)).toEqual({
      block: 160_000,
      tx: '0xfeed',
      timestamp: 161_000,
    })
    expect(ranges).toEqual([
      [100_000, 149_999],
      [150_000, 199_999],
    ])
  })

  it('narrows the window when the RPC refuses it, and gives up at the head', async () => {
    const { client, ranges } = chain(null, 20_000)
    expect(await findReveal(client, appManager, epochId, aid, 250_000)).toBeNull()
    expect(ranges.at(-1)![1]).toBe(300_000)
    expect(ranges.every(([from, to]) => to - from + 1 <= 20_000)).toBe(true)
  })
})
