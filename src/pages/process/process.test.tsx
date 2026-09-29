import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { demoFixture } from '~fixtures/demo'
import { paths, patterns } from '~routes/paths'
import { renderWithProviders } from '../../test-utils'
import { ProcessPage } from '.'

const fixture = demoFixture()

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path={patterns.process} element={<ProcessPage />} />
      <Route path={patterns.processTab} element={<ProcessPage />} />
    </Routes>,
    { route }
  )
}

describe('process metadata', () => {
  it('shows the committed document as checked', async () => {
    renderAt(paths.process(fixture.featured.openProcess))
    const check = await screen.findByTestId('metadata-check')
    await waitFor(() => expect(check).toHaveAttribute('data-status', 'matches'))
    expect(check).toHaveTextContent('The document matches the fingerprint on the chain')
    expect(screen.getByTestId('process-metadata')).toHaveTextContent('Community fund round')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Community fund round')
    expect(screen.queryByTestId('unverified-mark')).toBeNull()
    expect(within(screen.getByTestId('metadata-history')).getAllByRole('listitem')).toHaveLength(1)
  })

  it('flags a version set after votes had settled', async () => {
    renderAt(paths.process(fixture.featured.metadataAfterVotes))
    const second = await screen.findByTestId('metadata-version-2')
    expect(second).toHaveTextContent('changed while voting was open')
    expect(second).toHaveTextContent('Votes cast before this change were cast under the previous version.')
    expect(screen.getByTestId('metadata-version-1')).not.toHaveTextContent('changed while voting was open')
    await waitFor(() => expect(screen.getByTestId('metadata-check')).toHaveAttribute('data-status', 'matches'))
  })

  it('does not change a version set before voting opened', async () => {
    renderAt(paths.process(fixture.featured.metadataBeforeStart))
    const second = await screen.findByTestId('metadata-version-2')
    expect(second).toHaveTextContent('current')
    expect(second).not.toHaveTextContent('changed while voting was open')
  })

  it('marks what a document that does not match says, and names results by field', async () => {
    const pid = fixture.featured.metadataTampered
    const { unmount } = renderAt(paths.process(pid))
    const check = await screen.findByTestId('metadata-check')
    await waitFor(() => expect(check).toHaveAttribute('data-status', 'differs'))
    expect(check).toHaveTextContent('The document does not match the fingerprint on the chain')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('unverified')
    expect(screen.getByTestId('process-metadata')).toHaveAttribute('data-verified', 'false')
    unmount()

    renderAt(paths.process(pid, 'results'))
    const tally = await screen.findByTestId('tally')
    await waitFor(() => expect(within(tally).getAllByTestId('unverified-label').length).toBeGreaterThan(0))
    const first = within(tally).getAllByRole('listitem')[0]!
    // The field's own name, then the document's (swapped) one, marked.
    expect(first).toHaveTextContent('Field 1')
    expect(first).toHaveTextContent('“Option 2”')
  })

  it('warns on the tally when the description changed while voting was open', async () => {
    // The demo's results processes kept their first document; give one a later version for this test.
    const p = fixture.store.processes[fixture.featured.resultsProcess]!
    const saved = p.metadataHistory
    const first = saved[0]!
    p.metadataHistory = [first, { ...first, atCreation: false, afterStart: true, afterFirstVote: true }]
    try {
      renderAt(paths.process(p.id, 'results'))
      expect(await screen.findByTestId('tally-metadata-changed')).toHaveTextContent(
        'The organizer changed the description while voting was open'
      )
    } finally {
      p.metadataHistory = saved
    }
  })
})

describe('process dates', () => {
  const find = (status: string) =>
    fixture.store.processOrder.find(
      (k) => fixture.store.processes[k]!.state?.status === status && !fixture.store.processes[k]!.decryptionRequest
    )!

  it('lists the pauses', async () => {
    renderAt(paths.process(find('paused')))
    const pauses = await screen.findByTestId('pauses')
    expect(within(pauses).getAllByRole('listitem')).toHaveLength(1)
    expect(pauses).toHaveTextContent('paused by the organizer')
  })

  it('marks the duration an early end set', async () => {
    renderAt(paths.process(find('ended')))
    const changes = await screen.findByTestId('duration-changes')
    expect(changes).toHaveTextContent('ended early by the organizer')
    expect(screen.getByText('Voting has not been paused.')).toBeInTheDocument()
  })

  it('gives a canceled election the end it was due, not a countdown', async () => {
    renderAt(paths.process(find('canceled')))
    expect(await screen.findByText('as planned; the organizer canceled the election')).toBeInTheDocument()
  })

  it('starts each history with the value the election was created with', async () => {
    // The busy open process raised its voter limit from 1,000 to 5,000.
    const { unmount } = renderAt(paths.process(fixture.featured.openProcess))
    expect(await screen.findByText('1,000 at creation, changed 1 time, last to 5,000')).toBeInTheDocument()
    unmount()

    const ended = renderAt(paths.process(find('ended')))
    const durations = await screen.findByTestId('duration-changes')
    expect(within(durations).getAllByRole('listitem')[0]).toHaveTextContent(/^at creation\s*duration 9 d/)
    ended.unmount()

    const replaced = fixture.store.processOrder.find((k) => fixture.store.processes[k]!.censusUpdates.length > 0)!
    renderAt(paths.process(replaced))
    const census = await screen.findByTestId('census-changes')
    expect(within(census).getAllByRole('listitem')).toHaveLength(2)
    expect(within(census).getAllByRole('listitem')[0]).toHaveTextContent(/^at creation/)
  })
})
