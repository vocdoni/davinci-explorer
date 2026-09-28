import { useEffect, useMemo, type ReactNode } from 'react'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { CheckMark, Explain, Timestamp, TxLink } from '~components'
import { useDataSource } from '~data/context'
import { useStore, type ProcessView } from '~data/hooks'
import { useDkgApplication, useJsonDocument } from '~data/queries'
import type { CheckState } from '~indexer/selectors'
import { txKey } from '~indexer/types'
import { Address, Badge, BlockCell, Callout, Hash, KeyValue, Panel, SkeletonText } from '~kit'
import { formatNumber, formatPercent } from '~lib/format'
import { decodeResultsPublicValues, resultsFailBits, type ResultsPublics } from '~protocol/publics'
import type { KeyModeName } from '~protocol/types'
import { describeBallotMode } from '../ballot-mode'
import { fetchableUri, metadataChoices } from '../metadata'
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

/** What the registry enforced before storing a tally, from ProcessRegistry.sol. */
const CONTRACT_RULES: Record<'sequencer' | 'dkg', MessageDescriptor[]> = {
  sequencer: [
    msg`setProcessResults accepts only a sequencer-key process that is not canceled and has no results yet.`,
    msg`The process must have ended: status Ended, or its end time passed.`,
    msg`The public values must report that every check of the results program passed (ok = 1, fail mask 0).`,
    msg`The state root the proof was made for must be the process’s latest state root, so the tally covers every settled batch.`,
    msg`The PLONK must verify against the registry’s results program vk and ZisK setup root.`,
    msg`It then stores the first numFields tallies from the public values and sets the status to Results.`,
  ],
  dkg: [
    msg`requestResultsDecryption accepts only a DKG-key process that is not canceled, has no results and was not requested before, once it has ended by status or by time.`,
    msg`It checks the submitted accumulator (the encrypted sum of all ballots) is leaf 0x04 of the latest state root, with every coordinate in range, so nobody can send another ciphertext for decryption.`,
    msg`It moves the process to Ended, out of the organizer’s hands: the plaintexts become public on the DKG before they reach the registry, and a Ready process could otherwise be canceled after its organizer saw the tally.`,
    msg`It submits one ciphertext per field to the committee through the DKG adapter. A field that is the identity is recorded as 0; only a process that never tallied a ballot has one, since every ballot and refresh adds a ciphertext to every field, even an option nobody picked.`,
    msg`finalizeResultsFromDKG stores the result only when every submitted ciphertext has a completed combine on the DKG, whose partial decryptions and combine each carried a Groth16 proof the DKG contracts verified.`,
  ],
}

const RESULTS_PROGRAM = msg`The results program proves, from the final state root alone, that the encryption key is leaf 0x03 and the accumulator leaf 0x04 of that tree, and that each tally is the decryption of the accumulator under that key (one Chaum–Pedersen proof per field). The key holder never reveals the key.`

export function ResultsTab({ view }: { view: ProcessView }) {
  const { i18n, t } = useLingui()
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
          label={t`On-chain rules`}
          description={t`The rules the registry enforces before it stores a tally. A result on-chain means all of them held.`}
        >
          <ol className='flex list-decimal flex-col gap-2 pl-5 text-[13px] leading-relaxed text-silver marker:text-ash'>
            {CONTRACT_RULES[s.keyMode === 'sequencer' ? 'sequencer' : 'dkg'].map((r, i) => (
              <li key={i}>{i18n._(r)}</li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  )
}

function TallyPanel({ view }: { view: ProcessView }) {
  const { t } = useLingui()
  const s = view.process.state!
  const results = view.process.results!
  const metadata = useJsonDocument(fetchableUri(s.metadataURI))
  const labels = metadataChoices(metadata.data, s.ballotMode.numFields)
  const rows = tallyRows(results.values, labels)
  const voters = view.row.votersCount
  const sum = formatNumber(results.values.reduce((a, v) => a + v, 0n))
  const block = formatNumber(results.block)
  const mode = describeBallotMode(s.ballotMode)
  return (
    <Panel
      title={t`Tally`}
      label={t`Final result`}
      description={
        <>
          {mode.summary}{' '}
          <Trans>Each total is the sum of the values voters gave that field, over every voter’s latest ballot.</Trans>
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
          return (
            <li key={r.field} className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1'>
              <span className='truncate text-[13px] text-silver'>
                {r.label}
                {labels ? (
                  <span className='ml-2 font-mono text-[11px] text-ash'>
                    <Trans>field {position}</Trans>
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
            <Trans>Option names come from the organizer’s metadata, which the chain does not check.</Trans>
          </>
        ) : null}
      </p>
    </Panel>
  )
}

const NEXT: Record<KeyModeName, MessageDescriptor> = {
  sequencer: msg`After the end, the holder of the election key (normally the sequencer node that issued it) decrypts the accumulator, proves the tally with the zkVM results program and calls setProcessResults. Only the key holder can.`,
  'dkg-automatic': msg`After the end, anyone can send the accumulator to the committee with requestResultsDecryption; sequencers do it on their first heartbeat after the end. A threshold of members then post partial decryptions and a combine per field, and anyone can call finalizeResultsFromDKG to store the tally.`,
  'dkg-locked': msg`After the end, anyone can send the accumulator to the committee with requestResultsDecryption; sequencers do it on their first heartbeat after the end. The committee can decrypt only after the organizer reveals its secret (revealProcessKey); then anyone can call finalizeResultsFromDKG.`,
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
    body = t`The organizer canceled this process. The registry refuses results for a canceled process, so none will appear.`
  } else if (request) {
    title = t`Decryption requested`
    body =
      s.keyMode === 'dkg-locked'
        ? t`The accumulator went to the committee. Its members post partial decryptions once the organizer reveals its secret; after every field is combined, anyone can finalize the result.`
        : t`The accumulator went to the committee. Once a threshold of members have posted partial decryptions and each field is combined, anyone can finalize the result.`
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
                  The process ends <Timestamp value={endTime} />, and it is paused now.
                </Trans>
              ) : (
                <Trans>
                  The process ends <Timestamp value={endTime} />.
                </Trans>
              )
            ) : paused ? (
              <Trans>The process has no end time yet, and it is paused now.</Trans>
            ) : (
              <Trans>The process has no end time yet.</Trans>
            )}
          </p>
        ) : null}
      </Callout>
    </div>
  )
}

function SequencerProofPanel({ view }: { view: ProcessView }) {
  const { i18n, t } = useLingui()
  const store = useStore()
  const source = useDataSource()
  const s = view.process.state!
  const results = view.process.results
  const tx = results?.tx ? store.txDetails[txKey(results.tx)] : undefined
  useEffect(() => {
    if (results?.tx && !tx) source.ensureTxDetails([results.tx])
  }, [source, results?.tx, tx])

  const decoded = useMemo((): { publics: ResultsPublics | null; error: string | null } => {
    if (!tx?.publicValues) return { publics: null, error: tx?.decodeError ?? null }
    try {
      return { publics: decodeResultsPublicValues(tx.publicValues), error: null }
    } catch (err) {
      return { publics: null, error: err instanceof Error ? err.message : String(err) }
    }
  }, [tx])

  if (!results) {
    return (
      <Panel title={t`How the result is produced`} label={t`zkVM results proof`}>
        <p className='text-[13px] leading-relaxed text-silver'>{i18n._(RESULTS_PROGRAM)}</p>
        <p className='mt-2 text-[13px] leading-relaxed text-ash'>
          <Trans>
            The proof is wrapped as a PLONK and checked by the same verifier as the batches, under the registry’s
            results program vk.
          </Trans>
        </p>
      </Panel>
    )
  }

  const pub = decoded.publics
  const lastRoot = view.transitions[view.transitions.length - 1]?.rootAfter ?? view.process.genesisRoot
  const nf = s.ballotMode.numFields
  const ok = pub?.ok ? 1 : 0
  const failMask = pub?.failMask ?? 0
  const failBits = pub ? resultsFailBits(pub.failMask).join(', ') : ''
  const lastRegister = 9 + 2 * nf
  const checks: Check[] = [
    {
      label: t`The results program passed every check`,
      state: pub ? (pub.ok && pub.failMask === 0 ? 'pass' : 'fail') : 'unknown',
      detail: pub
        ? failMask
          ? t`ok = ${ok}, fail mask = ${failMask} (${failBits})`
          : t`ok = ${ok}, fail mask = ${failMask}`
        : t`Waiting for the transaction’s calldata`,
    },
    {
      label: t`Proven against the final state root`,
      state:
        pub && lastRoot
          ? pub.stateRoot === lastRoot && pub.stateRoot === s.latestStateRoot
            ? 'pass'
            : 'fail'
          : 'unknown',
      detail: pub ? (
        <span className='inline-flex flex-wrap items-center gap-1'>
          <Trans>
            public values register 2..9 <Hash value={pub.stateRoot} chars={6} /> against the last transition’s root
          </Trans>
        </span>
      ) : (
        t`public values register 2..9 against the last transition’s root`
      ),
    },
    {
      label: t`The stored tally is the proven one`,
      state: pub
        ? results.values.length === nf && results.values.every((v, i) => pub.results[i] === v)
          ? 'pass'
          : 'fail'
        : 'unknown',
      detail: t`registers 10..${lastRegister}, one 64-bit value per field, against the ProcessResultsSet event`,
    },
    {
      label: t`The PLONK verified on-chain`,
      state: 'pass',
      detail: t`The registry emits ProcessResultsSet only after the verifier accepted the proof under the results program vk.`,
    },
  ]
  const decodeError = decoded.error

  return (
    <Panel title={t`How the result was produced`} label={t`zkVM results proof`} description={i18n._(RESULTS_PROGRAM)}>
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
            value: <Address value={results.sender} />,
          },
          { label: t`Block`, value: <BlockCell block={results.block} /> },
          { label: t`Time`, value: <Timestamp value={results.timestamp} /> },
        ]}
      />
      {decodeError ? (
        <Callout tone='warn' className='mt-3'>
          <Trans>The calldata could not be decoded: {decodeError}</Trans>
        </Callout>
      ) : null}
      <div className='mt-3'>
        <CheckList checks={checks} />
      </div>
    </Panel>
  )
}

function DkgDecryptionPanel({ view }: { view: ProcessView }) {
  const { i18n, t } = useLingui()
  const s = view.process.state!
  const dkg = useDkgApplication(view.process.id)
  const request = view.process.decryptionRequest
  const results = view.process.results
  const app = dkg.data
  const locked = s.keyMode === 'dkg-locked'
  const completed = app?.ciphertexts.filter((c) => c.completed).length ?? 0
  const submitted = s.dkg?.count ?? 0
  const combined = formatNumber(completed)
  const total = formatNumber(submitted)
  const requestBlock = request ? formatNumber(request.block) : null
  const requestCount = request ? formatNumber(request.count) : null
  const requestFirst = request ? formatNumber(request.firstIndex) : null

  const checks: Check[] = request
    ? [
        {
          label: t`The accumulator is the one in the final state root`,
          state: 'pass',
          detail: t`ResultsDecryptionRequested is emitted only after the registry verified the accumulator’s inclusion as leaf 0x04.`,
        },
        ...(locked
          ? [
              {
                label: t`The organizer revealed its secret`,
                state: (app ? (app.revealed ? 'pass' : 'unknown') : 'unknown') as CheckState,
                detail: app?.revealed
                  ? t`The DKG checked sk·G = PK_org when it accepted the reveal.`
                  : t`Until the reveal the DKG refuses every partial decryption and combine.`,
              },
            ]
          : []),
        {
          label: t`Every submitted ciphertext is combined`,
          state: (app ? (completed === submitted ? 'pass' : 'unknown') : 'unknown') as CheckState,
          detail: app
            ? t`${combined} of ${total} combined on the DKG`
            : dkg.isLoading
              ? t`Reading the DKG contracts…`
              : t`The DKG state could not be read`,
        },
        ...(results && app && app.ciphertexts.length > 0
          ? [
              {
                label: t`The stored tally is the committee’s plaintexts`,
                state: (app.ciphertexts.every((c) => c.completed && results.values[c.field] === c.plaintext)
                  ? 'pass'
                  : 'fail') as CheckState,
                detail: t`Each combined plaintext against its field in ProcessResultsSet.`,
              },
            ]
          : []),
      ]
    : []

  return (
    <Panel
      title={results ? t`How the result was produced` : t`How the result will be produced`}
      label={t`DKG threshold decryption`}
      description={t`The committee decrypts only the final accumulator, one ciphertext per field, and never reconstructs the election secret. There is no results PLONK in the DKG modes: the committee’s Groth16 proofs and the registry’s inclusion check replace it.`}
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
              label: t`Ciphertexts`,
              value: t`${requestCount} from DKG index ${requestFirst}`,
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
            Encryption key
          </Link>{' '}
          tab.
        </Trans>
      </p>
    </Panel>
  )
}
