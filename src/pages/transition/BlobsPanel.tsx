import { useMemo } from 'react'
import type { MessageDescriptor } from '@lingui/core'
import { msg, plural } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import type { UseQueryResult } from '@tanstack/react-query'
import { Explain, Formula, NumberedList, Term } from '~components'
import { BlobCellView, BlobLayoutBar, CiphertextTable, countsOf, SlotUpdateList, VoteIdList } from '~components/blob'
import { Disclosure } from '~components/code'
import { useServices } from '~data/context'
import type { DecodedTransitionBlobs } from '~data/queries'
import type { TransitionDetail } from '~indexer/selectors'
import { Badge, Callout, EmptyState, Hash, Panel, Skeleton, SkeletonText, StatCell, StatRow, Tabs, Tooltip } from '~kit'
import { formatNumber } from '~lib/format'
import type { FetchedBlob } from '~protocol/beacon'
import { blobEvaluationPoint, usedCells } from '~protocol/blob'
import type { Hex } from '~protocol/bytes'
import { CELLS_PER_BLOB, requiredRefresh } from '~protocol/limits'

const BINDING: Record<
  FetchedBlob['binding'],
  { label: MessageDescriptor; tone: 'ok' | 'warn'; hint: MessageDescriptor }
> = {
  commitment: {
    label: msg`by commitment`,
    tone: 'ok',
    hint: msg`Tied to the transaction: the beacon returned this blob with a KZG commitment that hashes to the transaction’s versioned hash. The explorer does not recompute the commitment from the bytes.`,
  },
  'beacon-filter': {
    label: msg`by versioned hash`,
    tone: 'ok',
    hint: msg`Tied to the transaction: the beacon picked this blob by the transaction’s versioned hash. The explorer does not recompute the commitment from the bytes.`,
  },
  sequencer: {
    label: msg`by position`,
    tone: 'warn',
    hint: msg`Tied by position only: a sequencer node served this blob for this batch, and nothing ties the bytes to the transaction’s versioned hash but the node’s word. The checks the registry made still hold for the real blob.`,
  },
}

/** Column key, header, what it is (plain words first) and, for a computed value, its formula. */
const COLUMNS: Array<[string, MessageDescriptor, MessageDescriptor | null, string?]> = [
  ['blob', msg`Blob`, null],
  [
    'versioned-hash',
    msg`Versioned hash`,
    msg`The blob’s fingerprint as the transaction carries it, and what BLOBHASH returns: 0x01, then the last 31 bytes of the commitment’s SHA-256.`,
    'versionedHash = 0x01 ‖ sha256(commitment)[1..]',
  ],
  [
    'commitment',
    msg`KZG commitment`,
    msg`48 bytes that pin down the blob’s content (as a polynomial). They come from the call’s data, and the proven program used them to pick the point z.`,
  ],
  [
    'z',
    msg`Point z`,
    msg`A point that depends on this process, the state before the batch and the commitment, computed here in the BLS12-381 scalar field. It ties the blob to this batch, so a commitment from another batch is useless.`,
    'z = sha256(processId ‖ rootBefore ‖ commitment) mod r_BLS',
  ],
  [
    'y',
    msg`Evaluation y`,
    msg`The blob’s value at z, as the proven program computed it from the data it checked. The registry checks the real blob against it (a KZG opening).`,
  ],
  ['proof', msg`KZG proof`, msg`48 bytes that prove the blob has the value y at z (the opening proof).`],
  [
    'bytes',
    msg`Bytes`,
    msg`Where the explorer got the bytes shown below, and how it tied them to the transaction. Hover a badge for details.`,
  ],
]

/** Pruned by the beacon, and nothing else to ask. */
function isPruned(message: string): boolean {
  return /not found|pruned|404/i.test(message)
}

/**
 * The transition's EIP-4844 blobs: what they hold and reveal, what binds each
 * one to the proof, and the data they carry once fetched from the beacon (or
 * a sequencer) and decoded.
 */
export function BlobsPanel({
  detail,
  blobs,
}: {
  detail: TransitionDetail
  blobs: UseQueryResult<DecodedTransitionBlobs>
}) {
  const { i18n, t } = useLingui()
  const { tx, transition: tr, publics } = detail
  const services = useServices()
  const points = useMemo<Hex[]>(
    () => (tx ? tx.commitments.map((c) => blobEvaluationPoint(tr.processId, tr.rootBefore, c)) : []),
    [tx, tr.processId, tr.rootBefore]
  )
  const decoded = blobs.data?.decoded ?? null
  const refreshes = decoded && publics ? decoded.updates.length - publics.voters : null
  const minRefresh = publics ? requiredRefresh(publics.voters, publics.overwrites, publics.occupiedBefore) : null
  const cellTotal = blobs.data ? formatNumber(blobs.data.blobs.length * CELLS_PER_BLOB) : null
  const ballotCount = publics?.voters ?? 0
  const refreshCount = refreshes ?? 0

  return (
    <Panel
      label={t`Data availability`}
      title={t`Blobs`}
      description={
        <Trans>
          Everything needed to rebuild the election’s state after this batch is published in data{' '}
          <Term id='blob'>blobs</Term> attached to the transaction (EIP-4844). Anyone can apply them to the previous
          state and arrive at the same new fingerprint.
        </Trans>
      }
    >
      <div className='flex flex-col gap-5'>
        <Layout />

        {!tx ? (
          <SkeletonText lines={4} />
        ) : (
          <div className='scroll-slim overflow-x-auto'>
            <table className='w-full min-w-[980px] border-collapse text-[12px]' data-testid='blob-list'>
              <thead>
                <tr className='label-caps text-left text-[10px] text-pewter'>
                  {COLUMNS.map(([key, label, hint, formula]) => (
                    <th key={key} scope='col' className='border-b border-charcoal px-2 py-2 font-semibold'>
                      <span className='inline-flex items-center gap-1'>
                        {i18n._(label)}
                        {hint ? (
                          <Explain>
                            <span className='flex flex-col gap-1.5 font-normal normal-case tracking-normal'>
                              <span>{i18n._(hint)}</span>
                              {formula ? <Formula expr={formula} className='w-fit bg-carbon' /> : null}
                            </span>
                          </Explain>
                        ) : null}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(tx.blobVersionedHashes ?? []).map((vh, i) => {
                  const fetched = blobs.data?.blobs[i]
                  const cell = (v: Hex | undefined) => (v ? <Hash value={v} chars={6} /> : '—')
                  return (
                    <tr key={vh} className='border-b border-charcoal/60 last:border-b-0'>
                      <td className='px-2 py-2 font-mono text-silver tnum'>{i}</td>
                      <td className='px-2 py-2'>{cell(vh)}</td>
                      <td className='px-2 py-2'>{cell(tx.commitments[i])}</td>
                      <td className='px-2 py-2'>{cell(points[i])}</td>
                      <td className='px-2 py-2'>{cell(tx.ys[i])}</td>
                      <td className='px-2 py-2'>{cell(tx.kzgProofs[i])}</td>
                      <td className='px-2 py-2'>
                        {fetched ? (
                          <Tooltip content={i18n._(BINDING[fetched.binding].hint)}>
                            <span className='inline-flex'>
                              <Badge size='sm' tone={BINDING[fetched.binding].tone}>
                                {i18n._(BINDING[fetched.binding].label)} · {fetched.source}
                              </Badge>
                            </span>
                          </Tooltip>
                        ) : (
                          <span className='text-ash'>{blobs.isLoading ? t`fetching…` : t`not fetched`}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <Content detail={detail} blobs={blobs} sequencers={services.sequencers.length} />

        {decoded ? (
          <div className='flex flex-col gap-4' data-testid='blob-content'>
            <StatRow>
              <StatCell
                label={t`Vote ids`}
                value={formatNumber(decoded.voteIds.length)}
                hint={t`one per ballot, sorted`}
                mono
              />
              <StatCell
                label={t`Slot updates`}
                value={formatNumber(decoded.updates.length)}
                hint={
                  refreshes != null && refreshes >= 0
                    ? t`${plural(ballotCount, { one: '# ballot', other: '# ballots' })} + ${plural(refreshCount, {
                        one: '# silent refresh',
                        other: '# silent refreshes',
                      })}`
                    : t`every slot the batch wrote`
                }
                mono
              />
              <StatCell
                label={t`Fields per ballot`}
                value={formatNumber(decoded.numFields)}
                hint={t`encrypted values per ballot and in the running total`}
                mono
              />
              <StatCell
                label={t`Cells used`}
                value={formatNumber(usedCells(decoded))}
                hint={t`of ${cellTotal}; the rest is zero`}
                mono
              />
            </StatRow>
            {refreshes != null && minRefresh != null ? (
              <RefreshRequirement required={minRefresh} carried={refreshes} />
            ) : null}
            <BlobLayoutBar counts={countsOf(decoded)} nBlobs={blobs.data!.blobs.length} />
            <Tabs
              items={[
                {
                  value: 'vote-ids',
                  label: t`Vote ids`,
                  meta: formatNumber(decoded.voteIds.length),
                  content: <VoteIdList processId={tr.processId} voteIds={decoded.voteIds} />,
                },
                {
                  value: 'updates',
                  label: t`Slot updates`,
                  meta: formatNumber(decoded.updates.length),
                  content: (
                    <div className='flex flex-col gap-3'>
                      <p className='text-[12px] leading-relaxed text-ash'>
                        <Trans>
                          A <Term id='slot'>slot</Term> holds one voter’s current ballot. Its number comes from the
                          voter’s address with a list of voters (a Merkle census), or from the index the credential
                          service signed (a CSP census). The encrypted values are the re-encrypted ballot, compressed to
                          one cell per curve point; open a row to unpack them.
                        </Trans>
                      </p>
                      <SlotUpdateList updates={decoded.updates} />
                    </div>
                  ),
                },
                {
                  value: 'accumulator',
                  label: t`Accumulator`,
                  meta: formatNumber(decoded.accumulator.length),
                  content: (
                    <div className='flex flex-col gap-3'>
                      <p className='text-[12px] leading-relaxed text-ash'>
                        <Trans>
                          The <Term id='accumulator'>encrypted running total</Term> after this batch, one encrypted
                          value per ballot field: the previous total, plus every new ballot, minus the ballots they
                          replaced, plus the silent refreshes’ encryptions of zero, which change no count. Only the
                          final total is decrypted, when the results are published. The holder of the election key could
                          decrypt this one, or any ballot in the blobs.
                        </Trans>
                      </p>
                      <CiphertextTable ciphertexts={decoded.accumulator} />
                    </div>
                  ),
                },
                {
                  value: 'cells',
                  label: t`Cells`,
                  meta: formatNumber(blobs.data!.blobs.length * CELLS_PER_BLOB),
                  content: <BlobCellView blobs={blobs.data!.blobs.map((b) => b.data)} counts={countsOf(decoded)} />,
                },
              ]}
            />
          </div>
        ) : blobs.data && blobs.data.decodeError ? (
          <Disclosure summary={t`Raw cells`}>
            <BlobCellView blobs={blobs.data.blobs.map((b) => b.data)} counts={null} />
          </Disclosure>
        ) : null}
      </div>
    </Panel>
  )
}

function RefreshRequirement({ required, carried }: { required: number; carried: number }) {
  const carriedText = formatNumber(carried)
  return (
    <p className='text-[12px] leading-relaxed text-ash'>
      <Trans>
        To hide who changed their vote, this batch had to re-encrypt at least{' '}
        <Plural value={required} one='# ballot nobody changed' other='# ballots nobody changed' /> (silent refreshes),
        and the data carries {carriedText}.
      </Trans>{' '}
      <Explain>
        <span className='flex flex-col gap-1.5'>
          <Trans>
            The minimum depends on how many people had voted before and on the batch’s own votes. The count is public;
            which ballots were refreshed is not.
          </Trans>
          <Formula expr='min(target, occupied_before − overwrites)' className='w-fit bg-carbon' />
          <Formula expr='target = min(2048, max(16, 2 × overwrites, votes))' className='w-fit bg-carbon' />
        </span>
      </Explain>
    </p>
  )
}

function Layout() {
  const { t } = useLingui()
  return (
    <div className='grid gap-5 text-[13px] leading-relaxed text-ash md:grid-cols-2'>
      <div className='flex flex-col gap-2.5'>
        <h3 className='text-[13px] font-semibold text-ghost'>
          <Trans>What the blobs hold, in order</Trans>
        </h3>
        <NumberedList
          items={[
            t`The vote ids of the batch, sorted.`,
            t`Every ballot the batch wrote, sorted by slot: new votes, changed votes and silent refreshes alike, each compressed to one cell per curve point.`,
            t`The new encrypted running total (the accumulator).`,
            t`Zeros to the end of the last blob.`,
          ]}
        />
        <p className='text-[12px]'>
          <Trans>
            The proven program lays out these cells itself, from the state it just proved, so the sequencer cannot
            publish anything else. A cell is a 32-byte number.
          </Trans>
        </p>
      </div>
      <div className='flex flex-col gap-2.5'>
        <h3 className='text-[13px] font-semibold text-ghost'>
          <Trans>What they reveal, and what they don’t</Trans>
        </h3>
        <p>
          <Trans>
            A new vote, a <Term id='overwrite'>changed vote</Term> and a <Term id='silent-refresh'>silent refresh</Term>{' '}
            look the same in the data. Each batch also re-encrypts a random sample of ballots it did not change, so
            nobody can tell which ballots were changed and which were only refreshed.
          </Trans>
        </p>
        <p>
          <Trans>
            A voter’s first vote is visible, though, because refreshes only touch slots already written. With a Merkle
            census the slot follows from the voter’s address, so who voted and when is public. The vote ids and the
            slots are sorted separately, but in a small batch the new vote ids and the new slots can still be matched.
          </Trans>
        </p>
      </div>
    </div>
  )
}

/** Where a sequencer node serves the blobs it archived. A route, not text. */
const ARCHIVE_ROUTE = '/processes/{pid}/transitions/{index}/blobs'

function Content({
  detail,
  blobs,
  sequencers,
}: {
  detail: TransitionDetail
  blobs: UseQueryResult<DecodedTransitionBlobs>
  sequencers: number
}) {
  const { t } = useLingui()
  if (blobs.data?.decoded) {
    if (blobs.data.attempts.length === 0) return null
    return <Attempts attempts={blobs.data.attempts} intro={t`Found after these sources failed:`} />
  }
  if (blobs.data?.decodeError) {
    const reason = blobs.data.decodeError
    return (
      <Callout tone='danger' title={t`The blob data does not decode`}>
        <Trans>
          {reason}. The decoder checks the layout the proven program produces; a batch the registry accepted can only
          fail here if the bytes are not the blob the transaction carried, or the ballot field count is not known yet.
        </Trans>
      </Callout>
    )
  }
  if (blobs.error) {
    const message = blobs.error.message
    if (isPruned(message) && sequencers === 0) {
      const route = ARCHIVE_ROUTE
      return (
        <Callout tone='warn' title={t`The data of this batch is no longer served, and no sequencer is configured`}>
          <p>
            <Trans>
              Beacon nodes keep blobs for about 15 days on Gnosis Chain (16384 epochs of 80 s) and about 18 on Ethereum
              mainnet, then prune them. This transition's blobs are gone from the configured beacon, and this explorer
              has no sequencer node to ask: nodes archive the blobs they saw and serve them at {route}.
            </Trans>
          </p>
          <p className='mt-2'>
            <Trans>
              The settlement is not in doubt. The registry checked the real blobs when they were fresh, against the
              commitments, evaluations and KZG proofs that stay in the call’s data, and the checks below still hold.
              Only the content cannot be shown.
            </Trans>
          </p>
          <Attempts attempts={[]} raw={message} />
        </Callout>
      )
    }
    return (
      <Callout tone='danger' title={t`The blobs could not be fetched`}>
        <p>{message}</p>
      </Callout>
    )
  }
  if (!detail.tx) return <Skeleton className='h-24 w-full' />
  if (blobs.isLoading) {
    return (
      <div className='flex flex-col gap-2' aria-busy='true'>
        <p className='text-[12px] text-ash'>
          <Trans>Fetching the blobs from the beacon…</Trans>
        </p>
        <Skeleton className='h-24 w-full' />
      </div>
    )
  }
  return (
    <EmptyState
      compact
      title={t`Waiting for the transaction`}
      description={t`The blobs are fetched once the transaction that recorded the batch and the ballot’s field count are known.`}
    />
  )
}

function Attempts({
  attempts,
  intro,
  raw,
}: {
  attempts: DecodedTransitionBlobs['attempts']
  intro?: string
  raw?: string
}) {
  const { t } = useLingui()
  return (
    <Disclosure summary={t`Sources tried`} className='mt-3'>
      {intro ? <p className='mb-2 text-[12px] text-ash'>{intro}</p> : null}
      <ul className='flex flex-col gap-1 font-mono text-[11px] break-all text-ash'>
        {attempts.map((a, i) => (
          <li key={i}>
            {a.source} {a.url}: {a.error}
          </li>
        ))}
        {raw ? <li>{raw}</li> : null}
      </ul>
    </Disclosure>
  )
}
