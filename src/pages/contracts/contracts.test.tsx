import { afterEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
      'What a mismatch would mean. Transitions would be proven by a program other than the released vote-batch guest'
    )
    await waitFor(() => expect(screen.getByTestId('contract-row-dkg-registry')).toHaveTextContent('0x'))
    expect(within(screen.getByTestId('wiring-checks')).getByText('7 of 7 consistent')).toBeInTheDocument()
    expect(screen.getByTestId('registration-epoch')).toHaveTextContent('registrationEpoch()')
    expect(screen.getByTestId('page-contracts')).toHaveTextContent(`pins frozen on ${formatDate(release.date)}`)
  })

  it('switches the verification command between the chain’s pins and the release’s', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContractsPage />, { route: '/contracts' })
    const script = screen.getByTestId('verify-script')
    expect(script).toHaveTextContent('python3 script/verify_deployment.py')
    expect(script).toHaveTextContent(`--batch-vk ${release.batchProgramVK}`)
    await user.click(within(script).getByRole('radio', { name: `Pins of ${release.label}` }))
    expect(within(script).getByRole('radio', { name: `Pins of ${release.label}` })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(script).toHaveTextContent('also checks that the registry holds exactly the released keys')
    expect(screen.getByText(/belongs to the ZisK snark setup/)).toHaveTextContent(
      `rootCVadcopFinal belongs to the ZisK snark setup (ZisK ${release.zisk} for ${release.label}), not to the guests.`
    )
  })

  it('formats numbers and dates in the active language and leaves the commands alone', async () => {
    await activateLocale('es')
    renderWithProviders(<ContractsPage />, { route: '/contracts' })
    const page = screen.getByTestId('page-contracts')
    // The demo epoch lasts 17,280 blocks; the release pins were frozen on a YYYY-MM-DD day.
    await waitFor(() => expect(page).toHaveTextContent('17.280'))
    const date = formatDate(release.date)
    expect(date).not.toBe(release.date)
    expect(page).toHaveTextContent(date)
    expect(screen.getByTestId('verify-script')).toHaveTextContent(`--batch-vk ${release.batchProgramVK}`)
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
