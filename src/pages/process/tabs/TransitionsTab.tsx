import { useEffect, useMemo, useState } from 'react'
import { plural } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import type { SortingState } from '@tanstack/react-table'
import { Link } from 'react-router'
import { CheckMark, Explain, NativeAmount, Term, Timestamp, TxLink } from '~components'
import { useDataSource } from '~data/context'
import type { ProcessView } from '~data/hooks'
import { votingOver, type TransitionRow } from '~indexer/selectors'
import { Address, BlockCell, Card, CardHeader, DataTable, EmptyState, Hash, Panel, type AnyColumnDef } from '~kit'
import { cn } from '~lib/cn'
import { formatNumber } from '~lib/format'
import { paths } from '~routes/paths'

export function TransitionsTab({ view }: { view: ProcessView }) {
  const { t } = useLingui()
  const source = useDataSource()
  const { process: p, transitions, rootChain } = view
  const pid = p.id

  // Built here, not at module scope: the headers and tooltips are text.
  const cols = useMemo<AnyColumnDef<TransitionRow>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        accessorKey: 'index',
        cell: ({ row }) => (
          <Link
            to={paths.transition(pid, row.original.index)}
            onClick={(e) => e.stopPropagation()}
            className='font-mono text-emerald hover:underline'
          >
            #{row.original.index}
          </Link>
        ),
        meta: { width: '64px', headerTooltip: t`Position among the election’s batches, from 0.` },
      },
      {
        id: 'block',
        header: t`Block`,
        accessorKey: 'block',
        cell: ({ row }) => <BlockCell block={row.original.block} />,
        meta: { width: '110px' },
      },
      {
        id: 'time',
        header: t`Time`,
        accessorFn: (r) => r.timestamp ?? 0,
        cell: ({ row }) => <Timestamp value={row.original.timestamp} className='text-[12px]' />,
        meta: { width: '110px' },
      },
      {
        id: 'tx',
        header: t`Transaction`,
        accessorFn: (r) => r.tx ?? '',
        cell: ({ row }) => (row.original.tx ? <TxLink hash={row.original.tx} chars={4} /> : '—'),
        meta: { width: '170px' },
      },
      {
        id: 'sender',
        header: t`Sender`,
        accessorKey: 'sender',
        cell: ({ row }) => (
          <Address value={row.original.sender} to={paths.sequencer(row.original.sender)} explorer={false} />
        ),
        meta: {
          headerTooltip: t`The sequencer that sent the batch. Anyone may send one: the registry trusts the proof, not the sender.`,
        },
      },
      {
        id: 'newVoters',
        header: t`New voters`,
        accessorKey: 'newVoters',
        cell: ({ row }) => formatNumber(row.original.newVoters),
        meta: {
          numeric: true,
          width: '100px',
          headerWrap: true,
          headerTooltip: t`People voting for the first time in this election (ballot slots written for the first time).`,
        },
      },
      {
        id: 'overwrites',
        header: t`Changed votes`,
        accessorKey: 'overwrites',
        cell: ({ row }) => formatNumber(row.original.overwrites),
        meta: {
          numeric: true,
          width: '100px',
          headerWrap: true,
          headerTooltip: t`Votes that replaced an earlier vote of the same voter.`,
        },
      },
      {
        id: 'blobs',
        header: t`Data blobs`,
        accessorKey: 'nBlobs',
        cell: ({ row }) => formatNumber(row.original.nBlobs),
        meta: { numeric: true, width: '80px', headerWrap: true },
      },
      {
        id: 'gas',
        header: t`Gas`,
        accessorFn: (r) => (r.gasUsed == null ? -1 : Number(r.gasUsed)),
        cell: ({ row }) => (row.original.gasUsed == null ? '…' : formatNumber(row.original.gasUsed)),
        meta: { numeric: true, width: '100px' },
      },
      {
        id: 'fee',
        header: t`Fee`,
        accessorFn: (r) => (r.fee == null ? -1 : Number(r.fee)),
        cell: ({ row }) => <NativeAmount wei={row.original.fee} digits={6} className='text-[12px]' />,
        meta: {
          numeric: true,
          width: '130px',
          headerTooltip: t`Execution gas plus blob gas, at the prices the transaction paid.`,
        },
      },
    ],
    [t, pid]
  )
  const [sorting, setSorting] = useState<SortingState>([])

  // Gas and fees need each settlement's receipt: ask for this process's first.
  const missing = transitions.filter((t) => t.tx && t.gasUsed == null).map((t) => t.tx)
  const missingKey = missing.join(',')
  useEffect(() => {
    if (missingKey) source.ensureTxDetails(missingKey.split(',') as `0x${string}`[])
  }, [source, missingKey])

  const totals = transitions.reduce(
    (acc, t) => ({
      gas: acc.gas + (t.gasUsed ?? 0n),
      fee: acc.fee + (t.fee ?? 0n),
      blobs: acc.blobs + t.nBlobs,
      ballots: acc.ballots + t.votes,
      known: acc.known && t.fee != null,
    }),
    { gas: 0n, fee: 0n, blobs: 0, ballots: 0, known: true }
  )

  const headText =
    rootChain.headMatches == null
      ? t`the fingerprint the registry holds now is not read yet`
      : rootChain.headMatches
        ? t`the last fingerprint is the one the registry holds now`
        : t`the last fingerprint is not the one the registry holds now`
  const count = transitions.length
  const gaps = rootChain.gaps
  const ballots = totals.ballots
  const blobs = totals.blobs
  const gas = formatNumber(totals.gas)

  return (
    <div data-testid='tab-transitions' className='flex flex-col gap-6'>
      <Panel
        title={t`One unbroken chain`}
        label={t`From each batch to the next`}
        description={
          <Trans>
            Each batch must continue exactly where the previous one ended, so no batch can be skipped, replayed or
            forked. Each step is shown by the fingerprint of the election’s state (its{' '}
            <Term id='state-root'>state root</Term>), starting from the one the registry computed at creation. The
            registry enforces this on the chain; the explorer checks it again from the events.
          </Trans>
        }
      >
        <p data-testid='transition-summary' className='mb-4 flex flex-wrap items-center gap-2 text-[13px] text-silver'>
          <CheckMark
            state={
              rootChain.gaps > 0 || rootChain.headMatches === false
                ? 'fail'
                : rootChain.headMatches == null || rootChain.genesisRoot == null
                  ? 'unknown'
                  : 'pass'
            }
          />
          <span>
            {t`${plural(count, { one: '# batch', other: '# batches' })}`} ·{' '}
            {gaps === 0
              ? t`the chain is continuous`
              : t`${plural(gaps, { one: '# gap in the chain', other: '# gaps in the chain' })}`}{' '}
            · {headText}
          </span>
        </p>
        <RootChainList view={view} />
      </Panel>

      <Card flush className='overflow-hidden'>
        <CardHeader
          title={t`Batches`}
          label={t`Recorded batches`}
          description={t`Each row is one batch of votes a sequencer proved and recorded on the chain (a state transition, sent with submitStateTransition). Open one to see what its proof says, its published data and every check the registry ran.`}
          actions={
            transitions.length > 0 ? (
              <span className='flex flex-wrap gap-x-4 gap-y-1 font-mono text-[12px] text-ash tnum'>
                <span>
                  <Plural value={ballots} one='# vote' other='# votes' />
                </span>
                <span>
                  <Plural value={blobs} one='# data blob' other='# data blobs' />
                </span>
                <span>
                  <Trans>{gas} gas</Trans>
                </span>
                <span>
                  {totals.known ? '' : '≥ '}
                  <NativeAmount wei={totals.fee} />
                </span>
              </span>
            ) : null
          }
        />
        <DataTable
          data={transitions}
          columns={cols}
          getRowId={(r) => r.key}
          sorting={sorting}
          onSortingChange={setSorting}
          virtualized={transitions.length > 50}
          maxHeight={transitions.length > 15 ? 600 : 100_000}
          empty={
            votingOver(view.row.phase) ? (
              <EmptyState
                title={t`No batch was recorded`}
                description={t`Voting is over and no sequencer recorded a batch, so no vote was counted.`}
              />
            ) : (
              <EmptyState
                title={t`No batches yet`}
                description={t`When a sequencer records the first batch of votes, it appears here with its block, data blobs and fee.`}
              />
            )
          }
        />
      </Card>
    </div>
  )
}

function RootChainList({ view }: { view: ProcessView }) {
  const { t } = useLingui()
  const { process: p, rootChain } = view
  const latest = p.state?.latestStateRoot ?? null
  return (
    <ol
      className='max-h-[420px] overflow-y-auto rounded-sm border border-charcoal scroll-slim'
      aria-label={t`The fingerprint of each state`}
    >
      <li className='flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-charcoal/60 px-3 py-2 text-[13px]'>
        <span className='w-24 shrink-0 text-pewter'>
          <Trans>Start</Trans>
          <Explain className='ml-1'>
            <Trans>
              The fingerprint of the election’s state before any vote (the genesis root). The registry computes it at
              creation from the process id, the ballot rules, the election key, an empty encrypted total, the kind of
              list of voters and the ballot proof key.
            </Trans>
          </Explain>
        </span>
        {rootChain.genesisRoot ? (
          <Hash value={rootChain.genesisRoot} chars={10} />
        ) : (
          <span className='text-ash'>
            <Trans>not read yet</Trans>
          </span>
        )}
      </li>
      {rootChain.links.map((l) => {
        const expected = l.expectedBefore ? <Hash value={l.expectedBefore} chars={6} /> : '…'
        return (
          <li
            key={l.index}
            className={cn(
              'flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-charcoal/60 px-3 py-2 text-[13px]',
              l.continuous === false && 'bg-red/5'
            )}
          >
            <Link to={paths.transition(p.id, l.index)} className='w-24 shrink-0 font-mono text-emerald hover:underline'>
              #{l.index}
            </Link>
            <CheckMark state={l.continuous == null ? 'unknown' : l.continuous ? 'pass' : 'fail'} />
            {l.continuous === false ? (
              <span className='inline-flex flex-wrap items-center gap-1 text-red'>
                <Trans>
                  starts from <Hash value={l.rootBefore} chars={6} />, expected {expected}
                </Trans>
              </span>
            ) : null}
            <span className='text-ash'>→</span>
            <Hash value={l.rootAfter} chars={10} />
          </li>
        )
      })}
      <li className='flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[13px]'>
        <span className='w-24 shrink-0 text-pewter'>
          <Trans>Registry now</Trans>
          <Explain className='ml-1'>
            <Trans>The fingerprint the registry holds now (latestStateRoot): the next batch must start from it.</Trans>
          </Explain>
        </span>
        <CheckMark state={rootChain.headMatches == null ? 'unknown' : rootChain.headMatches ? 'pass' : 'fail'} />
        {latest ? (
          <Hash value={latest} chars={10} />
        ) : (
          <span className='text-ash'>
            <Trans>not read yet</Trans>
          </span>
        )}
      </li>
    </ol>
  )
}
