import { plural } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { CheckMark, Timestamp, TxLink } from '~components'
import { Disclosure } from '~components/code'
import { useTransitionBlobs, type DecodedTransitionBlobs, type VoteInclusion } from '~data/queries'
import type { TransitionRow } from '~indexer/selectors'
import { BlockCell, Callout, Hash, KeyValue, Panel, ProgressBar, SkeletonText } from '~kit'
import { formatNumber } from '~lib/format'
import { paths } from '~routes/paths'

/** Where the blob that lists the vote came from, and what ties it to the transaction. */
function BlobOrigin({ data }: { data: DecodedTransitionBlobs }) {
  const { t } = useLingui()
  const url = data.sourceUrl
  const sequencer = data.source === 'sequencer' || data.blobs.some((b) => b.binding === 'sequencer')
  const text = sequencer
    ? t`The blob came from ${url}, from a sequencer's archive, not checked against the transaction's blob hashes.`
    : data.blobs.some((b) => b.binding === 'beacon-filter')
      ? t`The blob came from the beacon API ${url}, which selected it by the transaction's versioned hash.`
      : t`The blob came from the beacon API ${url}; its KZG commitment hashes to the transaction's versioned hash.`
  return (
    <p className={`text-xs break-words ${sequencer ? 'text-amber' : 'text-ash'}`} data-testid='vote-inclusion-source'>
      {text}
    </p>
  )
}

/**
 * Where the vote id landed on-chain: the settled transition whose blob lists
 * it. Needs only the beacon (or a sequencer's blob archive), no sequencer API.
 */
export function Inclusion({
  pid,
  inclusion,
  transitions,
  txsKnown,
}: {
  pid: string
  inclusion: VoteInclusion
  transitions: TransitionRow[]
  /** Transitions whose settlement transaction the indexer has read. */
  txsKnown: number
}) {
  const { t } = useLingui()
  const found = inclusion.transitionIndex != null ? transitions[inclusion.transitionIndex] : undefined
  // The search already fetched these blobs; this reads them back from the cache.
  const blobs = useTransitionBlobs(pid, found?.index, { enabled: found != null })
  const known = formatNumber(txsKnown)
  const settled = formatNumber(transitions.length)
  const searched = inclusion.total
  const unread = inclusion.errors.length

  return (
    <Panel
      label={t`On-chain`}
      title={t`Inclusion`}
      description={t`Every settled batch lists the vote ids it inserted in its blob. The explorer reads the process's blobs, newest first, until it finds this one.`}
    >
      <div className='flex flex-col gap-3' data-testid='vote-inclusion'>
        {transitions.length === 0 ? (
          <Callout title={t`No batch has settled for this process yet`}>
            <Trans>A vote shows up here once the batch carrying it settles on the registry.</Trans>
          </Callout>
        ) : inclusion.state === 'idle' ? (
          <div className='flex flex-col gap-2'>
            <p className='text-[13px] text-ash'>
              <Trans>
                Waiting for the indexer to read the settlement transactions ({known} of {settled}).
              </Trans>
            </p>
            <SkeletonText lines={2} />
          </div>
        ) : inclusion.state === 'searching' ? (
          <ProgressBar
            value={inclusion.checked}
            total={inclusion.total}
            label={t`Reading blobs, newest transition first`}
            tone='neutral'
          />
        ) : inclusion.state === 'found' && found ? (
          <>
            <p className='flex items-start gap-2 text-[13px] text-silver'>
              <CheckMark state='pass' className='mt-0.5' />
              <FoundIn pid={pid} index={found.index} />
            </p>
            {blobs.data ? <BlobOrigin data={blobs.data} /> : null}
            <KeyValue
              columns={2}
              items={[
                {
                  label: t`Block`,
                  value: (
                    <span className='inline-flex items-center gap-2'>
                      <BlockCell block={found.block} />
                      <Timestamp value={found.timestamp} className='text-ash' />
                    </span>
                  ),
                },
                { label: t`Transaction`, value: found.tx ? <TxLink hash={found.tx} chars={8} /> : '—' },
                { label: t`Root after`, value: <Hash value={found.rootAfter} chars={8} /> },
                { label: t`Batch`, value: <BatchSize votes={found.votes} nBlobs={found.nBlobs} /> },
              ]}
            />
          </>
        ) : inclusion.state === 'not-found' ? (
          <Callout
            tone='warn'
            title={t`Not in any of the ${plural(searched, {
              one: '# settled transition',
              other: '# settled transitions',
            })}`}
          >
            <Trans>
              The vote may still be waiting at a sequencer, or it belongs to another process, or the id has a typo.
            </Trans>
            {unread > 0 ? (
              <>
                {' '}
                <Plural
                  value={unread}
                  one='The blobs of # transition could not be read, so it may be in that one.'
                  other='The blobs of # transitions could not be read, so it may be in one of those.'
                />
              </>
            ) : null}
          </Callout>
        ) : (
          <Callout tone='danger' title={t`The blobs could not be read`}>
            <Trans>
              None of this process's blobs could be fetched. Beacon nodes prune blobs after about 15 days on Gnosis
              Chain (16384 epochs of 80 s) and about 18 on Ethereum mainnet; without a sequencer that archived them the
              vote ids are no longer available here. The tracker proof, when a sequencer serves one, does not need the
              blobs.
            </Trans>
          </Callout>
        )}
        {unread > 0 ? (
          <Disclosure summary={t`${plural(unread, { one: '# transition not read', other: '# transitions not read' })}`}>
            <ul className='flex flex-col gap-1 font-mono text-[11px] break-all text-ash'>
              {inclusion.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </Disclosure>
        ) : null}
      </div>
    </Panel>
  )
}

function FoundIn({ pid, index }: { pid: string; index: number }) {
  return (
    <span>
      <Trans>
        Listed in the blob of{' '}
        <Link to={paths.transition(pid, index)} className='text-emerald hover:underline'>
          transition #{index}
        </Link>
        . That batch inserted the vote id into the state tree, the zkVM proof covers the insertion and the registry
        settled it.
      </Trans>
    </span>
  )
}

function BatchSize({ votes, nBlobs }: { votes: number; nBlobs: number }) {
  return (
    <Trans>
      <Plural value={votes} one='# ballot' other='# ballots' /> · <Plural value={nBlobs} one='# blob' other='# blobs' />
    </Trans>
  )
}
