import { useEffect, useMemo } from 'react'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Link, useLocation } from 'react-router'
import { HashLink } from '~components/HashLink'
import { useRuntimeConfig } from '~config/config-context'
import { useDeploymentDetails } from '~data/deployment'
import { useChain, useReleaseCheck } from '~data/hooks'
import { Callout, SectionHeader, Stack } from '~kit'
import { paths } from '~routes/paths'
import { AddressesPanel } from './AddressesPanel'
import { DkgPanel } from './DkgPanel'
import { ParametersPanel } from './ParametersPanel'
import { ReleasePanel } from './ReleasePanel'
import { VerifyPanel } from './VerifyPanel'
import { contractRows, publicRpc, releaseVerdict, wiringChecks } from './model'

const SECTIONS: Array<{ id: string; label: MessageDescriptor }> = [
  { id: 'addresses', label: msg`Addresses` },
  { id: 'parameters', label: msg`Pinned values` },
  { id: 'release', label: msg`Release check` },
  { id: 'verify', label: msg`Verify it yourself` },
  { id: 'dkg', label: msg`DKG committee` },
]

/** The auditor's page: what the deployment is, what it is pinned to, and how to check both. */
export function ContractsPage() {
  const { i18n, t } = useLingui()
  const config = useRuntimeConfig()
  const chain = useChain()
  const match = useReleaseCheck()
  const details = useDeploymentDetails()
  const { hash } = useLocation()

  const rows = useMemo(() => contractRows(chain, details.data), [chain, details.data])
  const checks = useMemo(() => wiringChecks(chain, details.data, config.chainId), [chain, details.data, config.chainId])
  const verdict = releaseVerdict(match)
  const ready = chain.registry != null
  const released = match.release?.label

  // Deep links (#verify, #dkg) land after the lazy page and its data have rendered.
  useEffect(() => {
    if (!hash) return
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
  }, [hash, ready])

  return (
    <Stack data-testid='page-contracts'>
      <SectionHeader
        size='page'
        label={t`Contracts`}
        title={t`Contracts and parameters`}
        description={t`What this deployment is made of and what it is pinned to: the contract addresses, the verification keys every proof is checked against, and the commands to check both without trusting this page.`}
      />

      <Callout
        tone={verdict.tone}
        title={
          released
            ? t`Pinned to ${released}`
            : verdict.tone === 'danger'
              ? t`The pins differ from the known releases`
              : t`Checking the pins`
        }
        actions={
          <HashLink id='release' className='text-[12px] whitespace-nowrap text-pewter hover:text-emerald'>
            <Trans>Details</Trans>
          </HashLink>
        }
      >
        <span data-testid='release-summary'>{i18n._(verdict.text)}</span>{' '}
        {match.release ? (
          <Trans>
            Every transition and every sequencer-key tally on this registry is verified against the released guests, the
            released ZisK setup and the released verifier code.
          </Trans>
        ) : null}
      </Callout>

      <nav aria-label={t`On this page`} className='flex flex-wrap gap-x-4 gap-y-1 text-[12px]'>
        {SECTIONS.map((s) => (
          <HashLink key={s.id} id={s.id} className='text-pewter transition-colors hover:text-emerald'>
            {i18n._(s.label)}
          </HashLink>
        ))}
        <Link to={paths.learn('verify-auditor')} className='text-pewter transition-colors hover:text-emerald'>
          <Trans>The auditor’s guide</Trans>
        </Link>
      </nav>

      <section id='addresses' className='scroll-mt-20'>
        <AddressesPanel rows={rows} checks={checks} />
      </section>
      <section id='parameters' className='scroll-mt-20'>
        <ParametersPanel chain={chain} details={details.data} />
      </section>
      <section id='release' className='scroll-mt-20'>
        <ReleasePanel match={match} />
      </section>
      <section id='verify' className='scroll-mt-20'>
        <VerifyPanel chain={chain} rpc={publicRpc(config.rpcUrls)} match={match} />
      </section>
      <section id='dkg' className='scroll-mt-20'>
        <DkgPanel
          chain={chain}
          dkg={details.data?.dkg}
          loading={details.isLoading || !ready}
          error={details.error ? (details.error as Error).message : null}
        />
      </section>
    </Stack>
  )
}
