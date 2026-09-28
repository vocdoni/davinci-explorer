import { plural } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { Explain, Timestamp } from '~components'
import { useNetworkName } from '~config/config-context'
import { useIndexer, useNetworkStats } from '~data/hooks'
import { buttonClasses, Callout, SectionHeader, Stack, StatCell, StatRow } from '~kit'
import { formatNumber } from '~lib/format'
import { paths } from '~routes/paths'
import { ActivityPanel } from './ActivityPanel'
import { NetworkCard } from './NetworkCard'
import { ProcessesPanel } from './ProcessesPanel'
import { RoleCards } from './RoleCards'
import { VotesPerDayPanel } from './VotesPerDayPanel'

/** The front page: what the deployment is doing, and where to start checking it. */
export function OverviewPage() {
  const { t } = useLingui()
  const networkName = useNetworkName()
  const stats = useNetworkStats()
  const { loading } = useIndexer()
  const empty = !loading && stats.processes === 0
  const open = stats.byPhase.open
  const withResults = formatNumber(stats.withResults)
  const voters = stats.voters
  const overwrites = stats.overwrites
  const lastBlock = stats.lastActivity ? formatNumber(stats.lastActivity.block) : null
  const blobs = stats.blobs

  return (
    <Stack data-testid='page-overview'>
      <SectionHeader
        size='page'
        label={t`Overview`}
        title={networkName}
        description={t`What this DAVINCI deployment is doing, and how to check it yourself. Everything here is read from the chain by your browser.`}
        actions={
          <Link to={paths.processes()} className={buttonClasses('secondary', 'md')}>
            <Trans>Browse processes</Trans>
          </Link>
        }
      />

      {empty ? (
        <div data-testid='empty-registry'>
          <Callout tone='info' title={t`No processes on this registry yet`}>
            <Trans>
              The registry is deployed and the explorer is watching it. When an organizer creates a process it shows up
              here with its ballot rules, census and key. Each batch a sequencer settles then appears as a state
              transition with its blobs, and the tally appears once the process ends. Meanwhile you can already check
              the deployment itself.
            </Trans>
          </Callout>
        </div>
      ) : null}

      <StatRow>
        <StatCell
          label={t`Processes`}
          value={formatNumber(stats.processes)}
          loading={loading}
          mono
          hint={t`${plural(open, { one: '# open', other: '# open' })} · ${withResults} with results`}
        />
        <StatCell
          label={t`Ballots settled`}
          value={formatNumber(stats.ballots)}
          loading={loading}
          mono
          tone={stats.ballots > 0 ? 'accent' : 'default'}
          hint={t`${plural(voters, { one: '# voter', other: '# voters' })} · ${plural(overwrites, {
            one: '# overwrite',
            other: '# overwrites',
          })}`}
          aside={
            <Explain>
              <Trans>
                Votes in settled batches. A voter counts once however often they vote again; each later vote is an
                overwrite that replaces the previous one.
              </Trans>
            </Explain>
          }
        />
        <StatCell
          label={t`Transitions`}
          value={formatNumber(stats.transitions)}
          loading={loading}
          mono
          hint={<Plural value={blobs} one='# blob published' other='# blobs published' />}
          aside={
            <Explain>
              <Trans>
                A transition is one batch of votes a sequencer proved and settled on the registry. Its data travels in
                EIP-4844 blobs, so anyone can rebuild the state.
              </Trans>
            </Explain>
          }
        />
        <StatCell
          label={t`Last activity`}
          value={stats.lastActivity ? <Timestamp value={stats.lastActivity.timestamp} /> : '—'}
          loading={loading}
          hint={lastBlock ? t`block ${lastBlock}` : t`no registry events yet`}
        />
      </StatRow>

      <RoleCards />

      <div className='grid items-start gap-6 lg:grid-cols-5'>
        <Stack className='min-w-0 lg:col-span-3'>
          <VotesPerDayPanel />
          <ActivityPanel />
        </Stack>
        <Stack className='min-w-0 lg:col-span-2'>
          <NetworkCard />
          <ProcessesPanel />
        </Stack>
      </div>
    </Stack>
  )
}
