import { Plural, Trans, useLingui } from '@lingui/react/macro'
import type { UseQueryResult } from '@tanstack/react-query'
import { Link } from 'react-router'
import { CheckMark } from '~components'
import { CodeBlock, Disclosure } from '~components/code'
import type { TrackerCheck } from '~data/queries'
import type { TransitionRow } from '~indexer/selectors'
import { Callout, Hash, Panel, SkeletonText } from '~kit'
import { formatVoteId } from '~protocol/blob'
import { SMT_LEVELS } from '~protocol/limits'
import { paths } from '~routes/paths'

/**
 * A sequencer's tracker proof, recomputed in the browser: the vote-id leaf
 * hashes up to a root, and that root is one the registry held.
 */
export function TrackerProof({
  pid,
  voteId,
  tracker,
  sequencers,
  transitions,
  genesisRoot,
}: {
  pid: string
  voteId: bigint
  tracker: UseQueryResult<TrackerCheck | null>
  sequencers: number
  transitions: TransitionRow[]
  genesisRoot: string | null
}) {
  const { t } = useLingui()
  const data = tracker.data
  const root = data?.proof.root.toLowerCase()
  const at = root ? transitions.find((tr) => tr.rootAfter === root) : undefined

  return (
    <Panel
      label={t`Recorded as cast`}
      title={t`Tracker proof`}
      description={t`A sequencer's proof that the vote id is a leaf of the state tree under a root the registry holds. The explorer recomputes the path here: the leaf is sha256(vote id as 8 little-endian bytes ‖ 32 zero bytes ‖ 0x01), each level hashes sha256(left ‖ right), and the vote id's bits say which side, the lowest bit at the root.`}
    >
      <div className='flex flex-col gap-3' data-testid='tracker-proof'>
        {sequencers === 0 ? (
          <Callout title={t`No sequencer is configured`}>
            <Trans>
              Tracker proofs come from a sequencer node's copy of the state tree, and this explorer has none to ask. The
              inclusion check does the same job from the blobs.
            </Trans>
          </Callout>
        ) : tracker.isLoading ? (
          <SkeletonText lines={3} />
        ) : tracker.error ? (
          <Callout tone='warn' title={t`No tracker proof`}>
            {tracker.error.message}
          </Callout>
        ) : data == null ? (
          <Callout title={t`No configured sequencer knows this vote`}>
            <Trans>
              A node serves a tracker proof once the vote id is in its tree, which happens when the batch carrying it
              settles.
            </Trans>
          </Callout>
        ) : (
          <>
            <ul className='flex flex-col gap-2 text-[13px] text-silver'>
              <li className='flex items-start gap-2'>
                <CheckMark state={data.valid ? 'pass' : 'fail'} className='mt-0.5' />
                <span>
                  {data.otherVote
                    ? t`The sequencer answered with a proof for another vote`
                    : data.valid
                      ? t`The path reaches the root the proof names`
                      : t`The path does not reach its root`}
                  <span className='block text-[12px] text-ash'>
                    <PathDetail data={data} pid={pid} />
                  </span>
                </span>
              </li>
              <li className='flex items-start gap-2'>
                <CheckMark state={data.rootOnChain ? 'pass' : 'fail'} className='mt-0.5' />
                <span>
                  {data.rootOnChain
                    ? t`That root is one the registry held for this process`
                    : t`That root is not one the registry held for this process`}
                  <span className='block text-[12px] text-ash'>
                    {at ? (
                      <RootAfter pid={pid} index={at.index} />
                    ) : root && root === genesisRoot ? (
                      t`the genesis root`
                    ) : data.rootOnChain ? (
                      t`the latest root`
                    ) : (
                      t`not the genesis root nor any transition root`
                    )}
                  </span>
                </span>
              </li>
            </ul>
            <div className='flex items-center gap-2 text-[12px] text-ash'>
              <Trans>
                Root <Hash value={data.proof.root} chars={10} />
              </Trans>
            </div>
            <Disclosure summary={t`The proof as served`}>
              <CodeBlock
                code={JSON.stringify(
                  {
                    processId: data.proof.processId,
                    voteId: formatVoteId(data.proof.voteId),
                    root: data.proof.root,
                    siblings: data.proof.siblings,
                  },
                  null,
                  2
                )}
                label={t`Copy the tracker proof`}
                maxHeight={280}
              />
            </Disclosure>
            <Disclosure summary={t`Fetch it yourself`}>
              <p className='mb-2 text-[12px] text-ash'>
                <Trans>
                  The node route is in the sequencer README; davinci_client::api::verify_tracker checks the answer
                  against the registry.
                </Trans>
              </p>
              <CodeBlock
                code={`curl ${data.sequencer.upstream.replace(/\/+$/, '')}/votes/${pid}/voteId/${formatVoteId(voteId)}/proof`}
                label={t`Copy the command`}
              />
            </Disclosure>
          </>
        )}
      </div>
    </Panel>
  )
}

function RootAfter({ pid, index }: { pid: string; index: number }) {
  return (
    <Trans>
      the root after{' '}
      <Link to={paths.transition(pid, index)} className='text-silver hover:text-emerald'>
        transition #{index}
      </Link>
    </Trans>
  )
}

/** Which vote the path is for and how long it is, and which node served it. */
function PathDetail({ data, pid }: { data: TrackerCheck; pid: string }) {
  const upstream = data.sequencer.upstream
  if (data.otherVote) {
    const vote = formatVoteId(data.proof.voteId)
    const otherProcess = data.proof.processId
    return otherProcess?.toLowerCase() !== pid.toLowerCase() ? (
      <Trans>
        it names vote {vote} of process {otherProcess}, not the one asked for, from {upstream}
      </Trans>
    ) : (
      <Trans>
        it names vote {vote}, not the one asked for, from {upstream}
      </Trans>
    )
  }
  const siblings = data.proof.siblings.length
  const levels = SMT_LEVELS
  return (
    <Trans>
      <Plural value={siblings} one='# sibling' other='# siblings' /> of at most {levels} levels, from {upstream}
    </Trans>
  )
}
