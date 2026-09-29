import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConfigContext } from '~config/config-context'
import { DEMO_CONFIG } from '~config/runtime-config'
import { DataProvider } from '~data/DataProvider'
import { createExplorerData } from '~data/create'
import { demoFixture } from '~fixtures/demo'
import { useProcessTitles } from './titles'

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

afterEach(() => vi.restoreAllMocks())

describe('useProcessTitles', () => {
  it('asks once for a document two processes share, and titles both', async () => {
    const warn = vi.spyOn(console, 'warn')
    const s = fixture.store.processes[fixture.featured.openProcess]!.state!
    const doc = { metadataURI: s.metadataURI, metadataHash: s.metadataHash }
    const rows = [
      { id: 'a', ...doc },
      { id: 'b', ...doc },
      { id: 'c', metadataURI: null, metadataHash: null },
      { id: 'd', metadataURI: null, metadataHash: null },
    ]
    const { result } = renderHook(() => useProcessTitles(rows), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.size).toBe(2))
    expect(result.current.get('a')).toEqual(result.current.get('b'))
    expect(result.current.get('a')?.verified).toBe(true)
    expect(warn.mock.calls.flat().join(' ')).not.toContain('Duplicate Queries')
  })
})
