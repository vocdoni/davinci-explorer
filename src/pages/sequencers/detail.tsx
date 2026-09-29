import { useEffect, useMemo, useState } from 'react'
import { plural } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { Link, useParams } from 'react-router'
import { MissingEntity, NativeAmount, Timestamp, TxLink } from '~components'
import { useRuntimeConfig } from '~config/config-context'
import { useDataSource } from '~data/context'
import { useProcesses, useStore } from '~data/hooks'
import { useSequencers } from '~data/queries'
import {
  sequencerActivity,
  sequencerResults,
  sequencerRows,
  sequencerTransitions,
  type ProcessRow,
  type SequencerResult,
  type TransitionRow,
} from '~indexer/selectors'
import {
  BlockCell,
  ChevronLeftIcon,
  CopyButton,
  DataTable,
  EmptyState,
  ExternalIcon,
  Pagination,
  Panel,
  SectionHeader,
  SkeletonText,
  Stack,
  StatCell,
  StatRow,
  checksum,
  uriHost,
  type AnyColumnDef,
} from '~kit'
import { CHART_COLORS, StackedBars, type BarDatum } from '~kit/charts'
import { explorerAddressUrl } from '~lib/explorer'
import { formatDate, formatNumber } from '~lib/format'
import { paths } from '~routes/paths'
import { ProcessName } from '~components/ProcessName'
import { findSequencerEntry, sequencerEntries } from './model'
import { NodeBadges, SequencerCard } from './SequencerCard'

const DAYS = 30

/** One sequencer: what it recorded and published on chain, and what its node reports when one is configured. */
export function SequencerPage() {
  const { t } = useLingui()
  const { address: key } = useParams()
  const store = useStore()
  const nodes = useSequencers()
  const all = useProcesses()
  const source = useDataSource()
  const processRows = useMemo(() => new Map<string, ProcessRow>(all.map((r) => [r.id.toLowerCase(), r])), [all])
  const entries = useMemo(() => sequencerEntries(sequencerRows(store), nodes), [store, nodes])
  const entry = findSequencerEntry(entries, key)
  const address = entry?.address ?? null
  const transitions = useMemo(() => (address ? sequencerTransitions(store, address) : []), [store, address])
  const results = useMemo(() => (address ? sequencerResults(store, address) : []), [store, address])
  const days = useMemo(() => (address ? sequencerActivity(store, address, DAYS) : []), [store, address])

  // Fees need each transaction's receipt: ask for this account's first.
  const missing = [...transitions.filter((r) => r.fee == null), ...results.filter((r) => r.fee == null)]
    .map((r) => r.tx)
    .filter((tx) => tx != null)
    .join(',')
  useEffect(() => {
    if (missing) source.ensureTxDetails(missing.split(',') as `0x${string}`[])
  }, [source, missing])

  if (!entry) {
    // A node that has not answered yet may still name this account.
    if (nodes.some((n) => n.info.isLoading)) return <SkeletonText lines={6} className='max-w-2xl' />
    return <MissingEntity what='sequencer' id={key} />
  }

  const r = entry.onchain
  const node = entry.nodes[0]
  const title = address ? checksum(address) : node ? uriHost(node.endpoint.upstream) : entry.key
  const nTransitions = r?.transitions ?? 0
  const nBallots = r?.ballots ?? 0
  const nProcesses = r?.processes ?? 0
  const nResults = r?.results ?? 0
  const overwrites = r?.overwrites ?? 0
  const feesPending = r?.feesPending ?? 0

  return (
    <Stack data-testid='page-sequencer'>
      <Link
        to={paths.sequencers()}
        className='inline-flex w-fit items-center gap-1 text-[13px] text-pewter transition-colors hover:text-emerald'
      >
        <ChevronLeftIcon size={13} />
        <Trans>All sequencers</Trans>
      </Link>
      <SectionHeader
        size='page'
        label={t`Sequencer`}
        title={
          <span className='inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
            <span className='break-all font-mono text-[20px] leading-snug sm:text-[24px]'>{title}</span>
            {address ? <AddressActions address={title} /> : null}
          </span>
        }
        description={
          r ? (
            nResults > 0 ? (
              <Trans>
                Recorded <Plural value={nTransitions} one='# batch' other='# batches' /> with{' '}
                <Plural value={nBallots} one='# ballot' other='# ballots' /> for{' '}
                <Plural value={nProcesses} one='# process' other='# processes' />, and published the results of{' '}
                <Plural value={nResults} one='# process' other='# processes' />.
              </Trans>
            ) : (
              <Trans>
                Recorded <Plural value={nTransitions} one='# batch' other='# batches' /> with{' '}
                <Plural value={nBallots} one='# ballot' other='# ballots' /> for{' '}
                <Plural value={nProcesses} one='# process' other='# processes' />.
              </Trans>
            )
          ) : node?.info.data?.observer ? (
            <Trans>
              An observer: a configured sequencer node without a key. It follows every process and answers questions
              about it, but never records a batch.
            </Trans>
          ) : address ? (
            <Trans>A configured sequencer node whose account has not recorded a batch nor published results yet.</Trans>
          ) : (
            <Trans>A configured sequencer node that has not said which account it sends batches from.</Trans>
          )
        }
        actions={node && r ? <NodeBadges node={node} /> : null}
      />

      {r ? (
        <>
          <StatRow>
            <StatCell label={t`Transitions`} value={formatNumber(r.transitions)} mono hint={t`batches recorded`} />
            <StatCell
              label={t`Ballots`}
              value={formatNumber(r.ballots)}
              mono
              hint={t`${plural(overwrites, { one: 'including # changed vote', other: 'including # changed votes' })}`}
            />
            <StatCell label={t`Processes`} value={formatNumber(r.processes)} mono hint={t`with a batch or a result`} />
            <StatCell label={t`Blobs`} value={formatNumber(r.blobs)} mono hint={t`published with its batches`} />
          </StatRow>
          <StatRow>
            <StatCell
              label={t`Fees paid`}
              value={
                <span className='inline-flex items-baseline gap-1'>
                  {r.feesPending > 0 ? <span className='text-ash'>≥</span> : null}
                  <NativeAmount wei={r.fees} digits={4} />
                </span>
              }
              hint={
                feesPending > 0
                  ? t`${plural(feesPending, { one: '# receipt', other: '# receipts' })} still to read`
                  : t`execution and blob gas`
              }
            />
            <StatCell label={t`Results`} value={formatNumber(r.results)} mono hint={t`tallies published`} />
            <StatCell
              label={t`First active`}
              value={<Timestamp value={r.first.timestamp} className='text-[18px]' />}
              hint={<ActivityBlock block={r.first.block} />}
            />
            <StatCell
              label={t`Last active`}
              value={<Timestamp value={r.last.timestamp} className='text-[18px]' />}
              hint={<ActivityBlock block={r.last.block} />}
            />
          </StatRow>
          <ActivityPanel days={days} />
        </>
      ) : null}

      {address ? <TransitionsPanel rows={transitions} processes={processRows} /> : null}
      {results.length > 0 ? <ResultsPanel rows={results} processes={processRows} /> : null}
      {entry.nodes.map((n) => (
        <SequencerCard
          key={n.endpoint.index}
          state={n}
          chain={store.chain}
          store={store}
          rows={processRows}
          onchain={r}
        />
      ))}
    </Stack>
  )
}

/** Copy and block-explorer buttons for the address in the page title. */
function AddressActions({ address }: { address: string }) {
  const { t } = useLingui()
  const { blockExplorerUrl } = useRuntimeConfig()
  const href = explorerAddressUrl(blockExplorerUrl, address)
  const label = t`View address on the block explorer`
  return (
    <span className='inline-flex items-center'>
      <CopyButton value={address} label={t`Copy address`} size={15} />
      {href ? (
        <a
          href={href}
          target='_blank'
          rel='noreferrer noopener'
          aria-label={label}
          title={label}
          className='inline-flex shrink-0 items-center rounded-sm p-1 text-ash transition-colors hover:bg-onyx hover:text-ghost'
        >
          <ExternalIcon size={15} />
        </a>
      ) : null}
    </span>
  )
}

function ActivityBlock({ block }: { block: number }) {
  return (
    <Trans>
      block <BlockCell block={block} className='text-[12px]' />
    </Trans>
  )
}

function ActivityPanel({ days }: { days: ReturnType<typeof sequencerActivity> }) {
  const { t } = useLingui()
  const data = useMemo<BarDatum[]>(
    () =>
      days.map((d) => {
        const transitions = d.transitions
        const blobs = d.blobs
        return {
          label: formatDate(d.day, 'short'),
          values: { newVoters: d.newVoters, overwrites: d.overwrites },
          note: `${formatDate(d.day)} · ${plural(transitions, { one: '# transition', other: '# transitions' })} · ${plural(blobs, { one: '# blob', other: '# blobs' })}`,
        }
      }),
    [days]
  )
  const empty = days.every((d) => d.ballots === 0)
  const total = formatNumber(days.reduce((n, d) => n + d.ballots, 0))
  return (
    <Panel
      title={t`Ballots it recorded per day`}
      label={t`Last ${DAYS} days, UTC`}
      description={t`New votes and changed votes in the batches this account recorded, by the day each batch landed.`}
      actions={<span className='font-mono text-[12px] text-ash tnum'>{t`${total} in total`}</span>}
    >
      {empty ? (
        <EmptyState
          compact
          title={t`Nothing recorded in the last ${DAYS} days`}
          description={t`Its earlier batches are in the table below.`}
        />
      ) : (
        <StackedBars
          data={data}
          height={180}
          series={[
            { key: 'newVoters', label: t`new voters`, color: CHART_COLORS.emerald },
            { key: 'overwrites', label: t`changed votes`, color: CHART_COLORS.slate },
          ]}
        />
      )}
    </Panel>
  )
}

const PAGE = 20

function TransitionsPanel({ rows, processes }: { rows: TransitionRow[]; processes: Map<string, ProcessRow> }) {
  const { t } = useLingui()
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE))
  const current = Math.min(page, pageCount - 1)
  const slice = useMemo(() => rows.slice(current * PAGE, current * PAGE + PAGE), [rows, current])
  const columns = useMemo<AnyColumnDef<TransitionRow>[]>(
    () => [
      {
        id: 'process',
        header: t`Process`,
        cell: ({ row }) => (
          <ProcessName
            id={row.original.processId}
            metadataURI={processes.get(row.original.processId.toLowerCase())?.metadataURI ?? null}
            metadataHash={processes.get(row.original.processId.toLowerCase())?.metadataHash ?? null}
          />
        ),
        meta: { width: '200px' },
      },
      {
        id: 'index',
        header: t`Transition`,
        cell: ({ row }) => (
          <Link
            to={paths.transition(row.original.processId, row.original.index)}
            className='font-mono text-emerald hover:underline'
          >
            #{row.original.index}
          </Link>
        ),
        meta: { width: '96px', headerTooltip: t`The batch’s number within its process, from 0.` },
      },
      {
        id: 'time',
        header: t`Recorded`,
        cell: ({ row }) => <Timestamp value={row.original.timestamp} className='text-[12px]' />,
        meta: { width: '120px' },
      },
      {
        id: 'ballots',
        header: t`Ballots`,
        cell: ({ row }) => formatNumber(row.original.votes),
        meta: { numeric: true, width: '84px', headerTooltip: t`New votes plus votes that changed an earlier one.` },
      },
      {
        id: 'blobs',
        header: t`Blobs`,
        cell: ({ row }) => formatNumber(row.original.nBlobs),
        meta: { numeric: true, width: '70px' },
      },
      {
        id: 'fee',
        header: t`Fee`,
        cell: ({ row }) => <NativeAmount wei={row.original.fee} digits={6} className='text-[12px]' />,
        meta: {
          numeric: true,
          width: '140px',
          headerTooltip: t`Execution gas plus blob gas, at the prices the transaction paid.`,
        },
      },
      {
        id: 'tx',
        header: t`Transaction`,
        cell: ({ row }) => (row.original.tx ? <TxLink hash={row.original.tx} chars={4} /> : '—'),
        meta: { width: '170px' },
      },
    ],
    [t, processes]
  )
  const count = rows.length
  return (
    <Panel
      title={t`Batches it recorded`}
      label={t`State transitions`}
      description={t`Newest first. Open one for what its proof says, the data it published and every check the registry made.`}
      actions={
        <span className='font-mono text-[12px] text-ash tnum'>
          <Plural value={count} one='# transition' other='# transitions' />
        </span>
      }
      bodyClassName='p-0'
    >
      <div data-testid='sequencer-transitions'>
        <DataTable
          data={slice}
          columns={columns.map((c) => ({ ...c, enableSorting: false }))}
          getRowId={(r) => r.key}
          maxHeight={100_000}
          empty={
            <EmptyState
              compact
              title={t`No batch recorded`}
              description={t`This account has not recorded a batch on this registry.`}
            />
          }
        />
      </div>
      {pageCount > 1 ? (
        <div className='border-t border-charcoal px-5 py-3'>
          <Pagination page={current} pageCount={pageCount} onPageChange={setPage} pageSize={PAGE} total={count} />
        </div>
      ) : null}
    </Panel>
  )
}

function ResultsPanel({ rows, processes }: { rows: SequencerResult[]; processes: Map<string, ProcessRow> }) {
  const { t } = useLingui()
  return (
    <Panel
      title={t`Results it published`}
      label={t`Tallies`}
      description={t`Each is a process’s final count, proven and accepted by the registry.`}
      bodyClassName='p-0'
    >
      <ul className='divide-y divide-charcoal/60' data-testid='sequencer-results'>
        {rows.map((r) => (
          <li key={r.processId} className='flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-[13px]'>
            <span className='min-w-0 basis-full sm:flex-1 sm:basis-auto'>
              <ProcessName
                id={r.processId}
                metadataURI={processes.get(r.processId)?.metadataURI ?? null}
                metadataHash={processes.get(r.processId)?.metadataHash ?? null}
              />
            </span>
            <Link
              to={paths.process(r.processId, 'results')}
              className='text-pewter underline-offset-2 hover:text-emerald hover:underline'
            >
              <Trans>See the results</Trans>
            </Link>
            <Timestamp value={r.timestamp} className='text-[12px] text-ash' />
            <NativeAmount wei={r.fee} digits={6} className='text-[12px]' />
            {r.tx ? <TxLink hash={r.tx} chars={4} /> : null}
          </li>
        ))}
      </ul>
    </Panel>
  )
}
