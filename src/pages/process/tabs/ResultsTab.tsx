import type { ReactNode } from 'react'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { CheckMark, Explain, Formula, NumberedList, Term, Timestamp, TxLink, UnverifiedMark } from '~components'
import { Disclosure } from '~components/code'
import type { ProcessView } from '~data/hooks'
import { useMetadataCheck } from '~data/queries'
import type { CheckState } from '~indexer/selectors'
import { Address, Badge, BlockCell, Callout, Hash, KeyValue, Panel, SkeletonText } from '~kit'
import { formatNumber, formatPercent } from '~lib/format'
import type { KeyModeName } from '~protocol/types'
import { describeBallotMode } from '../ballot-mode'
import { changedWhileOpen, metadataChoices } from '../metadata'
import { useDkgResultsChecks, useSequencerResultsChecks } from '../results-checks'
import { tallyRows } from '../tally'
import { paths } from '~routes/paths'

interface Check {
  label: string
  state: CheckState
  detail: ReactNode
}

function CheckList({ checks }: { checks: Check[] }) {
  return (
    <ul className='flex flex-col divide-y divide-charcoal/60'>
      {checks.map((c) => (
        <li key={c.label} className='flex gap-3 py-2.5'>
          <CheckMark state={c.state} className='mt-0.5' />
          <div className='min-w-0'>
            <div className='text-[13px] text-silver'>{c.label}</div>
            <div className='text-xs leading-relaxed text-ash'>{c.detail}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** What the registry enforced before storing a tally, from ProcessRegistry.sol, in its order. */
function ContractRules({ mode }: { mode: 'sequencer' | 'dkg' }) {
  const rules: Record<'sequencer' | 'dkg', ReactNode[]> = {
    sequencer: [
      <Trans key='1'>
        Only for an election with a sequencer key that is not canceled and has no results yet (
        <code>setProcessResults</code>).
      </Trans>,
      <Trans key='2'>The election must have ended: status Ended, or its end time passed.</Trans>,
      <Trans key='3'>
        The results program must report that every one of its checks passed: <Formula expr='ok = 1, fail_mask = 0' />.
      </Trans>,
      <Trans key='4'>
        The proof must start from the election’s latest state, so the results cover every recorded batch.
      </Trans>,
      <Trans key='5'>
        The proof must verify under the results program and the proving setup the registry fixes (
        <code>resultsProgramVK</code> and <code>rootCVadcopFinal</code>).
      </Trans>,
      <Trans key='6'>
        The registry then stores one total per field in use (the first <code>numFields</code> values of the proof) and
        sets the status to Results.
      </Trans>,
    ],
    dkg: [
      <Trans key='1'>
        Only for an election with a committee key that is not canceled, has no results and was not sent before, once
        voting has ended by status or by time (<code>requestResultsDecryption</code>).
      </Trans>,
      <Trans key='2'>
        The <Term id='accumulator'>encrypted total</Term> sent must be the one in the latest state, with every number in
        range, so nobody can get anything else decrypted.
      </Trans>,
      <Trans key='3'>
        It moves the election to Ended, out of the organizer’s hands. The decrypted totals become public on the
        committee’s side before they reach the registry, and an organizer could otherwise cancel an election after
        seeing its results.
      </Trans>,
      <Trans key='4'>
        It sends one encrypted value per field to the committee. An empty field is recorded as 0; only an election that
        never counted a ballot has one, since every vote and refresh adds to every field, even an option nobody picked.
      </Trans>,
      <Trans key='5'>
        The results are stored (<code>finalizeResultsFromDKG</code>) only when every value sent is fully decrypted on
        the committee’s side, where each member’s part of the decryption and the final combination carried a proof the
        committee’s contracts verified.
      </Trans>,
    ],
  }
  const { t } = useLingui()
  return (
    <>
      <NumberedList items={rules[mode]} />
      <Disclosure summary={t`Technical details`} variant='plain' className='mt-3' testId='results-rules-details'>
        <p className='text-[13px] leading-relaxed text-ash'>
          {mode === 'sequencer' ? (
            <Trans>
              The proof must be for the process’s <code>latestStateRoot</code>, and its public values carry{' '}
              <code>ok</code>, <code>fail_mask</code>, that root and the totals.
            </Trans>
          ) : (
            <Trans>
              The encrypted total must be leaf <code>0x04</code> under the latest state root, with every coordinate in
              range. It reaches the committee through the DKG adapter, and an empty field is the identity point. Each
              member’s partial decryption and the final combine carry a Groth16 proof that the davinci-dkg contracts
              verify.
            </Trans>
          )}
        </p>
      </Disclosure>
    </>
  )
}

function ResultsProgramText() {
  return (
    <Trans>
      The key holder proves that the results are the true decryption of the{' '}
      <Term id='accumulator'>encrypted total</Term>, without revealing the key. The proof starts from the final state of
      the election alone: it shows that the election key and the encrypted total are in that state, and that each total
      decrypts correctly.
    </Trans>
  )
}

/** The results proof's mechanism, under "Technical details". */
function ResultsProgramDetails() {
  const { t } = useLingui()
  return (
    <Disclosure summary={t`Technical details`} variant='plain' className='mt-3' testId='results-proof-details'>
      <p className='text-[13px] leading-relaxed text-ash'>
        <Trans>
          The results program starts from the final state root. It proves the encryption key (leaf <code>0x03</code>)
          and the accumulator (leaf <code>0x04</code>) under that root, and each field’s decryption with one{' '}
          <Term id='chaum-pedersen-proof'>Chaum–Pedersen proof</Term>. Its proof is wrapped as a PLONK and checked by
          the same verifier as the batches, under the results program the registry fixes (<code>resultsProgramVK</code>
          ).
        </Trans>
      </p>
    </Disclosure>
  )
}

export function ResultsTab({ view }: { view: ProcessView }) {
  const { t } = useLingui()
  const s = view.process.state
  if (!s) {
    return (
      <div data-testid='tab-results'>
        <SkeletonText lines={6} className='max-w-2xl' />
      </div>
    )
  }
  const results = view.process.results
  return (
    <div data-testid='tab-results' className='flex flex-col gap-6'>
      {results ? <TallyPanel view={view} /> : <NoResultsPanel view={view} />}
      <div className='grid items-start gap-6 lg:grid-cols-2'>
        {s.keyMode === 'sequencer' ? <SequencerProofPanel view={view} /> : <DkgDecryptionPanel view={view} />}
        <Panel
          title={t`What the contract checked`}
          label={t`Rules on the chain`}
          description={t`The registry stores results only if all of these hold, so results on the chain mean every one of them passed.`}
        >
          <ContractRules mode={s.keyMode === 'sequencer' ? 'sequencer' : 'dkg'} />
        </Panel>
      </div>
    </div>
  )
}

function TallyPanel({ view }: { view: ProcessView }) {
  const { t } = useLingui()
  const s = view.process.state!
  const results = view.process.results!
  const metadata = useMetadataCheck(s.metadataURI, s.metadataHash)
  // Option names only from the committed document; another document's names are shown beside, as unverified.
  const named = metadataChoices(metadata.doc, s.ballotMode.numFields)
  const labels = metadata.status === 'matches' ? named : null
  const unverified = metadata.status === 'differs' ? named : null
  const changed = view.process.metadataHistory.some(changedWhileOpen)
  const rows = tallyRows(results.values, labels)
  const voters = view.row.votersCount
  const sum = formatNumber(results.values.reduce((a, v) => a + v, 0n))
  const block = formatNumber(results.block)
  const mode = describeBallotMode(s.ballotMode)
  return (
    <Panel
      title={t`Final results`}
      label={t`Per option`}
      description={
        <>
          {mode.summary}{' '}
          <Trans>Each total adds up what voters gave that option, counting only each voter’s latest vote.</Trans>
        </>
      }
      actions={
        <span className='font-mono text-[12px] text-ash tnum'>
          <Trans>
            <Plural value={voters} one='# voter' other='# voters' /> · sum {sum}
          </Trans>
        </span>
      }
    >
      <ul className='flex flex-col gap-3' data-testid='tally'>
        {rows.map((r) => {
          const position = r.field + 1
          const name = unverified?.[r.field]
          return (
            <li key={r.field} className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1'>
              <span className='flex min-w-0 items-center gap-2 text-[13px] text-silver'>
                <span className='truncate'>{r.label}</span>
                {labels ? (
                  <span className='font-mono text-[11px] text-ash'>
                    <Trans>field {position}</Trans>
                  </span>
                ) : null}
                {unverified ? (
                  <span className='flex min-w-0 items-center gap-1 text-[12px] text-ash' data-testid='unverified-label'>
                    <span className='truncate italic'>
                      <Trans>“{name}”</Trans>
                    </span>
                    <UnverifiedMark compact />
                  </span>
                ) : null}
              </span>
              <span className='font-mono text-[13px] text-ghost tnum'>
                {formatNumber(r.value)}
                <span className='ml-2 inline-block w-16 text-right text-ash'>{formatPercent(r.share, 1)}</span>
              </span>
              <div className='col-span-2 h-2 overflow-hidden rounded-pill bg-onyx' aria-hidden='true'>
                <div className='h-full rounded-pill bg-emerald' style={{ width: `${r.ofMax * 100}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
      <p className='mt-4 text-xs text-ash'>
        <Trans>
          Published <Timestamp value={results.timestamp} /> in block {block}.
        </Trans>
        {labels ? (
          <>
            {' '}
            <Trans>
              The option names come from the organizer’s description document, which matches its fingerprint on the
              chain.
            </Trans>
          </>
        ) : unverified ? (
          <>
            {' '}
            <Trans>
              The names in quotes come from a document that does not match the fingerprint on the chain, so each total
              is shown by its field number instead.
            </Trans>
          </>
        ) : null}
      </p>
      {changed ? (
        <p className='mt-2 text-xs leading-relaxed text-amber' data-testid='tally-metadata-changed'>
          <Trans>
            The organizer changed the description while voting was open, so votes cast before the change were cast under
            the previous version and its option names. Every version is in the description’s history on the{' '}
            <Link to={paths.process(view.process.id)} className='underline underline-offset-2 hover:text-emerald'>
              Overview
            </Link>{' '}
            tab.
          </Trans>
        </p>
      ) : null}
    </Panel>
  )
}

const NEXT: Record<KeyModeName, MessageDescriptor> = {
  sequencer: msg`After voting ends, the key holder (normally the sequencer node that issued the key) decrypts the encrypted total, proves the results with the results program and publishes them (setProcessResults). Only the key holder can.`,
  'dkg-automatic': msg`After voting ends, anyone can send the encrypted total to the key committee (requestResultsDecryption); sequencers do it on their first heartbeat after the end. Enough members then decrypt it together, field by field, and anyone can store the results on the chain (finalizeResultsFromDKG).`,
  'dkg-locked': msg`After voting ends, anyone can send the encrypted total to the key committee (requestResultsDecryption); sequencers do it on their first heartbeat after the end. The committee can decrypt it only after the organizer reveals the organizer secret (revealProcessKey); then anyone can store the results on the chain (finalizeResultsFromDKG).`,
}

function NoResultsPanel({ view }: { view: ProcessView }) {
  const { i18n, t } = useLingui()
  const s = view.process.state!
  const phase = view.row.phase
  const request = view.process.decryptionRequest
  const endTime = view.row.endTime
  const paused = phase === 'paused'
  let title = t`No results yet`
  let body = i18n._(NEXT[s.keyMode])
  if (phase === 'canceled') {
    title = t`Canceled: no results`
    body = t`The organizer canceled this election. The registry refuses results for a canceled election, so none will appear.`
  } else if (request) {
    title = t`Decryption requested`
    body =
      s.keyMode === 'dkg-locked'
        ? t`The encrypted total went to the key committee. Its members can decrypt it once the organizer reveals the organizer secret; when every field is decrypted, anyone can store the results on the chain.`
        : t`The encrypted total went to the key committee. Once enough members have posted their partial decryptions and every field is combined, anyone can store the results on the chain.`
  } else if (phase === 'ended' || phase === 'closed') {
    title = t`Voting is over; results pending`
  }
  return (
    <div data-testid='no-results'>
      <Callout tone={phase === 'canceled' ? 'warn' : 'info'} title={title}>
        <p>{body}</p>
        {phase !== 'canceled' && !request && phase !== 'ended' && phase !== 'closed' ? (
          <p className='mt-1'>
            {endTime ? (
              paused ? (
                <Trans>
                  The election ends <Timestamp value={endTime} />, and it is paused now.
                </Trans>
              ) : (
                <Trans>
                  The election ends <Timestamp value={endTime} />.
                </Trans>
              )
            ) : paused ? (
              <Trans>The election has no end time yet, and it is paused now.</Trans>
            ) : (
              <Trans>The election has no end time yet.</Trans>
            )}
          </p>
        ) : null}
      </Callout>
    </div>
  )
}

function SequencerProofPanel({ view }: { view: ProcessView }) {
  const { t } = useLingui()
  const results = view.process.results
  const { checks, decodeError } = useSequencerResultsChecks(view)

  if (!results) {
    return (
      <Panel title={t`How the results are produced`} label={t`A proof of the results`}>
        <p className='text-[13px] leading-relaxed text-silver'>
          <ResultsProgramText />
        </p>
        <ResultsProgramDetails />
      </Panel>
    )
  }

  return (
    <Panel
      title={t`How the results were produced`}
      label={t`A proof of the results`}
      description={<ResultsProgramText />}
    >
      <KeyValue
        items={[
          { label: t`Transaction`, value: results.tx ? <TxLink hash={results.tx} /> : '—' },
          {
            label: (
              <span className='inline-flex items-center gap-1'>
                <Trans>Sender</Trans>
                <Explain>
                  <Trans>Anyone may submit a results proof; in practice the node holding the key does.</Trans>
                </Explain>
              </span>
            ),
            value: <Address value={results.sender} to={paths.sequencer(results.sender)} />,
          },
          { label: t`Block`, value: <BlockCell block={results.block} /> },
          { label: t`Time`, value: <Timestamp value={results.timestamp} /> },
        ]}
      />
      {decodeError ? (
        <Callout tone='warn' className='mt-3'>
          <Trans>The transaction’s data could not be decoded: {decodeError}</Trans>
        </Callout>
      ) : null}
      <div className='mt-3'>
        <CheckList checks={checks} />
      </div>
      <ResultsProgramDetails />
    </Panel>
  )
}

function DkgDecryptionPanel({ view }: { view: ProcessView }) {
  const { i18n, t } = useLingui()
  const s = view.process.state!
  const request = view.process.decryptionRequest
  const results = view.process.results
  const { checks } = useDkgResultsChecks(view)
  const requestBlock = request ? formatNumber(request.block) : null
  const requestCount = request ? formatNumber(request.count) : null
  const requestFirst = request ? formatNumber(request.firstIndex) : null

  return (
    <Panel
      title={results ? t`How the results were produced` : t`How the results will be produced`}
      label={t`Decrypted by the key committee`}
      description={t`The key committee decrypts only the final encrypted total, one value per field, and never rebuilds the whole key. There is no results program here: the committee’s own proofs and the registry’s check that the total is the one in the final state take its place.`}
    >
      {request ? (
        <KeyValue
          items={[
            {
              label: t`Decryption request`,
              value: (
                <span className='inline-flex flex-wrap items-center justify-end gap-2'>
                  {request.tx ? <TxLink hash={request.tx} chars={4} /> : null}
                  <Timestamp value={request.timestamp} className='text-ash' />
                </span>
              ),
              hint: t`block ${requestBlock}`,
            },
            {
              label: t`Encrypted values sent`,
              value: t`${requestCount} from committee index ${requestFirst}`,
              mono: true,
            },
            { label: t`Epoch`, value: <Hash value={request.epochId} chars={8} /> },
            { label: 'aid', value: <Hash value={request.aid} chars={8} /> },
            {
              label: t`Finalized`,
              value: results?.tx ? (
                <span className='inline-flex flex-wrap items-center justify-end gap-2'>
                  <TxLink hash={results.tx} chars={4} />
                  <Timestamp value={results.timestamp} className='text-ash' />
                </span>
              ) : (
                <Badge tone='warn'>
                  <Trans>not yet</Trans>
                </Badge>
              ),
            },
          ]}
        />
      ) : (
        <p className='text-[13px] leading-relaxed text-ash'>{i18n._(NEXT[s.keyMode])}</p>
      )}
      {checks.length > 0 ? (
        <div className='mt-3'>
          <CheckList checks={checks} />
        </div>
      ) : null}
      <p className='mt-3 text-xs text-ash'>
        <Trans>
          The per-field decryption state is on the{' '}
          <Link to={paths.process(view.process.id, 'key')} className='text-emerald hover:underline'>
            Election key
          </Link>{' '}
          tab.
        </Trans>
      </p>
    </Panel>
  )
}
