// The cards of the election check: its setup (census, key, ballot rules),
// every batch and the root chain, and the result.

import { useState } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { CensusOriginBadge, CheckMark, KeyModeBadge } from '~components'
import { Formula } from '~components/Formula'
import type { ProcessView } from '~data/hooks'
import type { DkgApplicationView } from '~data/services'
import type { CheckState } from '~indexer/selectors'
import { Badge, Button, Hash, UriLink } from '~kit'
import { cn } from '~lib/cn'
import { bigIntToHex, formatNumber, formatTimestamp } from '~lib/format'
import { describeBallotMode } from '~pages/process/ballot-mode'
import { browsableUri } from '~pages/process/metadata'
import type { ResultsCheck } from '~pages/process/results-checks'
import { GET_PROCESS, TRANSITION_EVENT } from '~pages/transition/commands'
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
              A fixed list of voters, published by the organizer. Its fingerprint (the census root) was written on-chain
              when the election was created and cannot change.
            </Trans>
          ) : origin === 'merkle-dynamic' ? (
            <Trans>
              A list of voters the organizer may replace while the election is open. Each replacement is recorded
              on-chain, and a batch counts only if it used the list in force.
            </Trans>
          ) : origin === 'onchain-dynamic' ? (
            <Trans>
              A list kept by a contract on the chain. The registry asks that contract about every batch before accepting
              it.
            </Trans>
          ) : origin === 'csp' ? (
            <Trans>
              Voters are let in by a credential service provider, which signs for each voter. The provider’s address is
              fixed on-chain.
            </Trans>
          ) : (
            <Trans>A census kind the registry does not accept.</Trans>
          )}{' '}
          {batches > 0 ? (
            status === 'pass' ? (
              <Plural
                value={batches}
                one='The batch was proven against it.'
                other='All # batches were proven against it.'
              />
            ) : status === 'fail' ? (
              <Trans>A batch was proven against another census.</Trans>
            ) : null
          ) : null}
        </>
      }
      how={
        <>
          <p>{CENSUS_ORIGIN_INFO[origin].description}</p>
          <p>
            <Trans>
              For each batch the explorer compares the census root the proof used with the roots this election accepts.
              It cannot for an on-chain census, where the registry asked the census contract at settlement, and for a
              replaced list it knows only the roots it has seen replaced.
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
            <HowPart title={t`Rebuild the root from the census file`}>
              <p>
                <Trans>
                  Download the census file from the address above. Each voter is one leaf, the address shifted left by
                  88 bits with the voter’s weight in the low bits, in the file’s order. The leaves form a lean
                  incremental Merkle tree hashed with Poseidon: a node without a right sibling moves up unchanged. The
                  top of the tree must equal the census root.
                </Trans>
              </p>
              <div className='flex flex-col gap-1.5'>
                <Formula block expr='leaf = (address << 88) | weight' />
                <Formula block expr='node = Poseidon(left, right)' />
              </div>
              <p>
                <Trans>
                  The davinci-zkvm Rust SDK does it in two calls, census::census_leaf and census::LeanImt::from_leaves;
                  lean-imt-go builds the same tree.
                </Trans>
              </p>
            </HowPart>
          ) : null}
          {origin === 'onchain-dynamic' ? (
            <RedoCommand
              note={
                <Trans>
                  Ask the census contract when it recorded a root; the registry requires a block at or after the
                  election’s creation for every batch.
                </Trans>
              }
              code={`cast call ${contract} "getRootBlockNumber(uint256)(uint256)" \\\n  ${root.toString()} --rpc-url $RPC`}
            />
          ) : (
            <RedoCommand
              note={
                <Trans>The census is the fifteenth value of the registry’s record; its second field is the root.</Trans>
              }
              code={`cast call ${registry} \\\n  "${GET_PROCESS}" \\\n  ${pid} --rpc-url $RPC`}
            />
          )}
        </>
      }
    >
      {c.uri ? <UriLink uri={c.uri} href={href} label={t`Open the census file`} /> : null}
    </CheckCard>
  )
}

export function KeyCard({
  view,
  app,
  status,
}: {
  view: ProcessView
  app: DkgApplicationView | null | undefined
  status: VerifyStatus
}) {
  const { i18n, t } = useLingui()
  const s = view.process.state
  if (!s)
    return (
      <CheckCard id='key' status='pending' title={t`Who can open the ballots`} summary={t`Reading the election…`} />
    )
  const mode = s.keyMode
  const matches = app ? keyMatches(s.encryptionKey, app) : false
  return (
    <CheckCard
      id='key'
      status={status}
      title={t`Who can open the ballots`}
      summary={
        <span className='inline-flex flex-wrap items-center gap-x-2 gap-y-1'>
          <span>{i18n._(WHO_CAN_DECRYPT[mode])}</span>
          <KeyModeBadge mode={mode} />
        </span>
      }
      how={
        <>
          <p>
            <Trans>
              Voters encrypt their ballots to the election key. The key is written into the election’s starting state
              (leaf 0x03), so it cannot change after creation, and every batch keeps the ballots encrypted under it.
            </Trans>{' '}
            {KEY_MODE_INFO[mode].description}
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
                            {matches ? t`converted, it is the election key` : t`converted, it is not the election key`}
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
            The rules are part of the election’s starting state, so they cannot change. Each voter’s app proves that the
            ballot follows them without revealing it, and the zkVM checks every one of those proofs before a batch
            settles.
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
                <Plural value={v.votes} one='# ballot' other='# ballots' />
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
            <Trans>No batch of votes was ever settled for this election.</Trans>
          ) : (
            <Trans>No batch of votes has been settled yet.</Trans>
          )
        ) : failed > 0 ? (
          <Trans>
            {failed} of {total} batches failed a check.
          </Trans>
        ) : (
          <Trans>
            {passed} of {total} batches passed every check the registry makes before it accepts a batch, including its
            zkVM proof.
          </Trans>
        )
      }
      how={
        <p>
          <Trans>
            For every batch, the explorer recomputes from public data what the registry checked when it accepted it: the
            zkVM guest accepted every ballot, the batch starts from the previous state, it used the election’s census,
            its counts add up, and its blobs are the ones the proof covers. The proof itself and the blob openings were
            verified on-chain. Open a batch for each check, its values and the command that redoes it.
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
        status === 'pass' ? (
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
              The election’s state is a Merkle tree, summed up by its root. The registry computed the first root when
              the election was created, and accepts a batch only if it starts from the current root; the batch’s proof
              then gives the next one. The explorer follows that chain from the settlement events.
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
              <Trans>Every root, batch by batch, on the transitions tab.</Trans>
            </Link>
          </p>
          <RedoCommand
            note={
              <Trans>
                List the election’s settlement events: each one’s data starts with the root before and the root after,
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
  const results = view.process.results
  const request = view.process.decryptionRequest
  const when = results?.timestamp != null ? formatTimestamp(results.timestamp) : null
  const end = view.row.endTime != null ? formatTimestamp(view.row.endTime) : null
  const voters = view.row.votersCount
  const pid = view.process.id
  const link = (
    <Link to={paths.process(pid, 'results')} className={LINK}>
      <Trans>The result</Trans>
    </Link>
  )
  return (
    <CheckCard
      id='published'
      status={status}
      title={t`The result is published`}
      statusLabel={status === 'pending' ? t`Not yet` : undefined}
      summary={
        results ? (
          when ? (
            <Trans>
              {link} was published on {when}, counting <Plural value={voters} one='# voter' other='# voters' />.
            </Trans>
          ) : (
            <Trans>
              {link} is published, counting <Plural value={voters} one='# voter' other='# voters' />.
            </Trans>
          )
        ) : view.row.phase === 'canceled' ? (
          <Trans>The organizer canceled the election, so no result will be published.</Trans>
        ) : request ? (
          <Trans>
            The encrypted total went to the committee for decryption; the result follows once it is decrypted.
          </Trans>
        ) : end ? (
          <Trans>Not yet: the result comes after the vote ends, on {end}.</Trans>
        ) : (
          <Trans>Not yet: the result comes after the vote ends.</Trans>
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
  return (
    <CheckCard
      id='produced'
      status={status}
      title={mode === 'sequencer' ? t`The result was proven correct` : t`The committee decrypted the right total`}
      statusLabel={status === 'pending' && checks.length === 0 ? t`Not yet` : undefined}
      summary={mode ? i18n._(HOW_RESULT[mode]) : t`Reading the election…`}
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
          ) : (
            <Trans>Every number the registry stored is exactly the one the committee decrypted.</Trans>
          )
        ) : status === 'fail' ? (
          <Trans>A stored number differs from the proven one.</Trans>
        ) : status === 'na' ? (
          <Trans>There is no result to compare.</Trans>
        ) : (
          <Trans>Compared once the result is published.</Trans>
        )
      }
      how={checks.length ? <ResultChecksList checks={checks} /> : undefined}
    />
  )
}
