import type { ReactNode } from 'react'
import type { MessageDescriptor } from '@lingui/core'
import { msg, plural } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { CensusOriginBadge, CheckMark, Explain, Formula, InShort, Term, Timestamp, TxLink } from '~components'
import { Disclosure } from '~components/code'
import { useChain, type ProcessView } from '~data/hooks'
import { useMetadataCheck } from '~data/queries'
import { Address, Badge, BlockCell, Callout, Hash, KeyValue, Panel, ProgressBar, SkeletonText, UriLink } from '~kit'
import { formatDuration, formatNumber, formatTimestamp } from '~lib/format'
import { NUM_FIELDS } from '~protocol/limits'
import { browsableUri } from '~protocol/metadata'
import { parseProcessId } from '~protocol/process-id'
import { CENSUS_ORIGIN_INFO, KEY_MODE_INFO, type CensusOriginName } from '~protocol/types'
import { describeBallotMode } from '../ballot-mode'
import { metadataPreset } from '../metadata'
import { MetadataPanel } from '../MetadataPanel'

/** Result cap of `newProcess`: maxValue ≤ 10^12 / maxVoters. */
const MAX_POSSIBLE_RESULT = 1_000_000_000_000n

const CENSUS_ROOT_RULE: Record<CensusOriginName, MessageDescriptor> = {
  unknown: msg`Not a kind of list the registry accepts.`,
  'merkle-static': msg`The list was fixed when the election was created. Every batch of votes is checked against that same list.`,
  'merkle-dynamic': msg`The organizer can replace the list while the election is open or paused, until the end. Each batch of votes is checked against the list current at the time.`,
  'onchain-dynamic': msg`A contract keeps the list. A batch may use any version of it the contract has held since the election was created, and the registry asks the contract at every batch.`,
  csp: msg`Each vote carries a signature from the credential service. The service’s signing address stands for the list and never changes.`,
}

/** davinci-sdk's election presets, by the `type` it writes in the metadata. */
const PRESET_LABEL: Record<string, MessageDescriptor> = {
  single_choice: msg`Single choice`,
  multiple_choice: msg`Multiple choice`,
  approval: msg`Approval`,
  rating: msg`Rating`,
  ranking: msg`Ranking`,
  quadratic: msg`Quadratic voting`,
}

function Label({ children, help }: { children: ReactNode; help: ReactNode }) {
  return (
    <span className='inline-flex items-center gap-1'>
      {children}
      <Explain>{help}</Explain>
    </span>
  )
}

/** A URI as a compact link (what it opens, its host, the full URI on hover), never the whole string inline. */
function Uri({ uri, label }: { uri: string; label: string }) {
  if (!uri)
    return (
      <span className='text-ash'>
        <Trans>none</Trans>
      </span>
    )
  return <UriLink uri={uri} href={browsableUri(uri)} label={label} />
}

export function OverviewTab({ view }: { view: ProcessView }) {
  const s = view.process.state
  if (!s) {
    return (
      <div data-testid='tab-overview'>
        <SkeletonText lines={8} className='max-w-2xl' />
      </div>
    )
  }
  return (
    <div data-testid='tab-overview' className='grid items-start gap-6 lg:grid-cols-2'>
      <div className='min-w-0 lg:col-span-2'>
        <ProcessInShort view={view} />
      </div>
      <div className='flex min-w-0 flex-col gap-6'>
        <BallotPanel view={view} />
        <CensusPanel view={view} />
      </div>
      <div className='flex min-w-0 flex-col gap-6'>
        <DatesPanel view={view} />
        <LimitsPanel view={view} />
        <ProcessIdPanel view={view} />
      </div>
      <div className='min-w-0 lg:col-span-2'>
        <MetadataPanel view={view} />
      </div>
    </div>
  )
}

/** The process in a few plain sentences: where voting stands, who voted, what a ballot is, who holds the key. */
function ProcessInShort({ view }: { view: ProcessView }) {
  const { row } = view
  const s = view.process.state!
  const end = row.endTime
  const start = row.startTime
  const voters = row.votersCount
  const overwrites = row.overwrittenVotesCount
  const most = formatNumber(s.maxVoters)
  const phase =
    row.phase === 'upcoming' ? (
      <Trans>
        Voting opens <Timestamp value={start} relative={false} />.
      </Trans>
    ) : row.phase === 'open' ? (
      <Trans>
        Voting is open until <Timestamp value={end} relative={false} />.
      </Trans>
    ) : row.phase === 'paused' ? (
      <Trans>
        The organizer paused voting, which is due to end <Timestamp value={end} relative={false} />.
      </Trans>
    ) : row.phase === 'closed' || row.phase === 'ended' ? (
      <Trans>Voting has ended; the results are not published yet.</Trans>
    ) : row.phase === 'canceled' ? (
      <Trans>The organizer canceled this election, so there will be no results.</Trans>
    ) : row.phase === 'results' ? (
      <Trans>Voting has ended and the results are published.</Trans>
    ) : null
  return (
    <InShort>
      <p data-testid='process-in-short'>
        {phase}{' '}
        {overwrites > 0 ? (
          <Trans>
            <Plural value={voters} one='# voter' other='# voters' /> of at most {most} took part, with{' '}
            <Plural value={overwrites} one='# changed vote' other='# changed votes' />.
          </Trans>
        ) : (
          <Trans>
            <Plural value={voters} one='# voter' other='# voters' /> of at most {most} took part.
          </Trans>
        )}{' '}
        {describeBallotMode(s.ballotMode).summary} {KEY_MODE_INFO[s.keyMode].description}
      </p>
    </InShort>
  )
}

function BallotPanel({ view }: { view: ProcessView }) {
  const { i18n, t } = useLingui()
  const s = view.process.state!
  const bm = s.ballotMode
  const d = describeBallotMode(bm)
  const metadata = useMetadataCheck(s.metadataURI, s.metadataHash)
  // Only from the document the organizer committed to; another one's label says nothing.
  const preset = metadata.status === 'matches' ? metadataPreset(metadata.doc) : null
  const declared = preset ? (PRESET_LABEL[preset] ? i18n._(PRESET_LABEL[preset]) : preset) : null
  const pattern = d.label
  const capacity = NUM_FIELDS
  return (
    <Panel title={t`Ballot`} label={d.kind === 'unsatisfiable' ? pattern : t`Ballot rules`} description={d.summary}>
      <div className='mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-ash' data-testid='ballot-kind'>
        <span className='inline-flex flex-wrap items-center gap-1.5'>
          <Trans>
            Reads as: <Badge size='sm'>{pattern}</Badge>
          </Trans>
          <Explain>
            <Trans>
              The chain stores the rules, not a name for them, so the explorer names the pattern the rules follow.
            </Trans>
          </Explain>
        </span>
        {declared ? (
          <span className='inline-flex flex-wrap items-center gap-1.5' data-testid='ballot-kind-declared'>
            <Trans>
              Declared by the organizer:{' '}
              <Badge size='sm' tone='slate'>
                {declared}
              </Badge>
            </Trans>
            <Explain>
              <Trans>
                The kind of ballot the organizer’s app wrote in the election’s description, whose fingerprint matches
                the one recorded on the chain. It is only a label: the rules above are what every ballot proof enforces.
              </Trans>
            </Explain>
          </span>
        ) : null}
      </div>
      <ul className='flex flex-col gap-1.5 text-[13px] leading-relaxed text-silver' data-testid='ballot-rules'>
        {d.rules.map((r) => (
          <li key={r} className='flex gap-2'>
            <span aria-hidden='true' className='mt-2 h-1 w-1 shrink-0 rounded-full bg-emerald' />
            {r}
          </li>
        ))}
      </ul>
      <p className='mt-3 text-xs leading-relaxed text-ash'>
        <Trans>
          A ballot that breaks these rules cannot be counted. Each voting app proves that the encrypted ballot follows
          them (a <Term id='ballot-proof'>ballot proof</Term>), and every batch checks those proofs against the rules
          stored with the election.
        </Trans>
      </p>
      <KeyValue
        className='mt-4'
        columns={2}
        items={[
          {
            label: (
              <Label
                help={t`How many numbers a ballot holds, usually one per option (1 to ${capacity}). The unused places are padding and are skipped.`}
              >
                <Trans>Fields</Trans>
              </Label>
            ),
            value: bm.numFields,
            mono: true,
          },
          {
            label: (
              <Label help={t`No two fields may carry the same value.`}>
                <Trans>Unique values</Trans>
              </Label>
            ),
            value: bm.uniqueValues ? t`yes` : t`no`,
            mono: true,
          },
          {
            label: (
              <Label help={t`Lowest value a field may take.`}>
                <Trans>Min value</Trans>
              </Label>
            ),
            value: formatNumber(bm.minValue),
            mono: true,
          },
          {
            label: (
              <Label help={t`Highest value a field may take.`}>
                <Trans>Max value</Trans>
              </Label>
            ),
            value: formatNumber(bm.maxValue),
            mono: true,
          },
          {
            label: (
              <Label
                help={t`What a vote costs: each value is raised to this power before the values are added up. With 2, putting 3 votes on one option costs 9.`}
              >
                <Trans>Cost exponent</Trans>
              </Label>
            ),
            value: bm.costExponent,
            mono: true,
          },
          {
            label: (
              <Label
                help={t`Fields per question, for a ballot with several questions: 0 when unused, or the field count for a single question.`}
              >
                <Trans>Group size</Trans>
              </Label>
            ),
            value: bm.groupSize,
            mono: true,
          },
          {
            label: (
              <Label help={t`The least a voter must give in total, adding up the costs. 0 means no minimum.`}>
                <Trans>Min sum</Trans>
              </Label>
            ),
            value: formatNumber(bm.minValueSum),
            mono: true,
          },
          {
            label: (
              <Label
                help={t`The most a voter may give in total, adding up the costs. 0 means up to the voter’s weight on the list of voters.`}
              >
                <Trans>Max sum</Trans>
              </Label>
            ),
            value: bm.maxValueSum === 0n ? t`0 (weight)` : formatNumber(bm.maxValueSum),
            mono: true,
          },
        ]}
      />
      <Disclosure summary={t`Technical details`} variant='plain' className='mt-4' testId='ballot-mode-details'>
        <p className='text-[13px] leading-relaxed text-ash'>
          <Trans>
            These rules are the process’s ballot mode, packed into its starting state as leaf <code>0x02</code> when it
            was created, so they cannot change. The batch program checks every ballot proof against that leaf.
          </Trans>
        </p>
      </Disclosure>
    </Panel>
  )
}

function CensusPanel({ view }: { view: ProcessView }) {
  const { i18n, t } = useLingui()
  const { process: p } = view
  const c = p.state!.census
  const updates = p.censusUpdates
  const isCsp = c.origin === 'csp'
  const cspAddress = isCsp ? `0x${c.root.slice(-40)}` : null
  return (
    <Panel
      title={t`List of voters`}
      label={t`Who may vote`}
      description={CENSUS_ORIGIN_INFO[c.origin].description}
      actions={<CensusOriginBadge origin={c.origin} />}
    >
      <Callout tone='info'>{i18n._(CENSUS_ROOT_RULE[c.origin])}</Callout>
      <KeyValue
        className='mt-3'
        items={[
          {
            label: (
              <Label
                help={
                  isCsp
                    ? t`The credential service whose signature lets a voter vote. Its address stands in for the list’s fingerprint.`
                    : c.origin === 'onchain-dynamic'
                      ? t`The fingerprint of the contract’s list when the election was created, kept for information. Batches are checked against the contract instead.`
                      : t`The fingerprint of the list of voters and their weights. Each voter proves they are on the list against it.`
                }
              >
                {isCsp
                  ? t`Credential service`
                  : c.origin === 'onchain-dynamic'
                    ? t`Fingerprint at creation`
                    : t`Fingerprint of the list`}
              </Label>
            ),
            value: cspAddress ? <Address value={cspAddress} /> : <Hash value={c.root} chars={10} />,
          },
          ...(c.origin === 'onchain-dynamic'
            ? [
                {
                  label: (
                    <Label
                      help={t`The contract that keeps the list. At every batch the registry asks it whether it held the list the batch used.`}
                    >
                      <Trans>Contract that keeps the list</Trans>
                    </Label>
                  ),
                  value: <Address value={c.contractAddress} />,
                },
              ]
            : []),
          {
            label: (
              <Label
                help={
                  isCsp
                    ? t`Where voters get their signatures.`
                    : t`Where the full list can be downloaded. Sequencers fetch it and check its fingerprint before they accept votes.`
                }
              >
                <Trans>Where to get it</Trans>
              </Label>
            ),
            value: <Uri uri={c.uri} label={isCsp ? t`Open the signer’s service` : t`Open the list`} />,
          },
        ]}
      />
      {c.origin === 'merkle-dynamic' ? (
        <div className='mt-4'>
          <div className='label-caps mb-2 text-[11px] text-pewter'>
            <Trans>Changes to the list</Trans>
          </div>
          {updates.length === 0 ? (
            <p className='text-[13px] text-ash'>
              <Trans>The organizer has not replaced the list.</Trans>
            </p>
          ) : (
            <ul className='flex flex-col divide-y divide-charcoal/60 text-[13px]'>
              {updates.map((u, i) => (
                <li key={`${u.block}:${i}`} className='flex flex-wrap items-center gap-x-3 gap-y-1 py-2'>
                  <Timestamp value={u.timestamp} className='text-ash' />
                  <Hash value={u.value.root} chars={8} />
                  <span className='min-w-0 flex-1'>
                    <Uri uri={u.value.uri} label={t`Open the list`} />
                  </span>
                  {u.tx ? <TxLink hash={u.tx} chars={4} /> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      <Disclosure summary={t`Technical details`} variant='plain' className='mt-4' testId='census-details'>
        <p className='text-[13px] leading-relaxed text-ash'>
          {isCsp ? (
            <Trans>
              A credential service provider (CSP) census: the registry stores the signer’s address as the census root, a
              big-endian integer, and every vote carries the service’s signature.
            </Trans>
          ) : c.origin === 'onchain-dynamic' ? (
            <Trans>
              An on-chain census: the contract implements <code>ICensusValidator</code>, and at every batch the registry
              calls its <code>getRootBlockNumber</code> with the root the batch used. It answers the last block that
              root was valid (the current block for the current root, the block it was replaced in for an older one, 0
              for one it never held), and the registry requires that block to be no earlier than the creation block and
              no later than the batch. Voters prove membership with lean-IMT (Poseidon) proofs, as in any Merkle census.
              The root shown is the one given at creation, as a big-endian integer.
            </Trans>
          ) : (
            <Trans>
              The census root is the root of a lean-IMT Merkle tree (Poseidon) over the voters and their weights, as a
              big-endian integer. Each voting app proves membership against it, and the batch program checks every
              proof. An updatable list is replaced with <code>setProcessCensus</code>, which emits{' '}
              <code>CensusUpdated</code>.
            </Trans>
          )}
        </p>
      </Disclosure>
    </Panel>
  )
}

function DatesPanel({ view }: { view: ProcessView }) {
  const { t } = useLingui()
  const { process: p, row } = view
  const s = p.state!
  // Ending voting early sets the duration in the same transaction.
  const endTxs = new Set(p.statusChanges.filter((c) => c.to === 'ended' && c.tx).map((c) => c.tx))
  const pauses = p.statusChanges.filter((c) => c.to === 'paused' || (c.from === 'paused' && c.to === 'ready'))
  return (
    <Panel title={t`Dates`} label={t`Voting window`}>
      <KeyValue
        items={[
          {
            label: t`Created`,
            value: (
              <span className='inline-flex flex-wrap items-center justify-end gap-2'>
                <Timestamp value={row.createdAt} />
                <BlockCell block={p.createdBlock} />
                {p.createdTx ? <TxLink hash={p.createdTx} chars={4} /> : null}
              </span>
            ),
          },
          { label: t`Start`, value: <Timestamp value={s.startTime} />, hint: formatTimestamp(s.startTime) },
          {
            label: (
              <Label help={t`The start time plus the duration. Votes are recorded only between the start and the end.`}>
                <Trans>End</Trans>
              </Label>
            ),
            // A canceled election never reaches it: the date it was due, not a countdown.
            value: <Timestamp value={row.endTime} relative={row.phase !== 'canceled'} />,
            hint:
              row.phase === 'canceled'
                ? t`as planned; the organizer canceled the election`
                : formatTimestamp(row.endTime),
          },
          { label: t`Duration`, value: formatDuration(s.duration), mono: true },
        ]}
      />
      <div className='mt-4'>
        <div className='label-caps mb-2 inline-flex items-center gap-1 text-[11px] text-pewter'>
          <Trans>Duration changes</Trans>
          <Explain>
            <Trans>
              Before the end, the organizer can only make voting last longer. Ending it early (status Ended) sets the
              duration to the time since the start.
            </Trans>
          </Explain>
        </div>
        {p.durationChanges.length === 0 ? (
          <p className='text-[13px] text-ash'>
            <Trans>The duration has not changed since creation.</Trans>
          </p>
        ) : (
          <ul className='flex flex-col divide-y divide-charcoal/60 text-[13px]' data-testid='duration-changes'>
            {p.durationChanges.map((c, i) => {
              const duration = formatDuration(c.value)
              const ends = formatTimestamp(s.startTime + c.value)
              return (
                <li key={`${c.block}:${i}`} className='flex flex-wrap items-center gap-x-3 gap-y-1 py-2'>
                  <Timestamp value={c.timestamp} className='text-ash' />
                  <span className='flex-1 text-silver'>
                    {c.tx && endTxs.has(c.tx) ? (
                      <Trans>
                        ended early by the organizer: duration {duration}, ended {ends}
                      </Trans>
                    ) : (
                      <Trans>
                        duration {duration}, ends {ends}
                      </Trans>
                    )}
                  </span>
                  {c.tx ? <TxLink hash={c.tx} chars={4} /> : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div className='mt-4'>
        <div className='label-caps mb-2 inline-flex items-center gap-1 text-[11px] text-pewter'>
          <Trans>Pauses</Trans>
          <Explain>
            <Trans>
              The organizer can pause voting and resume it until the end. While it is paused the registry records no
              batch, and the end time does not move.
            </Trans>
          </Explain>
        </div>
        {pauses.length === 0 ? (
          <p className='text-[13px] text-ash'>
            <Trans>Voting has not been paused.</Trans>
          </p>
        ) : (
          <ul className='flex flex-col divide-y divide-charcoal/60 text-[13px]' data-testid='pauses'>
            {pauses.map((c, i) => {
              const since = pauses[i - 1]?.timestamp
              const length = c.timestamp != null && since != null ? formatDuration(c.timestamp - since) : null
              return (
                <li key={`${c.block}:${i}`} className='flex flex-wrap items-center gap-x-3 gap-y-1 py-2'>
                  <Timestamp value={c.timestamp} className='text-ash' />
                  <span className='flex-1 text-silver'>
                    {c.to === 'paused' ? (
                      <Trans>paused by the organizer</Trans>
                    ) : length ? (
                      <Trans>resumed by the organizer, after a pause of {length}</Trans>
                    ) : (
                      <Trans>resumed by the organizer</Trans>
                    )}
                  </span>
                  {c.tx ? <TxLink hash={c.tx} chars={4} /> : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Panel>
  )
}

function LimitsPanel({ view }: { view: ProcessView }) {
  const { t } = useLingui()
  const { process: p, row } = view
  const s = p.state!
  const worst = BigInt(s.maxVoters) * s.ballotMode.maxValue
  const changes = p.maxVotersChanges.length
  const last = changes > 0 ? formatNumber(p.maxVotersChanges[changes - 1]!.value) : null
  const used = formatNumber(s.ballotMode.numFields)
  const capacity = formatNumber(NUM_FIELDS)
  const cap = formatNumber(MAX_POSSIBLE_RESULT)
  return (
    <Panel title={t`Limits`} label={t`Capacity`}>
      <ProgressBar
        value={row.votersCount}
        total={Math.max(s.maxVoters, 1)}
        label={t`Voters so far, of the maximum`}
        tone={row.votersCount >= s.maxVoters ? 'warn' : 'accent'}
      />
      <KeyValue
        className='mt-3'
        items={[
          {
            label: (
              <Label
                help={t`The most voters this election accepts: the registry refuses a batch that would go above it. The organizer can change it while the election is open or paused, but never below the voters so far.`}
              >
                <Trans>Max voters</Trans>
              </Label>
            ),
            value: formatNumber(s.maxVoters),
            mono: true,
            hint:
              last != null
                ? t`${plural(changes, { one: 'changed # time', other: 'changed # times' })}, last to ${last}`
                : t`unchanged since creation`,
          },
          {
            label: (
              <Label
                help={t`Every ballot has room for ${capacity} encrypted numbers. The election uses the first ones (numFields); the rest are fixed padding.`}
              >
                <Trans>Fields in use</Trans>
              </Label>
            ),
            value: t`${used} of ${capacity}`,
            mono: true,
          },
          {
            label: (
              <Label
                help={
                  <Trans>
                    The highest total one option could reach if every voter gave it the maximum. The registry keeps it
                    at or below one trillion, so the results can always be decrypted:{' '}
                    <Formula expr='maxValue × maxVoters ≤ 10^12' />.
                  </Trans>
                }
              >
                <Trans>Largest possible result per field</Trans>
              </Label>
            ),
            value: formatNumber(worst),
            mono: true,
            hint: t`limit ${cap}`,
          },
        ]}
      />
    </Panel>
  )
}

function ProcessIdPanel({ view }: { view: ProcessView }) {
  const { t } = useLingui()
  const chain = useChain()
  const parsed = parseProcessId(view.process.id)
  const expected = chain.registry?.pidPrefix
  const prefixHex = `0x${parsed.prefix.toString(16).padStart(8, '0')}`
  return (
    <Panel
      title={t`Process id`}
      label={t`Decoded`}
      description={t`The id has three parts: the organizer’s address, a code for this registry and chain, and a count of the organizer’s earlier elections (31 bytes in all).`}
    >
      <KeyValue
        items={[
          { label: t`Organizer`, value: <Address value={parsed.organizer} />, hint: t`bytes 0–19` },
          {
            label: (
              <Label
                help={
                  <Trans>
                    Ties the id to this registry and chain: the registry refuses ids with another prefix, so an id
                    cannot be reused anywhere else. It is the last 4 bytes of a fingerprint of the registry’s chain id
                    and address: <Formula expr='pidPrefix = uint32(keccak256(abi.encodePacked(chainID, registry)))' />.
                  </Trans>
                }
              >
                <Trans>Registry prefix</Trans>
              </Label>
            ),
            value: (
              <span className='inline-flex items-center gap-2'>
                <span className='font-mono'>{prefixHex}</span>
                {expected != null ? <CheckMark state={expected === parsed.prefix ? 'pass' : 'fail'} /> : null}
              </span>
            ),
            hint:
              expected == null
                ? t`bytes 20–23`
                : expected === parsed.prefix
                  ? t`bytes 20–23, matches this registry`
                  : t`bytes 20–23, does not match this registry`,
          },
          {
            label: (
              <Label help={t`How many elections the organizer had created on this registry before this one.`}>
                <Trans>Nonce</Trans>
              </Label>
            ),
            value: formatNumber(parsed.nonce),
            mono: true,
            hint: t`bytes 24–30`,
          },
        ]}
      />
    </Panel>
  )
}
