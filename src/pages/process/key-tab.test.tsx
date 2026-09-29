import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ConfigContext } from '~config/config-context'
import { DEMO_CONFIG } from '~config/runtime-config'
import { createExplorerData } from '~data/create'
import { DataProvider } from '~data/DataProvider'
import type { ExplorerServices } from '~data/services'
import { demoFixture } from '~fixtures/demo'
import { TooltipProvider } from '~kit'
import { paths, patterns } from '~routes/paths'
import { ProcessPage } from '.'

const fixture = demoFixture()
// "Statute reform": a locked committee key, its tally sent but the secret still sealed.
const pid = fixture.featured.awaitingReveal
const process = fixture.store.processes[pid]!
const end = process.state!.startTime + process.state!.duration

/** The demo network, with the organizer's secret revealed at `at` (null: still sealed). */
function renderRevealedAt(at: number | null, nothingSent = false) {
  const data = createExplorerData({ config: DEMO_CONFIG, demoOptions: { blockIntervalMs: 0 } })
  if (nothingSent) {
    // As if no ballot had been counted: every field empty, nothing sent to the committee.
    const dkg = data.source.getSnapshot().store.processes[pid]!.state!.dkg!
    Object.assign(dkg, { count: 0, firstIndex: 0, zeroSkipped: (1 << process.state!.ballotMode.numFields) - 1 })
  }
  const services: ExplorerServices = {
    ...data.services,
    readDkgApplication: async (p, registry, signal) => {
      const app = await data.services.readDkgApplication(p, registry, signal)
      if (!app || at == null) return app && { ...app, ciphertexts: nothingSent ? [] : app.ciphertexts }
      return { ...app, organizerSecret: 7n, revealed: true, reveal: { block: 1, tx: null, timestamp: at } }
    },
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ConfigContext.Provider value={DEMO_CONFIG}>
      <QueryClientProvider client={client}>
        <DataProvider source={data.source} services={services}>
          <MemoryRouter initialEntries={[paths.process(pid, 'key')]}>
            <TooltipProvider>
              <Routes>
                <Route path={patterns.processTab} element={<ProcessPage />} />
              </Routes>
            </TooltipProvider>
          </MemoryRouter>
        </DataProvider>
      </QueryClientProvider>
    </ConfigContext.Provider>
  )
}

describe('the organizer secret', () => {
  it('flags a reveal before voting ended', async () => {
    renderRevealedAt(end - 600)
    expect(await screen.findByText('The organizer secret was revealed before voting ended')).toBeInTheDocument()
    expect(screen.getByTestId('reveal-time')).toHaveTextContent(/, before voting ended$/)
  })

  it('says when a reveal came after the end, and flags nothing', async () => {
    renderRevealedAt(end + 600)
    expect(await screen.findByTestId('reveal-time')).toHaveTextContent(/, after voting ended$/)
    expect(screen.queryByText('The organizer secret was revealed before voting ended')).toBeNull()
  })

  it('does not wait for a reveal when nothing was sent', async () => {
    renderRevealedAt(null, true)
    expect(await screen.findByText(/^Nothing was sent: fields/)).toBeInTheDocument()
    expect(screen.queryByText(/waits for the organizer’s reveal/)).toBeNull()
  })
})
