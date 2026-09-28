import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ConfigContext } from '~config/config-context'
import { DEMO_CONFIG } from '~config/runtime-config'
import { DataProvider } from '~data/DataProvider'
import type { SequencerState } from '~data/queries'
import { demoFixture } from '~fixtures/demo'
import { sequencerRows } from '~indexer/selectors'
import { TooltipProvider } from '~kit'
import { checksum } from '~lib/address'
import { patterns } from '~routes/paths'
import { renderWithProviders, testData } from '../../test-utils'
import { SequencersPage } from './index'
import { SequencerCard } from './SequencerCard'

const store = demoFixture().store
const rows = sequencerRows(store)

const onRoute = (route: string) =>
  renderWithProviders(
    <Routes>
      <Route path={patterns.sequencers} element={<SequencersPage />} />
      <Route path={patterns.sequencer} element={<SequencersPage />} />
    </Routes>,
    { route }
  )

describe('SequencersPage', () => {
  it('lists every settling account and every configured node', async () => {
    onRoute('/sequencers')
    const table = await screen.findByTestId('sequencer-table')
    // Both demo accounts settled; the observer reports no address and gets a row of its own.
    await waitFor(() => expect(within(table).getAllByText('Observer')).toHaveLength(1))
    expect(within(table).getAllByText('Signer')).toHaveLength(1)
    expect(within(table).getAllByText('Online')).toHaveLength(2)
    expect(within(table).getByText('not configured')).toBeInTheDocument()
    for (const r of rows)
      expect(within(table).getByText(checksum(r.address).slice(0, 8), { exact: false })).toBeTruthy()
    const total = rows.reduce((n, r) => n + r.transitions, 0)
    expect(screen.getByText(total.toLocaleString('en'))).toBeInTheDocument()
  })

  it('still lists the settling accounts with no sequencer API configured', () => {
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
    const table = screen.getByTestId('sequencer-table')
    // With no API anywhere, the node column goes: the note under the table says why.
    expect(within(table).getAllByRole('row')).toHaveLength(rows.length + 1)
    expect(within(table).queryByText('not configured')).toBeNull()
    expect(within(table).queryByRole('columnheader', { name: 'Node API' })).toBeNull()
    expect(screen.getByText(/No sequencer API is configured/)).toHaveTextContent('SEQUENCER_URLS')
  })

  it('shows one account: its numbers, its node and its transitions', async () => {
    const busiest = rows[0]!
    onRoute(`/sequencers/${busiest.address}`)
    const page = await screen.findByTestId('page-sequencer')
    expect(page).toHaveTextContent(checksum(busiest.address))
    // The table is virtualised above 50 rows and jsdom has no layout to window: check its count.
    expect(within(page).getByTestId('sequencer-transitions')).toBeInTheDocument()
    expect(within(page).getByText(`${busiest.transitions} transitions`)).toBeInTheDocument()
    const card = await within(page).findByTestId('sequencer-0')
    await waitFor(() => expect(within(card).getByText('davinci-zkvm v0.1.0')).toBeInTheDocument())
    expect(
      within(within(card).getByTestId('sequencer-info-checks')).getAllByRole('img', { name: 'passed' })
    ).toHaveLength(5)
    expect(within(card).getByText(/^sent \d+ transitions? on this registry, for \d+ process(es)?$/)).toBeInTheDocument()
  })

  it('shows a node that reports no account under its node key', async () => {
    onRoute('/sequencers/node-2')
    const page = await screen.findByTestId('page-sequencer')
    await waitFor(() => expect(within(page).getAllByText('Observer').length).toBeGreaterThan(0))
    expect(within(page).getByTestId('sequencer-1')).toBeInTheDocument()
    expect(within(page).queryByTestId('sequencer-transitions')).toBeNull()
  })

  it('says so for an account that never settled', async () => {
    onRoute('/sequencers/0x0000000000000000000000000000000000000001')
    expect(await screen.findByText('No sequencer found')).toBeInTheDocument()
  })

  it('says which call of an unreachable node failed, with the node’s own error', () => {
    const endpoint = testData().services.sequencers[0]!
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
      <SequencerCard state={state} chain={store.chain} store={store} rows={new Map()} onchain={null} />
    )
    const card = screen.getByTestId('sequencer-0')
    expect(within(card).getByText('Offline')).toBeInTheDocument()
    const alerts = within(card).getAllByRole('alert')
    expect(alerts[0]).toHaveTextContent('/info did not answer: connection refused')
    expect(alerts[1]).toHaveTextContent('/processes did not answer: HTTP 502')
  })
})
