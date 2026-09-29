// The cards of the election check: its setup (census, key, ballot rules),
// every batch and the root chain, and the results.

import { useState } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { CensusOriginBadge, CheckMark, KeyModeBadge, Term, Timestamp, UnverifiedMark } from '~components'
import { Formula } from '~components/Formula'
import { useChain, type ProcessView } from '~data/hooks'
import type { MetadataCheck } from '~data/queries'
import type { DkgApplicationView } from '~data/services'
import type { CheckState } from '~indexer/selectors'
import { Badge, Button, Hash, UriLink } from '~kit'
import { cn } from '~lib/cn'
import { bigIntToHex, formatNumber, formatTimestamp } from '~lib/format'
import { describeBallotMode } from '~pages/process/ballot-mode'
import { changedWhileOpen, metadataTitle } from '~pages/process/metadata'
import type { ResultsCheck } from '~pages/process/results-checks'
import {
  GET_PROCESS,
  graceEndCommand,
  metadataHashCommand,
  metadataHistoryCommand,
  TRANSITION_EVENT,
} from '~pages/transition/commands'
import { browsableUri } from '~protocol/metadata'
import { CENSUS_ORIGIN_INFO, KEY_MODE_INFO } from '~protocol/types'
import { paths } from '~routes/paths'
import { CheckCard, Compared, HowPart, RedoCommand, StatusDisc } from '../checklist'
import type { VerifyStatus } from '../status'
import { HOW_RESULT, WHO_CAN_DECRYPT } from '../words'
import { keyMatches, type BatchVerdict } from './model'

const LINK = 'text-emerald hover:underline'

export function CensusCard({
  view,
  status,
  batches,
  registry,
}: {
  view: ProcessView
  status: VerifyStatus
  batches: number
  registry: string
}) {
  const { t } = useLingui()
  const s = view.process.state
  if (!s) return <CheckCard id='census' status='pending' title={t`Who may vote`} summary={t`Reading the election…`} />
  const c = s.census
  const origin = c.origin
  const merkle = origin === 'merkle-static' || origin === 'merkle-dynamic'
  const updates = view.process.censusUpdates.length
  const href = c.uri ? browsableUri(c.uri) : null
  const pid = view.process.id
  const root = BigInt(c.root)
  const contract = c.contractAddress
  return (
    <CheckCard
      id='census'
      status={status}
      title={t`Who may vote`}
      summary={
        <>
          {origin === 'merkle-static' ? (
            <Trans>
              A fixed list of voters, published by the organizer. Its fingerprint (the{' '}
              <Term id='census-root'>census root</Term>) was recorded on the chain when the election was created and
              cannot change.
            </Trans>
          ) : origin === 'merkle-dynamic' ? (
            <Trans>
              A list of voters the organizer may replace while the election is open. Each replacement is recorded on the
              chain, and a batch counts only if it used the list in force.
            </Trans>
          ) : origin === 'onchain-dynamic' ? (
            <Trans>
              A list kept by a contract on the chain. The registry asks that contract about every batch before accepting
              it.
            </Trans>
          ) : origin === 'csp' ? (
            <Trans>
              Voters are let in by a credential service (a <Term id='csp'>CSP</Term>), which signs for each voter. The
              service’s address is fixed on the chain.
            </Trans>
          ) : (
            <Trans>A kind of list the registry does not accept.</Trans>
          )}{' '}
          {origin === 'merkle-dynamic' && updates > 0 ? (
            <>
              <Plural
                value={updates}
                one='The organizer replaced it once.'
                other='The organizer replaced it # times.'
              />{' '}
            </>
          ) : null}
          {batches > 0 ? (
            status === 'pass' ? (
              origin === 'merkle-dynamic' && updates > 0 ? (
                <Plural
                  value={batches}
                  one='The batch was proven against a version of the list the election had.'
                  other='All # batches were proven against versions of the list the election had.'
                />
              ) : (
                <Plural
                  value={batches}
                  one='The batch was proven against it.'
                  other='All # batches were proven against it.'
                />
              )
            ) : status === 'fail' ? (
              <Trans>A batch was proven against another list of voters.</Trans>
            ) : null
          ) : null}
        </>
      }
      how={
        <>
          <p>{CENSUS_ORIGIN_INFO[origin].description}</p>
          <p>
            <Trans>
              For each batch the explorer compares the list fingerprint the proof used (its census root) with the ones
              this election accepts. It cannot for a list kept by a contract, where the registry asked the contract when
              it recorded the batch, and for a replaced list it knows only the fingerprints it has seen replaced.
            </Trans>
          </p>
          <HowPart title={t`Values read`}>
            <Compared
              rows={[
                { label: t`Census kind`, value: <CensusOriginBadge origin={origin} /> },
                {
                  label: origin === 'csp' ? t`Provider address` : t`Census root`,
                  value: <Hash value={c.root} chars={10} />,
                },
                ...(origin === 'onchain-dynamic'
                  ? [{ label: t`Census contract`, value: <span className='font-mono break-all'>{contract}</span> }]
                  : []),
                ...(merkle && updates > 0 ? [{ label: t`Replacements`, value: formatNumber(updates) }] : []),
              ]}
            />
          </HowPart>
          {merkle ? (
            <HowPart title={t`Rebuild the fingerprint from the census file`}>
              <p>
                <Trans>
                  Download the census file from the address above. Each voter becomes one leaf, made of their address
                  and their voting weight, in the file’s order. The leaves are hashed in pairs, level by level, up to a
                  single value, which must equal the census root.
                </Trans>
              </p>
              <div className='flex flex-col gap-1.5'>
                <Formula block expr='leaf = (address << 88) | weight' />
                <Formula block expr='node = Poseidon(left, right)' />
              </div>
              <p>
                <Trans>
                  The tree is a lean incremental Merkle tree hashed with Poseidon: the address sits 88 bits up, the
                  weight in the low bits, and a node without a right sibling moves up unchanged. The davinci-zkvm Rust
                  SDK builds it in two calls, <code>census::census_leaf</code> and{' '}
                  <code>census::LeanImt::from_leaves</code>; lean-imt-go builds the same tree.
                </Trans>
              </p>
            </HowPart>
          ) : null}
          {origin === 'onchain-dynamic' ? (
            <RedoCommand
              note={
                <Trans>
                  Ask the census contract up to which block a list fingerprint was valid: the current block for its
                  current list, the block it was replaced in for an older one, 0 for one it never held. For every batch,
                  the registry requires that block to be no earlier than the election’s creation and no later than the
                  batch.
                </Trans>
              }
              code={`cast call ${contract} "getRootBlockNumber(uint256)(uint256)" \\\n  ${root.toString()} --rpc-url $RPC`}
            />
          ) : (
            <RedoCommand
              note={
                <Trans>The census is the sixteenth value of the registry’s record; its second field is the root.</Trans>
              }
              code={`cast call ${registry} \\\n  "${GET_PROCESS}" \\\n  ${pid} --rpc-url $RPC`}
            />
          )}
        </>
      }
    >
      {c.uri ? <UriLink uri={c.uri} href={href} label={t`Open the list of voters`} /> : null}
    </CheckCard>
  )
}

export function KeyCard({
  view,
  app,
  status,
  revealedEarly = false,
}: {
  view: ProcessView
  app: DkgApplicationView | null | undefined
  status: VerifyStatus
  /** A locked key whose organizer secret came out before voting ended. */
  revealedEarly?: boolean
}) {
  const { i18n, t } = useLingui()
  const s = view.process.state
  if (!s)
    return (
      <CheckCard id='key' status='pending' title={t`Who can open the ballots`} summary={t`Reading the election…`} />
    )
  const mode = s.keyMode
  const matches = app ? keyMatches(s.encryptionKey, app) : false
  const revealedOn = formatTimestamp(app?.reveal?.timestamp)
  return (
    <CheckCard
      id='key'
      status={status}
      title={t`Who can open the ballots`}
      statusLabel={status === 'attention' ? t`Unlocked early` : undefined}
      summary={
        <>
          <span className='inline-flex flex-wrap items-center gap-x-2 gap-y-1'>
            <span>{i18n._(WHO_CAN_DECRYPT[mode])}</span>
            <KeyModeBadge mode={mode} />
          </span>
          {revealedEarly && app?.reveal?.timestamp != null ? (
            <span className='mt-1 block text-amber'>
              <Trans>
                The organizer revealed the secret on {revealedOn}, before voting ended. From then on a threshold of
                committee members acting together could have opened single ballots.
              </Trans>
            </span>
          ) : null}
        </>
      }
      how={
        <>
          <p>
            <Trans>
              Voters encrypt their ballots to this key (the <Term id='encryption-key'>election key</Term>). It was fixed
              when the election was created, so it cannot change, and every batch encrypts the stored ballots afresh
              under it.
            </Trans>{' '}
            {KEY_MODE_INFO[mode].description}
          </p>
          <p className='text-[12px]'>
            <Trans>
              The key is a BabyJubJub point written into the election’s starting state as leaf 0x03, and the ballots are
              ElGamal encryptions to it.
            </Trans>
          </p>
          <HowPart title={t`Values read`}>
            <Compared
              rows={[
                { label: 'x', value: <Hash value={bigIntToHex(s.encryptionKey.x)} chars={10} /> },
                { label: 'y', value: <Hash value={bigIntToHex(s.encryptionKey.y)} chars={10} /> },
                ...(mode !== 'sequencer'
                  ? [
                      {
                        label: t`The committee’s key`,
                        value: app ? (
                          <span className='inline-flex items-center gap-2'>
                            <CheckMark state={matches ? 'pass' : 'fail'} />
                            {matches
                              ? t`converted to the registry’s form, it is the election key`
                              : t`converted to the registry’s form, it is not the election key`}
                          </span>
                        ) : (
                          '…'
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </HowPart>
          <p>
            <Link to={paths.process(view.process.id, 'key')} className={LINK}>
              <Trans>The election’s key tab has every detail.</Trans>
            </Link>
          </p>
        </>
      }
    />
  )
}

export function RulesCard({ view }: { view: ProcessView }) {
  const { t } = useLingui()
  const s = view.process.state
  if (!s)
    return <CheckCard id='rules' status='pending' title={t`What a ballot may say`} summary={t`Reading the election…`} />
  const mode = describeBallotMode(s.ballotMode)
  return (
    <CheckCard
      id='rules'
      status='pass'
      title={t`What a ballot may say`}
      summary={
        <span className='inline-flex flex-wrap items-center gap-x-2 gap-y-1'>
          <span>{mode.summary}</span>
          <Badge tone='slate'>{mode.label}</Badge>
        </span>
      }
      how={
        <p>
          <Trans>
            The rules are part of the election’s starting state, so they cannot change. Each voting app proves that the
            ballot follows them without revealing it (a <Term id='ballot-proof'>ballot proof</Term>), and every one of
            those proofs is checked inside the batch’s proof before the batch is recorded.
          </Trans>
        </p>
      }
    >
      <ul className='flex list-disc flex-col gap-1 pl-5 text-[13px] leading-relaxed text-pewter marker:text-ash'>
        {mode.rules.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </CheckCard>
  )
}

export function MetadataCard({
  view,
  check,
  status,
  registry,
}: {
  view: ProcessView
  check: MetadataCheck
  status: VerifyStatus
  registry: string
}) {
  const { t } = useLingui()
  const s = view.process.state
  const title = t`The description is the one the organizer committed`
  if (!s) return <CheckCard id='metadata' status='pending' title={title} summary={t`Reading the election…`} />
  const uri = s.metadataURI
  const detail = check.error ?? ''
  const named = metadataTitle(check.doc)
  return (
    <CheckCard
      id='metadata'
      status={status}
      title={title}
      statusLabel={
        check.status === 'unreachable'
          ? t`Could not download`
          : check.status === 'not-browsable'
            ? t`Not checked here`
            : undefined
      }
      summary={
        check.status === 'matches' ? (
          <Trans>
            The document at its address is, byte for byte, the one whose fingerprint the organizer recorded on the
            chain, so the title, the question and the option names are the organizer’s.
          </Trans>
        ) : check.status === 'differs' ? (
          <Trans>
            Its address serves another document than the one the organizer recorded on the chain. Its title, question
            and option names may not be what voters were shown, so do not rely on them.
          </Trans>
        ) : check.status === 'unreachable' ? (
          <Trans>
            The document could not be downloaded ({detail}), so it could not be compared. The command below checks it
            from a terminal.
          </Trans>
        ) : check.status === 'not-browsable' ? (
          <Trans>A browser cannot fetch this address; the command below checks it from a terminal.</Trans>
        ) : (
          <Trans>Downloading the document and taking its fingerprint…</Trans>
        )
      }
      how={
        <>
          <p>
            <Trans>
              The chain knows a ballot only as numbers in fields; what each field means is in the organizer’s document.
              When the election was created, and at every change, the registry recorded the document’s address and its{' '}
              <Term id='metadata-hash'>fingerprint</Term> (the SHA-256 of its exact bytes). Your browser downloads the
              document, hashes the bytes as they came, with no reformatting, and compares; the text shown on these pages
              is read from those same bytes.
            </Trans>
          </p>
          <HowPart title={t`Values compared`}>
            <Compared
              rows={[
                {
                  label: t`Address`,
                  value: uri ? <span className='font-mono break-all'>{uri}</span> : '—',
                },
                { label: t`Fingerprint on the chain`, value: <Hash value={s.metadataHash} chars={10} /> },
                {
                  label: t`Fingerprint of what is served`,
                  value: check.served ? (
                    <span className='inline-flex items-center gap-2'>
                      <CheckMark state={check.status === 'matches' ? 'pass' : 'fail'} />
                      <Hash value={check.served.hash} chars={10} />
                    </span>
                  ) : (
                    '…'
                  ),
                },
              ]}
            />
          </HowPart>
          {uri ? (
            <RedoCommand
              note={
                <Trans>
                  The first line takes the fingerprint of what the address serves; the second prints the registry’s
                  record, whose fourteenth value is the committed one. They must be equal (<code>sha256sum</code> leaves
                  out the 0x).
                </Trans>
              }
              code={metadataHashCommand({ registry, processId: view.process.id, uri })}
            />
          ) : null}
        </>
      }
    >
      <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
        {uri ? <UriLink uri={uri} href={browsableUri(uri)} label={t`Open the document`} /> : null}
        {named && check.status === 'differs' ? (
          <span className='inline-flex min-w-0 items-center gap-2 text-[13px] text-ash'>
            <span className='truncate italic'>
              <Trans>“{named}”</Trans>
            </span>
            <UnverifiedMark />
          </span>
        ) : null}
      </div>
    </CheckCard>
  )
}

export function MetadataHistoryCard({
  view,
  status,
  registry,
}: {
  view: ProcessView
  status: VerifyStatus
  registry: string
}) {
  const { t } = useLingui()
  const history = view.process.metadataHistory
  const changes = history.length - 1
  return (
    <CheckCard
      id='metadata-history'
      status={status}
      title={t`When the description changed`}
      statusLabel={status === 'attention' ? t`Changed while open` : undefined}
      summary={
        status === 'attention' ? (
          <Trans>
            The organizer changed the description while voting was open. Votes cast before a change were cast under the
            previous version.
          </Trans>
        ) : status === 'pass' ? (
          <Plural
            value={changes}
            one='The organizer changed the description once, before voting opened.'
            other='The organizer changed the description # times, all before voting opened.'
          />
        ) : (
          <Trans>Reading when each change happened…</Trans>
        )
      }
      how={
        <>
          <p>
            <Trans>
              Every change is an event on the registry (<code>ProcessMetadataUpdated</code>) with the new address and
              fingerprint. The organizer may change the description while the election is Ready or Paused and before its
              end; after that it is frozen. A change is flagged when its block is later than the start of voting.
            </Trans>
          </p>
          <RedoCommand
            code={metadataHistoryCommand({
              registry,
              processId: view.process.id,
              fromBlock: view.process.createdBlock,
            })}
          />
        </>
      }
    >
      <ol className='flex flex-col gap-1.5 text-[13px] text-pewter' data-testid='metadata-versions'>
        {history.map((v, i) => {
          const n = i + 1
          const flagged = changedWhileOpen(v)
          return (
            <li key={`${v.block}:${v.logIndex}`} className='flex flex-wrap items-center gap-x-2 gap-y-1'>
              <span className='font-medium text-silver'>
                {v.atCreation ? t`Version ${n}, at creation` : t`Version ${n}`}
              </span>
              <Timestamp value={v.timestamp} relative={false} className='text-ash' />
              {flagged ? (
                <Badge tone='warn' size='sm'>
                  <Trans>changed while voting was open</Trans>
                </Badge>
              ) : null}
              {i === history.length - 1 ? (
                <Badge tone='ok' size='sm'>
                  <Trans>current</Trans>
                </Badge>
              ) : null}
            </li>
          )
        })}
      </ol>
    </CheckCard>
  )
}

const DOT: Record<CheckState, string> = {
  pass: 'bg-emerald',
  fail: 'bg-red',
  unknown: 'bg-charcoal',
}

const FIRST = 12

function BatchList({ pid, verdicts }: { pid: string; verdicts: BatchVerdict[] }) {
  const { t } = useLingui()
  const [all, setAll] = useState(false)
  // Newest first, like everywhere else.
  const ordered = [...verdicts].reverse()
  const shown = all ? ordered : ordered.slice(0, FIRST)
  const more = verdicts.length - FIRST
  return (
    <div className='rounded-md border border-charcoal' data-testid='batch-list'>
      <ul className='scroll-slim max-h-[480px] divide-y divide-charcoal overflow-y-auto'>
        {shown.map((v) => {
          const passed = v.checks.filter((c) => c.state === 'pass').length
          const total = v.checks.length
          const index = v.index
          return (
            <li key={v.index} className='flex items-center gap-3 px-3 py-2' data-testid={`batch-${v.index}`}>
              <StatusDisc status={v.status} size='sm' />
              <Link
                to={paths.transition(pid, v.index)}
                className='w-14 shrink-0 font-mono text-[13px] text-emerald hover:underline'
              >
                #{index}
              </Link>
              <span className='hidden w-44 shrink-0 text-[12px] text-ash md:block'>
                {v.timestamp != null ? formatTimestamp(v.timestamp) : '—'}
              </span>
              <span className='w-24 shrink-0 text-[12px] text-ash'>
                <Plural value={v.votes} one='# vote' other='# votes' />
              </span>
              <span className='flex min-w-0 flex-1 flex-wrap items-center gap-1' aria-hidden='true'>
                {v.checks.map((c) => (
                  <span key={c.id} title={c.label} className={cn('h-2 w-2 rounded-full', DOT[c.state])} />
                ))}
              </span>
              <span className='sr-only'>
                <Trans>
                  {passed} of {total} checks passed
                </Trans>
              </span>
            </li>
          )
        })}
      </ul>
      {!all && more > 0 ? (
        <div className='border-t border-charcoal p-2 text-center'>
          <Button variant='subtle' size='sm' onClick={() => setAll(true)}>
            <Plural value={more} one='Show # older batch' other='Show # older batches' />
          </Button>
        </div>
      ) : null}
      <p className='border-t border-charcoal px-3 py-2 text-[11px] text-ash'>
        {t`Each dot is one check of the batch: green passed, red failed, grey not read yet. Hover a dot for its name.`}
      </p>
    </div>
  )
}

export function BatchesCard({
  view,
  status,
  verdicts,
}: {
  view: ProcessView
  status: VerifyStatus
  verdicts: BatchVerdict[]
}) {
  const { t } = useLingui()
  const n = verdicts.length
  const passed = verdicts.filter((v) => v.status === 'pass').length
  const failed = verdicts.filter((v) => v.status === 'fail').length
  const total = formatNumber(n)
  const pid = view.process.id
  return (
    <CheckCard
      id='batches'
      status={status}
      title={t`Every batch of votes passed every check`}
      summary={
        n === 0 ? (
          status === 'na' ? (
            <Trans>No batch of votes was ever recorded for this election.</Trans>
          ) : (
            <Trans>No batch of votes has been recorded yet.</Trans>
          )
        ) : failed > 0 ? (
          <Trans>
            {failed} of {total} batches failed a check.
          </Trans>
        ) : (
          <Trans>
            {passed} of {total} batches passed every check the registry makes before it accepts a batch, the proof
            itself included.
          </Trans>
        )
      }
      how={
        <p>
          <Trans>
            For every batch, the explorer redoes from public data what the registry checked when it accepted it: every
            ballot passed the checks inside the proof, the batch starts from the previous state, it used the election’s
            list of voters, its counts add up, and its published data is the data the proof covers. The proof itself and
            the blob openings were checked on the chain. Open a batch for each check, its values and the command that
            redoes it.
          </Trans>
        </p>
      }
    >
      {n > 0 ? <BatchList pid={pid} verdicts={verdicts} /> : null}
    </CheckCard>
  )
}

export function ChainCard({ view, status, registry }: { view: ProcessView; status: VerifyStatus; registry: string }) {
  const { t } = useLingui()
  const chain = view.rootChain
  const n = chain.links.length
  const gaps = chain.gaps
  const latest = view.process.state?.latestStateRoot ?? null
  const pid = view.process.id
  const from = view.process.createdBlock
  return (
    <CheckCard
      id='chain'
      status={status}
      title={t`No batch was skipped, replayed or forked`}
      summary={
        status === 'pass' && n === 0 ? (
          <Trans>No batch was recorded: the registry’s current state is still the starting one.</Trans>
        ) : status === 'pass' ? (
          <Plural
            value={n}
            one='The state goes from its starting point, through the one batch, to the registry’s current state, each step starting where the last one ended.'
            other='The state goes from its starting point, through all # batches, to the registry’s current state, each step starting where the last one ended.'
          />
        ) : status === 'fail' ? (
          gaps > 0 ? (
            <Plural
              value={gaps}
              one='The chain of states has # gap: a batch does not start where the previous one ended.'
              other='The chain of states has # gaps: batches do not start where the previous ones ended.'
            />
          ) : (
            <Trans>The last batch does not end at the registry’s current state.</Trans>
          )
        ) : (
          <Trans>Reading the chain of states…</Trans>
        )
      }
      how={
        <>
          <p>
            <Trans>
              The election’s state is summed up by one fingerprint (the root of its Merkle tree, its{' '}
              <Term id='state-root'>state root</Term>). The registry computed the first one when the election was
              created, and accepts a batch only if it starts from the current one; the batch’s proof then gives the
              next. The explorer follows that chain from the registry’s batch events.
            </Trans>
          </p>
          <HowPart title={t`Values compared`}>
            <Compared
              rows={[
                {
                  label: t`Starting state`,
                  value: chain.genesisRoot ? <Hash value={chain.genesisRoot} chars={10} /> : '…',
                },
                {
                  label: t`Batches`,
                  value: (
                    <Trans>
                      <Plural value={n} one='# batch' other='# batches' />,{' '}
                      <Plural value={gaps} one='# gap' other='# gaps' />
                    </Trans>
                  ),
                },
                { label: t`Current state`, value: latest ? <Hash value={latest} chars={10} /> : '…' },
              ]}
            />
          </HowPart>
          <p>
            <Link to={paths.process(pid, 'transitions')} className={LINK}>
              <Trans>Every fingerprint, batch by batch, on the batches tab.</Trans>
            </Link>
          </p>
          <RedoCommand
            note={
              <Trans>
                List the election’s batch events: each one’s data starts with the fingerprint before and the one after,
                so each line must start where the previous one ended.
              </Trans>
            }
            code={`cast logs --from-block ${from} --address ${registry} \\\n  "${TRANSITION_EVENT}" \\\n  ${pid} --rpc-url $RPC`}
          />
        </>
      }
    />
  )
}

export function PublishedCard({ view, status }: { view: ProcessView; status: VerifyStatus }) {
  const { t } = useLingui()
  const registry = useChain().registryAddress
  const results = view.process.results
  const request = view.process.decryptionRequest
  const phase = view.row.phase
  const when = results?.timestamp != null ? formatTimestamp(results.timestamp) : null
  const end = view.row.endTime != null ? formatTimestamp(view.row.endTime) : null
  const graceEnd = view.row.graceEnd != null ? formatTimestamp(view.row.graceEnd) : null
  const voters = view.row.votersCount
  const pid = view.process.id
  const link = (
    <Link to={paths.process(pid, 'results')} className={LINK}>
      <Trans>The results</Trans>
    </Link>
  )
  return (
    <CheckCard
      id='published'
      status={status}
      title={t`The results are published`}
      statusLabel={status === 'pending' ? t`Not yet` : undefined}
      summary={
        results ? (
          when ? (
            <Trans>
              {link} were published on {when}, counting <Plural value={voters} one='# voter' other='# voters' />.
            </Trans>
          ) : (
            <Trans>
              {link} are published, counting <Plural value={voters} one='# voter' other='# voters' />.
            </Trans>
          )
        ) : view.row.phase === 'canceled' ? (
          <Trans>The organizer canceled the election, so no results will be published.</Trans>
        ) : request ? (
          <Trans>
            The encrypted total went to the key committee for decryption; the results follow once it is decrypted.
          </Trans>
        ) : phase === 'ended' && graceEnd ? (
          <Trans>
            Not yet: voting is over, and the registry has accepted the results since the grace window closed on{' '}
            {graceEnd}.
          </Trans>
        ) : phase === 'closing' && graceEnd ? (
          <Trans>
            Not yet: voting has ended, and the registry accepts the results once the grace window closes, on {graceEnd},
            or later if more batches are recorded.
          </Trans>
        ) : end ? (
          <Trans>Not yet: the results come after the vote ends, on {end}, and a short grace window after it.</Trans>
        ) : (
          <Trans>Not yet: the results come after the vote ends.</Trans>
        )
      }
      how={
        results || phase === 'canceled' ? undefined : (
          <>
            <p>
              <Trans>
                After the end the registry still records batches of votes cast before it, for a short{' '}
                <Term id='grace-window'>grace window</Term>, and refuses the results until the window closes (the call
                reverts with <code>GraceOpen</code>), so they count every recorded vote.
              </Trans>
            </p>
            <RedoCommand
              note={<Trans>The registry’s answer is the unix time the window closes, or closed.</Trans>}
              code={graceEndCommand({ registry, processId: view.process.id })}
            />
          </>
        )
      }
    />
  )
}

function ResultChecksList({ checks }: { checks: ResultsCheck[] }) {
  return (
    <ul className='flex flex-col gap-1.5'>
      {checks.map((c) => (
        <li key={c.id} className='flex items-start gap-2 text-[12px] text-silver'>
          <CheckMark state={c.state} className='mt-0.5' />
          <span>
            {c.label}
            <span className='block text-ash'>{c.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export function ProducedCard({
  view,
  status,
  checks,
}: {
  view: ProcessView
  status: VerifyStatus
  checks: ResultsCheck[]
}) {
  const { i18n, t } = useLingui()
  const mode = view.process.state?.keyMode
  const pid = view.process.id
  // No ballot counted: the total was empty and nothing went to the committee.
  const empty = mode !== 'sequencer' && view.process.decryptionRequest?.count === 0
  return (
    <CheckCard
      id='produced'
      status={status}
      title={
        mode === 'sequencer'
          ? t`The results were proven correct`
          : empty
            ? t`There was nothing to decrypt`
            : t`The key committee decrypted the right total`
      }
      statusLabel={status === 'pending' && checks.length === 0 ? t`Not yet` : undefined}
      summary={
        empty
          ? t`No ballot was counted, so every field of the encrypted total was empty. The registry checked that total against the final state and recorded 0 for every field, without the key committee.`
          : mode
            ? i18n._(HOW_RESULT[mode])
            : t`Reading the election…`
      }
      how={
        checks.length ? (
          <>
            <ResultChecksList checks={checks} />
            <p>
              <Link to={paths.process(pid, 'results')} className={LINK}>
                <Trans>The results tab has the transaction, the rules the registry enforced and every value.</Trans>
              </Link>
            </p>
          </>
        ) : undefined
      }
    />
  )
}

export function TallyCard({
  view,
  status,
  checks,
}: {
  view: ProcessView
  status: VerifyStatus
  checks: ResultsCheck[]
}) {
  const { t } = useLingui()
  const mode = view.process.state?.keyMode
  const empty = mode !== 'sequencer' && view.process.decryptionRequest?.count === 0
  return (
    <CheckCard
      id='tally'
      status={status}
      title={t`The published numbers are the ones proven`}
      statusLabel={status === 'pending' && checks.length === 0 ? t`Not yet` : undefined}
      summary={
        status === 'pass' ? (
          mode === 'sequencer' ? (
            <Trans>Every number the registry stored is exactly the one the results proof carries.</Trans>
          ) : empty ? (
            <Trans>Every number the registry stored is 0, as no ballot was counted.</Trans>
          ) : (
            <Trans>Every number the registry stored is exactly the one the committee decrypted.</Trans>
          )
        ) : status === 'fail' ? (
          <Trans>A stored number differs from the proven one.</Trans>
        ) : status === 'na' ? (
          <Trans>There are no results to compare.</Trans>
        ) : (
          <Trans>Compared once the results are published.</Trans>
        )
      }
      how={checks.length ? <ResultChecksList checks={checks} /> : undefined}
    />
  )
}
