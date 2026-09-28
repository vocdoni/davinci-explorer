import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ConfigContext } from '~config/config-context'
import { DEMO_CONFIG } from '~config/runtime-config'
import { createExplorerData } from '~data/create'
import { DataProvider } from '~data/DataProvider'
import type { SequencerApi } from '~data/services'
import { demoFixture } from '~fixtures/demo'
import { activateLocale } from '~i18n/i18n'
import { transitionKey } from '~indexer/types'
import { TooltipProvider } from '~kit'
import { formatVoteId } from '~protocol/blob'
import { patterns, paths } from '~routes/paths'
import { VotesPage } from '.'

const fixture = demoFixture()

afterEach(() => activateLocale('en'))

function renderAt(url: string, services?: Partial<ReturnType<typeof createExplorerData>['services']>) {
  const data = createExplorerData({ config: DEMO_CONFIG, demoOptions: { blockIntervalMs: 0 } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ConfigContext.Provider value={DEMO_CONFIG}>
      <QueryClientProvider client={client}>
        <DataProvider source={data.source} services={{ ...data.services, ...services }}>
          <MemoryRouter initialEntries={[url]}>
            <TooltipProvider>
              <Routes>
                <Route path={patterns.votes} element={<VotesPage />} />
                <Route path={patterns.vote} element={<VotesPage />} />
              </Routes>
            </TooltipProvider>
          </MemoryRouter>
        </DataProvider>
      </QueryClientProvider>
    </ConfigContext.Provider>
  )
}

describe('VotesPage', () => {
  it('says so when the sequencer answers with a proof for another vote', async () => {
    const { processId, voteId } = fixture.featured.settledVote
    const other = fixture.transitionData.get(transitionKey(processId, 1))!.voteIds[0]!
    const data = createExplorerData({ config: DEMO_CONFIG, demoOptions: { blockIntervalMs: 0 } })
    const api = data.services.sequencers[0]!.api
    const trackerProof: SequencerApi['trackerProof'] = (pid, _voteId, signal) => api.trackerProof(pid, other, signal)
    const sequencers = [{ ...data.services.sequencers[0]!, api: { ...api, trackerProof } }]
    renderAt(paths.vote(processId, formatVoteId(voteId)), { sequencers })
    const panel = await screen.findByTestId('tracker-proof')
    expect(await within(panel).findByText('The sequencer answered with a proof for another vote')).toBeInTheDocument()
    expect(
      within(panel).getByText(new RegExp(`it names vote ${formatVoteId(other)}, not the one asked for`))
    ).toBeInTheDocument()
  })

  it('shows the form in the active language', async () => {
    await activateLocale('es')
    renderAt(paths.votes({ voteId: '0x1' }))
    expect(screen.getByLabelText('Id de proceso')).toBeInTheDocument()
    expect(screen.getByLabelText('Id de voto')).toHaveValue('0x1')
  })

  it('names the transition a vote was found in', async () => {
    const { processId, voteId } = fixture.featured.settledVote
    renderAt(paths.vote(processId, formatVoteId(voteId)), { sequencers: [] })
    const summary = await screen.findByTestId('vote-summary')
    expect(summary).toHaveTextContent(/no sequencer configured/)
    await within(await screen.findByTestId('vote-inclusion')).findByText(
      /Listed in the blob of/,
      {},
      { timeout: 15_000 }
    )
    expect(summary).toHaveTextContent(/inclusion: found in transition #\d+/)
  })
})
