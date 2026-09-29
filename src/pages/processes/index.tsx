import { useEffect, useMemo, useState } from 'react'
import { plural } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import type { SortingState } from '@tanstack/react-table'
import { useNavigate, useSearchParams } from 'react-router'
import { CensusOriginBadge, Explain, KeyModeBadge, ProcessPhaseBadge, Term, Timestamp } from '~components'
import { ProcessName } from '~components/ProcessName'
import { useIndexer, useNetworkStats, useProcesses } from '~data/hooks'
import type { ProcessRow } from '~indexer/selectors'
import {
  Address,
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  SearchIcon,
  SectionHeader,
  Select,
  Stack,
  Tooltip,
  type AnyColumnDef,
} from '~kit'
import { formatNumber } from '~lib/format'
import { CENSUS_ORIGIN_INFO, KEY_MODE_INFO } from '~protocol/types'
import { paths, type ProcessListFilter } from '~routes/paths'
import { CENSUS_OPTIONS, isFiltered, KEY_MODE_OPTIONS, PHASE_OPTIONS, readProcessFilter } from './filters'

const ADDRESS = /^0x[0-9a-fA-F]{40}$/

/** Every process on the registry, filtered and searched through the URL query. */
export function ProcessesPage() {
  const { i18n, t } = useLingui()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { list, filter } = useMemo(() => readProcessFilter(params), [params])
  const rows = useProcesses(filter)
  const stats = useNetworkStats()
  const { loading } = useIndexer()
  const filtered = isFiltered(list)
  // Controlled sorting: uncontrolled, the kit table passes onSortingChange: undefined over
  // TanStack's default updater and header clicks do nothing.
  const [sorting, setSorting] = useState<SortingState>([])

  const apply = (next: Partial<ProcessListFilter>) => navigate(paths.processes({ ...list, ...next }), { replace: true })

  // The organizer box applies once it holds a whole address (or nothing).
  const [organizer, setOrganizer] = useState(list.organizer ?? '')
  useEffect(() => setOrganizer(list.organizer ?? ''), [list.organizer])
  const organizerInvalid = organizer.trim() !== '' && !ADDRESS.test(organizer.trim())

  // Built here, not at module scope: the headers and tooltips are text.
  const columns = useMemo<AnyColumnDef<ProcessRow>[]>(
    () => [
      {
        id: 'id',
        header: t`Process`,
        accessorKey: 'createdBlock',
        cell: ({ row }) => (
          <ProcessName
            id={row.original.id}
            metadataURI={row.original.metadataURI}
            metadataHash={row.original.metadataHash}
          />
        ),
        meta: {
          width: '240px',
          headerTooltip: t`The election’s title and its process id. Sorts by creation time.`,
        },
      },
      {
        id: 'organizer',
        header: t`Organizer`,
        accessorKey: 'organizer',
        cell: ({ row }) => (
          <Address
            value={row.original.organizer}
            to={paths.processes({ organizer: row.original.organizer })}
            explorer={false}
          />
        ),
        meta: { headerTooltip: t`The account that created the election. Click it to list only its processes.` },
      },
      {
        id: 'phase',
        header: t`Phase`,
        accessorKey: 'phase',
        cell: ({ row }) => <ProcessPhaseBadge phase={row.original.phase} size='sm' />,
      },
      {
        id: 'keyMode',
        header: t`Key`,
        accessorFn: (r) => r.keyMode ?? '',
        cell: ({ row }) => (row.original.keyMode ? <KeyModeBadge mode={row.original.keyMode} size='sm' /> : '—'),
        meta: { headerTooltip: t`Who holds the key the ballots are encrypted to, and so who can decrypt the results.` },
      },
      {
        id: 'census',
        header: t`List of voters`,
        accessorFn: (r) => r.censusOrigin ?? '',
        cell: ({ row }) =>
          row.original.censusOrigin ? <CensusOriginBadge origin={row.original.censusOrigin} size='sm' /> : '—',
        meta: { headerTooltip: t`Where the list of voters comes from.` },
      },
      {
        id: 'voters',
        header: t`Voters / changed votes`,
        accessorKey: 'votersCount',
        cell: ({ row }) => {
          const r = row.original
          const maxVoters = r.maxVoters
          return (
            <Tooltip
              content={
                maxVoters != null
                  ? t`at most ${plural(maxVoters, { one: '# voter', other: '# voters' })}`
                  : t`max voters not read yet`
              }
            >
              <span>
                {formatNumber(r.votersCount)}
                <span className='text-ash'> / {formatNumber(r.overwrittenVotesCount)}</span>
              </span>
            </Tooltip>
          )
        },
        meta: {
          numeric: true,
          headerWrap: true,
          headerTooltip: t`How many people voted, and how many later votes replaced someone’s earlier vote.`,
        },
      },
      {
        id: 'start',
        header: t`Start`,
        accessorFn: (r) => r.startTime ?? 0,
        cell: ({ row }) => <Timestamp value={row.original.startTime} className='text-[12px]' />,
        meta: { align: 'right' },
      },
      {
        id: 'end',
        header: t`End`,
        accessorFn: (r) => r.endTime ?? 0,
        cell: ({ row }) => <Timestamp value={row.original.endTime} className='text-[12px]' />,
        meta: {
          align: 'right',
          headerTooltip: t`When voting ends: the start time plus the duration. Ending early brings it forward.`,
        },
      },
    ],
    [t]
  )
  const count = rows.length
  const total = formatNumber(stats.processes)

  return (
    <Stack data-testid='page-processes'>
      <SectionHeader
        size='page'
        label={t`Processes`}
        title={t`Every voting process on the registry`}
        description={
          <Trans>
            Each process is one election. It sets its <Term id='ballot-mode'>ballot rules</Term>, its{' '}
            <Term id='census'>list of voters</Term> and its <Term id='encryption-key'>election key</Term> when it is
            created. Votes are then recorded in <Term id='batch'>batches</Term> until voting ends and the results are
            published.
          </Trans>
        }
      />

      <Card className='flex flex-col gap-4'>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_minmax(0,2fr)]'>
          <Input
            label={t`Search`}
            aria-label={t`Search processes by id or organizer`}
            placeholder={t`Process id or organizer, or part of one`}
            mono
            iconLeft={<SearchIcon size={14} />}
            value={params.get('q') ?? ''}
            onChange={(e) => apply({ q: e.target.value || undefined })}
          />
          <Select
            label={t`Phase`}
            value={list.status ?? ''}
            onChange={(e) => apply({ status: e.target.value || undefined })}
            options={[
              { value: '', label: t`Any phase` },
              ...PHASE_OPTIONS.map((o) => ({ value: o.value, label: i18n._(o.label) })),
            ]}
          />
          <Select
            label={t`Key holder`}
            value={list.keyMode ?? ''}
            onChange={(e) => apply({ keyMode: e.target.value || undefined })}
            options={[
              { value: '', label: t`Any key holder` },
              ...KEY_MODE_OPTIONS.map((value) => ({ value, label: KEY_MODE_INFO[value].label })),
            ]}
          />
          <Select
            label={t`List of voters`}
            value={list.census ?? ''}
            onChange={(e) => apply({ census: e.target.value || undefined })}
            options={[
              { value: '', label: t`Any list` },
              ...CENSUS_OPTIONS.map((value) => ({ value, label: CENSUS_ORIGIN_INFO[value].label })),
            ]}
          />
          <Input
            label={t`Organizer`}
            placeholder={t`0x… (whole address)`}
            mono
            value={organizer}
            error={organizerInvalid ? t`An address is 0x followed by 40 hex digits.` : undefined}
            onChange={(e) => {
              const value = e.target.value
              setOrganizer(value)
              const v = value.trim()
              if (v === '') apply({ organizer: undefined })
              else if (ADDRESS.test(v)) apply({ organizer: v.toLowerCase() })
            }}
          />
        </div>
        <div className='flex flex-wrap items-center justify-between gap-3 text-[13px] text-ash'>
          <p>
            {filtered ? (
              <Trans>
                <span data-testid='process-count' className='font-medium text-silver'>
                  <Plural value={count} one='# process' other='# processes' />
                </span>{' '}
                <Plural value={count} one='matches' other='match' />, of {total} on the registry.
              </Trans>
            ) : (
              <Trans>
                <span data-testid='process-count' className='font-medium text-silver'>
                  <Plural value={count} one='# process' other='# processes' />
                </span>{' '}
                on the registry, newest first.
              </Trans>
            )}
            <Explain className='ml-1'>
              <Trans>
                The phase combines the status on the chain with the clock. After its end time an election still reads
                Ready on the chain until someone ends it or publishes the results; the explorer shows that as Voting
                closed.
              </Trans>
            </Explain>
          </p>
          {filtered ? (
            <Button size='sm' variant='subtle' onClick={() => navigate(paths.processes(), { replace: true })}>
              <Trans>Clear filters</Trans>
            </Button>
          ) : null}
        </div>
      </Card>

      <Card flush className='overflow-hidden'>
        <DataTable
          data={rows}
          columns={columns}
          loading={loading}
          getRowId={(r) => r.id}
          sorting={sorting}
          onSortingChange={setSorting}
          onRowClick={(r) => navigate(paths.process(r.id))}
          virtualized={rows.length > 50}
          maxHeight={rows.length > 50 ? 640 : 100_000}
          empty={
            filtered ? (
              <EmptyState
                title={t`No process matches these filters`}
                description={t`Widen the phase, key holder or list of voters, or clear the search.`}
                action={
                  <Button size='sm' variant='ghost' onClick={() => navigate(paths.processes(), { replace: true })}>
                    <Trans>Clear filters</Trans>
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title={t`No processes yet`}
                description={t`When an organizer creates an election (newProcess on the registry), it appears here with its phase, key holder, list of voters and progress.`}
              />
            )
          }
        />
      </Card>
    </Stack>
  )
}
