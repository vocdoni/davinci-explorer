import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { demoDeploymentDetails } from '~data/deployment'
import { demoFixture } from '~fixtures/demo'
import { activateLocale } from '~i18n/i18n'
import type { ChainMeta } from '~indexer/types'
import { formatDate } from '~lib/format'
import { KNOWN_RELEASES } from '~protocol/releases'
import { renderWithProviders } from '../../test-utils'
import { DkgPanel } from './DkgPanel'
import { ContractsPage } from './index'

const release = KNOWN_RELEASES[0]!
const store = demoFixture().store
const dkg = demoDeploymentDetails(store).dkg!

afterEach(() => activateLocale('en'))

describe('ContractsPage', () => {
  it('shows the demo deployment pinned to the known release, with every contract', async () => {
    renderWithProviders(<ContractsPage />, { route: '/contracts' })
    expect(screen.getByTestId('release-summary')).toHaveTextContent(`All five pins match ${release.label}`)
    for (const pin of [
      'batchProgramVK',
      'resultsProgramVK',
      'rootCVadcopFinal',
      'ziskVerifierCodeHash',
      'ballotVKHash',
    ]) {
      expect(screen.getByTestId(`pin-${pin}`)).toHaveAttribute('data-state', 'pass')
    }
    expect(screen.getByTestId('pin-batchProgramVK')).toHaveTextContent(
      'What a mismatch would mean. Batches of votes would be checked by a program other than the released one'
    )
    await waitFor(() => expect(screen.getByTestId('contract-row-dkg-registry')).toHaveTextContent('0x'))
    expect(within(screen.getByTestId('wiring-checks')).getByText('7 of 7 consistent')).toBeInTheDocument()
    expect(screen.getByTestId('registration-epoch')).toHaveTextContent('registrationEpoch()')
    expect(screen.getByTestId('page-contracts')).toHaveTextContent(`pins frozen on ${formatDate(release.date)}`)
  })

  it('formats numbers and dates in the active language', async () => {
    await activateLocale('es')
    renderWithProviders(<ContractsPage />, { route: '/contracts' })
    const page = screen.getByTestId('page-contracts')
    // The demo epoch lasts 17,280 blocks; the release pins were frozen on a YYYY-MM-DD day.
    await waitFor(() => expect(page).toHaveTextContent('17.280'))
    const date = formatDate(release.date)
    expect(date).not.toBe(release.date)
    expect(page).toHaveTextContent(date)
  })

  it('keeps the mechanism behind one switch that every panel shares', async () => {
    renderWithProviders(<ContractsPage />, { route: '/contracts' })
    await waitFor(() => expect(screen.getByTestId('contract-row-dkg-registry')).toHaveTextContent('0x'))
    // Plain by default: no formulas, no contract calls.
    expect(screen.getByTestId('wiring-checks').querySelector('[data-formula]')).toBeNull()
    expect(screen.queryAllByTestId('param-detail')).toHaveLength(0)
    expect(screen.getByTestId('contract-row-verifier')).not.toHaveTextContent('verifySnarkProof')

    const switches = screen.getAllByRole('switch', { name: 'Technical details' })
    expect(switches.length).toBeGreaterThanOrEqual(4)
    fireEvent.click(switches[0]!)
    for (const s of screen.getAllByRole('switch', { name: 'Technical details' })) {
      expect(s).toHaveAttribute('aria-checked', 'true')
    }
    expect(screen.getByTestId('wiring-checks').querySelectorAll('[data-formula]')).toHaveLength(7)
    expect(screen.getByTestId('contract-row-verifier')).toHaveTextContent('verifySnarkProof')
    expect(within(screen.getByTestId('param-pidPrefix')).getByTestId('param-detail')).toHaveTextContent(
      'keccak256(chainID ‖ registry)'
    )
    expect(screen.getByTestId('pin-batchProgramVK')).toHaveTextContent('registry.batchProgramVK()')
  })

  it('names each pin in plain words, with its identifier beside', () => {
    renderWithProviders(<ContractsPage />, { route: '/contracts' })
    const pin = screen.getByTestId('pin-batchProgramVK')
    expect(pin).toHaveTextContent('Vote-batch program')
    expect(within(pin).getByText('batchProgramVK').tagName).toBe('CODE')
  })

  it('sends the reader to the deployment check to verify it', () => {
    renderWithProviders(<ContractsPage />, { route: '/contracts' })
    expect(screen.queryByTestId('verify-script')).toBeNull()
    expect(screen.getByRole('link', { name: 'Verify it without trusting this page' })).toHaveAttribute(
      'href',
      '/verify/deployment'
    )
  })
})

describe('DkgPanel', () => {
  const noDkg: ChainMeta = {
    ...store.chain,
    registry: { ...store.chain.registry!, dkgAdapter: null, dkgManager: null, dkgAppManager: null },
  }

  it('says the DKG modes are off on a registry without an adapter', () => {
    renderWithProviders(<DkgPanel chain={noDkg} dkg={null} loading={false} error={null} />)
    expect(screen.getByText('The DKG key modes are disabled on this registry')).toBeInTheDocument()
    expect(screen.getByText('DKGDisabled')).toBeInTheDocument()
  })

  it('shows a read failure as it came', () => {
    renderWithProviders(<DkgPanel chain={store.chain} dkg={null} loading={false} error='execution reverted' />)
    expect(screen.getByText('Could not read the DKG contracts')).toBeInTheDocument()
    expect(screen.getByText('execution reverted')).toBeInTheDocument()
  })

  it('shows the epoch, its cadence and the counts', () => {
    renderWithProviders(<DkgPanel chain={store.chain} dkg={dkg} loading={false} error={null} />)
    const e = dkg.newestEpoch!
    const epoch = screen.getByTestId('dkg-epoch')
    expect(epoch).toHaveTextContent(`Epoch #${e.nonce}`)
    expect(epoch).toHaveTextContent(`${e.contributionCount} of ${e.committeeSize}`)
    expect(epoch).toHaveTextContent(`Any ${e.threshold} of them can decrypt; fewer cannot.`)
    expect(screen.getAllByText(/^17,280 blocks · ~/)).toHaveLength(1)
    expect(screen.getByText(`${e.threshold} of ${e.committeeSize}`)).toBeInTheDocument()
  })

  it('names who may register applications', () => {
    const adapter = store.chain.registry!.dkgAdapter!
    const { unmount } = renderWithProviders(
      <DkgPanel
        chain={store.chain}
        dkg={{ ...dkg, registration: { kind: 'registrar', address: adapter } }}
        loading={false}
        error={null}
      />
    )
    expect(screen.getByText('Application registration is restricted')).toBeInTheDocument()
    expect(screen.getByText(/this registry’s adapter, may register applications/)).toBeInTheDocument()
    unmount()

    renderWithProviders(
      <DkgPanel
        chain={store.chain}
        dkg={{ ...dkg, registration: { kind: 'open', reason: 'unset' } }}
        loading={false}
        error={null}
      />
    )
    expect(screen.getByText('Anyone can register an application')).toBeInTheDocument()
    expect(screen.getByText(/The DKGAppManager has no registrar set:/)).toBeInTheDocument()
  })
})
