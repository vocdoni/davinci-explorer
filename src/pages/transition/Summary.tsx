import type { ReactNode } from 'react'
import { plural } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import {
  Explain,
  HashLink,
  InShort,
  NativeAmount,
  ProcessIdLink,
  ProcessPhaseBadge,
  Term,
  Timestamp,
  TxLink,
} from '~components'
import type { DecodedTransitionBlobs } from '~data/queries'
import type { TransitionDetail } from '~indexer/selectors'
import { processPhase } from '~indexer/selectors'
import { Address, BlockCell, Card, Hash, KeyValue, Skeleton, type KeyValueItem } from '~kit'
import { formatBytes, formatGwei, formatNumber } from '~lib/format'
import { paths } from '~routes/paths'
import type { UseQueryResult } from '@tanstack/react-query'

/** Gnosis base fees sit at a few wei, which "0.00 gwei" would hide. Unit symbols stay as they are. */
const gasPrice = (wei: bigint) => (wei < 10_000_000n ? `${formatNumber(wei)} wei` : `${formatGwei(wei)} gwei`)

function BlobsLine({ blobs }: { blobs: UseQueryResult<DecodedTransitionBlobs> }) {
  const { t } = useLingui()
  if (blobs.data?.decoded) {
    const voteIds = blobs.data.decoded.voteIds.length
    const updates = blobs.data.decoded.updates.length
    return t`blobs: ${plural(voteIds, { one: '# vote id', other: '# vote ids' })}, ${plural(updates, {
      one: '# slot update',
      other: '# slot updates',
    })}`
  }
  if (blobs.data?.decodeError) {
    const reason = blobs.data.decodeError
    return t`blobs: ${reason}`
  }
  if (blobs.error) return t`blobs: not available`
  if (blobs.isLoading) return t`blobs: loading…`
  return t`blobs: waiting for the transaction`
}

function Label({ children, explain }: { children: ReactNode; explain?: ReactNode }) {
  return (
    <span className='inline-flex items-center gap-1'>
      {children}
      {explain ? <Explain>{explain}</Explain> : null}
    </span>
  )
}

/** The facts of one transition: where it sits, who settled it, what it changed and what it cost. */
export function TransitionSummary({
  detail,
  blobs,
  now,
  total,
}: {
  detail: TransitionDetail
  blobs: UseQueryResult<DecodedTransitionBlobs>
  now: number | null
  total: number
}) {
  const { t } = useLingui()
  const { transition: tr, row, tx, process } = detail
  const passed = detail.checks.filter((c) => c.state === 'pass').length
  const failed = detail.checks.filter((c) => c.state === 'fail').length
  const tone = failed ? 'text-red' : passed === detail.checks.length ? 'text-emerald' : 'text-silver'
  const execFee = tx ? tx.gasUsed * tx.effectiveGasPrice : null
  const blobFee = tx?.blobGasUsed != null && tx.blobGasPrice != null ? tx.blobGasUsed * tx.blobGasPrice : null
  const pending = <Skeleton className='inline-block h-3 w-20' />

  const index = tr.index
  const totalText = formatNumber(total)
  const newVoters = tr.newVoters
  const overwrites = tr.overwrites
  const voters = tr.votersCount
  const overwritten = tr.overwrittenVotesCount
  const nBlobsText = formatNumber(tr.nBlobs)
  const blobGas = tx?.blobGasUsed != null ? formatNumber(tx.blobGasUsed) : null

  const items: KeyValueItem[] = [
    {
      label: <Label>{t`Process`}</Label>,
      value: (
        <span className='inline-flex items-center gap-2'>
          <ProcessIdLink id={process.id} chars={10} />
          <ProcessPhaseBadge phase={processPhase(process, now)} size='sm' />
        </span>
      ),
    },
    {
      label: (
        <Label
          explain={t`Batches are numbered from 0 in the order they were recorded, as the sequencer API numbers them.`}
        >
          {t`Position`}
        </Label>
      ),
      value: t`#${index} of ${totalText}`,
      mono: true,
    },
    {
      label: <Label>{t`Block`}</Label>,
      value: (
        <span className='inline-flex items-center gap-2'>
          <BlockCell block={tr.block} />
          <Timestamp value={row.timestamp} className='text-ash' />
        </span>
      ),
    },
    {
      label: <Label>{t`Transaction`}</Label>,
      value: tr.tx ? <TxLink hash={tr.tx} chars={10} /> : '—',
    },
    {
      label: (
        <Label
          explain={t`Anyone may send a proven batch, and the registry checks it the same way whoever sends it. The account links to everything it recorded.`}
        >
          {t`Sent by`}
        </Label>
      ),
      value: <Address value={tr.sender} to={paths.sequencer(tr.sender)} />,
    },
    {
      label: <Label explain={t`Whether the transaction that recorded the batch went through.`}>{t`Status`}</Label>,
      value: tx ? (tx.status === 'success' ? t`Success` : t`Reverted`) : pending,
    },
    {
      label: (
        <Label
          explain={t`The fingerprint of the election’s state before this batch (its state root). The batch had to start from the one the registry held.`}
        >
          {t`State before`}
        </Label>
      ),
      value: <Hash value={tr.rootBefore} chars={10} />,
    },
    {
      label: (
        <Label
          explain={t`The fingerprint of the state after this batch. The registry stored it, and the next batch starts from it.`}
        >
          {t`State after`}
        </Label>
      ),
      value: <Hash value={tr.rootAfter} chars={10} />,
    },
    {
      label: (
        <Label
          explain={t`A new voter voted for the first time; a changed vote (an overwrite) replaced a voter’s earlier vote. A first vote is public, since refreshes only touch slots already written; which of those were changed and which only refreshed is not.`}
        >
          {t`Votes`}
        </Label>
      ),
      value: t`${plural(newVoters, { one: '# new voter', other: '# new voters' })} · ${plural(overwrites, {
        one: '# changed vote',
        other: '# changed votes',
      })}`,
    },
    {
      label: (
        <Label
          explain={t`The election’s counts after this batch, as the registry recorded them.`}
        >{t`Totals after`}</Label>
      ),
      value: t`${plural(voters, { one: '# voter', other: '# voters' })} · ${plural(overwritten, {
        one: '# changed vote',
        other: '# changed votes',
      })}`,
    },
    {
      label: (
        <Label
          explain={t`Data blobs attached to the transaction (EIP-4844). They carry what anyone needs to rebuild the state, and are paid for in blob gas rather than as call data.`}
        >
          {t`Blobs`}
        </Label>
      ),
      value: blobGas != null ? t`${nBlobsText} · ${blobGas} blob gas` : nBlobsText,
      mono: true,
    },
    {
      label: (
        <Label explain={t`Execution gas: checking the proof, the other checks and the storage writes.`}>
          {t`Gas used`}
        </Label>
      ),
      value: tx ? `${formatNumber(tx.gasUsed)} @ ${gasPrice(tx.effectiveGasPrice)}` : pending,
      mono: true,
    },
    {
      label: <Label explain={t`What the sender paid: the execution fee plus the blob fee.`}>{t`Fee`}</Label>,
      value: tx ? <NativeAmount wei={tx.fee} /> : pending,
      hint:
        execFee != null ? (
          blobFee != null ? (
            <Trans>
              execution <NativeAmount wei={execFee} /> · blobs <NativeAmount wei={blobFee} />
            </Trans>
          ) : (
            <Trans>
              execution <NativeAmount wei={execFee} />
            </Trans>
          )
        ) : undefined,
    },
    {
      label: (
        <Label
          explain={t`What the transaction sent to the registry (submitStateTransition): the process id, 512 bytes of public values, the 768-byte proof, and per blob a commitment, an evaluation and a KZG proof.`}
        >
          {t`Calldata`}
        </Label>
      ),
      value: tx ? formatBytes(tx.inputSize) : pending,
      mono: true,
    },
  ]

  const ballots = row.votes
  const nBlobs = tr.nBlobs
  const passedText = formatNumber(passed)
  const checksText = formatNumber(detail.checks.length)

  return (
    <Card data-testid='transition-summary'>
      <p className='text-[13px] text-silver'>
        <Plural value={ballots} one='# ballot' other='# ballots' /> ·{' '}
        <Plural value={nBlobs} one='# blob' other='# blobs' /> ·{' '}
        <HashLink id='verify' className={`${tone} hover:underline`}>
          <Trans>
            {passedText}/{checksText} checks passed
          </Trans>
        </HashLink>{' '}
        · <BlobsLine blobs={blobs} />
      </p>
      <KeyValue items={items} columns={2} className='mt-3' />
      <p className='mt-3 text-[12px] text-ash'>
        <Trans>
          Every batch of this election is on its{' '}
          <Link to={paths.process(process.id, 'transitions')} className='text-silver hover:text-emerald'>
            transitions tab
          </Link>
          , each starting where the one before ended.
        </Trans>
      </p>
    </Card>
  )
}

/** The batch in a few plain sentences: what it recorded, whether it passed, where its data is. */
export function TransitionInShort({ detail }: { detail: TransitionDetail }) {
  const { transition: tr, row, checks } = detail
  const failed = checks.filter((c) => c.state === 'fail').length
  const passed = checks.filter((c) => c.state === 'pass').length
  const total = checks.length
  const index = tr.index
  const newVoters = tr.newVoters
  const overwrites = tr.overwrites
  const nBlobs = tr.nBlobs
  return (
    <InShort>
      <ul data-testid='transition-in-short'>
        <li>
          {overwrites > 0 ? (
            <Trans>
              Batch #{index} recorded <Plural value={row.votes} one='# vote' other='# votes' /> for this election:{' '}
              <Plural value={newVoters} one='# new voter' other='# new voters' /> and{' '}
              <Plural value={overwrites} one='# changed vote' other='# changed votes' />.
            </Trans>
          ) : (
            <Trans>
              Batch #{index} recorded <Plural value={row.votes} one='# vote' other='# votes' /> for this election, all
              from new voters.
            </Trans>
          )}
        </li>
        <li>
          {failed > 0 ? (
            <Trans>
              <Plural value={failed} one='# check fails' other='# checks fail' /> here: compare the values under “What
              the registry checked”.
            </Trans>
          ) : passed === total ? (
            <Trans>
              The registry accepted it after checking its proof, and the {total} checks the explorer can redo pass here
              too.
            </Trans>
          ) : (
            <Trans>
              The registry accepted it after checking its proof. {passed} of the {total} checks the explorer can redo
              pass here; the rest wait for data, or only the chain could decide them.
            </Trans>
          )}
        </li>
        <li>
          <Trans>
            Its data is published in <Plural value={nBlobs} one='# blob' other='# blobs' />, so anyone can rebuild the
            election’s <Term id='state-root'>state</Term> from it without trusting whoever sent it.
          </Trans>
        </li>
      </ul>
    </InShort>
  )
}
