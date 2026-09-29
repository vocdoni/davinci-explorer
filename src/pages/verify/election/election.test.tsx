import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { demoFixture } from '~fixtures/demo'
import { metadataTitle } from '~pages/process/metadata'
import { readServedDocument } from '~protocol/metadata'
import { patterns } from '~routes/paths'
import { renderWithProviders } from '../../../test-utils'
import { VerifyElectionPage } from '.'

const fixture = demoFixture()
const openTitle = metadataTitle(
  readServedDocument(fixture.metadata.get(fixture.store.processes[fixture.featured.openProcess]!.state!.metadataURI)!)
    .doc
)!

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path={patterns.verifyElection} element={<VerifyElectionPage />} />
      <Route path={patterns.verifyElectionProcess} element={<VerifyElectionPage />} />
    </Routes>,
    { route }
  )
}

describe('VerifyElectionPage', () => {
  it('lists the elections and finds one by title', async () => {
    const user = userEvent.setup()
    renderAt('/verify/election')
    const picker = screen.getByTestId('process-picker')
    await waitFor(() => expect(within(picker).getAllByTestId('picker-row').length).toBeGreaterThan(1))
    await user.type(within(picker).getByLabelText('Find the election'), openTitle.toLowerCase())
    await waitFor(() => expect(within(picker).getAllByTestId('picker-row')).toHaveLength(1))
    expect(within(picker).getByTestId('picker-row')).toHaveAttribute(
      'href',
      `/verify/election/${fixture.featured.openProcess}`
    )
  })

  it('checks every batch and the root chain of an election with results', async () => {
    const pid = fixture.featured.resultsProcess
    renderAt(`/verify/election/${pid}`)
    const batches = await screen.findByTestId('check-batches')
    await waitFor(() => expect(batches).toHaveAttribute('data-status', 'pass'), { timeout: 10_000 })
    const n = fixture.store.processes[pid]!.transitions.length
    expect(batches).toHaveTextContent(`${n} of ${n} batches passed every check`)
    expect(screen.getByTestId('check-chain')).toHaveAttribute('data-status', 'pass')
    expect(screen.getByTestId('check-published')).toHaveAttribute('data-status', 'pass')
    await waitFor(() => expect(screen.getByTestId('check-tally')).toHaveAttribute('data-status', 'pass'))
    expect(screen.getByTestId('check-rules')).toHaveAttribute('data-status', 'pass')
  })

  it('counts a settled batch as the census check of an on-chain census', async () => {
    renderAt(`/verify/election/${fixture.featured.openProcess}`)
    await waitFor(() => expect(screen.getByTestId('check-census')).toHaveAttribute('data-status', 'pass'), {
      timeout: 10_000,
    })
    await waitFor(() => expect(screen.getByTestId('check-batches')).toHaveAttribute('data-status', 'pass'))
    // Open, so the result is still to come.
    expect(screen.getByTestId('check-published')).toHaveAttribute('data-status', 'pending')
  })

  it('checks the description against its hash, and flags a change made while voting was open', async () => {
    const { unmount } = renderAt(`/verify/election/${fixture.featured.openProcess}`)
    await waitFor(() => expect(screen.getByTestId('check-metadata')).toHaveAttribute('data-status', 'pass'))
    expect(screen.queryByTestId('check-metadata-history')).toBeNull()
    unmount()

    const tampered = renderAt(`/verify/election/${fixture.featured.metadataTampered}`)
    await waitFor(() => expect(screen.getByTestId('check-metadata')).toHaveAttribute('data-status', 'fail'))
    expect(screen.getByTestId('chosen-election')).toHaveTextContent('unverified')
    tampered.unmount()

    const after = renderAt(`/verify/election/${fixture.featured.metadataAfterVotes}`)
    await waitFor(() => expect(screen.getByTestId('check-metadata')).toHaveAttribute('data-status', 'pass'))
    const history = screen.getByTestId('check-metadata-history')
    expect(history).toHaveAttribute('data-status', 'attention')
    expect(history).toHaveTextContent('changed while voting was open')
    after.unmount()

    renderAt(`/verify/election/${fixture.featured.metadataBeforeStart}`)
    await waitFor(() => expect(screen.getByTestId('check-metadata-history')).toHaveAttribute('data-status', 'pass'))
  })

  it('says an election without batches is still at its starting state', async () => {
    // featured.metadataBeforeStart has not opened yet.
    renderAt(`/verify/election/${fixture.featured.metadataBeforeStart}`)
    const chain = await screen.findByTestId('check-chain')
    await waitFor(() => expect(chain).toHaveAttribute('data-status', 'pass'))
    expect(chain).toHaveTextContent('No batch was recorded: the registry’s current state is still the starting one.')
  })

  it('says how often an updatable list was replaced', async () => {
    const pid = fixture.store.processOrder.find((k) => {
      const p = fixture.store.processes[k]!
      return p.censusUpdates.length === 1 && p.transitions.length > 1 && p.state?.status !== 'canceled'
    })!
    renderAt(`/verify/election/${pid}`)
    const census = await screen.findByTestId('check-census')
    await waitFor(() => expect(census).toHaveAttribute('data-status', 'pass'), { timeout: 10_000 })
    expect(census).toHaveTextContent('The organizer replaced it once.')
    expect(census).toHaveTextContent('batches were proven against versions of the list the election had.')
  })

  it('says when there is no such election', async () => {
    renderAt(`/verify/election/0x${'ab'.repeat(31)}`)
    expect(await screen.findByText('No such election')).toBeInTheDocument()
  })
})
