import { useMemo } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { Timestamp } from '~components'
import { useProcesses, useStore } from '~data/hooks'
import { useSequencers } from '~data/queries'
import type { ProcessRow } from '~indexer/selectors'
import { Address, Badge, BlockCell, Card, EmptyState, Panel, SectionHeader, Stack } from '~kit'
import { formatNumber } from '~lib/format'
import { paths } from '~routes/paths'
import { SequencerCard } from './SequencerCard'
import { settlers } from './model'

const LINK = 'text-pewter underline-offset-2 transition-colors hover:text-emerald hover:underline'

export function SequencersPage() {
  const { t } = useLingui()
  const sequencers = useSequencers()
  const store = useStore()
  const all = useProcesses()
  const rows = useMemo(() => new Map<string, ProcessRow>(all.map((r) => [r.id.toLowerCase(), r])), [all])
  const settlerRows = useMemo(() => settlers(store), [store])
  const configured = useMemo(
    () =>
      new Set(
        sequencers.map((s) => s.info.data?.sequencerAddress?.toLowerCase()).filter((a): a is string => a != null)
      ),
    [sequencers]
  )

  return (
    <Stack data-testid='page-sequencers'>
      <SectionHeader
        size='page'
        label={t`Sequencers`}
        title={t`Sequencer nodes`}
        description={t`The nodes that collect ballots, prove them in batches and settle them on the registry: the ones this explorer is configured with, and every account that has settled a transition here.`}
      />

      <Card>
        <div className='grid gap-6 lg:grid-cols-2'>
          <div>
            <h2 className='text-[15px] font-semibold text-ghost'>
              <Trans>What a sequencer does</Trans>
            </h2>
            <p className='mt-2 text-[13px] leading-relaxed text-ash'>
              <Trans>
                A sequencer takes encrypted ballots and checks each one the way the zkVM guest will: the ballot proof,
                the signature, the census proof and the inputs hash. It groups them into batches, re-encrypts every
                ballot, silently refreshes other occupied slots, has the batch proven as one ZisK PLONK and settles it
                on the registry in a blob transaction that carries everything needed to rebuild the state.
              </Trans>{' '}
              <Link to={paths.learn('how-it-works')} className={LINK}>
                <Trans>How it fits together</Trans>
              </Link>
            </p>
          </div>
          <div>
            <h2 className='text-[15px] font-semibold text-ghost'>
              <Trans>Why several can serve one process</Trans>
            </h2>
            <p className='mt-2 text-[13px] leading-relaxed text-ash'>
              <Trans>
                Settlement is permissionless: the registry takes a transition from anyone, as long as the proof verifies
                and it starts at the current state root. When two nodes race, the first transaction lands and the other
                reverts on that root check; the loser rebuilds the winner’s transition from its blobs, requeues its
                votes and builds on the new root. A race costs gas, never state. A node without a key, an observer,
                follows every process the same way and serves reads and tracker proofs, but never settles. With a
                sequencer key, only the node that handed out the key can publish that process’s results.
              </Trans>
            </p>
          </div>
        </div>
      </Card>

      {sequencers.length === 0 ? (
        <Card>
          <EmptyState
            compact
            title={t`No sequencer API configured`}
            description={
              <Trans>
                Everything settled is read from the chain and the beacon API. A sequencer API adds what only a node
                knows: the status of a vote before it settles, its tracker proof, and blobs the beacon has already
                pruned. List node URLs in <code>SEQUENCER_URLS</code> to add them here.
              </Trans>
            }
          />
        </Card>
      ) : (
        sequencers.map((s) => (
          <SequencerCard
            key={s.endpoint.index}
            state={s}
            chain={store.chain}
            store={store}
            rows={rows}
            settlerRows={settlerRows}
          />
        ))
      )}

      <Panel
        title={t`Accounts that settled transitions`}
        label={t`From the chain`}
        description={t`The sender of every state transition on this registry. Any account may send one; the proof and the root check decide whether it lands.`}
      >
        {settlerRows.length === 0 ? (
          <EmptyState
            compact
            title={t`No transition settled yet`}
            description={t`Once a sequencer settles the first batch of a process, its account shows up here.`}
          />
        ) : (
          <div className='scroll-slim -mx-5 -my-5 overflow-x-auto' data-testid='settlers'>
            <table className='w-full min-w-[620px] text-left text-[13px]'>
              <thead>
                <tr className='border-b border-charcoal text-pewter'>
                  <th className='label-caps px-5 py-2.5 text-[11px] font-semibold'>
                    <Trans>Account</Trans>
                  </th>
                  <th className='label-caps px-3 py-2.5 text-right text-[11px] font-semibold'>
                    <Trans>Transitions</Trans>
                  </th>
                  <th className='label-caps px-3 py-2.5 text-right text-[11px] font-semibold'>
                    <Trans>Processes</Trans>
                  </th>
                  <th className='label-caps px-5 py-2.5 text-[11px] font-semibold'>
                    <Trans>Last settlement</Trans>
                  </th>
                </tr>
              </thead>
              <tbody>
                {settlerRows.map((r) => (
                  <tr key={r.address} className='border-b border-charcoal last:border-b-0'>
                    <td className='px-5 py-2.5'>
                      <span className='inline-flex items-center gap-2'>
                        <Address value={r.address} chars={6} />
                        {configured.has(r.address) ? (
                          <Badge size='sm' tone='accent'>
                            <Trans>configured</Trans>
                          </Badge>
                        ) : null}
                      </span>
                    </td>
                    <td className='px-3 py-2.5 text-right font-mono tnum text-silver'>{formatNumber(r.transitions)}</td>
                    <td className='px-3 py-2.5 text-right font-mono tnum text-silver'>{formatNumber(r.processes)}</td>
                    <td className='px-5 py-2.5'>
                      <span className='inline-flex items-center gap-2 text-[12px]'>
                        <BlockCell block={r.lastBlock} />
                        <Timestamp value={r.lastTimestamp} className='text-ash' />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Stack>
  )
}
