import type { ReactNode } from 'react'
import type { MessageDescriptor } from '@lingui/core'
import { msg, plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { CensusOriginBadge, CheckMark, Explain, Timestamp, TxLink } from '~components'
import { useChain, type ProcessView } from '~data/hooks'
import { useJsonDocument } from '~data/queries'
import { Address, Badge, BlockCell, Callout, Hash, KeyValue, Panel, ProgressBar, SkeletonText, UriLink } from '~kit'
import { formatDuration, formatNumber, formatTimestamp } from '~lib/format'
import { NUM_FIELDS } from '~protocol/limits'
import { parseProcessId } from '~protocol/process-id'
import { CENSUS_ORIGIN_INFO, type CensusOriginName } from '~protocol/types'
import { describeBallotMode } from '../ballot-mode'
import { toJson } from '../json'
import { browsableUri, fetchableUri, metadataChoices, metadataDescription, metadataTitle } from '../metadata'

/** Result cap of `newProcess`: maxValue ≤ 10^12 / maxVoters. */
const MAX_POSSIBLE_RESULT = 1_000_000_000_000n

const CENSUS_ROOT_RULE: Record<CensusOriginName, MessageDescriptor> = {
  unknown: msg`Not an origin the registry accepts.`,
  'merkle-static': msg`Every batch must be proven against the root fixed at creation.`,
  'merkle-dynamic': msg`The organizer may replace the root while the process is Ready or Paused and before its end; each batch must use the current root.`,
  'onchain-dynamic': msg`Each batch may use any root the census contract recorded at or after the creation block; the registry asks the contract at every settlement.`,
  csp: msg`Every vote carries a signature from the CSP signer; the root is that signer’s address and never changes.`,
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
        <MetadataPanel uri={s.metadataURI} numFields={s.ballotMode.numFields} />
      </div>
    </div>
  )
}

function BallotPanel({ view }: { view: ProcessView }) {
  const { t } = useLingui()
  const bm = view.process.state!.ballotMode
  const d = describeBallotMode(bm)
  const pattern = d.label
  const capacity = NUM_FIELDS
  return (
    <Panel
      title={t`Ballot`}
      label={d.kind === 'unsatisfiable' ? pattern : t`Reads as: ${pattern}`}
      description={d.summary}
    >
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
          Each voter&apos;s ballot proof enforces these rules on the encrypted ballot, and the batch program checks
          every ballot proof against the ballot mode pinned in state leaf 0x02, so a ballot built for other rules is
          rejected.
        </Trans>
      </p>
      <KeyValue
        className='mt-4'
        columns={2}
        items={[
          {
            label: (
              <Label help={t`Numbers per ballot, 1 to ${capacity}. Unused capacity is padded and skipped.`}>
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
              <Label help={t`Each value is raised to this power before summing: 2 makes votes cost their square.`}>
                <Trans>Cost exponent</Trans>
              </Label>
            ),
            value: bm.costExponent,
            mono: true,
          },
          {
            label: (
              <Label help={t`Groups of fields for multi-question ballots; 0 when unused.`}>
                <Trans>Group size</Trans>
              </Label>
            ),
            value: bm.groupSize,
            mono: true,
          },
          {
            label: (
              <Label help={t`Lower bound of the cost sum; 0 means none.`}>
                <Trans>Min sum</Trans>
              </Label>
            ),
            value: formatNumber(bm.minValueSum),
            mono: true,
          },
          {
            label: (
              <Label help={t`Upper bound of the cost sum; 0 means the voter's census weight.`}>
                <Trans>Max sum</Trans>
              </Label>
            ),
            value: bm.maxValueSum === 0n ? t`0 (weight)` : formatNumber(bm.maxValueSum),
            mono: true,
          },
        ]}
      />
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
      title={t`Census`}
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
                    ? t`The address of the credential service provider whose signatures admit voters, stored as a big-endian integer.`
                    : c.origin === 'onchain-dynamic'
                      ? t`The census contract’s root when the process was created, kept for information: batches are checked against the contract instead.`
                      : t`Root of the lean-IMT Merkle tree of eligible voters and their weights, a big-endian integer. Voters prove membership against it.`
                }
              >
                {isCsp ? t`CSP signer` : c.origin === 'onchain-dynamic' ? t`Root at creation` : t`Census root`}
              </Label>
            ),
            value: cspAddress ? <Address value={cspAddress} /> : <Hash value={c.root} chars={10} />,
          },
          ...(c.origin === 'onchain-dynamic'
            ? [
                {
                  label: (
                    <Label
                      help={t`The ICensusValidator contract the registry asks, at every settlement, whether it held the batch’s census root.`}
                    >
                      <Trans>Census contract</Trans>
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
                    : t`Where sequencers download the census; they check its root before serving votes.`
                }
              >
                <Trans>Census URI</Trans>
              </Label>
            ),
            value: <Uri uri={c.uri} label={isCsp ? t`Open the signer’s service` : t`Open the census file`} />,
          },
        ]}
      />
      {c.origin === 'merkle-dynamic' ? (
        <div className='mt-4'>
          <div className='label-caps mb-2 text-[11px] text-pewter'>
            <Trans>Census updates</Trans>
          </div>
          {updates.length === 0 ? (
            <p className='text-[13px] text-ash'>
              <Trans>The organizer has not replaced the census root.</Trans>
            </p>
          ) : (
            <ul className='flex flex-col divide-y divide-charcoal/60 text-[13px]'>
              {updates.map((u, i) => (
                <li key={`${u.block}:${i}`} className='flex flex-wrap items-center gap-x-3 gap-y-1 py-2'>
                  <Timestamp value={u.timestamp} className='text-ash' />
                  <Hash value={u.value.root} chars={8} />
                  <span className='min-w-0 flex-1'>
                    <Uri uri={u.value.uri} label={t`Open the census file`} />
                  </span>
                  {u.tx ? <TxLink hash={u.tx} chars={4} /> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </Panel>
  )
}

function DatesPanel({ view }: { view: ProcessView }) {
  const { t } = useLingui()
  const { process: p, row } = view
  const s = p.state!
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
              <Label help={t`Start time plus duration. Batches settle only inside this window.`}>
                <Trans>End</Trans>
              </Label>
            ),
            value: <Timestamp value={row.endTime} />,
            hint: formatTimestamp(row.endTime),
          },
          { label: t`Duration`, value: formatDuration(s.duration), mono: true },
        ]}
      />
      <div className='mt-4'>
        <div className='label-caps mb-2 inline-flex items-center gap-1 text-[11px] text-pewter'>
          <Trans>Duration changes</Trans>
          <Explain>
            <Trans>
              While a process is Ready or Paused and before its end, the organizer may only extend it. Ending it early
              (status Ended) sets the duration to the time elapsed since the start.
            </Trans>
          </Explain>
        </div>
        {p.durationChanges.length === 0 ? (
          <p className='text-[13px] text-ash'>
            <Trans>The duration has not changed since creation.</Trans>
          </p>
        ) : (
          <ul className='flex flex-col divide-y divide-charcoal/60 text-[13px]'>
            {p.durationChanges.map((c, i) => {
              const duration = formatDuration(c.value)
              const ends = formatTimestamp(s.startTime + c.value)
              return (
                <li key={`${c.block}:${i}`} className='flex flex-wrap items-center gap-x-3 gap-y-1 py-2'>
                  <Timestamp value={c.timestamp} className='text-ash' />
                  <span className='flex-1 text-silver'>
                    <Trans>
                      duration {duration}, ends {ends}
                    </Trans>
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
        label={t`Voters against the maximum`}
        tone={row.votersCount >= s.maxVoters ? 'warn' : 'accent'}
      />
      <KeyValue
        className='mt-3'
        items={[
          {
            label: (
              <Label
                help={t`The registry refuses a batch that would take the voter count above this. The organizer may change it while the process is Ready or Paused, but never below the current voter count.`}
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
                help={t`Every ballot carries ${capacity} encrypted fields; the process uses the first numFields and the rest are fixed padding.`}
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
                help={t`The registry requires maxValue × maxVoters to stay within 10^12, so any tally stays inside the bounded search that decrypts it.`}
              >
                <Trans>Largest possible tally per field</Trans>
              </Label>
            ),
            value: formatNumber(worst),
            mono: true,
            hint: t`cap ${cap}`,
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
      description={t`31 bytes: the organizer’s address, a 4-byte prefix of this registry and chain, and the organizer’s nonce.`}
    >
      <KeyValue
        items={[
          { label: t`Organizer`, value: <Address value={parsed.organizer} />, hint: t`bytes 0–19` },
          {
            label: (
              <Label
                help={t`The last 4 bytes of keccak256(chainId ‖ registry address). The registry refuses ids with another prefix, so an id cannot be replayed on another chain or registry.`}
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
              <Label help={t`How many processes the organizer had created on this registry before this one.`}>
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

function MetadataPanel({ uri, numFields }: { uri: string; numFields: number }) {
  const { t } = useLingui()
  const doc = useJsonDocument(fetchableUri(uri))
  const title = metadataTitle(doc.data)
  const description = metadataDescription(doc.data)
  const choices = metadataChoices(doc.data, numFields)
  // The failure as it came (an HTTP status, a parse error), inside a translated sentence.
  const detail = doc.error instanceof Error ? doc.error.message : String(doc.error)
  return (
    <Panel
      title={t`Metadata`}
      label={t`Published by the organizer`}
      description={t`The registry stores only this URI. The document (title, questions, options) is not verified on-chain; read it as the organizer’s description.`}
    >
      <KeyValue items={[{ label: t`Metadata URI`, value: <Uri uri={uri} label={t`Open the document`} /> }]} />
      <div className='mt-3' data-testid='process-metadata'>
        {!uri ? (
          <p className='text-[13px] text-ash'>
            <Trans>This process has no metadata document.</Trans>
          </p>
        ) : !fetchableUri(uri) ? (
          <p className='text-[13px] text-ash'>
            <Trans>
              A browser cannot fetch this URI (only http, https and ipfs are read), so the explorer does not show it.
            </Trans>
          </p>
        ) : doc.isLoading ? (
          <SkeletonText lines={3} />
        ) : doc.error ? (
          <Callout tone='warn' title={t`Could not read the metadata`}>
            <Trans>{detail}. It may be offline, block cross-origin requests, or not be JSON.</Trans>
          </Callout>
        ) : doc.data !== undefined ? (
          <div className='flex flex-col gap-3'>
            {title ? <div className='text-[15px] font-semibold text-ghost'>{title}</div> : null}
            {description ? <p className='text-[13px] leading-relaxed text-ash'>{description}</p> : null}
            {choices ? (
              <div className='flex flex-wrap gap-2'>
                {choices.map((choice, i) => {
                  const position = i + 1
                  return (
                    <Badge key={i}>
                      <Trans>
                        field {position}: {choice}
                      </Trans>
                    </Badge>
                  )
                })}
              </div>
            ) : null}
            <details className='rounded-sm border border-charcoal'>
              <summary className='cursor-pointer px-3 py-2 text-[13px] text-pewter hover:text-ghost'>
                <Trans>The document as JSON</Trans>
              </summary>
              <pre className='max-h-80 overflow-auto border-t border-charcoal p-3 text-[11px] leading-relaxed text-silver scroll-slim'>
                {toJson(doc.data)}
              </pre>
            </details>
          </div>
        ) : null}
      </div>
    </Panel>
  )
}
