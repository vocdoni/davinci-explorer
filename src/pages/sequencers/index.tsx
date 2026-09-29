import { useMemo, useState } from 'react'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import type { SortingState } from '@tanstack/react-table'
import { Link, useNavigate, useParams } from 'react-router'
import { NativeAmount, Term, Timestamp } from '~components'
import { useIndexer, useStore } from '~data/hooks'
import { useSequencers } from '~data/queries'
import { useMeasuredWidth } from '~hooks/use-measured-width'
import { sequencerActivity, sequencerRows, type SequencerRow } from '~indexer/selectors'
import {
  Address,
  Card,
  DataTable,
  EmptyState,
  SectionHeader,
  SkeletonText,
  Stack,
  StatCell,
  StatRow,
  Tooltip,
  uriHost,
  type AnyColumnDef,
} from '~kit'
import { Sparkline } from '~kit/charts'
import { formatNumber } from '~lib/format'
import { paths } from '~routes/paths'
import { SequencerPage } from './detail'
import { SettlementDetails } from './explain'
import { sequencerEntries, type SequencerEntry } from './model'
import { NodeBadges } from './SequencerCard'

const DAYS = 30
/** Below this width the list is cards, not a table. */
const TABLE_MIN_WIDTH = 1100

interface Row extends SequencerEntry {
  /** Batches per UTC day over the last `DAYS` days, for the sparkline. */
  activity: number[]
}

const cmp = (a: bigint | number, b: bigint | number) => (a < b ? -1 : a > b ? 1 : 0)

/** `/sequencers` lists them; `/sequencers/:address` is one of them. */
export function SequencersPage() {
  const { address } = useParams()
  return address ? <SequencerPage /> : <SequencerList />
}

/** Every account that recorded batches or published results, with what each configured node reports. */
function SequencerList() {
  const { t } = useLingui()
  const store = useStore()
  const nodes = useSequencers()
  const { loading } = useIndexer()
  const [ref, width] = useMeasuredWidth<HTMLDivElement>()
  const onchain = useMemo(() => sequencerRows(store), [store])
  const rows = useMemo<Row[]>(
    () =>
      sequencerEntries(onchain, nodes).map((e) => ({
        ...e,
        activity: e.onchain ? sequencerActivity(store, e.onchain.address, DAYS).map((d) => d.transitions) : [],
      })),
    [onchain, nodes, store]
  )
  const totals = useMemo(
    () =>
      onchain.reduce(
        (acc, r) => ({
          transitions: acc.transitions + r.transitions,
          ballots: acc.ballots + r.ballots,
          overwrites: acc.overwrites + r.overwrites,
          fees: acc.fees + r.fees,
          pending: acc.pending + r.feesPending,
        }),
        { transitions: 0, ballots: 0, overwrites: 0, fees: 0n, pending: 0 }
      ),
    [onchain]
  )

  const configured = nodes.length
  const overwrites = totals.overwrites
  // jsdom measures 0: keep the table there.
  const narrow = width != null && width > 0 && width < TABLE_MIN_WIDTH

  return (
    <Stack data-testid='page-sequencers'>
      <SectionHeader
        size='page'
        label={t`Sequencers`}
        title={t`Who records the votes`}
        description={
          <Trans>
            A <Term id='sequencer'>sequencer</Term> collects the encrypted ballots, proves them in batches and records
            each batch on the registry, which checks the proof before accepting it. Anyone can run one: the registry
            takes a batch from any account, as long as its proof is valid.
          </Trans>
        }
      />

      <SettlementDetails />

      <StatRow>
        <StatCell
          label={t`Sequencers`}
          value={formatNumber(onchain.length)}
          mono
          loading={loading}
          hint={
            configured > 0
              ? t`${plural(configured, { one: '# API configured', other: '# APIs configured' })}`
              : t`from the chain`
          }
        />
        <StatCell
          label={t`Batches`}
          value={formatNumber(totals.transitions)}
          mono
          loading={loading}
          hint={t`recorded on the chain`}
        />
        <StatCell
          label={t`Votes`}
          value={formatNumber(totals.ballots)}
          mono
          loading={loading}
          hint={t`${plural(overwrites, { one: 'including # changed vote', other: 'including # changed votes' })}`}
        />
        <StatCell
          label={t`Fees paid`}
          value={<Fees row={{ fees: totals.fees, feesPending: totals.pending }} />}
          loading={loading}
          hint={t`execution and blob gas`}
        />
      </StatRow>

      <Card flush className='overflow-hidden'>
        <div className='border-b border-charcoal px-5 py-4'>
          <h2 className='text-[15px] font-semibold text-ghost'>
            <Trans>Every sequencer</Trans>
          </h2>
          <p className='mt-1 text-[13px] leading-relaxed text-ash'>
            <Trans>
              One row per account that recorded a batch or published results on this registry, read from the chain, and
              one per configured sequencer API whose account has not. Open one for its batches and what its node
              reports.
            </Trans>
          </p>
        </div>
        <div ref={ref} data-testid='sequencer-table'>
          {narrow ? (
            <SequencerCards rows={rows} loading={loading} showNodes={configured > 0} />
          ) : (
            <SequencerTable rows={rows} loading={loading} showNodes={configured > 0} />
          )}
        </div>
        {configured === 0 ? (
          <p className='border-t border-charcoal px-5 py-3 text-[12px] leading-relaxed text-ash'>
            <Trans>
              No sequencer API is configured, so everything here comes from the chain. A node’s API adds what only it
              knows: whether it is online, its role and counters, a vote’s status before it is recorded, receipts for
              votes (tracker proofs) and data the beacon no longer serves. List node URLs in <code>SEQUENCER_URLS</code>{' '}
              to add them.
            </Trans>
          </p>
        ) : null}
      </Card>
    </Stack>
  )
}

/** Fees in the native token, "≥" while some receipts are still to read. */
function Fees({ row, className }: { row: Pick<SequencerRow, 'fees' | 'feesPending'>; className?: string }) {
  const pending = row.feesPending > 0
  return (
    <span className='inline-flex items-baseline gap-1'>
      {pending ? <span className='text-ash'>≥</span> : null}
      <NativeAmount wei={row.fees} digits={4} className={className} />
    </span>
  )
}

/** The account (or the node's host when it reports none), linking to its page; the node's host under it. */
function SequencerName({ row }: { row: Row }) {
  const node = row.nodes[0]
  return (
    <div className='flex min-w-0 flex-col gap-0.5'>
      {row.address ? (
        <Address value={row.address} chars={6} to={paths.sequencer(row.key)} />
      ) : (
        <Link
          to={paths.sequencer(row.key)}
          onClick={(e) => e.stopPropagation()}
          className='truncate font-mono text-[12px] text-silver hover:text-emerald'
        >
          {node ? uriHost(node.endpoint.upstream) : row.key}
        </Link>
      )}
      {row.address && node ? (
        <Tooltip content={node.endpoint.upstream} value>
          <span className='truncate font-mono text-[11px] text-ash'>{uriHost(node.endpoint.upstream)}</span>
        </Tooltip>
      ) : null}
    </div>
  )
}

function NodeCell({ row, wrap }: { row: Row; wrap?: boolean }) {
  return row.nodes[0] ? (
    <NodeBadges node={row.nodes[0]} size='sm' wrap={wrap} />
  ) : (
    <span className='text-[12px] text-ash'>
      <Trans>not configured</Trans>
    </span>
  )
}

/** `showNodes`: the node column, only when some sequencer API is configured. */
function SequencerTable({ rows, loading, showNodes }: { rows: Row[]; loading: boolean; showNodes: boolean }) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const [sorting, setSorting] = useState<SortingState>([])
  // Built here, not at module scope: the headers and tooltips are text.
  const columns = useMemo<AnyColumnDef<Row>[]>(() => {
    const num = (id: string, header: string, value: (r: Row) => number, headerTooltip: string, width = '96px') =>
      ({
        id,
        header,
        accessorFn: value,
        cell: ({ row }) =>
          row.original.onchain ? formatNumber(value(row.original)) : <span className='text-ash'>—</span>,
        meta: { numeric: true, width, headerWrap: true, headerTooltip },
      }) satisfies AnyColumnDef<Row>
    const time = (id: 'first' | 'last', header: string) =>
      ({
        id,
        header,
        accessorFn: (r) => r.onchain?.[id].block ?? -1,
        cell: ({ row }) =>
          row.original.onchain ? (
            <Timestamp value={row.original.onchain[id].timestamp} className='text-[12px]' />
          ) : (
            <span className='text-ash'>—</span>
          ),
        meta: { align: 'right', width: '110px', headerWrap: true },
      }) satisfies AnyColumnDef<Row>
    return [
      {
        id: 'sequencer',
        header: t`Sequencer`,
        accessorFn: (r) => r.address ?? '',
        enableSorting: false,
        cell: ({ row }) => <SequencerName row={row.original} />,
        meta: { width: '220px' },
      },
      {
        id: 'node',
        header: t`Node API`,
        accessorFn: (r) => r.nodes.length,
        enableSorting: false,
        cell: ({ row }) => <NodeCell row={row.original} wrap={false} />,
        meta: {
          width: '170px',
          headerTooltip: t`What a configured sequencer API reports: whether it answers, and whether it records batches (signer) or only follows (observer).`,
        },
      },
      num(
        'transitions',
        t`Batches`,
        (r) => r.onchain?.transitions ?? 0,
        t`Batches of votes it recorded, each proven and accepted by the registry (state transitions).`
      ),
      num(
        'ballots',
        t`Votes`,
        (r) => r.onchain?.ballots ?? 0,
        t`Votes in those batches: new votes plus changed votes.`
      ),
      num(
        'processes',
        t`Processes`,
        (r) => r.onchain?.processes ?? 0,
        t`The elections it recorded a batch or published results for.`
      ),
      num(
        'blobs',
        t`Data blobs`,
        (r) => r.onchain?.blobs ?? 0,
        t`Data blobs its batches published (EIP-4844).`,
        '76px'
      ),
      {
        id: 'fees',
        header: t`Fees paid`,
        accessorFn: (r) => r.onchain?.fees ?? -1n,
        sortingFn: (a, b) => cmp(a.original.onchain?.fees ?? -1n, b.original.onchain?.fees ?? -1n),
        cell: ({ row }) =>
          row.original.onchain ? (
            <Fees row={row.original.onchain} className='text-[12px]' />
          ) : (
            <span className='text-ash'>—</span>
          ),
        meta: {
          numeric: true,
          width: '140px',
          headerWrap: true,
          headerTooltip: t`Execution and blob gas of the transactions that recorded its batches and results. Failed transactions leave no registry event and are not counted.`,
        },
      },
      num('results', t`Results`, (r) => r.onchain?.results ?? 0, t`The results of elections it published.`, '84px'),
      time('first', t`First active`),
      time('last', t`Last active`),
      {
        id: 'activity',
        header: t`Last ${DAYS} days`,
        accessorFn: (r) => r.activity.reduce((n, v) => n + v, 0),
        enableSorting: false,
        cell: ({ row }) => (
          <Sparkline
            values={row.original.activity}
            width={88}
            height={22}
            ariaLabel={t`Batches per day over the last ${DAYS} days`}
          />
        ),
        meta: { align: 'right', width: '112px', headerWrap: true, headerTooltip: t`Batches recorded per UTC day.` },
      },
    ]
  }, [t])
  const visible = useMemo(() => (showNodes ? columns : columns.filter((c) => c.id !== 'node')), [columns, showNodes])

  return (
    <DataTable
      data={rows}
      columns={visible}
      loading={loading}
      loadingRows={3}
      getRowId={(r) => r.key}
      sorting={sorting}
      onSortingChange={setSorting}
      onRowClick={(r) => navigate(paths.sequencer(r.key))}
      maxHeight={100_000}
      empty={<NoSequencer />}
    />
  )
}

function NoSequencer() {
  const { t } = useLingui()
  return (
    <EmptyState
      title={t`No sequencer yet`}
      description={t`Once a sequencer records the first batch of an election, its account shows up here.`}
    />
  )
}

/** The same rows as cards, for a phone. */
function SequencerCards({ rows, loading, showNodes }: { rows: Row[]; loading: boolean; showNodes: boolean }) {
  const { t } = useLingui()
  if (loading) return <SkeletonText lines={4} className='p-5' />
  if (rows.length === 0) return <NoSequencer />
  return (
    <ul className='divide-y divide-charcoal'>
      {rows.map((r) => {
        const o = r.onchain
        const stats: Array<[string, string]> = o
          ? [
              [t`Batches`, formatNumber(o.transitions)],
              [t`Votes`, formatNumber(o.ballots)],
              [t`Processes`, formatNumber(o.processes)],
              [t`Data blobs`, formatNumber(o.blobs)],
              [t`Results`, formatNumber(o.results)],
            ]
          : []
        return (
          <li key={r.key} className='flex flex-col gap-3 px-5 py-4'>
            <div className='flex flex-wrap items-start justify-between gap-2'>
              <SequencerName row={r} />
              {showNodes ? <NodeCell row={r} /> : null}
            </div>
            {o ? (
              <>
                <dl className='grid grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-6'>
                  {stats.map(([label, value]) => (
                    <div key={label} className='min-w-0'>
                      <dt className='label-caps truncate text-[10px] text-pewter'>{label}</dt>
                      <dd className='font-mono text-[13px] text-silver tnum'>{value}</dd>
                    </div>
                  ))}
                  <div className='min-w-0'>
                    <dt className='label-caps truncate text-[10px] text-pewter'>
                      <Trans>Fees paid</Trans>
                    </dt>
                    <dd className='text-[12px] text-silver'>
                      <Fees row={o} />
                    </dd>
                  </div>
                </dl>
                <div className='flex items-end justify-between gap-3 text-[12px] text-ash'>
                  <span className='flex flex-col gap-0.5'>
                    <span>
                      <Trans>
                        first active <Timestamp value={o.first.timestamp} className='text-silver' />
                      </Trans>
                    </span>
                    <span>
                      <Trans>
                        last active <Timestamp value={o.last.timestamp} className='text-silver' />
                      </Trans>
                    </span>
                  </span>
                  <Sparkline
                    values={r.activity}
                    width={96}
                    height={22}
                    ariaLabel={t`Batches per day over the last ${DAYS} days`}
                  />
                </div>
              </>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
