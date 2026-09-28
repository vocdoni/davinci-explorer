import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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
import { VerifyVotePage } from '.'

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
                <Route path={patterns.verifyVote} element={<VerifyVotePage />} />
              </Routes>
            </TooltipProvider>
          </MemoryRouter>
        </DataProvider>
      </QueryClientProvider>
    </ConfigContext.Provider>
  )
}

describe('VerifyVotePage', () => {
  it('says so when the sequencer answers with a proof for another vote', async () => {
    const { processId, voteId } = fixture.featured.settledVote
    const other = fixture.transitionData.get(transitionKey(processId, 1))!.voteIds[0]!
    const data = createExplorerData({ config: DEMO_CONFIG, demoOptions: { blockIntervalMs: 0 } })
    const api = data.services.sequencers[0]!.api
    const trackerProof: SequencerApi['trackerProof'] = (pid, _voteId, signal) => api.trackerProof(pid, other, signal)
    const sequencers = [{ ...data.services.sequencers[0]!, api: { ...api, trackerProof } }]
    renderAt(paths.vote(processId, formatVoteId(voteId)), { sequencers })
    const card = await screen.findByTestId('check-tracker')
    expect(
      await within(card).findByText(
        'The sequencer answered with a proof for another vote, so it proves nothing about yours.'
      )
    ).toBeInTheDocument()
    expect(card).toHaveAttribute('data-status', 'fail')
  })

  it('shows the form in the active language', async () => {
    await activateLocale('es')
    renderAt(paths.votes({ voteId: '0x1' }))
    expect(screen.getByLabelText('Id de voto')).toHaveValue('0x1')
  })

  it('asks for the election when only a vote id is given', () => {
    renderAt(paths.votes({ voteId: '0x8000000000000001' }))
    expect(screen.getByText('Which election?')).toBeInTheDocument()
    expect(screen.getByTestId('verify-stepper')).toHaveTextContent('Choose')
  })

  it('finds the batch a vote is in, and says the receipt needs a sequencer', async () => {
    const { processId, voteId } = fixture.featured.settledVote
    renderAt(paths.vote(processId, formatVoteId(voteId)), { sequencers: [] })
    const settled = await screen.findByTestId('check-settled')
    await waitFor(() => expect(settled).toHaveAttribute('data-status', 'pass'), { timeout: 15_000 })
    expect(settled).toHaveTextContent(/Your vote is in batch #\d+, settled on/)
    const tracker = screen.getByTestId('check-tracker')
    expect(tracker).toHaveAttribute('data-status', 'na')
    expect(tracker).toHaveTextContent('Not available: no sequencer is configured')
    expect(screen.getByTestId('check-election')).toHaveAttribute('data-status', 'pass')
    await waitFor(() => expect(screen.getByTestId('check-batch')).toHaveAttribute('data-status', 'pass'))
  })
})
