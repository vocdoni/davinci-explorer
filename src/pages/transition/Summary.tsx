import type { ReactNode } from 'react'
import { plural } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { Explain, NativeAmount, ProcessIdLink, ProcessPhaseBadge, Timestamp, TxLink } from '~components'
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
          explain={t`Transitions are numbered from 0 in the order they settled, as the sequencer API numbers them.`}
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
          explain={t`Settlement is permissionless: any sequencer may send a proven batch, and the registry checks it the same way whoever sends it.`}
        >
          {t`Settled by`}
        </Label>
      ),
      value: <Address value={tr.sender} />,
    },
    {
      label: <Label explain={t`The status the settlement transaction ended with.`}>{t`Status`}</Label>,
      value: tx ? (tx.status === 'success' ? t`Success` : t`Reverted`) : pending,
    },
    {
      label: (
        <Label
          explain={t`The state tree's root before this batch: the process root the registry held, which the proof had to start from.`}
        >
          {t`Root before`}
        </Label>
      ),
      value: <Hash value={tr.rootBefore} chars={10} />,
    },
    {
      label: (
        <Label
          explain={t`The root after this batch. The registry stored it as the process root; the next transition starts here.`}
        >
          {t`Root after`}
        </Label>
      ),
      value: <Hash value={tr.rootAfter} chars={10} />,
    },
    {
      label: (
        <Label
          explain={t`New voters wrote a slot for the first time; overwrites replaced an earlier vote of the same voter. A first write is public, since refreshes only touch occupied slots; which occupied slots were overwritten and which were only refreshed is not.`}
        >
          {t`Votes`}
        </Label>
      ),
      value: t`${plural(newVoters, { one: '# new voter', other: '# new voters' })} · ${plural(overwrites, {
        one: '# overwrite',
        other: '# overwrites',
      })}`,
    },
    {
      label: <Label explain={t`The process counters the registry emitted after this batch.`}>{t`Totals after`}</Label>,
      value: t`${plural(voters, { one: '# voter', other: '# voters' })} · ${plural(overwritten, {
        one: '# overwrite',
        other: '# overwrites',
      })}`,
    },
    {
      label: (
        <Label
          explain={t`EIP-4844 blobs attached to the transaction. They carry the data to rebuild the state and cost blob gas, not calldata.`}
        >
          {t`Blobs`}
        </Label>
      ),
      value: blobGas != null ? t`${nBlobsText} · ${blobGas} blob gas` : nBlobsText,
      mono: true,
    },
    {
      label: (
        <Label explain={t`Execution gas: the PLONK verification, the checks and the storage writes.`}>
          {t`Gas used`}
        </Label>
      ),
      value: tx ? `${formatNumber(tx.gasUsed)} @ ${gasPrice(tx.effectiveGasPrice)}` : pending,
      mono: true,
    },
    {
      label: <Label explain={t`Execution fee plus blob fee, paid by the sender.`}>{t`Fee`}</Label>,
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
          explain={t`submitStateTransition calldata: the process id, 512 bytes of public values, the 768-byte proof and one commitment, evaluation and KZG proof per blob.`}
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
        <a href='#verify' className={`${tone} hover:underline`}>
          <Trans>
            {passedText}/{checksText} checks passed
          </Trans>
        </a>{' '}
        · <BlobsLine blobs={blobs} />
      </p>
      <KeyValue items={items} columns={2} className='mt-3' />
      <p className='mt-3 text-[12px] text-ash'>
        <Trans>
          All transitions of this process are on its{' '}
          <Link to={paths.process(process.id, 'transitions')} className='text-silver hover:text-emerald'>
            transitions tab
          </Link>
          , with the chain of roots from genesis.
        </Trans>
      </p>
    </Card>
  )
}
