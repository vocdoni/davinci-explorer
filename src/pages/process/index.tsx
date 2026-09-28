import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useNavigate, useParams } from 'react-router'
import { CensusOriginBadge, KeyModeBadge, MissingEntity, ProcessPhaseBadge } from '~components'
import { useProcess } from '~data/hooks'
import { useJsonDocument } from '~data/queries'
import { Address, Hash, SectionHeader, Stack, StatCell, StatRow, Tabs } from '~kit'
import { formatNumber, shortHash } from '~lib/format'
import { isProcessTab, paths, type ProcessTab } from '~routes/paths'
import { Lifecycle } from './Lifecycle'
import { fetchableUri, metadataTitle } from './metadata'
import { KeyTab } from './tabs/KeyTab'
import { OverviewTab } from './tabs/OverviewTab'
import { RawTab } from './tabs/RawTab'
import { ResultsTab } from './tabs/ResultsTab'
import { TransitionsTab } from './tabs/TransitionsTab'
import { VotesTab } from './tabs/VotesTab'

// Header (phase, lifecycle, counters) plus one tab per aspect; the active tab
// is the last path segment (/processes/:pid/:tab), so every tab is linkable.
export function ProcessPage() {
  const { t } = useLingui()
  const { pid, tab } = useParams()
  const navigate = useNavigate()
  const view = useProcess(pid)
  const active: ProcessTab = isProcessTab(tab) ? tab : 'overview'
  const metadata = useJsonDocument(fetchableUri(view?.process.state?.metadataURI))

  if (!pid || !view) return <MissingEntity what='process' id={pid} />
  const { process, row, transitions } = view
  const title = metadataTitle(metadata.data)
  const blobs = transitions.reduce((n, tr) => n + tr.nBlobs, 0)
  const ballots = transitions.reduce((n, tr) => n + tr.votes, 0)
  const short = shortHash(process.id, 8, 6)
  const maxVoters = row.maxVoters != null ? formatNumber(row.maxVoters) : null

  return (
    <Stack data-testid='page-process'>
      <SectionHeader
        size='page'
        label={t`Process`}
        title={title ?? t`Process ${short}`}
        description={
          <span className='flex flex-col gap-1'>
            <span className='inline-flex min-w-0 flex-wrap items-center gap-x-2'>
              <span className='text-ash'>
                <Trans>id</Trans>
              </span>
              <Hash value={process.id} chars={14} />
            </span>
            <span className='inline-flex min-w-0 flex-wrap items-center gap-x-2'>
              <span className='text-ash'>
                <Trans>organizer</Trans>
              </span>
              <Address value={process.organizer} to={paths.processes({ organizer: process.organizer })} />
            </span>
          </span>
        }
        actions={
          <>
            <ProcessPhaseBadge phase={row.phase} />
            {row.keyMode ? <KeyModeBadge mode={row.keyMode} /> : null}
            {row.censusOrigin ? <CensusOriginBadge origin={row.censusOrigin} /> : null}
          </>
        }
      />

      <Lifecycle view={view} />

      <StatRow>
        <StatCell
          label={t`Voters`}
          value={formatNumber(row.votersCount)}
          mono
          hint={maxVoters != null ? t`of at most ${maxVoters}` : undefined}
        />
        <StatCell
          label={t`Overwrites`}
          value={formatNumber(row.overwrittenVotesCount)}
          mono
          hint={t`votes that replaced an earlier one`}
        />
        <StatCell
          label={t`Transitions`}
          value={formatNumber(transitions.length)}
          mono
          hint={t`${plural(ballots, { one: '# ballot settled', other: '# ballots settled' })}`}
        />
        <StatCell label={t`Blobs`} value={formatNumber(blobs)} mono hint={t`EIP-4844 data blobs published`} />
      </StatRow>

      <Tabs
        value={active}
        onValueChange={(value) => navigate(paths.process(process.id, value as ProcessTab))}
        items={[
          { value: 'overview', label: t`Overview`, content: <OverviewTab view={view} /> },
          { value: 'key', label: t`Encryption key`, content: <KeyTab view={view} /> },
          {
            value: 'transitions',
            label: t`Transitions`,
            meta: formatNumber(transitions.length),
            content: <TransitionsTab view={view} />,
          },
          { value: 'votes', label: t`Votes`, content: <VotesTab view={view} /> },
          { value: 'results', label: t`Results`, content: <ResultsTab view={view} /> },
          { value: 'raw', label: t`Raw`, content: <RawTab view={view} /> },
        ]}
      />
    </Stack>
  )
}
