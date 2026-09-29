import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { plural } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Explain, Term, Timestamp } from '~components'
import { Disclosure } from '~components/code'
import { useDataSource } from '~data/context'
import type { ProcessView } from '~data/hooks'
import { useTransitionBlobs } from '~data/queries'
import {
  Button,
  buttonClasses,
  Callout,
  ChevronLeftIcon,
  ChevronRightIcon,
  EmptyState,
  Input,
  Pagination,
  Panel,
  Select,
  SkeletonText,
} from '~kit'
import { cn } from '~lib/cn'
import { formatNumber } from '~lib/format'
import { formatVoteId, parseVoteId } from '~protocol/blob'
import { paths } from '~routes/paths'

const PAGE = 60

export function VotesTab({ view }: { view: ProcessView }) {
  const { t } = useLingui()
  const { process: p, transitions } = view
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const newest = transitions.length - 1
  const requested = Number.parseInt(params.get('t') ?? '', 10)
  const index = Number.isInteger(requested) && requested >= 0 && requested <= newest ? requested : newest
  const [lookup, setLookup] = useState('')
  const lookupId = parseVoteId(lookup)
  const lookupInvalid = lookup.trim() !== '' && lookupId == null

  const select = (i: number) => {
    const next = new URLSearchParams(params)
    next.set('t', String(i))
    setParams(next, { replace: true })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (lookupId != null) navigate(paths.vote(p.id, formatVoteId(lookupId)))
  }

  return (
    <div data-testid='tab-votes' className='flex flex-col gap-6'>
      <Panel
        title={t`Find a vote`}
        label={t`Vote lookup`}
        description={
          <Trans>
            Your voting app shows a <Term id='vote-id'>vote id</Term> when you vote. Enter it to check your vote: the
            explorer finds the batch that recorded it and checks the sequencer’s receipt, which shows it is in a state
            the registry recorded.
          </Trans>
        }
      >
        <form onSubmit={submit} className='flex flex-col gap-2 sm:flex-row sm:items-start' role='search'>
          <Input
            aria-label={t`Vote id`}
            placeholder={t`Vote id: 0x followed by 16 hex digits, or decimal`}
            mono
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            error={
              lookupInvalid
                ? t`A vote id is 0x followed by 16 hex digits, the first one 8 to f, or the same number in decimal.`
                : undefined
            }
            wrapperClassName='flex-1'
          />
          <Button type='submit' variant='primary' disabled={lookupId == null}>
            <Trans>Look up this vote</Trans>
          </Button>
        </form>
      </Panel>

      <Panel
        title={t`Vote ids per batch`}
        label={t`From the published data`}
        description={
          <Trans>
            Each batch publishes the vote ids it recorded, in its <Term id='blob'>data blobs</Term>, so anyone can find
            a vote.
          </Trans>
        }
      >
        <dl className='mb-4 grid gap-2 text-[13px] leading-relaxed sm:grid-cols-2' data-testid='votes-privacy'>
          <div className='rounded-sm border border-charcoal bg-onyx/40 px-3 py-2'>
            <dt className='label-caps text-[10px] text-pewter'>
              <Trans>Public</Trans>
            </dt>
            <dd className='mt-1 text-silver'>
              <Trans>
                Every vote id, and who voted and when: a first vote fills an empty slot, and unless a credential service
                signs the votes, a voter’s slot follows from their address.
              </Trans>
            </dd>
          </div>
          <div className='rounded-sm border border-charcoal bg-onyx/40 px-3 py-2'>
            <dt className='label-caps text-[10px] text-pewter'>
              <Trans>Hidden</Trans>
            </dt>
            <dd className='mt-1 text-silver'>
              <Trans>
                Which slots got a changed vote. A <Term id='overwrite'>changed vote</Term> and a{' '}
                <Term id='silent-refresh'>silent refresh</Term> look the same in the data, so nobody can tell one from
                the other.
              </Trans>
            </dd>
          </div>
        </dl>
        <Disclosure summary={<Trans>Technical details</Trans>} variant='plain' className='mb-4'>
          <p className='text-[13px] leading-relaxed text-ash'>
            <Trans>
              Each batch (a state transition) publishes its data in EIP-4844 blobs: the vote ids of the batch, then
              every ballot slot it wrote with the new ciphertexts, then the new accumulator. With a Merkle census a
              voter’s slot is derived from their address; with a credential service, from the index the service signs.
            </Trans>
          </p>
        </Disclosure>
        {transitions.length === 0 ? (
          <EmptyState
            compact
            title={t`No batches yet`}
            description={t`Vote ids appear here once a sequencer records the first batch of this election.`}
          />
        ) : (
          <div className='flex flex-col gap-4'>
            <div className='flex flex-wrap items-end gap-2'>
              <Button
                size='icon'
                variant='subtle'
                aria-label={t`Older batch`}
                disabled={index <= 0}
                onClick={() => select(index - 1)}
              >
                <ChevronLeftIcon />
              </Button>
              <Select
                aria-label={t`Batch`}
                wrapperClassName='min-w-0 flex-1 sm:max-w-md'
                value={String(index)}
                onChange={(e) => select(Number(e.target.value))}
                options={[...transitions].reverse().map((tr) => {
                  const position = tr.index
                  const votes = tr.votes
                  const blobs = tr.nBlobs
                  return {
                    value: String(position),
                    label: t`#${position} · ${plural(votes, { one: '# vote', other: '# votes' })} · ${plural(blobs, { one: '# data blob', other: '# data blobs' })}`,
                  }
                })}
              />
              <Button
                size='icon'
                variant='subtle'
                aria-label={t`Newer batch`}
                disabled={index >= newest}
                onClick={() => select(index + 1)}
              >
                <ChevronRightIcon />
              </Button>
              <Link to={paths.transition(p.id, index)} className={buttonClasses('ghost', 'md', 'ml-auto')}>
                <Trans>Open batch #{index}</Trans>
              </Link>
            </div>
            <TransitionVotes key={index} view={view} index={index} highlight={lookupId} />
          </div>
        )}
      </Panel>
    </div>
  )
}

function TransitionVotes({ view, index, highlight }: { view: ProcessView; index: number; highlight: bigint | null }) {
  const { t } = useLingui()
  const { process: p } = view
  const row = view.transitions[index]!
  const source = useDataSource()
  const blobs = useTransitionBlobs(p.id, index)
  const [page, setPage] = useState(0)

  useEffect(() => {
    if (row.tx) source.ensureTxDetails([row.tx])
  }, [source, row.tx])

  const ids = useMemo(() => blobs.data?.decoded?.voteIds ?? [], [blobs.data])
  const hit = highlight != null ? ids.indexOf(highlight) : -1
  useEffect(() => {
    if (hit >= 0) setPage(Math.floor(hit / PAGE))
  }, [hit])

  const waitingForTx = blobs.status === 'pending' && blobs.fetchStatus === 'idle'
  const block = formatNumber(row.block)
  const newVoters = row.newVoters
  const overwrites = row.overwrites
  const nBlobs = row.nBlobs
  const header = (
    <p className='text-[13px] text-ash'>
      <Trans>
        Recorded <Timestamp value={row.timestamp} /> in block {block}:{' '}
        <Plural value={newVoters} one='# new voter' other='# new voters' /> and{' '}
        <Plural value={overwrites} one='# changed vote' other='# changed votes' />, in{' '}
        <Plural value={nBlobs} one='# data blob' other='# data blobs' />.
      </Trans>
    </p>
  )

  if (waitingForTx || blobs.isLoading) {
    return (
      <div className='flex flex-col gap-3'>
        {header}
        <p className='text-[13px] text-ash'>
          {waitingForTx
            ? t`Reading the batch’s transaction to find its data blobs…`
            : t`${plural(nBlobs, { one: 'Fetching # data blob…', other: 'Fetching # data blobs…' })}`}
        </p>
        <SkeletonText lines={4} />
      </div>
    )
  }
  if (blobs.error) {
    return (
      <div className='flex flex-col gap-3'>
        {header}
        <Callout tone='warn' title={t`The published data could not be fetched`}>
          <p>{blobs.error instanceof Error ? blobs.error.message : String(blobs.error)}</p>
          <p className='mt-1'>
            <Trans>
              The network keeps data blobs for about two weeks: about 15 days on Gnosis Chain (16384 epochs of 80 s) and
              about 18 on Ethereum mainnet. After that only a sequencer that stored them, or an archive, can serve them.
              The transaction still carries their fingerprints (versioned hashes).
            </Trans>
          </p>
        </Callout>
      </div>
    )
  }
  const data = blobs.data
  if (!data) return header
  if (!data.decoded) {
    return (
      <div className='flex flex-col gap-3'>
        {header}
        <Callout tone='danger' title={t`The published data could not be decoded`}>
          {data.decodeError}
        </Callout>
      </div>
    )
  }

  const updates = data.decoded.updates.length
  const refreshes = Math.max(0, updates - row.votes)
  const pageCount = Math.ceil(ids.length / PAGE)
  const shown = ids.slice(page * PAGE, (page + 1) * PAGE)
  const voteIds = ids.length
  const votes = row.votes
  const sourceUrl = data.sourceUrl
  const missing = highlight != null && hit < 0 ? formatVoteId(highlight) : null

  return (
    <div className='flex flex-col gap-3' data-testid='vote-ids'>
      {header}
      <p className='text-[13px] text-silver'>
        <Trans>
          <Plural value={voteIds} one='# vote id' other='# vote ids' /> ·{' '}
          <Plural value={updates} one='# slot update' other='# slot updates' />:{' '}
          <Plural value={votes} one='# vote' other='# votes' /> plus{' '}
          <Plural value={refreshes} one='# silent refresh' other='# silent refreshes' />
        </Trans>
        <Explain className='ml-1'>
          <Trans>
            The counts are public (the registry event carries them), and so is a slot’s first write, since refreshes
            only touch slots that already hold a ballot. Which of those got a new vote and which were only refreshed is
            not: every batch re-encrypts a random sample of occupied slots it did not write, so a changed vote hides
            among the refreshes.
          </Trans>
        </Explain>
      </p>
      <p className='text-xs text-ash'>
        {data.source === 'sequencer'
          ? t`Served by the sequencer ${sourceUrl} from its archive. It is matched to this batch by position only, not checked against the blob fingerprints in the transaction.`
          : data.source === 'beacon'
            ? data.blobs.some((b) => b.binding === 'beacon-filter')
              ? t`From the beacon node ${sourceUrl}, which picked each blob by a fingerprint (versioned hash) the transaction carries.`
              : t`From the beacon node ${sourceUrl}. Each blob’s commitment matches a fingerprint (versioned hash) the transaction carries.`
            : t`From the demo network.`}
      </p>
      {missing != null ? (
        <p className='text-xs text-amber'>
          <Trans>This batch does not list {missing}.</Trans>
        </p>
      ) : null}
      <ul className='grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-4'>
        {shown.map((id) => {
          const hex = formatVoteId(id)
          return (
            <li key={hex}>
              <Link
                to={paths.vote(p.id, hex)}
                className={cn(
                  'block truncate rounded-sm border px-2 py-1 font-mono text-[12px] tnum transition-colors hover:border-emerald hover:text-emerald',
                  id === highlight ? 'border-emerald bg-emerald/10 text-emerald' : 'border-charcoal text-silver'
                )}
              >
                {hex}
              </Link>
            </li>
          )
        })}
      </ul>
      {pageCount > 1 ? (
        <Pagination page={page} pageCount={pageCount} onPageChange={setPage} pageSize={PAGE} total={ids.length} />
      ) : null}
    </div>
  )
}
