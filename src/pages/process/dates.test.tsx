import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ConfigContext } from '~config/config-context'
import { DEMO_CONFIG } from '~config/runtime-config'
import { createExplorerData } from '~data/create'
import { DataProvider } from '~data/DataProvider'
import { demoFixture } from '~fixtures/demo'
import { txKey, type IndexerStore } from '~indexer/types'
import { TooltipProvider } from '~kit'
import { paths, patterns } from '~routes/paths'
import { ProcessPage } from '.'

const fixture = demoFixture()
// "Union ballot": paused by the organizer after its batches.
const pid = fixture.store.processOrder.find((k) => fixture.store.processes[k]!.state?.status === 'paused')!

/** The process page on the demo network, after `change` edits its store. */
function renderWith(change: (store: IndexerStore) => void) {
  const data = createExplorerData({ config: DEMO_CONFIG, demoOptions: { blockIntervalMs: 0 } })
  change(data.source.getSnapshot().store)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ConfigContext.Provider value={DEMO_CONFIG}>
      <QueryClientProvider client={client}>
        <DataProvider source={data.source} services={data.services}>
          <MemoryRouter initialEntries={[paths.process(pid)]}>
            <TooltipProvider>
              <Routes>
                <Route path={patterns.process} element={<ProcessPage />} />
              </Routes>
            </TooltipProvider>
          </MemoryRouter>
        </DataProvider>
      </QueryClientProvider>
    </ConfigContext.Provider>
  )
}

describe('the pauses of an election', () => {
  it('start at creation for an election created paused', async () => {
    renderWith((store) => {
      const p = store.processes[pid]!
      // Created Paused: no status change, only the newProcess call says so.
      p.statusChanges = []
      store.txDetails[txKey(p.createdTx!)]!.initialStatus = 'paused'
    })
    const pauses = await screen.findByTestId('pauses')
    expect(within(pauses).getAllByRole('listitem')).toHaveLength(1)
    expect(pauses).toHaveTextContent('created paused by the organizer')
  })

  it('say a paused election is paused while its creation is not read', async () => {
    renderWith((store) => {
      const p = store.processes[pid]!
      p.statusChanges = []
      delete store.txDetails[txKey(p.createdTx!)]
    })
    expect(await screen.findByText('Voting is paused.')).toBeInTheDocument()
  })
})
