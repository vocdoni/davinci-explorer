// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readCapped } from './services'

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
