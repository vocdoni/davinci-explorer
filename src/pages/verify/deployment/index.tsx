import { useMemo } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { CheckMark, Term } from '~components'
import { Disclosure } from '~components/code'
import { Formula } from '~components/Formula'
import { useRuntimeConfig } from '~config/config-context'
import { useDeploymentDetails } from '~data/deployment'
import { useChain, useReleaseCheck } from '~data/hooks'
import { Address, Badge, Card, Hash, KeyValue } from '~kit'
import { formatDate } from '~lib/format'
import { DkgPhaseBadge } from '~pages/contracts/DkgPanel'
import {
  castCommands,
  contractRows,
  DKG_VERIFIER_LABELS,
  PIN_DETAILS,
  publicRpc,
  releaseVerdict,
  wiringChecks,
} from '~pages/contracts/model'
import { SourceLink } from '~pages/contracts/parts'
import { PIN_LABELS } from '~protocol/releases'
import { paths } from '~routes/paths'
import { CheckCard, CheckGroup, ChecklistSummary, Compared, HowPart, RedoCommand, StatusDisc } from '../checklist'
import { FlowFrame, FlowSection, Prose, ProvesPanel } from '../frame'
import { ShieldIcon } from '../icons'
import { fromCheckState, stepStates, type VerifyStatus } from '../status'
import { dkgStatus, PIN_PLAIN, pinState, releaseStatus, verifierStates, wiringStatus } from './model'
import { RedoPanel } from './RedoPanel'

const LINK = 'text-emerald hover:underline'

/**
 * Verify → The deployment (`/verify/deployment`): the registry's pins against
 * the known releases, how the contracts point at each other and where their
 * source is, the DKG committee's verifiers, and the commands to redo it all.
 */
export function VerifyDeploymentPage() {
  const { i18n, t } = useLingui()
  const config = useRuntimeConfig()
  const chain = useChain()
  const match = useReleaseCheck()
  const details = useDeploymentDetails()
  const rows = useMemo(() => contractRows(chain, details.data), [chain, details.data])
  const wiring = useMemo(() => wiringChecks(chain, details.data, config.chainId), [chain, details.data, config.chainId])
  const r = chain.registry
  const rpc = publicRpc(config.rpcUrls)
  const hasAdapter = r ? r.dkgAdapter != null : null
  const dkg = details.data?.dkg

  const release = releaseStatus(match)
  const contracts = wiringStatus(wiring.map((c) => c.state))
  const committee = dkgStatus(hasAdapter, dkg)
  const all: VerifyStatus[] = [release, contracts, committee]
  const decided = !all.includes('pending')

  const networkName = config.networkName
  const chainId = config.chainId
  const releaseLabel = match.release?.label ?? match.closest?.label
  const verdict = releaseVerdict(match)
  const withAddress = rows.filter((row) => row.address != null).length
  const passedWiring = wiring.filter((c) => c.state === 'pass').length
  const totalWiring = wiring.length
  const epoch = dkg?.newestEpoch
  const nonce = epoch?.nonce
  const threshold = epoch?.threshold
  const committeeSize = epoch?.committeeSize

  return (
    <FlowFrame
      testId='page-verify-deployment'
      flow={t`The deployment`}
      icon={<ShieldIcon size={24} />}
      question={t`Is this the real DAVINCI, running the published code?`}
      description={t`The contracts decide which proofs they accept. These checks show they only accept proofs of the released DAVINCI programs, that they are wired to each other as published, and that the decryption committee checks the published circuits.`}
      states={stepStates(true, decided)}
      hints={{ choose: networkName, check: releaseLabel }}
    >
      <FlowSection
        id='choose'
        n={1}
        title={t`The deployment`}
        description={t`The one this explorer is set up to read. There is nothing to choose: to check another deployment, run the explorer against it.`}
      >
        <Card className='p-5'>
          <KeyValue
            items={[
              { label: t`Network`, value: `${networkName} · ${chainId}` },
              {
                label: t`ProcessRegistry`,
                value: (
                  <span className='inline-flex items-center gap-1'>
                    <Address value={chain.registryAddress} chars={6} />
                    <SourceLink address={chain.registryAddress} />
                  </span>
                ),
                hint: t`The contract every election lives on; the others hang off it.`,
              },
            ]}
          />
        </Card>
      </FlowSection>

      <FlowSection
        id='check'
        n={2}
        title={t`Check`}
        description={t`Each card says what was checked and what the answer means. Open “How this is checked” for the values compared and the command.`}
      >
        <div className='flex flex-col gap-6'>
          <ChecklistSummary statuses={all} testId='deployment-summary' />

          <CheckGroup title={t`The programs it accepts`}>
            <CheckCard
              id='release'
              status={release}
              title={t`The registry runs a published release`}
              statusLabel={release === 'fail' ? t`Differs` : undefined}
              summary={
                match.release ? (
                  <Trans>
                    All five values the contracts check proofs against are the ones published with {releaseLabel}. They
                    are fixed at deployment and can never change.
                  </Trans>
                ) : (
                  i18n._(verdict.text)
                )
              }
              how={
                <>
                  <p>
                    <Trans>
                      A proof only convinces the registry if it was made for the right program. The registry stores
                      these values when it is deployed and has no way to change them. The explorer reads them and
                      compares them with the ones davinci-zkvm published for each release; it knows the releases it was
                      built with, so an unknown value may also be a newer release.
                    </Trans>
                  </p>
                  <p>
                    <Trans>
                      The verifier hashes the program’s fingerprint (its <Term id='program-vk'>program vk</Term>) and
                      the <Term id='root-c-vadcop-final'>proving setup</Term> into what the proof must match, so a proof
                      of any other program, or made with another setup, is refused:
                    </Trans>
                  </p>
                  <Formula block expr='publicInput = sha256(programVK ‖ publicValues ‖ rootCVadcopFinal)' />
                  <HowPart title={t`What a difference would mean`}>
                    <ul className='flex flex-col gap-1.5'>
                      {match.checks.map((c) => (
                        <li key={c.pin}>
                          <span className='text-silver'>{PIN_LABELS[c.pin]}</span> <code>{c.pin}</code>:{' '}
                          {i18n._(PIN_DETAILS[c.pin].mismatch)}
                        </li>
                      ))}
                    </ul>
                  </HowPart>
                  <RedoCommand
                    note={
                      <Trans>
                        The same reads with Foundry’s cast; the last line hashes the verifier’s code. The full script,
                        which also rebuilds the contracts, is under Redo it yourself.
                      </Trans>
                    }
                    code={castCommands(rpc, chain.registryAddress, r?.ziskVerifier ?? null)}
                    label={t`Copy the cast commands`}
                  />
                </>
              }
            >
              <ul
                className='flex flex-col divide-y divide-charcoal rounded-md border border-charcoal'
                data-testid='release-pins'
              >
                {match.checks.map((c) => {
                  const state = pinState(c.ok)
                  return (
                    <li key={c.pin} data-testid={`pin-${c.pin}`} data-state={state} className='flex gap-3 p-3'>
                      <StatusDisc status={fromCheckState(state)} size='sm' />
                      <div className='min-w-0 flex-1'>
                        <div className='flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5'>
                          <span className='text-[13px] font-medium text-ghost'>{PIN_LABELS[c.pin]}</span>
                          <code className='text-[11px] text-ash'>{c.pin}</code>
                        </div>
                        <p className='mt-0.5 text-[12px] leading-relaxed text-pewter'>{i18n._(PIN_PLAIN[c.pin])}</p>
                        <dl className='mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[12px]'>
                          <dt className='text-ash'>
                            <Trans>On chain</Trans>
                          </dt>
                          <dd className='min-w-0'>{c.actual ? <Hash value={c.actual} chars={10} /> : '…'}</dd>
                          <dt className='text-ash'>
                            <Trans>Published</Trans>
                          </dt>
                          <dd className='min-w-0'>
                            <Hash value={c.expected} chars={10} />
                          </dd>
                        </dl>
                      </div>
                    </li>
                  )
                })}
              </ul>
              {match.closest ? (
                <ReleaseNote
                  label={match.closest.label}
                  date={match.closest.date}
                  commit={match.closest.commit}
                  zisk={match.closest.zisk}
                />
              ) : null}
            </CheckCard>
          </CheckGroup>

          <CheckGroup title={t`The contracts`}>
            <CheckCard
              id='contracts'
              status={contracts}
              title={t`The contracts are wired together as published`}
              summary={
                contracts === 'pass' ? (
                  <Trans>
                    Each contract names the others it should, read back from the contracts themselves. Compare each
                    one’s published source code below with the repositories.
                  </Trans>
                ) : contracts === 'fail' ? (
                  <Trans>A contract points somewhere it should not. The details say which.</Trans>
                ) : (
                  <Trans>Reading the contracts…</Trans>
                )
              }
              how={
                <>
                  <p>
                    <Trans>
                      A copied address, or a registry connected to the wrong committee, would show up here: the explorer
                      reads from each contract which other contracts it uses, and compares.
                    </Trans>
                  </p>
                  <ul className='flex flex-col gap-2' data-testid='wiring-checks'>
                    {wiring.map((c) => (
                      <li key={c.id} className='flex items-start gap-2'>
                        <CheckMark state={c.state} className='mt-0.5' />
                        <div className='min-w-0'>
                          <div className='text-[13px] text-silver'>{i18n._(c.label)}</div>
                          <div className='text-[12px] break-words text-ash'>{i18n._(c.detail)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p>
                    <Trans>
                      The contracts page lists the same addresses with every parameter they hold, for reference:{' '}
                      <Link to={paths.contracts()} className={LINK}>
                        contracts and parameters
                      </Link>
                      .
                    </Trans>
                  </p>
                </>
              }
            >
              <p className='mb-2 text-[12px] text-ash'>
                <Trans>
                  {passedWiring} of {totalWiring} links consistent ·{' '}
                  <Plural value={withAddress} one='# contract' other='# contracts' />, each with its verified source on
                  the block explorer
                </Trans>
              </p>
              <ul className='flex flex-col divide-y divide-charcoal rounded-md border border-charcoal'>
                {rows.map((row) => (
                  <li
                    key={row.id}
                    data-testid={`contract-row-${row.id}`}
                    className='flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4'
                  >
                    <span className='flex min-w-0 items-center gap-2'>
                      <span className='text-[13px] text-ghost'>{row.name}</span>
                      {row.group === 'dkg' ? (
                        <Badge size='sm' tone='neutral'>
                          davinci-dkg
                        </Badge>
                      ) : null}
                    </span>
                    {row.address ? (
                      <span className='flex min-w-0 items-center gap-1'>
                        <Address value={row.address} chars={6} />
                        <SourceLink address={row.address} />
                      </span>
                    ) : row.note ? (
                      <span className='text-[12px] text-ash sm:max-w-xs sm:text-right'>{i18n._(row.note)}</span>
                    ) : (
                      <span className='text-[12px] text-ash'>…</span>
                    )}
                  </li>
                ))}
              </ul>
            </CheckCard>
          </CheckGroup>

          <CheckGroup title={t`The decryption committee`}>
            <CheckCard
              id='dkg'
              status={committee}
              title={t`The committee checks proofs of the published circuits`}
              statusLabel={hasAdapter === false ? t`Not used` : undefined}
              summary={
                hasAdapter === false ? (
                  <Trans>
                    This registry was deployed without a DKG committee, so every election here uses a sequencer key.
                  </Trans>
                ) : !dkg ? (
                  details.error ? (
                    <Trans>The committee’s contracts could not be read.</Trans>
                  ) : (
                    <Trans>Reading the committee’s contracts…</Trans>
                  )
                ) : epoch ? (
                  <span className='inline-flex flex-wrap items-center gap-x-2 gap-y-1'>
                    <span>
                      <Trans>
                        Every step of the committee is checked against the published circuits. Its newest epoch, #
                        {nonce}, has {committeeSize} members, and any {threshold} of them can decrypt.
                      </Trans>
                    </span>
                    <DkgPhaseBadge phase={epoch.phase} />
                  </span>
                ) : (
                  <Trans>
                    Every step of the committee is checked against the published circuits. No epoch exists yet.
                  </Trans>
                )
              }
              how={
                dkg ? (
                  <>
                    <p>
                      <Trans>
                        Elections in the DKG key modes are decrypted by a <Term id='committee'>committee</Term>. Every
                        step it takes comes with a proof, checked by one of four verifier contracts. Each verifier
                        reports the fingerprint of the circuit key it accepts, and the explorer compares them with the
                        published davinci-dkg circuits.
                      </Trans>
                    </p>
                    <p className='text-[12px]'>
                      <Trans>
                        The steps are dealing key shares, finalizing an epoch, decrypting a share and combining the
                        shares; each proof is a Groth16 proof, and the reference is the davinci-dkg circuits-v6 release.
                      </Trans>
                    </p>
                    <ul className='flex flex-col gap-2'>
                      {verifierStates(dkg).map((v) => {
                        const view = dkg.verifiers.find((x) => x.name === v.name)
                        return (
                          <li key={v.name} className='flex items-start gap-2' data-testid={`dkg-verifier-${v.name}`}>
                            <CheckMark state={v.state} className='mt-0.5' />
                            <div className='min-w-0'>
                              <div className='text-[13px] text-silver'>{DKG_VERIFIER_LABELS[v.name].name}</div>
                              <div className='text-[12px] text-ash'>{i18n._(DKG_VERIFIER_LABELS[v.name].role)}</div>
                              {view?.keyHash ? (
                                <Compared
                                  rows={[{ label: t`Key hash`, value: <Hash value={view.keyHash} chars={10} /> }]}
                                />
                              ) : null}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                    <p>
                      <Trans>
                        The committee, its members, the epoch cadence and who may register are on the{' '}
                        <Link to={`${paths.contracts()}#dkg`} className={LINK}>
                          contracts page
                        </Link>
                        .
                      </Trans>
                    </p>
                  </>
                ) : undefined
              }
            />
          </CheckGroup>
        </div>
      </FlowSection>

      <FlowSection
        id='redo'
        n={3}
        title={t`Redo it yourself`}
        description={t`Everything above is read in your browser from the RPC the explorer is configured with. These commands run the same checks from a terminal, against a build of the source.`}
      >
        <RedoPanel chain={chain} rpc={rpc} match={match} />
      </FlowSection>

      <ProvesPanel
        testId='deployment-limits'
        proves={[
          <Trans key='programs'>
            Every batch of votes, and every result of a sequencer-key election, is recorded only with a proof of the
            released programs, made with the released setup and checked by the released verifier code.
          </Trans>,
          <Trans key='ballots'>Only ballots proven with the released ballot circuit are accepted.</Trans>,
          <Trans key='wiring'>
            The registry, its verifier and the committee’s contracts point at each other as the published deployment
            does.
          </Trans>,
        ]}
        doesNot={[
          <Trans key='source'>
            That the code at these addresses is the published source. The block explorer’s verified source and the
            script under Redo it yourself, which compares the deployed code with a build, do that.
          </Trans>,
          <Trans key='sound'>
            That the released programs and contracts are free of bugs. That is what their source, audits and tests are
            for.
          </Trans>,
          <Trans key='latest'>
            That the release is the newest. The explorer knows the releases it was built with; a value it does not
            recognise may be a newer one, to check against the davinci-zkvm release notes.
          </Trans>,
          <Trans key='committee'>
            That the committee members will not collude. In the DKG key modes a threshold of them acting together could
            open ballots.
          </Trans>,
        ]}
      >
        <Disclosure summary={t`What the explorer does not do for you`} testId='explorer-limits'>
          <Prose>
            <ul className='flex list-disc flex-col gap-1.5 pl-5'>
              <li>
                <Trans>
                  It does not check the proofs again in your browser (the PLONK proofs, and the KZG openings of the
                  published data); the registry did, on the chain.
                </Trans>
              </li>
              <li>
                <Trans>
                  It does not recompute a blob’s fingerprint (its KZG commitment) from its bytes. A blob from the beacon
                  is tied to its transaction by that commitment’s versioned hash; one from a sequencer’s archive only by
                  position, and the page says so.
                </Trans>
              </li>
              <li>
                <Trans>
                  Its release table is the one it was built with. A pin it does not recognise may be a newer release;
                  check it against the davinci-zkvm source.
                </Trans>
              </li>
            </ul>
          </Prose>
        </Disclosure>
      </ProvesPanel>
    </FlowFrame>
  )
}

function ReleaseNote({ label, date, commit, zisk }: { label: string; date: string; commit: string; zisk: string }) {
  const frozen = formatDate(date)
  return (
    <Prose className='mt-2 text-[12px]'>
      <p>
        <Trans>
          {label}: values frozen on {frozen} at davinci-zkvm commit <code>{commit}</code>, proofs made with ZisK {zisk}.
        </Trans>
      </p>
    </Prose>
  )
}
