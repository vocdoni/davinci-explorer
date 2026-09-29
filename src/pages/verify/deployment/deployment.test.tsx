import { afterEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { activateLocale } from '~i18n/i18n'
import { KNOWN_RELEASES } from '~protocol/releases'
import { renderWithProviders } from '../../../test-utils'
import { VerifyDeploymentPage } from '.'

const release = KNOWN_RELEASES[0]!

afterEach(() => activateLocale('en'))

describe('VerifyDeploymentPage', () => {
  it('checks the pins, the wiring and the committee of the demo deployment', async () => {
    renderWithProviders(<VerifyDeploymentPage />, { route: '/verify/deployment' })
    const release_ = screen.getByTestId('check-release')
    expect(release_).toHaveAttribute('data-status', 'pass')
    expect(release_).toHaveTextContent(`published with ${release.label}`)
    for (const pin of [
      'batchProgramVK',
      'resultsProgramVK',
      'rootCVadcopFinal',
      'ziskVerifierCodeHash',
      'ballotVKHash',
    ]) {
      expect(within(release_).getByTestId(`pin-${pin}`)).toHaveAttribute('data-state', 'pass')
    }
    expect(within(release_).getByTestId('pin-batchProgramVK')).toHaveTextContent(
      'The program that checks every batch of votes'
    )
    await waitFor(() => expect(screen.getByTestId('check-contracts')).toHaveAttribute('data-status', 'pass'))
    await waitFor(() => expect(screen.getByTestId('check-dkg')).toHaveAttribute('data-status', 'pass'))
    expect(screen.getByTestId('deployment-summary')).toHaveTextContent('All 3 checks passed.')
    expect(screen.getByTestId('contract-row-registry')).toHaveTextContent('ProcessRegistry')
  })

  it('keeps each value’s source, each link’s relation and each contract’s mechanism under the details', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VerifyDeploymentPage />, { route: '/verify/deployment' })
    const formulas = (el: HTMLElement) =>
      Array.from(el.querySelectorAll('[data-formula]')).map((f) => f.textContent ?? '')

    const release_ = screen.getByTestId('check-release')
    await user.click(within(release_).getByText('How this is checked'))
    const pins = within(release_).getByTestId('pin-details')
    expect(formulas(pins)).toEqual(
      expect.arrayContaining(['registry.batchProgramVK()', 'keccak256(eth_getCode(ziskVerifier))'])
    )
    expect(pins).toHaveTextContent('cargo-zisk setup')

    const contracts = screen.getByTestId('check-contracts')
    await waitFor(() => expect(contracts).toHaveAttribute('data-status', 'pass'))
    await user.click(within(contracts).getByText('How this is checked'))
    expect(formulas(within(contracts).getByTestId('wiring-checks'))).toEqual(
      expect.arrayContaining(['adapter.registry() = registry', 'DKGManager.CHAIN_ID() = CHAIN_ID'])
    )
    expect(within(contracts).getByTestId('contract-details')).toHaveTextContent('verifySnarkProof')

    const dkg = screen.getByTestId('check-dkg')
    await waitFor(() => expect(dkg).toHaveAttribute('data-status', 'pass'))
    await user.click(within(dkg).getByText('How this is checked'))
    expect(within(dkg).getByTestId('dkg-verifier-finalize')).toHaveTextContent('finalizeEpoch')
  })

  it('switches the verification command between the chain’s pins and the release’s', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VerifyDeploymentPage />, { route: '/verify/deployment' })
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

  it('leaves the commands alone in another language', async () => {
    await activateLocale('es')
    renderWithProviders(<VerifyDeploymentPage />, { route: '/verify/deployment' })
    expect(screen.getByTestId('verify-script')).toHaveTextContent(`--batch-vk ${release.batchProgramVK}`)
  })
})
