import { useEffect, useMemo, type ReactNode } from 'react'
import { plural } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { Link, useParams } from 'react-router'
import { KeyModeBadge, ProcessPhaseBadge, Term, UnverifiedMark } from '~components'
import { CodeBlock, Disclosure } from '~components/code'
import { useRuntimeConfig } from '~config/config-context'
import { useDataSource } from '~data/context'
import { useChain, useChainNow, useIndexer, useProcess, useStore, type ProcessView } from '~data/hooks'
import { useMetadataCheck } from '~data/queries'
import { transitionDetail, votingOver, type TransitionDetail } from '~indexer/selectors'
import { Callout, Card, SkeletonText } from '~kit'
import { publicRpc } from '~pages/contracts/model'
import { metadataTitle } from '~pages/process/metadata'
import { revealedBeforeEnd } from '~pages/process/reveal'
import { useDkgResultsChecks, useSequencerResultsChecks, type ResultsCheck } from '~pages/process/results-checks'
import {
  GET_PROCESS,
  metadataHashCommand,
  metadataHistoryCommand,
  observerCommand,
  TRANSITION_EVENT,
} from '~pages/transition/commands'
import { isProcessId, normalizeProcessId } from '~protocol/process-id'
import type { KeyModeName } from '~protocol/types'
import { paths } from '~routes/paths'
import { CheckGroup, ChecklistSummary } from '../checklist'
import { FlowFrame, FlowSection, Prose, ProvesPanel } from '../frame'
import { BallotBoxIcon } from '../icons'
import { stepStates, type StepId, type StepState, type VerifyStatus } from '../status'
import { WHO_CAN_DECRYPT } from '../words'
import {
  BatchesCard,
  CensusCard,
  ChainCard,
  KeyCard,
  MetadataCard,
  MetadataHistoryCard,
  ProducedCard,
  PublishedCard,
  RulesCard,
  TallyCard,
} from './checks'
import {
  batchesStatus,
  batchVerdicts,
  censusStatus,
  chainStatus,
  keyStatus,
  metadataCheckStatus,
  metadataHistoryStatus,
  publishedStatus,
  resultChecksStatus,
} from './model'
import { ProcessPicker } from './ProcessPicker'

/**
 * Verify → An election (`/verify/election/:pid?`): its setup, every batch and
 * the root chain, and how the results were produced. Without a pid, a picker.
 */
export function VerifyElectionPage() {
  const { t } = useLingui()
  const { pid: raw } = useParams()
  const pid = raw && isProcessId(raw) ? normalizeProcessId(raw) : null

  if (!pid) {
    return (
      <ElectionFrame
        states={stepStates(false, false)}
        choose={
          <div className='flex flex-col gap-3'>
            {raw ? (
              <Callout tone='warn' title={t`This is not a process id`}>
                <Trans>A process id is 0x followed by 62 hex digits. Pick the election from the list instead.</Trans>
              </Callout>
            ) : null}
            <ProcessPicker />
          </div>
        }
        checks={
          <p className='rounded-md border border-dashed border-charcoal p-5 text-[14px] text-ash'>
            <Trans>
              Pick an election above. Its checks then run in your browser: who may vote, who can open the ballots, the
              ballot rules, every batch of votes, and the results.
            </Trans>
          </p>
        }
        redo={
          <p className='rounded-md border border-dashed border-charcoal p-5 text-[14px] text-ash'>
            <Trans>The commands to repeat the checks appear here, filled in for the election.</Trans>
          </p>
        }
        keyMode={null}
      />
    )
  }
  return <ElectionChecks key={pid} pid={pid} />
}

function ElectionFrame({
  states,
  hints,
  choose,
  checks,
  redo,
  keyMode,
}: {
  states: Record<StepId, StepState>
  hints?: Partial<Record<StepId, ReactNode>>
  choose: ReactNode
  checks: ReactNode
  redo: ReactNode
  keyMode: KeyModeName | null
}) {
  const { t } = useLingui()
  return (
    <FlowFrame
      testId='page-verify-election'
      flow={t`An election`}
      icon={<BallotBoxIcon size={24} />}
      question={t`Was this election run correctly?`}
      description={t`Who could vote, who can open the ballots, whether every batch of votes was accepted by the rules, and how the results were produced. Everything is read from the chain by your browser.`}
      states={states}
      hints={hints}
    >
      <FlowSection id='choose' n={1} title={t`Choose the election`}>
        {choose}
      </FlowSection>
      <FlowSection
        id='check'
        n={2}
        title={t`Check`}
        description={t`Each card says what was checked and what the answer means. Open “How this is checked” for the details and the command.`}
      >
        {checks}
      </FlowSection>
      <FlowSection
        id='redo'
        n={3}
        title={t`Redo it yourself`}
        description={t`The same checks from a terminal, without this site. You need an RPC node of your choice and Foundry’s cast, or a node that replays the whole election.`}
      >
        {redo}
      </FlowSection>
      <ElectionProves keyMode={keyMode} />
    </FlowFrame>
  )
}

function Chosen({ view, title, unverified }: { view: ProcessView | null; title: string | null; unverified: boolean }) {
  const { t } = useLingui()
  if (!view) return <SkeletonText lines={2} />
  const pid = view.process.id
  const votes = view.row.votersCount + view.row.overwrittenVotesCount
  return (
    <Card
      className='flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between'
      data-testid='chosen-election'
    >
      <div className='min-w-0'>
        <div className='flex min-w-0 items-center gap-2'>
          <span className='truncate text-[16px] font-semibold text-ghost'>{title ?? t`Untitled election`}</span>
          {title && unverified ? <UnverifiedMark /> : null}
        </div>
        <div className='mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ash'>
          <Link to={paths.process(pid)} className='font-mono break-all hover:text-emerald'>
            {pid}
          </Link>
        </div>
        <div className='mt-2 flex flex-wrap items-center gap-2'>
          <ProcessPhaseBadge phase={view.row.phase} />
          {view.row.keyMode ? <KeyModeBadge mode={view.row.keyMode} /> : null}
          <span className='text-[12px] text-ash'>
            <Plural value={votes} one='# vote recorded' other='# votes recorded' />
          </span>
        </div>
      </div>
      <Link to={paths.verifyElection()} className='shrink-0 text-[13px] text-emerald hover:underline'>
        <Trans>Choose another election</Trans>
      </Link>
    </Card>
  )
}

function ElectionChecks({ pid }: { pid: string }) {
  const { t } = useLingui()
  const store = useStore()
  const source = useDataSource()
  const chain = useChain()
  const now = useChainNow()
  const { status: indexer } = useIndexer()
  const view = useProcess(pid)
  const metadata = useMetadataCheck(view?.process.state?.metadataURI, view?.process.state?.metadataHash)
  const title = metadataTitle(metadata.doc)
  const sequencerResults = useSequencerResultsChecks(view)
  const dkgResults = useDkgResultsChecks(view)

  const details = useMemo(
    (): TransitionDetail[] =>
      view ? view.transitions.flatMap((r) => transitionDetail(store, pid, r.index) ?? []) : [],
    [store, pid, view]
  )
  // The batch checks need each recorded batch's calldata: ask for this election's first.
  const missing = details.filter((d) => d.transition.tx && !d.tx).map((d) => d.transition.tx)
  const missingKey = missing.join(',')
  useEffect(() => {
    if (missingKey) source.ensureTxDetails(missingKey.split(',') as `0x${string}`[])
  }, [source, missingKey])

  const indexing = indexer.phase === 'idle' || indexer.phase === 'loading' || indexer.scanning
  if (!view) {
    return (
      <ElectionFrame
        states={stepStates(false, false)}
        choose={
          indexing ? (
            <SkeletonText lines={3} />
          ) : (
            <div className='flex flex-col gap-3'>
              <Callout tone='warn' title={t`No such election`}>
                <Trans>
                  This registry has no election {pid}. Check the id, or whether this explorer reads the right network.
                </Trans>
              </Callout>
              <ProcessPicker />
            </div>
          )
        }
        checks={null}
        redo={null}
        keyMode={null}
      />
    )
  }

  const s = view.process.state
  const phase = view.row.phase
  const keyMode = s?.keyMode ?? null
  const verdicts = batchVerdicts(details, {
    onchain: t`The proof and the published data were verified on the chain`,
    onchainCensus: t`The registry asked the contract that keeps the list of voters`,
  })
  const loaded = s != null

  const census = censusStatus(s?.census.origin ?? null, details)
  const revealedEarly = revealedBeforeEnd(dkgResults.app?.reveal, view.row.endTime)
  const key = keyStatus(keyMode, s?.encryptionKey ?? null, dkgResults.app, revealedEarly)
  const rules: VerifyStatus = loaded ? 'pass' : 'pending'
  const described = loaded ? metadataCheckStatus(metadata.status) : 'pending'
  const history = view.process.metadataHistory
  const changed = history.length > 1 ? metadataHistoryStatus(history) : null
  const batches = batchesStatus(verdicts, votingOver(view.row, now))
  const rootChain = chainStatus(view.rootChain, loaded)
  const published = publishedStatus(view.process.results != null, phase)
  const resultChecks: ResultsCheck[] = keyMode === 'sequencer' ? sequencerResults.checks : dkgResults.checks
  const tallyIds = ['tally-proven', 'tally-plaintexts']
  const producedChecks = resultChecks.filter((c) => !tallyIds.includes(c.id))
  const tallyChecks = resultChecks.filter((c) => tallyIds.includes(c.id))
  const produced = resultChecksStatus(
    producedChecks.map((c) => c.state),
    published
  )
  const tally = resultChecksStatus(
    tallyChecks.map((c) => c.state),
    published
  )
  const all = [
    census,
    key,
    rules,
    described,
    ...(changed ? [changed] : []),
    batches,
    rootChain,
    published,
    produced,
    tally,
  ]
  const decided = !all.includes('pending')
  const count = verdicts.length

  return (
    <ElectionFrame
      states={stepStates(true, decided)}
      hints={{
        choose: title && metadata.status !== 'differs' ? title : `${pid.slice(0, 10)}…`,
        check: plural(count, { one: '# batch', other: '# batches' }),
      }}
      keyMode={keyMode}
      choose={<Chosen view={view} title={title} unverified={metadata.status === 'differs'} />}
      checks={
        <div className='flex flex-col gap-8'>
          <ChecklistSummary statuses={all} testId='election-summary' />
          <CheckGroup
            title={t`Setup`}
            description={t`Set when the election was created: who may vote, who can open the ballots, the rules for a ballot and the description of what is voted on.`}
            testId='group-setup'
          >
            <CensusCard view={view} status={census} batches={verdicts.length} registry={chain.registryAddress} />
            <KeyCard view={view} app={dkgResults.app} status={key} revealedEarly={revealedEarly === true} />
            <RulesCard view={view} />
            <MetadataCard view={view} check={metadata} status={described} registry={chain.registryAddress} />
            {changed ? <MetadataHistoryCard view={view} status={changed} registry={chain.registryAddress} /> : null}
          </CheckGroup>
          <CheckGroup
            title={t`Every batch`}
            description={t`Sequencers record the votes in batches. Each batch had to pass the registry’s checks, starting from where the last one ended.`}
            testId='group-batches'
          >
            <BatchesCard view={view} status={batches} verdicts={verdicts} />
            <ChainCard view={view} status={rootChain} registry={chain.registryAddress} />
          </CheckGroup>
          <CheckGroup
            title={t`Results`}
            description={t`After the vote ends, only the final encrypted total is decrypted, never a single ballot.`}
            testId='group-result'
          >
            <PublishedCard view={view} status={published} />
            <ProducedCard view={view} status={produced} checks={producedChecks} />
            <TallyCard view={view} status={tally} checks={tallyChecks} />
          </CheckGroup>
        </div>
      }
      redo={<ElectionRedo view={view} />}
    />
  )
}

function RedoStep({ n, title, children }: { n: number; title: ReactNode; children: ReactNode }) {
  return (
    <li className='flex gap-3'>
      <span
        aria-hidden='true'
        className='mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-charcoal font-mono text-[12px] text-pewter'
      >
        {n}
      </span>
      <div className='flex min-w-0 flex-1 flex-col gap-2'>
        <h3 className='text-[14px] font-semibold text-ghost'>{title}</h3>
        {children}
      </div>
    </li>
  )
}

function ElectionRedo({ view }: { view: ProcessView }) {
  const { t } = useLingui()
  const config = useRuntimeConfig()
  const chain = useChain()
  const pid = view.process.id
  const registry = chain.registryAddress
  return (
    <ol className='flex flex-col gap-6' data-testid='election-redo'>
      <RedoStep n={1} title={t`Point at a node you trust`}>
        <CodeBlock code={`export RPC=${publicRpc(config.rpcUrls)}`} label={t`Copy the RPC variable`} />
      </RedoStep>
      <RedoStep n={2} title={t`Read the election and its batches`}>
        <Prose>
          <p>
            <Trans>
              The first command prints the registry’s record of the election: its status, key, list of voters, counts
              and current state fingerprint (state root). The second lists every recorded batch with the fingerprints it
              went from and to.
            </Trans>
          </p>
        </Prose>
        <CodeBlock
          code={[
            `cast call ${registry} \\`,
            `  "${GET_PROCESS}" \\`,
            `  ${pid} --rpc-url $RPC`,
            `cast logs --from-block ${view.process.createdBlock} --address ${registry} \\`,
            `  "${TRANSITION_EVENT}" \\`,
            `  ${pid} --rpc-url $RPC`,
          ].join('\n')}
          label={t`Copy the commands`}
        />
      </RedoStep>
      {view.process.state?.metadataURI ? (
        <RedoStep n={3} title={t`Check the description`}>
          <Prose>
            <p>
              <Trans>
                Take the fingerprint (SHA-256) of the document the election’s address serves and compare it with the
                fourteenth value of the registry’s record; then list every version the organizer set, with its block.
              </Trans>
            </p>
          </Prose>
          <CodeBlock
            code={[
              metadataHashCommand({ registry, processId: pid, uri: view.process.state.metadataURI }),
              metadataHistoryCommand({ registry, processId: pid, fromBlock: view.process.createdBlock }),
            ].join('\n')}
            label={t`Copy the commands`}
          />
        </RedoStep>
      ) : null}
      <RedoStep n={view.process.state?.metadataURI ? 4 : 3} title={t`Replay the whole election`}>
        <Prose>
          <p>
            <Trans>
              Run your own copy of the sequencer software without a signing key, as an{' '}
              <Term id='observer'>observer</Term>. It follows every election, downloads each batch’s data, rebuilds the
              state on your computer and accepts a batch only if it reaches the same fingerprint as the chain. That
              checks every batch, whoever sent it.
            </Trans>
          </p>
        </Prose>
        <CodeBlock
          code={observerCommand({
            chainId: config.chainId,
            registry,
            startBlock: config.startBlock,
            beaconUrl: config.beaconUpstream ?? config.beaconUrl ?? null,
          })}
          label={t`Copy the observer command`}
        />
      </RedoStep>
      <RedoStep n={view.process.state?.metadataURI ? 5 : 4} title={t`Check each batch on its own`}>
        <Prose>
          <p>
            <Trans>
              Each batch page lists the checks the registry made for it, each with the command that redoes it: the
              proof, the published data (blobs and their openings), the list of voters and the counts.
            </Trans>
          </p>
          <p>
            <Link to={paths.process(pid, 'transitions')} className='text-emerald hover:underline'>
              <Trans>All batches of this election</Trans>
            </Link>
          </p>
        </Prose>
      </RedoStep>
    </ol>
  )
}

function ElectionProves({ keyMode }: { keyMode: KeyModeName | null }) {
  const { i18n } = useLingui()
  return (
    <ProvesPanel
      testId='election-limits'
      proves={[
        <Trans key='rules'>
          Every ballot counted had a valid proof, a valid signature and a voter on the list of voters, and followed the
          election’s ballot rules.
        </Trans>,
        <Trans key='chain'>
          No batch was skipped, replayed or forked: each one starts where the previous one ended.
        </Trans>,
        <Trans key='fixed'>
          The rules, the key and the kind of list of voters are fixed from the start; an updatable list can only be
          replaced in the open, on the chain.
        </Trans>,
        <Trans key='result'>
          Once published, the results are the decryption of the encrypted total in the final state, nothing else.
        </Trans>,
        <Trans key='metadata'>
          The title, the question and the option names are the document the organizer recorded on the chain, when its
          check above passes. The organizer can change it only in the open, until voting ends, and a change made while
          voting was open is shown above: votes cast before it were cast under the previous version.
        </Trans>,
      ]}
      doesNot={[
        <Trans key='censor'>
          That every vote cast made it into a batch. A sequencer could ignore a vote; each voter can check their own in
          the vote check, and vote again through another sequencer.
        </Trans>,
        keyMode ? (
          <span key='key'>
            <Trans>That nobody can read a ballot.</Trans> {i18n._(WHO_CAN_DECRYPT[keyMode])}
          </span>
        ) : (
          <Trans key='key'>
            That nobody can read a ballot. Who could depends on the election: one sequencer, or a threshold of a key
            committee.
          </Trans>
        ),
        <Trans key='census'>
          That the list of voters is fair. Who is on it is the organizer’s decision; the checks only show the list was
          used as published.
        </Trans>,
        <Trans key='metadata-app'>
          That a voting app showed the committed description. The chain binds the document, not what an app puts on the
          screen.
        </Trans>,
      ]}
    >
      <OrganizerControls />
    </ProvesPanel>
  )
}

/** What the organizer can still do to a process, and what the key modes ask of them (the organizer's guide). */
function OrganizerControls() {
  const { t } = useLingui()
  const LINK = 'text-emerald hover:underline'
  return (
    <Disclosure summary={t`For organizers: your controls, and getting the results`} testId='organizer-controls'>
      <Prose>
        <p>
          <Trans>Only the organizer can make these calls; each one shows up in the election’s history.</Trans>
        </p>
        <ul className='flex list-disc flex-col gap-1.5 pl-5'>
          <li>
            <Trans>
              <code>setProcessStatus</code>: from Ready or Paused, to Paused, Ready, Canceled or Ended. Pausing stops
              batches from being recorded but not the clock; votes can still queue at a sequencer and be recorded after
              you resume. Ending by hand also shortens the duration to the time elapsed. Canceled and Results are final.
            </Trans>
          </li>
          <li>
            <Trans>
              <code>setProcessDuration</code>: only longer, while Ready or Paused and before the current end.
            </Trans>
          </li>
          <li>
            <Trans>
              <code>setProcessMaxVoters</code>: while Ready or Paused, never below the voters already counted.
            </Trans>
          </li>
          <li>
            <Trans>
              <code>setProcessCensus</code>: only for an updatable Merkle census (origin 2), before the end. Batches
              proven against the old list are no longer accepted.
            </Trans>
          </li>
          <li>
            <Trans>
              <code>setProcessMetadata</code>: a new document address and its SHA-256, while Ready or Paused and before
              the end; then the description is frozen. Every version stays on the log, and a change made while voting
              was open is flagged to everyone who checks the election.
            </Trans>
          </li>
        </ul>
        <p>
          <Trans>
            No batch is recorded after the end time. With a sequencer key, the node that holds the key publishes the
            results once the election has ended; it is the only one that can. With a key committee (a DKG key) anyone
            can ask the committee to decrypt, and sequencers do on their first heartbeat after the end; in locked mode
            the decryption waits for your reveal (<code>revealProcessKey</code> on the registry). The results tab shows
            how the results were produced.
          </Trans>
        </p>
        <ul className='flex list-disc flex-col gap-1.5 pl-5'>
          <li>
            <Trans>
              Keep the organizer secret of a locked election. Without it the committee never decrypts the results.
            </Trans>
          </li>
          <li>
            <Trans>
              A reveal works at any time, but revealing during voting drops the election to the automatic trust model.
            </Trans>
          </li>
        </ul>
        <p>
          <Trans>
            With a committee key, once a sequencer has requested the decryption the election is Ended and out of your
            hands, so it cannot be canceled after its results become readable. See{' '}
            <Link to={paths.learn('key-modes')} className={LINK}>
              key modes
            </Link>{' '}
            and{' '}
            <Link to={{ pathname: paths.learn('glossary'), hash: 'term-census' }} className={LINK}>
              lists of voters
            </Link>
            .
          </Trans>
        </p>
      </Prose>
    </Disclosure>
  )
}
