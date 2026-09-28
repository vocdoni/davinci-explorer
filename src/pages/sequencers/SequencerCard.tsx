import { useMemo, useState } from 'react'
import { plural } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { CheckMark, Explain, ProcessIdLink, ProcessPhaseBadge } from '~components'
import type { SequencerState } from '~data/queries'
import type { SequencerEndpoint } from '~data/services'
import { useSequencerProcessViews } from '~data/sequencer-processes'
import type { ProcessRow, SequencerRow } from '~indexer/selectors'
import type { ChainMeta, IndexerStore } from '~indexer/types'
import {
  Address,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Hash,
  KeyValue,
  Pagination,
  Skeleton,
  SkeletonText,
  Tooltip,
} from '~kit'
import { cn } from '~lib/cn'
import { formatNumber } from '~lib/format'
import type { Hex } from '~protocol/bytes'
import { infoChecks, nodeRelease, nodeStatus, syncState, type NodeStatus } from './model'

const PAGE = 10

/** A node's status and role as two badges: online / offline / checking, signer / observer. */
export function NodeBadges({
  node,
  size,
  wrap = true,
}: {
  node: SequencerState
  size?: 'sm' | 'md'
  /** False in a table cell, so the cell keeps both badges on one line. */
  wrap?: boolean
}) {
  const { t } = useLingui()
  const status = nodeStatus(node)
  const data = node.info.data
  const label: Record<NodeStatus, string> = { online: t`Online`, offline: t`Offline`, checking: t`Checking` }
  const hint: Record<NodeStatus, string> = {
    online: t`Its /info answered on the last poll.`,
    offline: t`Its /info did not answer on the last poll.`,
    checking: t`Waiting for its /info.`,
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5', wrap ? 'flex-wrap' : 'whitespace-nowrap')}>
      <Tooltip content={hint[status]}>
        <span className='inline-flex'>
          <Badge
            size={size}
            tone={status === 'online' ? 'ok' : status === 'offline' ? 'danger' : 'neutral'}
            dot={status === 'online'}
          >
            {label[status]}
          </Badge>
        </span>
      </Tooltip>
      {data ? (
        <Tooltip
          content={
            data.observer
              ? t`An observer has no key: it follows every process and serves reads, but never settles.`
              : t`A signer has a key: it proves batches and settles them on the registry.`
          }
        >
          <span className='inline-flex'>
            <Badge size={size} tone={data.observer ? 'neutral' : 'slate'}>
              {data.observer ? t`Observer` : t`Signer`}
            </Badge>
          </span>
        </Tooltip>
      ) : null}
    </span>
  )
}

/** What a configured node reports about itself: status, role, counters, release, and the processes it serves. */
export function SequencerCard({
  state,
  chain,
  store,
  rows,
  onchain,
}: {
  state: SequencerState
  chain: ChainMeta
  store: IndexerStore
  rows: Map<string, ProcessRow>
  /** What its settling account did on chain; null when nothing. */
  onchain: SequencerRow | null
}) {
  const { i18n, t } = useLingui()
  const { endpoint, info, processes } = state
  const data = info.data
  const number = endpoint.index + 1
  const infoError = info.isError ? (info.error as Error).message : null
  const sent = onchain?.transitions ?? 0
  const served = onchain?.processes ?? 0
  const release = data ? nodeRelease(data) : null
  const settlingHint = data?.observer
    ? t`An observer has no key: it follows and serves reads, but never settles.`
    : onchain
      ? t`sent ${plural(sent, { one: '# transition', other: '# transitions' })} on this registry, for ${plural(served, { one: '# process', other: '# processes' })}`
      : t`has not settled a transition on this registry yet`

  return (
    <Card flush className='overflow-hidden' data-testid={`sequencer-${endpoint.index}`}>
      <CardHeader
        label={t`Node API ${number}`}
        title={<span className='font-mono text-[14px]'>{endpoint.upstream}</span>}
        description={t`What the node reports about itself through its HTTP API, polled every 30 seconds.`}
        actions={<NodeBadges node={state} />}
      />
      <div className='p-5'>
        {infoError != null ? (
          <p className='mb-4 text-[13px] text-red' role='alert'>
            <Trans>
              <code>/info</code> did not answer: {infoError}
            </Trans>
          </p>
        ) : null}
        {info.isLoading ? <SkeletonText lines={4} className='max-w-lg' /> : null}
        {data ? (
          <div className='grid gap-8 lg:grid-cols-2'>
            <div>
              <KeyValue
                items={[
                  {
                    label: t`Settling account`,
                    value: data.sequencerAddress ? (
                      <Address value={data.sequencerAddress} chars={6} />
                    ) : (
                      t({ message: 'none', context: 'no address' })
                    ),
                    hint: settlingHint,
                  },
                  {
                    label: (
                      <span className='inline-flex items-center gap-1'>
                        <Trans>Release</Trans>
                        <Explain>
                          <Trans>
                            The davinci-zkvm release whose program keys and ballot key the node reports. The node does
                            not report a software version; its keys say which programs it proves with.
                          </Trans>
                        </Explain>
                      </span>
                    ),
                    value: release ? (
                      <span className='font-mono text-[12px] text-ghost'>{release.label}</span>
                    ) : (
                      <span className='text-amber'>
                        <Trans>no release this explorer knows</Trans>
                      </span>
                    ),
                  },
                  {
                    label: (
                      <span className='inline-flex items-center gap-1'>
                        <Trans>Settled by itself</Trans>
                        <Explain>
                          <Trans>Batches this node proved and settled.</Trans>
                        </Explain>
                      </span>
                    ),
                    value: formatNumber(data.settledBySelf),
                    mono: true,
                  },
                  {
                    label: (
                      <span className='inline-flex items-center gap-1'>
                        <Trans>Synced from others</Trans>
                        <Explain>
                          <Trans>
                            Transitions another node settled, which this one rebuilt from their blobs and accepted only
                            because replaying them gave the event’s new root.
                          </Trans>
                        </Explain>
                      </span>
                    ),
                    value: formatNumber(data.syncedFromOthers),
                    mono: true,
                  },
                  {
                    label: (
                      <span className='inline-flex items-center gap-1'>
                        <Trans>Lost races</Trans>
                        <Explain>
                          <Trans>
                            Batches that another node’s transition beat to the chain. The node rolled back, synced the
                            winner and put the votes back in its queue: the only cost is the reverted transaction’s gas.
                          </Trans>
                        </Explain>
                      </span>
                    ),
                    value: formatNumber(data.lostRaces),
                    mono: true,
                  },
                ]}
              />
            </div>
            <div>
              <div className='label-caps text-[11px] text-pewter'>
                <Trans>Configured for this deployment</Trans>
              </div>
              <p className='mt-1 text-[12px] leading-relaxed text-ash'>
                <Trans>
                  The node’s <code>/info</code> against the registry. A node checks these at boot and will not start on
                  a mismatch, so a ✗ means it serves another deployment.
                </Trans>
              </p>
              <ul className='mt-3 flex flex-col gap-2' data-testid='sequencer-info-checks'>
                {infoChecks(data, chain).map((c) => (
                  <li key={c.id} className='flex items-center gap-2.5 text-[13px] text-silver'>
                    <CheckMark state={c.state} />
                    {i18n._(c.label)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        <ServedProcesses
          endpoint={endpoint}
          pids={processes.data ?? null}
          loading={processes.isLoading}
          error={processes.isError ? (processes.error as Error).message : null}
          store={store}
          rows={rows}
        />
      </div>
    </Card>
  )
}

function ServedProcesses({
  endpoint,
  pids,
  loading,
  error,
  store,
  rows,
}: {
  endpoint: SequencerEndpoint
  pids: Hex[] | null
  loading: boolean
  error: string | null
  store: IndexerStore
  rows: Map<string, ProcessRow>
}) {
  const { t } = useLingui()
  const [page, setPage] = useState(0)
  const all = useMemo(() => pids ?? [], [pids])
  const pageCount = Math.max(1, Math.ceil(all.length / PAGE))
  const current = Math.min(page, pageCount - 1)
  const slice = useMemo(() => all.slice(current * PAGE, current * PAGE + PAGE), [all, current])
  const known = all.length
  const views = useSequencerProcessViews(endpoint, slice)

  return (
    <div className='mt-8'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <div className='label-caps text-[11px] text-pewter'>
          <Trans>Processes it serves</Trans>
        </div>
        {pids ? (
          <span className='text-[12px] text-ash'>
            <Plural value={known} one='# known to the node' other='# known to the node' />
          </span>
        ) : null}
      </div>
      <p className='mt-1 text-[12px] leading-relaxed text-ash'>
        <Trans>
          Each process with its phase on chain and the node’s own view: whether it takes votes and whether its committed
          tree is at the registry’s latest root.
        </Trans>
      </p>
      {error ? (
        <p className='mt-3 text-[13px] text-red' role='alert'>
          <Trans>
            <code>/processes</code> did not answer: {error}
          </Trans>
        </p>
      ) : loading ? (
        <Skeleton className='mt-3 h-24 w-full' />
      ) : all.length === 0 ? (
        <EmptyState compact title={t`No processes yet`} description={t`The node knows no process of this registry.`} />
      ) : (
        <>
          <div className='scroll-slim mt-3 overflow-x-auto rounded-md border border-charcoal'>
            <table className='w-full min-w-[640px] text-left text-[13px]'>
              <thead>
                <tr className='border-b border-charcoal text-pewter'>
                  <th className='label-caps px-3 py-2 text-[11px] font-semibold'>
                    <Trans>Process</Trans>
                  </th>
                  <th className='label-caps px-3 py-2 text-[11px] font-semibold'>
                    <Trans>On chain</Trans>
                  </th>
                  <th className='label-caps px-3 py-2 text-[11px] font-semibold'>
                    <Trans>Votes</Trans>
                  </th>
                  <th className='label-caps px-3 py-2 text-[11px] font-semibold'>
                    <Trans>Node’s root</Trans>
                  </th>
                </tr>
              </thead>
              <tbody>
                {slice.map((pid, i) => {
                  const row = rows.get(pid.toLowerCase())
                  const view = views[i]
                  const onchainRoot = store.processes[pid.toLowerCase()]?.state?.latestStateRoot
                  const sync = syncState(view?.data, onchainRoot)
                  const note = view?.data?.note
                  return (
                    <tr key={pid} className='border-b border-charcoal last:border-b-0'>
                      <td className='px-3 py-2'>
                        <ProcessIdLink id={pid} />
                      </td>
                      <td className='px-3 py-2'>
                        {row ? (
                          <ProcessPhaseBadge phase={row.phase} size='sm' />
                        ) : (
                          <span className='text-[12px] text-ash'>
                            <Trans>not indexed</Trans>
                          </span>
                        )}
                      </td>
                      <td className='px-3 py-2 text-[12px]'>
                        {view?.isLoading ? (
                          <Skeleton className='h-3 w-20' />
                        ) : view?.data?.ignored ? (
                          <span className='text-amber'>{note ? t`ignored: ${note}` : t`ignored`}</span>
                        ) : view?.data ? (
                          <span className={view.data.isAcceptingVotes ? 'text-emerald' : 'text-ash'}>
                            {view.data.isAcceptingVotes ? t`accepting` : t`not accepting`}
                          </span>
                        ) : view?.isError ? (
                          <span className='text-ash'>
                            <Trans>no answer</Trans>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className='px-3 py-2 text-[12px]'>
                        {view?.data?.localStateRoot ? (
                          <span className='inline-flex items-center gap-2'>
                            <CheckMark state={sync === 'in-sync' ? 'pass' : 'unknown'} />
                            <Hash value={view.data.localStateRoot} chars={6} copy={false} />
                            <span className='text-ash'>
                              {sync === 'in-sync'
                                ? t`at the on-chain root`
                                : sync === 'differs'
                                  ? t`not at it yet`
                                  : ''}
                            </span>
                          </span>
                        ) : (
                          <span className='text-ash'>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {pageCount > 1 ? (
            <Pagination
              className='mt-3'
              page={current}
              pageCount={pageCount}
              onPageChange={setPage}
              pageSize={PAGE}
              total={all.length}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
