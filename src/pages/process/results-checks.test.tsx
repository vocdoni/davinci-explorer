import { describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConfigContext } from '~config/config-context'
import { DEMO_CONFIG } from '~config/runtime-config'
import { DataProvider } from '~data/DataProvider'
import { createExplorerData } from '~data/create'
import { useProcess, type ProcessView } from '~data/hooks'
import { demoFixture } from '~fixtures/demo'
import { tallyMatches, useDkgResultsChecks } from './results-checks'

const fixture = demoFixture()

function wrapper() {
  const data = createExplorerData({ config: DEMO_CONFIG, demoOptions: { blockIntervalMs: 0 } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <ConfigContext.Provider value={DEMO_CONFIG}>
      <QueryClientProvider client={client}>
        <DataProvider source={data.source} services={data.services}>
          {children}
        </DataProvider>
      </QueryClientProvider>
    </ConfigContext.Provider>
  )
}

const cipher = (field: number, plaintext: bigint) => ({ index: field + 1, field, completed: true, plaintext })

describe('tallyMatches', () => {
  it('wants each decrypted value in its field and 0 in a field never sent', () => {
    expect(tallyMatches([5n, 0n, 7n], [cipher(0, 5n), cipher(2, 7n)])).toBe(true)
    expect(tallyMatches([5n, 1n, 7n], [cipher(0, 5n), cipher(2, 7n)])).toBe(false)
    expect(tallyMatches([5n, 0n, 8n], [cipher(0, 5n), cipher(2, 7n)])).toBe(false)
    expect(tallyMatches([0n, 0n], [])).toBe(true)
  })
})

describe('useDkgResultsChecks', () => {
  const pid = fixture.store.processOrder.find((k) => {
    const p = fixture.store.processes[k]!
    return p.state?.keyMode !== 'sequencer' && p.results != null
  })!

  // The same election as if no ballot had been counted: nothing sent, zeros stored in the request's transaction.
  const empty = (view: ProcessView, values: bigint[], tx = view.process.decryptionRequest!.tx): ProcessView => ({
    ...view,
    process: {
      ...view.process,
      decryptionRequest: { ...view.process.decryptionRequest!, count: 0, firstIndex: 0 },
      results: { ...view.process.results!, values, tx },
    },
  })

  it('passes an election with nothing to decrypt', async () => {
    const { result } = renderHook(
      () => {
        const view = useProcess(pid)!
        const nf = view.process.results!.values.length
        return useDkgResultsChecks(empty(view, new Array<bigint>(nf).fill(0n)))
      },
      { wrapper: wrapper() }
    )
    await waitFor(() => expect(result.current.checks.find((c) => c.id === 'tally-plaintexts')).toBeDefined())
    const byId = Object.fromEntries(result.current.checks.map((c) => [c.id, c]))
    expect(byId.combined).toMatchObject({ label: 'Nothing had to be decrypted', state: 'pass' })
    expect(byId['tally-plaintexts']).toMatchObject({ label: 'Every stored total is 0', state: 'pass' })
  })

  it('fails a stored total that is not 0, or zeros stored anywhere but in the request', () => {
    const state = (make: (view: ProcessView, nf: number) => ProcessView) =>
      renderHook(
        () => {
          const view = useProcess(pid)!
          return useDkgResultsChecks(make(view, view.process.results!.values.length))
        },
        { wrapper: wrapper() }
      ).result.current.checks.find((c) => c.id === 'tally-plaintexts')?.state
    expect(state((view, nf) => empty(view, [1n, ...new Array<bigint>(nf - 1).fill(0n)]))).toBe('fail')
    expect(state((view, nf) => empty(view, new Array<bigint>(nf - 1).fill(0n)))).toBe('fail')
    expect(state((view, nf) => empty(view, new Array<bigint>(nf).fill(0n), `0x${'ee'.repeat(32)}`))).toBe('fail')
  })
})
