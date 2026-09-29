import type { ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Link, useSearchParams } from 'react-router'
import { CodeBlock, Disclosure } from '~components/code'
import { Formula } from '~components/Formula'
import { Term } from '~components/Term'
import { useRuntimeConfig } from '~config/config-context'
import { useChain, useIndexer, useProcess, useTransition, type ProcessView } from '~data/hooks'
import { votingOver } from '~indexer/selectors'
import { useMetadataCheck, useTrackerProof, useTransitionBlobs, useVoteInclusion, useVoteStatus } from '~data/queries'
import { useServices } from '~data/context'
import { Callout } from '~kit'
import { formatNumber } from '~lib/format'
import { publicRpc } from '~pages/contracts/model'
import { changedWhileOpen, metadataTitle } from '~pages/process/metadata'
import { useDkgResultsChecks, useSequencerResultsChecks } from '~pages/process/results-checks'
import { observerCommand } from '~pages/transition/commands'
import { formatVoteId } from '~protocol/blob'
import type { KeyModeName } from '~protocol/types'
import { paths } from '~routes/paths'
import { batchChecks } from '../batch'
import { ChecklistSummary } from '../checklist'
import { FlowFrame, FlowSection, Prose, ProvesPanel } from '../frame'
import { BallotIcon } from '../icons'
import { stepStates, type StepId, type StepState } from '../status'
import { WHO_CAN_DECRYPT } from '../words'
import { BatchCard, ElectionCard, ResultCard, SettledCard, TrackerCard } from './checks'
import { LookupForm } from './LookupForm'
import { validateLookup } from './lookup'
import { batchOutcome, chainFrom, electionOutcome, resultOutcome, settledOutcome, trackerOutcome } from './model'

/**
 * Verify → My vote (`/verify/vote?pid=&voteId=`): was this vote counted?
 * The election, the batch that recorded the vote, that batch's checks, the
 * results, and a sequencer's receipt (tracker proof).
 */
export function VerifyVotePage() {
  const { t } = useLingui()
  const [search] = useSearchParams()
  const pidInput = search.get('pid') ?? ''
  const voteInput = search.get('voteId') ?? ''
  const query = validateLookup(pidInput, voteInput)
  const asked = pidInput !== '' || voteInput !== ''
  const active = query.pid != null && query.voteId != null

  const choose = (
    <FlowSection
      id='choose'
      n={1}
      title={t`Choose your vote`}
      description={t`Enter the election and the vote id your voting app gave you when you voted.`}
    >
      <div className='flex flex-col gap-3'>
        <LookupForm key={`${pidInput}|${voteInput}`} initialPid={pidInput} initialVote={voteInput} />
        {asked && !active && query.voteId != null && !query.pid ? (
          <Callout title={t`Which election?`}>
            <Trans>Vote ids are unique within an election, so the check needs the election too. Pick it above.</Trans>
          </Callout>
        ) : asked && !active && pidInput !== '' && voteInput !== '' ? (
          <Callout tone='warn' title={t`This check’s address is not valid`}>
            {[query.pidError, query.voteError].filter(Boolean).join(' ')}
          </Callout>
        ) : null}
      </div>
    </FlowSection>
  )

  if (!active) {
    return (
      <VoteFrame
        states={stepStates(false, false)}
        choose={choose}
        checks={
          <p className='rounded-md border border-dashed border-charcoal p-5 text-[14px] text-ash'>
            <Trans>
              Enter your vote above. Five checks then run in your browser: the election, the batch that recorded your
              vote, that batch’s checks, the results and a sequencer’s receipt.
            </Trans>
          </p>
        }
        redo={
          <p className='rounded-md border border-dashed border-charcoal p-5 text-[14px] text-ash'>
            <Trans>The commands to repeat the checks appear here, filled in with your vote.</Trans>
          </p>
        }
        keyMode={null}
      />
    )
  }
  return <VoteChecks key={`${query.pid}|${query.voteId}`} pid={query.pid!} voteId={query.voteId!} choose={choose} />
}

function VoteFrame({
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
      testId='page-verify-vote'
      flow={t`My vote`}
      icon={<BallotIcon size={24} />}
      question={t`Was my vote counted?`}
      description={t`Follow your vote from your voting app to the published results. Every step is read from the chain by your browser, and each one tells you how to check it without this site.`}
      states={states}
      hints={hints}
    >
      {choose}
      <FlowSection
        id='check'
        n={2}
        title={t`Check`}
        description={t`Each card says what was checked and what the answer means for you. Open “How this is checked” for the details.`}
      >
        {checks}
      </FlowSection>
      <FlowSection
        id='redo'
        n={3}
        title={t`Redo it yourself`}
        description={t`The same checks from a terminal, without this site. You need an RPC node of your choice, Foundry’s cast and curl.`}
      >
        {redo}
      </FlowSection>
      <VoteProves keyMode={keyMode} />
    </FlowFrame>
  )
}

function VoteChecks({ pid, voteId, choose }: { pid: string; voteId: bigint; choose: ReactNode }) {
  const { t } = useLingui()
  const chain = useChain()
  const { status: indexer } = useIndexer()
  const services = useServices()
  const view = useProcess(pid)
  const known = view != null
  const statuses = useVoteStatus(known ? pid : undefined, known ? voteId : null)
  const inclusion = useVoteInclusion(known ? pid : undefined, known ? voteId : null)
  const tracker = useTrackerProof(known ? pid : undefined, known ? voteId : null)
  const found = inclusion.transitionIndex != null ? view?.transitions[inclusion.transitionIndex] : undefined
  const detail = useTransition(found ? pid : undefined, found?.index)
  // The search already fetched these blobs; this reads them back from the cache.
  const blobs = useTransitionBlobs(pid, found?.index, { enabled: found != null })
  const sequencerResults = useSequencerResultsChecks(view)
  const dkgResults = useDkgResultsChecks(view)
  const metadata = useMetadataCheck(view?.process.state?.metadataURI, view?.process.state?.metadataHash)
  const title = metadataTitle(metadata.doc)

  const indexing = indexer.phase === 'idle' || indexer.phase === 'loading' || indexer.scanning
  const election = electionOutcome({
    found: known,
    indexing,
    metadata: metadata.status,
    changedWhileOpen: view?.process.metadataHistory.some(changedWhileOpen) ?? false,
  })
  const reported = statuses.flatMap((s) => (s.status.data ? [s.status.data.status] : []))
  // Not while the indexer catches up: its clock runs ahead of the batches it has read.
  const over = view != null && !indexing && votingOver(view.row)
  const settled = settledOutcome(known, inclusion, view?.transitions.length ?? 0, reported, over)
  const checks = detail
    ? batchChecks(detail, {
        onchain: t`The proof and the published data were verified on the chain`,
        onchainCensus: t`The registry asked the contract that keeps the list of voters`,
      })
    : null
  const batch = batchOutcome(settled, checks ? checks.map((c) => c.state) : null)
  const chainAfter = view && found ? chainFrom(view.rootChain, found.index) : 'pending'
  const keyMode = view?.process.state?.keyMode ?? null
  const resultChecks = keyMode === 'sequencer' ? sequencerResults.checks : dkgResults.checks
  const result = resultOutcome(
    settled,
    view?.process.results != null,
    view?.row.phase === 'canceled',
    chainAfter,
    resultChecks.map((c) => c.state)
  )
  const trackerState = trackerOutcome({
    sequencers: services.sequencers.length,
    loading: tracker.isLoading,
    error: tracker.error != null,
    proof: tracker.data,
    settled,
  })
  const all = [election, settled.status, batch, result.status, trackerState.status]
  const decided = !all.includes('pending')

  const checked = formatNumber(inclusion.checked)
  const total = formatNumber(inclusion.total)
  const done = all.filter((s) => s !== 'pending').length
  const count = all.length
  const hints: Partial<Record<StepId, ReactNode>> = {
    choose: formatVoteId(voteId),
    check:
      inclusion.state === 'searching' ? t`${checked} of ${total} batches read` : t`${done} of ${count} checks decided`,
  }

  return (
    <VoteFrame
      states={stepStates(true, decided)}
      hints={hints}
      choose={choose}
      keyMode={keyMode}
      checks={
        <div className='flex flex-col gap-4'>
          <ChecklistSummary statuses={all} testId='vote-summary' />
          <ul className='flex flex-col gap-3' data-testid='vote-checks'>
            <ElectionCard
              pid={pid}
              view={view}
              status={election}
              title={title}
              metadata={metadata}
              registry={chain.registryAddress}
            />
            <SettledCard
              pid={pid}
              settled={settled}
              inclusion={inclusion}
              found={found}
              batches={view?.transitions.length ?? 0}
              statuses={statuses}
              blobs={blobs.data}
              over={over}
            />
            <BatchCard pid={pid} status={batch} checks={checks} found={found} />
            <ResultCard
              pid={pid}
              view={view}
              status={result.status}
              reason={result.reason}
              found={found}
              chain={chainAfter}
              resultChecks={resultChecks}
            />
            <TrackerCard
              pid={pid}
              voteId={voteId}
              status={trackerState.status}
              reason={trackerState.reason}
              tracker={tracker}
              transitions={view?.transitions ?? []}
              genesisRoot={view?.process.genesisRoot ?? null}
            />
          </ul>
        </div>
      }
      redo={
        <VoteRedo
          pid={pid}
          voteId={voteId}
          view={view}
          tx={found?.tx ?? null}
          tracker={tracker.data?.sequencer.upstream}
        />
      }
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

function VoteRedo({
  pid,
  voteId,
  view,
  tx,
  tracker,
}: {
  pid: string
  voteId: bigint
  view: ProcessView | null
  tx: string | null
  tracker: string | undefined
}) {
  const { t } = useLingui()
  const config = useRuntimeConfig()
  const chain = useChain()
  const rpc = publicRpc(config.rpcUrls)
  const steps: Array<{ title: ReactNode; body: ReactNode }> = [
    {
      title: t`Point at a node you trust`,
      body: (
        <>
          <Prose>
            <p>
              <Trans>
                Any RPC node of this chain gives the same answers. Use your own, or a provider you pick, rather than the
                one this site reads from. The commands below read its address from <code>$RPC</code>.
              </Trans>
            </p>
          </Prose>
          <CodeBlock code={`export RPC=${rpc}`} label={t`Copy the RPC variable`} />
        </>
      ),
    },
  ]
  if (tx) {
    steps.push({
      title: t`Read the batch that recorded your vote`,
      body: (
        <>
          <Prose>
            <p>
              <Trans>
                The transaction’s receipt shows the batch was accepted (status 1) and the new state fingerprint (state
                root); the transaction lists the fingerprints of the data blobs that carry your vote id (their versioned
                hashes).
              </Trans>
            </p>
          </Prose>
          <CodeBlock
            code={[`cast receipt ${tx} --rpc-url $RPC`, `cast tx ${tx} blobVersionedHashes --rpc-url $RPC`].join('\n')}
            label={t`Copy the commands`}
          />
        </>
      ),
    })
  }
  if (tracker) {
    steps.push({
      title: t`Ask a sequencer for your receipt`,
      body: (
        <CodeBlock
          code={`curl ${tracker.replace(/\/+$/, '')}/votes/${pid}/voteId/${formatVoteId(voteId)}/proof`}
          label={t`Copy the command`}
        />
      ),
    })
  }
  steps.push({
    title: t`Replay the whole election`,
    body: (
      <>
        <Prose>
          <p>
            <Trans>
              Run your own copy of the sequencer software without a signing key, as an observer. It downloads every
              batch’s data, rebuilds the election’s state on your computer and checks each batch against the chain. Your
              vote id is then in your own copy of the state.
            </Trans>
          </p>
        </Prose>
        <CodeBlock
          code={observerCommand({
            chainId: config.chainId,
            registry: chain.registryAddress,
            startBlock: view?.process.createdBlock ?? config.startBlock,
            beaconUrl: config.beaconUpstream ?? config.beaconUrl ?? null,
          })}
          label={t`Copy the observer command`}
        />
      </>
    ),
  })
  return (
    <ol className='flex flex-col gap-6' data-testid='vote-redo'>
      {steps.map((s, i) => (
        <RedoStep key={i} n={i + 1} title={s.title}>
          {s.body}
        </RedoStep>
      ))}
    </ol>
  )
}

function VoteProves({ keyMode }: { keyMode: KeyModeName | null }) {
  const { i18n, t } = useLingui()
  return (
    <ProvesPanel
      testId='vote-explainers'
      proves={[
        <Trans key='valid'>
          Your ballot was accepted: its proof, its signature and your place on the list of voters passed every check,
          and it was added to the encrypted total.
        </Trans>,
        <Trans key='kept'>
          It is kept: your vote id is part of the election’s state that the registry recorded, and later batches can
          only build on that state.
        </Trans>,
        <Trans key='counted'>
          Once the results are out, they are the decryption of a total that includes your ballot.
        </Trans>,
      ]}
      doesNot={[
        <Trans key='what'>
          What you voted. Your ballot stays encrypted: nobody reading the chain, you included, can see or prove what is
          in it.
        </Trans>,
        <Trans key='latest'>
          That this ballot is the one that counts. If you vote again, the newer ballot replaces it, and the old vote id
          still shows as included.
        </Trans>,
        keyMode ? (
          <span key='key'>
            <Trans>That nobody can read your ballot.</Trans> {i18n._(WHO_CAN_DECRYPT[keyMode])}
          </span>
        ) : (
          <Trans key='key'>
            That nobody can read your ballot. Who could depends on the election: one sequencer, or a threshold of a key
            committee.
          </Trans>
        ),
        <Trans key='public'>
          That nobody knows you voted. The first time your ballot slot is written is public, and when the list of voters
          is published (a Merkle census), the slot follows from your address. Whether you voted again stays hidden: a
          changed vote looks like a routine silent refresh.
        </Trans>,
      ]}
    >
      <Disclosure summary={t`Why the ballot on the chain is not the one you sent`}>
        <Prose>
          <p>
            <Trans>
              Before storing your ballot, the sequencer re-encrypts it: the ballot looks completely different, but the
              vote inside does not change. The proof checks that the stored ballot is exactly a{' '}
              <Term id='re-encryption'>re-encryption</Term> of the ballot your own proof covers.
            </Trans>
          </p>
          <p>
            <Trans>
              That is what keeps your vote private even from you: nobody can match the ballot you sent to the stored
              one, so you cannot prove which ballot your slot holds. It does not hide whose slot it is, though: the
              sequencer that sealed the batch could match them, and with a Merkle census the slot follows from your
              address.
            </Trans>
          </p>
          <p className='text-[13px]'>
            <Trans>
              Technically, the sequencer adds an encryption of zero under the election key to every encrypted value. The
              randomness comes from a secret seed it draws for each batch and never writes down, and no scalar is used
              twice. The prover deletes its copy of the seed only when it runs without{' '}
              <code>DAVINCI_KEEP_INPUTS=1</code>, an operator setting nothing on the chain shows.
            </Trans>
          </p>
        </Prose>
      </Disclosure>
      <Disclosure summary={t`Voting again, and the silent refreshes`}>
        <Prose>
          <p>
            <Trans>
              You can vote again while the election is open. The new ballot replaces the old one in your slot, and the
              encrypted total subtracts the old ballot and adds the new one.
            </Trans>
          </p>
          <p>
            <Trans>
              Every batch also re-encrypts a random sample of other ballots it did not change (a{' '}
              <Term id='silent-refresh'>silent refresh</Term>), and adds an encryption of zero to the encrypted total
              for each, which changes nothing. In the published data a changed vote and a silent refresh look the same:
              a slot whose encrypted values changed. Nobody watching the chain can tell whether you voted again or your
              slot was only refreshed, so a changed vote stays deniable.
            </Trans>
          </p>
          <p>
            <Trans>
              What stays public is how many votes each batch changed, and the first time a slot appears, since silent
              refreshes only touch slots already written. With a Merkle census the slot follows from your address, so
              that you voted, and when, is public too.
            </Trans>
          </p>
          <p>
            <Link to={paths.learn('silent-revoting')} className='text-emerald hover:underline'>
              <Trans>Changing your vote, re-encryption and silent refreshes, in the guide</Trans>
            </Link>
          </p>
        </Prose>
      </Disclosure>
      <Disclosure summary={t`Where your vote id comes from, and where the list of votes comes from`}>
        <Prose>
          <p>
            <Trans>
              Your voting app makes the <Term id='vote-id'>vote id</Term> from the election, your address and a secret
              random number of your ballot (k), so a new ballot gets a new vote id. It is a Poseidon hash cut to 63
              bits, in the upper half of the 64-bit range:
            </Trans>
          </p>
          <Formula block expr='voteId = 2^63 + (Poseidon(processId, address, k) mod 2^63)' />
          <p>
            <Trans>
              The list of vote ids a batch added is read from its published data (its blobs). A blob from the beacon is
              tied to the transaction by its versioned hash. One from a sequencer’s archive is tied by position only,
              not checked against the transaction’s blob hashes; the check “Your vote was recorded on the chain” says
              which. In a small batch the new vote ids and the slots they wrote can still be matched, since both lists
              are public.
            </Trans>
          </p>
        </Prose>
      </Disclosure>
    </ProvesPanel>
  )
}
