import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ConfigContext } from '~config/config-context'
import { DEMO_CONFIG } from '~config/runtime-config'
import { createExplorerData } from '~data/create'
import { DataProvider } from '~data/DataProvider'
import { ServiceError, type ExplorerServices } from '~data/services'
import { demoFixture } from '~fixtures/demo'
import { activateLocale } from '~i18n/i18n'
import { TooltipProvider } from '~kit'
import { formatVoteId } from '~protocol/blob'
import { patterns, paths } from '~routes/paths'
import { VerifyVotePage } from '~pages/verify/vote'
import { TransitionPage } from '.'

const fixture = demoFixture()

/** The demo network with a beacon that pruned everything and no sequencer. */
function renderAt(url: string, element: ReactElement, pattern: string, services?: Partial<ExplorerServices>) {
  const data = createExplorerData({ config: DEMO_CONFIG, demoOptions: { blockIntervalMs: 0 } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ConfigContext.Provider value={DEMO_CONFIG}>
      <QueryClientProvider client={client}>
        <DataProvider source={data.source} services={{ ...data.services, ...services }}>
          <MemoryRouter initialEntries={[url]}>
            <TooltipProvider>
              <Routes>
                <Route path={pattern} element={element} />
              </Routes>
            </TooltipProvider>
          </MemoryRouter>
        </DataProvider>
      </QueryClientProvider>
    </ConfigContext.Provider>
  )
}

const pruned: Partial<ExplorerServices> = {
  sequencers: [],
  fetchTransitionBlobs: async () => {
    throw new ServiceError(
      'beacon https://beacon.invalid: beacon /eth/v1/beacon/blob_sidecars/7: not found (pruned or not yet available)'
    )
  },
}

afterEach(() => activateLocale('en'))

describe('TransitionPage', () => {
  it('explains pruned blobs and still shows every check', async () => {
    const { processId, index } = fixture.featured.multiBlob
    renderAt(paths.transition(processId, index), <TransitionPage />, patterns.transition, pruned)
    expect(await screen.findByText(/no sequencer is configured/i, {}, { timeout: 5_000 })).toBeInTheDocument()
    expect(screen.getByText(/That the batch was recorded correctly is not in doubt/)).toBeInTheDocument()
    const verify = screen.getByTestId('verify')
    expect(within(verify).getByTestId('check-plonk')).toBeInTheDocument()
    expect(within(verify).getByTestId('check-kzg-openings')).toBeInTheDocument()
    expect(screen.getByTestId('blob-list').querySelectorAll('tbody tr')).toHaveLength(4)
  })

  it('decodes the blobs when they are available', async () => {
    const { processId, index } = fixture.featured.multiBlob
    renderAt(paths.transition(processId, index), <TransitionPage />, patterns.transition)
    const content = await screen.findByTestId('blob-content', {}, { timeout: 10_000 })
    expect(within(content).getByTestId('vote-id-list')).toBeInTheDocument()
    expect(screen.getByTestId('transition-summary')).toHaveTextContent(/vote ids/)
  })

  it('says when there is no such transition, in one sentence', async () => {
    const pid = fixture.featured.openProcess
    renderAt(paths.transition(pid, 999), <TransitionPage />, patterns.transition)
    expect(await screen.findByText(/No batch found/)).toBeInTheDocument()
    expect(screen.getByText(`The registry has no batch #999 of process ${pid}.`)).toBeInTheDocument()
  })

  it('counts with plurals and formats numbers in the active language', async () => {
    const { processId, index } = fixture.featured.multiBlob
    await activateLocale('es')
    renderAt(paths.transition(processId, index), <TransitionPage />, patterns.transition, pruned)
    expect(await screen.findByRole('heading', { level: 1, name: new RegExp(`${index}$`) })).toBeInTheDocument()
    const summary = await screen.findByTestId('transition-summary')
    // 524,288 blob gas in English; the count of data blobs is a plural.
    await waitFor(() => expect(summary).toHaveTextContent(/524\.288/), { timeout: 5_000 })
    expect(summary).toHaveTextContent(/· 4 \S/)
    expect(summary).not.toHaveTextContent(/524,288/)
  })
})

describe('VerifyVotePage', () => {
  it('works without a sequencer', async () => {
    const { processId, voteId } = fixture.featured.settledVote
    renderAt(paths.vote(processId, formatVoteId(voteId)), <VerifyVotePage />, patterns.verifyVote, { sequencers: [] })
    expect(screen.getByTestId('check-tracker')).toHaveTextContent(/no sequencer is configured/)
    await waitFor(() => expect(screen.getByTestId('check-settled')).toHaveTextContent(/Your vote is in batch #/), {
      timeout: 15_000,
    })
  })
})
