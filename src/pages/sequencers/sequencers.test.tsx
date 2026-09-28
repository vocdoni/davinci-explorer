import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ConfigContext } from '~config/config-context'
import { DEMO_CONFIG } from '~config/runtime-config'
import { DataProvider } from '~data/DataProvider'
import type { SequencerState } from '~data/queries'
import { demoFixture } from '~fixtures/demo'
import { TooltipProvider } from '~kit'
import { renderWithProviders, testData } from '../../test-utils'
import { SequencersPage } from './index'
import { SequencerCard } from './SequencerCard'

describe('SequencersPage', () => {
  it('shows each demo sequencer, its checks and the settling accounts', async () => {
    renderWithProviders(<SequencersPage />, { route: '/sequencers' })
    const first = await screen.findByTestId('sequencer-0')
    await waitFor(() => expect(within(first).getByText('Signer')).toBeInTheDocument())
    const checks = within(first).getByTestId('sequencer-info-checks')
    expect(within(checks).getAllByRole('img', { name: 'passed' })).toHaveLength(5)
    expect(checks).toHaveTextContent('Vote-batch program vk')
    expect(
      within(first).getByText(/^sent \d+ transitions? on this registry, for \d+ process(es)?$/)
    ).toBeInTheDocument()
    expect(await within(first).findByText(/^\d+ known to the node$/)).toBeInTheDocument()
    await waitFor(() => expect(within(screen.getByTestId('sequencer-1')).getByText('Observer')).toBeInTheDocument())
    expect(within(screen.getByTestId('settlers')).getAllByRole('row').length).toBeGreaterThan(1)
  })

  it('explains an explorer with no sequencer configured and still lists the settling accounts', () => {
    const config = { ...DEMO_CONFIG, sequencers: [] }
    const data = testData(config)
    render(
      <ConfigContext.Provider value={config}>
        <QueryClientProvider client={new QueryClient()}>
          <DataProvider source={data.source} services={{ ...data.services, sequencers: [] }}>
            <MemoryRouter>
              <TooltipProvider>
                <SequencersPage />
              </TooltipProvider>
            </MemoryRouter>
          </DataProvider>
        </QueryClientProvider>
      </ConfigContext.Provider>
    )
    expect(screen.getByText('No sequencer API configured')).toBeInTheDocument()
    expect(screen.queryByTestId('sequencer-0')).toBeNull()
    expect(screen.getByTestId('settlers')).toBeInTheDocument()
  })

  it('says which call of an unreachable node failed, with the node’s own error', () => {
    const endpoint = testData().services.sequencers[0]!
    const store = demoFixture().store
    const failed = (message: string) => ({
      isError: true,
      isSuccess: false,
      isLoading: false,
      error: new Error(message),
    })
    const state = {
      endpoint,
      info: failed('connection refused'),
      processes: failed('HTTP 502'),
    } as unknown as SequencerState
    renderWithProviders(
      <SequencerCard state={state} chain={store.chain} store={store} rows={new Map()} settlerRows={[]} />
    )
    const card = screen.getByTestId('sequencer-0')
    expect(within(card).getByText('Down')).toBeInTheDocument()
    const alerts = within(card).getAllByRole('alert')
    expect(alerts[0]).toHaveTextContent('/info did not answer: connection refused')
    expect(alerts[1]).toHaveTextContent('/processes did not answer: HTTP 502')
  })
})
