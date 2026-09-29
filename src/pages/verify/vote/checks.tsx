// The cards of the vote check. Each gets its outcome from `model.ts` and says
// what it means in one sentence; "How this is checked" holds the mechanism,
// the values compared and the command.

import { plural } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import type { UseQueryResult } from '@tanstack/react-query'
import { Link } from 'react-router'
import { CheckMark, ProcessPhaseBadge, Term, TxLink, UnverifiedMark } from '~components'
import { CodeBlock, Disclosure } from '~components/code'
import { Formula } from '~components/Formula'
import type { ProcessView } from '~data/hooks'
import type {
  DecodedTransitionBlobs,
  MetadataCheck,
  TrackerCheck,
  VoteInclusion,
  VoteStatusBySequencer,
} from '~data/queries'
import type { TransitionRow } from '~indexer/selectors'
import { BlockCell, Hash, ProgressBar } from '~kit'
import { formatTimestamp } from '~lib/format'
import { formatVoteId } from '~protocol/blob'
import { SMT_LEVELS } from '~protocol/limits'
import { paths } from '~routes/paths'
import { GET_PROCESS, metadataHashCommand } from '~pages/transition/commands'
import { changedWhileOpen } from '~pages/process/metadata'
import type { ResultsCheck } from '~pages/process/results-checks'
import { CheckCard, Compared, HowPart, RedoCommand, StatusDisc } from '../checklist'
import type { BatchCheck } from '../batch'
import type { VerifyStatus } from '../status'
import type { ResultReason, Settled, TrackerReason } from './model'
import { SequencerStatus } from './SequencerStatus'

const LINK = 'text-emerald hover:underline'

/** The election's description against its on-chain hash, in one line with its mark. */
function MetadataLine({ view, metadata }: { view: ProcessView; metadata: MetadataCheck }) {
  const changed = view.process.metadataHistory.some(changedWhileOpen)
  const status: VerifyStatus =
    metadata.status === 'matches'
      ? changed
        ? 'attention'
        : 'pass'
      : metadata.status === 'differs'
        ? 'fail'
        : 'pending'
  return (
    <p
      className='flex items-start gap-2 text-[13px] leading-relaxed text-pewter'
      data-testid='election-metadata'
      data-status={metadata.status}
    >
      <StatusDisc status={status} size='sm' />
      <span className='pt-px'>
        {metadata.status === 'matches' ? (
          changed ? (
            <Trans>
              Its description is the one the organizer recorded on the chain, but the organizer changed it while voting
              was open: if you voted before the change, you voted under the previous version.
            </Trans>
          ) : (
            <Trans>Its description (title, question and options) is the one the organizer recorded on the chain.</Trans>
          )
        ) : metadata.status === 'differs' ? (
          <Trans>
            Its description does not match the one the organizer recorded on the chain, so its title and option names
            may not be what you were shown.
          </Trans>
        ) : metadata.status === 'unreachable' ? (
          <Trans>
            Its description could not be downloaded, so it was not compared with the one recorded on the chain.
          </Trans>
        ) : metadata.status === 'not-browsable' ? (
          <Trans>Its description is at an address a browser cannot fetch, so it was not checked here.</Trans>
        ) : (
          <Trans>Checking its description against the one recorded on the chain…</Trans>
        )}
      </span>
    </p>
  )
}

export function ElectionCard({
  pid,
  view,
  status,
  title,
  metadata,
  registry,
}: {
  pid: string
  view: ProcessView | null
  status: VerifyStatus
  title: string | null
  metadata: MetadataCheck
  registry: string
}) {
  const { t } = useLingui()
  const created = view?.row.createdAt != null ? formatTimestamp(view.row.createdAt) : null
  const short = `${pid.slice(0, 10)}…${pid.slice(-4)}`
  const uri = view?.process.state?.metadataURI
  return (
    <CheckCard
      id='election'
      status={status}
      title={t`The election exists`}
      statusLabel={status === 'fail' ? t`Not found` : undefined}
      summary={
        view ? (
          <span className='inline-flex flex-wrap items-center gap-x-2 gap-y-1'>
            <span>
              {title ? (
                created ? (
                  <Trans>
                    “{title}” is on the registry, created on {created}.
                  </Trans>
                ) : (
                  <Trans>“{title}” is on the registry.</Trans>
                )
              ) : created ? (
                <Trans>
                  Election {short} is on the registry, created on {created}.
                </Trans>
              ) : (
                <Trans>Election {short} is on the registry.</Trans>
              )}
            </span>
            {title && metadata.status === 'differs' ? <UnverifiedMark /> : null}
            <ProcessPhaseBadge phase={view.row.phase} />
          </span>
        ) : status === 'pending' ? (
          <Trans>Looking for the election on the registry…</Trans>
        ) : (
          <Trans>
            This registry has no election {short}. Check the id, or whether this explorer reads the network you voted
            on.
          </Trans>
        )
      }
      how={
        <>
          <p>
            <Trans>
              Every election lives on the registry contract (<code>ProcessRegistry</code>), which keeps its rules, its
              list of voters, its key and its current state. The explorer reads it with <code>getProcess</code>.
            </Trans>
          </p>
          <HowPart title={t`Values read`}>
            <Compared
              rows={[
                { label: t`Process id`, value: <span className='font-mono break-all'>{pid}</span> },
                ...(view
                  ? [
                      {
                        label: t`Organizer`,
                        value: <span className='font-mono break-all'>{view.process.organizer}</span>,
                      },
                      {
                        label: t`Created in block`,
                        value: <BlockCell block={view.process.createdBlock} />,
                      },
                    ]
                  : []),
              ]}
            />
          </HowPart>
          {uri ? (
            <RedoCommand
              note={
                <Trans>
                  The second command prints the registry’s record of the election. The first takes the fingerprint
                  (SHA-256) of what the description’s address serves, which must equal the record’s fourteenth value (
                  <code>sha256sum</code> leaves out the 0x).
                </Trans>
              }
              code={metadataHashCommand({ registry, processId: pid, uri })}
            />
          ) : (
            <RedoCommand code={`cast call ${registry} \\\n  "${GET_PROCESS}" \\\n  ${pid} --rpc-url $RPC`} />
          )}
        </>
      }
    >
      {view ? <MetadataLine view={view} metadata={metadata} /> : null}
    </CheckCard>
  )
}

/** Where the blob that lists the vote came from, and what ties it to the transaction. */
function blobOrigin(data: DecodedTransitionBlobs | undefined): 'commitment' | 'beacon-filter' | 'sequencer' | null {
  if (!data) return null
  if (data.source === 'sequencer' || data.blobs.some((b) => b.binding === 'sequencer')) return 'sequencer'
  if (data.blobs.some((b) => b.binding === 'beacon-filter')) return 'beacon-filter'
  return 'commitment'
}

export function SettledCard({
  pid,
  settled,
  inclusion,
  found,
  batches,
  statuses,
  blobs,
}: {
  pid: string
  settled: Settled
  inclusion: VoteInclusion
  found: TransitionRow | undefined
  batches: number
  statuses: VoteStatusBySequencer[]
  blobs: DecodedTransitionBlobs | undefined
}) {
  const { t } = useLingui()
  const origin = blobOrigin(blobs)
  const url = blobs?.sourceUrl
  const unread = inclusion.errors.length
  const searched = inclusion.total
  const index = found?.index
  const when = found?.timestamp != null ? formatTimestamp(found.timestamp) : null
  const batchLink = found ? (
    <Link to={paths.transition(pid, found.index)} className={`font-mono ${LINK}`}>
      #{index}
    </Link>
  ) : null

  let summary
  switch (settled.reason) {
    case 'found':
      summary =
        found && when ? (
          <Trans>
            Your vote is in{' '}
            <Link to={paths.transition(pid, found.index)} className={LINK}>
              batch #{index}
            </Link>
            , recorded on {when}.
          </Trans>
        ) : found ? (
          <Trans>
            Your vote is in{' '}
            <Link to={paths.transition(pid, found.index)} className={LINK}>
              batch #{index}
            </Link>
            .
          </Trans>
        ) : null
      break
    case 'no-election':
      summary = <Trans>There is no election to look in.</Trans>
      break
    case 'no-batches':
      summary = (
        <Trans>
          No batch of votes has been recorded for this election yet. Your vote shows up here once its batch is.
        </Trans>
      )
      break
    case 'reading':
      summary = <Trans>Looking through the election’s recorded batches for your vote id, newest first…</Trans>
      break
    case 'waiting':
      summary = (
        <Trans>
          A sequencer has your vote and is working on the batch that carries it. It shows up here once that batch is
          recorded on the chain.
        </Trans>
      )
      break
    case 'refused':
      summary = (
        <Trans>
          A sequencer refused this vote, so it will not be recorded. The reason is below; you can vote again while the
          election is open.
        </Trans>
      )
      break
    case 'unreadable':
      summary = (
        <Trans>
          The data of this election’s batches is no longer available, so the explorer cannot look for your vote id in
          it. The sequencer’s receipt below does not need that data.
        </Trans>
      )
      break
    case 'not-found':
      summary = (
        <Trans>
          Your vote id is not in any of the{' '}
          <Plural value={searched} one='# recorded batch' other='# recorded batches' /> of this election. It may still
          be waiting at a sequencer, it may belong to another election, or the id may have a typo.
        </Trans>
      )
      break
  }

  return (
    <CheckCard
      id='settled'
      status={settled.status}
      title={t`Your vote was recorded on the chain`}
      statusLabel={
        settled.reason === 'not-found'
          ? t`Not found`
          : settled.reason === 'unreadable'
            ? t`Unavailable`
            : settled.reason === 'waiting' || settled.reason === 'no-batches'
              ? t`Not yet`
              : undefined
      }
      summary={summary}
      how={
        <>
          <p>
            <Trans>
              Every batch a sequencer records publishes the vote ids it added, in data attached to its transaction
              (EIP-4844 <Term id='blob'>blobs</Term>). The explorer downloads this election’s batches, newest first, and
              looks for your vote id. Being listed means the batch put your vote id into the election’s state, and the
              proof the registry checked covers that.
            </Trans>
          </p>
          {found ? (
            <HowPart title={t`Where it was found`}>
              <Compared
                rows={[
                  { label: t`Batch`, value: batchLink },
                  { label: t`Block`, value: <BlockCell block={found.block} /> },
                  { label: t`Transaction`, value: found.tx ? <TxLink hash={found.tx} chars={8} /> : '—' },
                  { label: t`State after (state root)`, value: <Hash value={found.rootAfter} chars={10} /> },
                  {
                    label: t`Batch size`,
                    value: (
                      <Trans>
                        <Plural value={found.votes} one='# ballot' other='# ballots' /> ·{' '}
                        <Plural value={found.nBlobs} one='# blob' other='# blobs' />
                      </Trans>
                    ),
                  },
                  ...(origin && url
                    ? [
                        {
                          label: t`Data from`,
                          value: (
                            <span
                              data-testid='vote-inclusion-source'
                              className={origin === 'sequencer' ? 'text-amber' : undefined}
                            >
                              {origin === 'sequencer'
                                ? t`${url}, a sequencer’s archive. It is matched to the batch by position only, not checked against the transaction’s blob hashes.`
                                : origin === 'beacon-filter'
                                  ? t`The beacon API ${url}, which selected it by the transaction’s versioned hash.`
                                  : t`The beacon API ${url}. Its KZG commitment hashes to the transaction’s versioned hash.`}
                            </span>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            </HowPart>
          ) : null}
          {statuses.length > 0 ? (
            <HowPart title={t`What the sequencers say`}>
              <p>
                <Trans>
                  Before a vote is recorded, only a sequencer knows where it stands: queued, in a batch being proved, or
                  recorded.
                </Trans>
              </p>
              <SequencerStatus statuses={statuses} />
            </HowPart>
          ) : null}
          {unread > 0 ? (
            <Disclosure summary={t`${plural(unread, { one: '# batch not read', other: '# batches not read' })}`}>
              <ul className='flex flex-col gap-1 font-mono text-[11px] break-all text-ash'>
                {inclusion.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </Disclosure>
          ) : null}
          {found?.tx ? (
            <RedoCommand
              note={
                <Trans>
                  The transaction lists one fingerprint (versioned hash) per blob; a beacon node serves the blob with
                  that hash for about two weeks after the block.
                </Trans>
              }
              code={`cast tx ${found.tx} blobVersionedHashes --rpc-url $RPC`}
            />
          ) : null}
        </>
      }
    >
      {settled.reason === 'reading' && inclusion.total > 0 ? (
        <ProgressBar
          value={inclusion.checked}
          total={inclusion.total}
          label={t`Batches read, newest first`}
          tone='neutral'
          size='sm'
        />
      ) : null}
      {(settled.reason === 'waiting' || settled.reason === 'refused') && statuses.length > 0 ? (
        <SequencerStatus statuses={statuses.filter((s) => s.status.data != null)} />
      ) : null}
      {settled.reason === 'found' && origin === 'sequencer' ? (
        <p className='text-[13px] text-amber'>
          <Trans>
            The list came from a sequencer’s archive rather than from the chain’s own blob store, so it is matched to
            the batch by position only.
          </Trans>
        </p>
      ) : null}
      {settled.reason === 'not-found' && batches > 0 && unread > 0 ? (
        <p className='text-[13px] text-ash'>
          <Plural
            value={unread}
            one='The data of # batch could not be read, so the vote may be in that one.'
            other='The data of # batches could not be read, so the vote may be in one of those.'
          />
        </p>
      ) : null}
    </CheckCard>
  )
}

export function BatchCard({
  pid,
  status,
  checks,
  found,
}: {
  pid: string
  status: VerifyStatus
  checks: BatchCheck[] | null
  found: TransitionRow | undefined
}) {
  const { t } = useLingui()
  const index = found?.index
  const passed = checks?.filter((c) => c.state === 'pass').length ?? 0
  const total = checks?.length ?? 0
  return (
    <CheckCard
      id='batch'
      status={status}
      title={t`That batch passed every check`}
      summary={
        !found ? (
          status === 'pending' ? (
            <Trans>This check runs once your vote is found in a recorded batch.</Trans>
          ) : (
            <Trans>There is no batch to check.</Trans>
          )
        ) : status === 'pass' ? (
          <Trans>
            <Link to={paths.transition(pid, found.index)} className={LINK}>
              Batch #{index}
            </Link>{' '}
            passed all {total} checks the registry makes before it accepts a batch of votes, the proof itself included.
          </Trans>
        ) : status === 'fail' ? (
          <Trans>
            <Link to={paths.transition(pid, found.index)} className={LINK}>
              Batch #{index}
            </Link>{' '}
            failed a check. The registry would have refused it, so compare the values on the batch page.
          </Trans>
        ) : (
          <Trans>
            {passed} of {total} checks of{' '}
            <Link to={paths.transition(pid, found.index)} className={LINK}>
              batch #{index}
            </Link>{' '}
            passed so far; the rest are still being read.
          </Trans>
        )
      }
      how={
        found ? (
          <>
            <p>
              <Trans>
                Before accepting a batch, the registry checks that every ballot in it passed the checks inside the
                proof, that it starts from the election’s current state, that its voters were on the list, that its
                counts add up and that its published data is the data the proof covers; then it checks the proof itself.
                A single failure would have undone the whole transaction. The explorer redoes each check from public
                data.
              </Trans>
            </p>
            {checks ? (
              <ul className='grid gap-x-6 gap-y-1.5 sm:grid-cols-2' data-testid='batch-checks'>
                {checks.map((c) => (
                  <li key={c.id} className='flex items-start gap-2 text-[12px] text-silver'>
                    <CheckMark state={c.state} className='mt-0.5' />
                    <span>{c.label}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p>
              <Trans>
                The{' '}
                <Link to={paths.transition(pid, found.index)} className={LINK}>
                  batch page
                </Link>{' '}
                explains each check and gives the command that redoes it.
              </Trans>
            </p>
            {found.tx ? (
              <RedoCommand
                note={<Trans>A recorded batch’s transaction went through: the receipt says status 1.</Trans>}
                code={`cast receipt ${found.tx} --rpc-url $RPC`}
              />
            ) : null}
          </>
        ) : undefined
      }
    />
  )
}

export function ResultCard({
  pid,
  view,
  status,
  reason,
  found,
  chain,
  resultChecks,
}: {
  pid: string
  view: ProcessView | null
  status: VerifyStatus
  reason: ResultReason
  found: TransitionRow | undefined
  chain: VerifyStatus
  resultChecks: ResultsCheck[]
}) {
  const { t } = useLingui()
  const results = view?.process.results
  const when = results?.timestamp != null ? formatTimestamp(results.timestamp) : null
  const end = view?.row.endTime != null ? formatTimestamp(view.row.endTime) : null
  const later = view ? view.transitions.length - 1 - (found?.index ?? 0) : 0
  const to = paths.process(pid, 'results')
  return (
    <CheckCard
      id='result'
      status={status}
      title={t`The result includes it`}
      statusLabel={reason === 'not-yet' ? t`Not yet` : undefined}
      summary={
        reason === 'blocked' ? (
          status === 'pending' ? (
            <Trans>This check runs once your vote is found in a recorded batch.</Trans>
          ) : (
            <Trans>There is no recorded vote to follow into the result.</Trans>
          )
        ) : reason === 'canceled' ? (
          <Trans>The election was canceled, so no result will be published.</Trans>
        ) : reason === 'not-yet' ? (
          end ? (
            <Trans>The result is not published yet. It comes after the vote ends, on {end}.</Trans>
          ) : (
            <Trans>The result is not published yet. It comes after the vote ends.</Trans>
          )
        ) : status === 'pass' ? (
          when ? (
            <Trans>
              <Link to={to} className={LINK}>
                The result
              </Link>
              , published on {when}, counts every recorded batch, yours included.
            </Trans>
          ) : (
            <Trans>
              <Link to={to} className={LINK}>
                The result
              </Link>{' '}
              counts every recorded batch, yours included.
            </Trans>
          )
        ) : status === 'fail' ? (
          <Trans>
            The chain from your batch to the{' '}
            <Link to={to} className={LINK}>
              result
            </Link>{' '}
            does not hold. The details below say where.
          </Trans>
        ) : (
          <Trans>
            Checking that the{' '}
            <Link to={to} className={LINK}>
              result
            </Link>{' '}
            follows from your batch…
          </Trans>
        )
      }
      how={
        reason === 'counted' ? (
          <>
            <p>
              <Trans>
                Each batch adds its ballots to an encrypted running total kept in the election’s state. Every later
                batch must start from the state the previous one left, so the state after your batch leads, batch by
                batch, to the final state. The result is proven to be the decryption of the total in that final state.
              </Trans>
            </p>
            <ul className='flex flex-col gap-1.5'>
              <li className='flex items-start gap-2 text-[12px] text-silver'>
                <CheckMark
                  state={chain === 'pass' ? 'pass' : chain === 'fail' ? 'fail' : 'unknown'}
                  className='mt-0.5'
                />
                <span>
                  <Plural
                    value={later}
                    _0='Your batch is the last one: the final state is the one it ended at'
                    one='From your batch to the final state, the # batch after it starts where yours ended'
                    other='From your batch to the final state, each of the # batches after it starts where the last one ended'
                  />
                </span>
              </li>
              {resultChecks.map((c) => (
                <li key={c.id} className='flex items-start gap-2 text-[12px] text-silver'>
                  <CheckMark state={c.state} className='mt-0.5' />
                  <span>
                    {c.label}
                    <span className='block text-ash'>{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p>
              <Trans>
                The{' '}
                <Link to={paths.process(pid, 'results')} className={LINK}>
                  results tab
                </Link>{' '}
                and the{' '}
                <Link to={paths.verifyElection(pid)} className={LINK}>
                  election check
                </Link>{' '}
                go through how the result was produced.
              </Trans>
            </p>
          </>
        ) : undefined
      }
    />
  )
}

export function TrackerCard({
  pid,
  voteId,
  status,
  reason,
  tracker,
  transitions,
  genesisRoot,
}: {
  pid: string
  voteId: bigint
  status: VerifyStatus
  reason: TrackerReason
  tracker: UseQueryResult<TrackerCheck | null>
  transitions: TransitionRow[]
  genesisRoot: string | null
}) {
  const { t } = useLingui()
  const data = tracker.data
  const root = data?.proof.root.toLowerCase()
  const at = root ? transitions.find((tr) => tr.rootAfter === root) : undefined
  const atIndex = at?.index
  const upstream = data?.sequencer.upstream
  const siblings = data?.proof.siblings.length ?? 0
  const levels = SMT_LEVELS
  const error = tracker.error?.message
  return (
    <CheckCard
      id='tracker'
      status={status}
      title={t`A sequencer’s receipt for your vote checks out`}
      statusLabel={
        reason === 'no-sequencer'
          ? t`Not available`
          : reason === 'unavailable'
            ? t`Unavailable`
            : reason === 'unknown-vote'
              ? t`Not yet`
              : undefined
      }
      summary={
        reason === 'no-sequencer' ? (
          <Trans>
            Not available: no sequencer is configured in this explorer. The check above, on the chain, does the same job
            from the batches’ data.
          </Trans>
        ) : reason === 'loading' ? (
          <Trans>Asking the sequencers for a receipt of your vote…</Trans>
        ) : reason === 'unavailable' ? (
          <Trans>The sequencers could not be asked: {error}</Trans>
        ) : reason === 'unknown-vote' ? (
          <Trans>
            No configured sequencer has this vote in its copy of the state yet. They do once its batch is recorded.
          </Trans>
        ) : data?.otherVote ? (
          <Trans>The sequencer answered with a receipt for another vote, so it proves nothing about yours.</Trans>
        ) : status === 'pass' ? (
          at ? (
            <Trans>
              Your browser checked the sequencer’s receipt: your vote id is in the state the election had after{' '}
              <Link to={paths.transition(pid, at.index)} className={LINK}>
                batch #{atIndex}
              </Link>
              , a state the registry recorded.
            </Trans>
          ) : (
            <Trans>
              Your browser checked the sequencer’s receipt: your vote id is in a state the registry recorded.
            </Trans>
          )
        ) : data && !data.valid ? (
          <Trans>The sequencer’s receipt does not add up: its path does not reach the state it names.</Trans>
        ) : (
          <Trans>The sequencer’s receipt leads to a state the registry never recorded for this election.</Trans>
        )
      }
      how={
        reason === 'no-sequencer' ? undefined : (
          <>
            <p>
              <Trans>
                The receipt (a <Term id='tracker-proof'>tracker proof</Term>) is a path from your vote id up to the
                fingerprint of the election’s whole state (the root of its state tree). Your browser hashes the path up
                and checks that it ends at a fingerprint the registry has recorded. The leaf and each level are:
              </Trans>
            </p>
            <div className='flex flex-col gap-1.5'>
              <Formula block expr='leaf = sha256(le64(voteId) ‖ 0x00…00 ‖ 0x01)' />
              <Formula block expr='node = sha256(left ‖ right)' />
            </div>
            <p>
              <Trans>
                The 32 zero bytes are the leaf’s value, and the bits of the vote id say which side each level takes, the
                lowest bit at the root. A recorded vote has such a path because the batch that carried it added its vote
                id to the tree.
              </Trans>
            </p>
            {data ? (
              <>
                <ul className='flex flex-col gap-1.5'>
                  <li className='flex items-start gap-2 text-[12px] text-silver'>
                    <CheckMark state={data.valid ? 'pass' : 'fail'} className='mt-0.5' />
                    <span>
                      {data.otherVote
                        ? t`The sequencer answered with a proof for another vote`
                        : data.valid
                          ? t`The path reaches the root the proof names`
                          : t`The path does not reach its root`}
                    </span>
                  </li>
                  <li className='flex items-start gap-2 text-[12px] text-silver'>
                    <CheckMark state={data.rootOnChain ? 'pass' : 'fail'} className='mt-0.5' />
                    <span>
                      {data.rootOnChain
                        ? t`That root is one the registry held for this process`
                        : t`That root is not one the registry held for this process`}
                    </span>
                  </li>
                </ul>
                <HowPart title={t`Values compared`}>
                  <Compared
                    rows={[
                      { label: t`Root`, value: <Hash value={data.proof.root} chars={10} /> },
                      {
                        label: t`Which state`,
                        value: at ? (
                          <Link to={paths.transition(pid, at.index)} className={LINK}>
                            <Trans>the root after batch #{atIndex}</Trans>
                          </Link>
                        ) : root && root === genesisRoot ? (
                          t`the genesis root`
                        ) : data.rootOnChain ? (
                          t`the latest root`
                        ) : (
                          t`not the genesis root nor any transition root`
                        ),
                      },
                      {
                        label: t`Path`,
                        value: (
                          <Trans>
                            <Plural value={siblings} one='# sibling' other='# siblings' /> of at most {levels} levels
                          </Trans>
                        ),
                      },
                      { label: t`Served by`, value: <span className='font-mono break-all'>{upstream}</span> },
                    ]}
                  />
                </HowPart>
                <Disclosure summary={t`The receipt as served`}>
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
                <RedoCommand
                  note={
                    <Trans>
                      The route is in the sequencer’s README; <code>davinci_client::api::verify_tracker</code> checks
                      the answer against the registry.
                    </Trans>
                  }
                  code={`curl ${data.sequencer.upstream.replace(/\/+$/, '')}/votes/${pid}/voteId/${formatVoteId(voteId)}/proof`}
                />
              </>
            ) : null}
          </>
        )
      }
    />
  )
}
