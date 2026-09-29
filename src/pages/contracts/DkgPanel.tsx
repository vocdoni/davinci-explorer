import type { MessageDescriptor } from '@lingui/core'
import { msg, plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { CheckMark, Timestamp } from '~components'
import { useRuntimeConfig } from '~config/config-context'
import {
  DKG_CIRCUITS_V6_KEY_HASHES,
  DKG_POOL_KEYS,
  type DkgDeployment,
  type DkgEpochPhase,
  type DkgEpochView,
} from '~data/deployment'
import type { ChainMeta } from '~indexer/types'
import {
  Address,
  Badge,
  BlockCell,
  Callout,
  ExternalIcon,
  Hash,
  KeyValue,
  Panel,
  SkeletonText,
  StatCell,
  StatRow,
  type BadgeTone,
} from '~kit'
import { formatDuration, formatNumber } from '~lib/format'
import { paths } from '~routes/paths'
import { Formula } from '~components/Formula'
import { RichText } from '~components/RichText'
import { Term } from '~components/Term'
import { DKG_VERIFIER_LABELS, dkgExplorerLink } from './model'
import { Code, SourceLink, SubHeading, TechnicalToggle } from './parts'

const PHASES: Record<DkgEpochPhase, { label: MessageDescriptor; tone: BadgeTone; description: MessageDescriptor }> = {
  none: {
    label: msg`Not created`,
    tone: 'neutral',
    description: msg`No epoch of the committee has been created yet.`,
  },
  'committee-selection': {
    label: msg`Committee selection`,
    tone: 'warn',
    description: msg`The committee is being drawn by lottery: eligible operators claim seats until all n are filled.`,
  },
  'key-assembly': {
    label: msg`Key assembly`,
    tone: 'warn',
    description: msg`Each member submits one contribution, with a proof, that deals its shares of all 16 pool keys.`,
  },
  live: {
    label: msg`Live`,
    tone: 'ok',
    description: msg`The epoch’s keys are ready (finalizeEpoch stored all 16 pool keys): applications can register, submit encrypted values and get them decrypted.`,
  },
  aborted: {
    label: msg`Aborted`,
    tone: 'danger',
    description: msg`The committee did not fill in time, or too few members contributed during key assembly, so this epoch serves nobody. The nodes create the next one.`,
  },
  completed: {
    label: msg`Completed`,
    tone: 'neutral',
    description: msg`Reserved by the contract; not used.`,
  },
}

export function DkgPhaseBadge({ phase }: { phase: DkgEpochPhase }) {
  const { i18n } = useLingui()
  const p = PHASES[phase]
  return (
    <Badge tone={p.tone} dot={phase === 'live'} title={i18n._(p.description)}>
      {i18n._(p.label)}
    </Badge>
  )
}

function ExternalText({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target='_blank'
      rel='noreferrer noopener'
      className='inline-flex items-center gap-1 text-[12px] text-pewter hover:text-emerald'
    >
      {children}
      <ExternalIcon size={12} />
    </a>
  )
}

/** Unix time of a future or past block, from the head and the average block time. */
function blockTime(chain: ChainMeta, block: number): number | null {
  if (chain.headTimestamp == null) return null
  return chain.headTimestamp + (block - chain.headBlock) * chain.blockTimeSeconds
}

export function DkgPanel({
  chain,
  dkg,
  loading,
  error,
  technical = false,
  onTechnical,
}: {
  chain: ChainMeta
  dkg: DkgDeployment | null | undefined
  loading: boolean
  error: string | null
  /** Show the mechanism: contract calls, circuits, the exact rules. */
  technical?: boolean
  onTechnical?: (on: boolean) => void
}) {
  const { i18n, t } = useLingui()
  const config = useRuntimeConfig()
  const r = chain.registry
  const title = t`DKG committee`
  const label = t`Threshold keys`
  const description = t`The group of independent operators (davinci-dkg) that holds the keys of DKG-mode processes and decrypts their final totals. No single operator knows a key.`

  if (r && !r.dkgAdapter) {
    return (
      <Panel title={title} label={label} description={description}>
        <Callout title={t`The DKG key modes are disabled on this registry`}>
          <Trans>
            It was deployed without a key committee, so every process here uses a sequencer key. Creating one in a DKG
            mode is refused: there is no adapter, and <Code>newProcess</Code> reverts with <Code>DKGDisabled</Code>.
          </Trans>
        </Callout>
      </Panel>
    )
  }
  if (!dkg) {
    return (
      <Panel title={title} label={label} description={description}>
        {error && !loading ? (
          <Callout tone='warn' title={t`Could not read the DKG contracts`}>
            {error}
          </Callout>
        ) : (
          <SkeletonText lines={5} className='max-w-xl' />
        )}
      </Panel>
    )
  }

  const e = dkg.newestEpoch
  const epochLink = e ? dkgExplorerLink(config.dkgExplorerUrl, 'epoch', e.id) : null
  const nextStart = dkg.nextEpochStartBlock
  // Named, so the catalog shows the translator what each placeholder is.
  const nonce = e?.nonce
  const threshold = e?.threshold
  const committeeSize = e?.committeeSize
  const registered = formatNumber(dkg.nodeCount)
  const blocks = (blockCount: number) => {
    const duration = formatDuration(blockCount * chain.blockTimeSeconds)
    return t`${plural(blockCount, { one: '# block', other: '# blocks' })} · ~${duration}`
  }
  const minThreshold = dkg.minThreshold
  const minCommitteeSize = dkg.minCommitteeSize
  // The bounds are numbers in a formula: never translated, formatted as they are.
  const maxAlpha = String((dkg.maxLotteryAlphaBps ?? 0) / 10_000)
  return (
    <Panel
      title={title}
      label={label}
      description={description}
      actions={
        config.dkgExplorerUrl || onTechnical ? (
          <div className='flex flex-wrap items-center gap-x-5 gap-y-2'>
            {config.dkgExplorerUrl ? <ExternalText href={config.dkgExplorerUrl}>{t`DKG explorer`}</ExternalText> : null}
            {onTechnical ? <TechnicalToggle checked={technical} onChange={onTechnical} /> : null}
          </div>
        ) : undefined
      }
    >
      <StatRow>
        <StatCell
          label={t`Newest epoch`}
          value={e ? t`#${nonce}` : t({ message: 'none', context: 'no epoch' })}
          hint={e ? i18n._(PHASES[e.phase].label) : t`no epoch created yet`}
          mono
        />
        <StatCell
          label={t`Threshold`}
          value={e ? t`${threshold} of ${committeeSize}` : '—'}
          hint={t`members needed to decrypt`}
          mono
        />
        <StatCell
          label={t`Pool keys claimed`}
          value={e?.poolKeysClaimed != null ? `${e.poolKeysClaimed} / ${DKG_POOL_KEYS}` : '—'}
          hint={t`one per application`}
          mono
        />
        <StatCell
          label={t`Operators`}
          value={dkg.activeCount != null ? formatNumber(dkg.activeCount) : '—'}
          hint={dkg.nodeCount != null ? t`active, of ${registered} registered` : t`active`}
          mono
        />
      </StatRow>

      {e ? <EpochDetails epoch={e} epochLink={epochLink} technical={technical} /> : null}

      <div className='mt-6 grid gap-6 lg:grid-cols-2'>
        <div>
          <SubHeading>
            <Trans>Where a new DKG process gets its key</Trans>
          </SubHeading>
          <div className='mt-2 text-[13px] leading-relaxed text-ash' data-testid='registration-epoch'>
            {dkg.registrationEpoch ? (
              <>
                <p>
                  <Trans>
                    A <span className='text-silver'>DKG automatic</span> process created now takes the next free{' '}
                    <Term id='pool-key'>pool key</Term> of <Term id='epoch'>epoch</Term>{' '}
                    <Hash value={dkg.registrationEpoch} chars={8} className='align-middle' />, the newest Live epoch
                    with a free key (the adapter’s <Code>registrationEpoch()</Code>). A{' '}
                    <span className='text-silver'>DKG locked</span> process names its epoch itself.
                  </Trans>
                </p>
                {technical ? (
                  <p className='mt-1.5 text-[12px]'>
                    <Trans>
                      <Code>registrationEpoch()</Code> returns the newest Live epoch with a free pool key, looking back
                      at most 8 epochs. A locked process names its epoch because the organizer’s proof of possession
                      binds it; clients read the same value.
                    </Trans>
                  </p>
                ) : null}
              </>
            ) : dkg.registrationEpochReverted ? (
              <Trans>
                None of the last 8 epochs is Live with a free pool key, so <Code>registrationEpoch()</Code> reverts and
                new automatic processes are refused (<Code>NoLiveEpoch</Code>) until a new epoch is Live. Locked
                processes name their epoch and are unaffected.
              </Trans>
            ) : (
              '…'
            )}
          </div>
        </div>
        <div>
          <SubHeading>
            <Trans>Epoch cadence</Trans>
          </SubHeading>
          <KeyValue
            className='mt-1'
            items={[
              {
                label: t`Epoch length`,
                value: dkg.epochDurationBlocks != null ? blocks(dkg.epochDurationBlocks) : '…',
              },
              {
                label: t`Next epoch possible from`,
                value:
                  nextStart != null ? (
                    <span className='inline-flex items-center gap-2'>
                      <BlockCell block={nextStart} />
                      <Timestamp value={blockTime(chain, nextStart)} className='text-[12px] text-ash' />
                    </span>
                  ) : (
                    '…'
                  ),
                hint: t`or earlier, once the newest epoch has nearly run out of pool keys or was aborted`,
              },
              {
                label: t`Epoch policy bounds`,
                value:
                  minThreshold != null ? (
                    <Formula expr={`t ≥ ${minThreshold}, n ≥ ${minCommitteeSize}, 1 ≤ α ≤ ${maxAlpha}`} />
                  ) : (
                    '…'
                  ),
                hint: t`whoever creates an epoch picks the threshold t, the committee size n and the lottery factor α within these`,
              },
              {
                label: t`Inactivity window`,
                value: dkg.inactivityWindow != null ? blocks(dkg.inactivityWindow) : '…',
                hint: t`an operator silent this long can be marked inactive`,
              },
            ]}
          />
        </div>
      </div>

      <Registration dkg={dkg} adapter={r?.dkgAdapter ?? null} />

      <div className='mt-6'>
        <SubHeading>
          <Trans>Proof verifiers of the committee</Trans>
        </SubHeading>
        <p className='mt-1 text-[12px] leading-relaxed text-ash'>
          <Trans>
            Every step the committee takes comes with a proof, checked by one of these contracts, so there is no dispute
            phase. Each reports the fingerprint of the key its circuit is proven with, compared here with the published
            davinci-dkg release that the committee’s nodes download and check against the same fingerprints.
          </Trans>
        </p>
        {technical ? (
          <p className='mt-1 text-[12px] leading-relaxed text-ash'>
            <Trans>
              Groth16 verifiers of every contribution, finalization, partial decryption and combine, each one
              proof-carrying call. The fingerprint is the SHA-256 of the circuit’s proving key, compared with the{' '}
              <Code>circuits-v6</Code> release.
            </Trans>
          </p>
        ) : null}
        <ul className='mt-3 flex flex-col divide-y divide-charcoal rounded-md border border-charcoal'>
          {dkg.verifiers.map((v) => {
            const expected = DKG_CIRCUITS_V6_KEY_HASHES[v.name]
            const state = v.keyHash == null ? 'unknown' : v.keyHash === expected ? 'pass' : 'fail'
            const labels = DKG_VERIFIER_LABELS[v.name]
            return (
              <li
                key={v.name}
                className='flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between'
                data-testid={`dkg-verifier-${v.name}`}
              >
                <div className='flex min-w-0 items-start gap-2.5'>
                  <CheckMark state={state} className='mt-0.5' />
                  <div className='min-w-0'>
                    <div className='text-[13px] text-silver'>{labels.name}</div>
                    <div className='text-[12px] leading-relaxed text-ash'>
                      {technical ? <RichText text={i18n._(labels.detail)} /> : i18n._(labels.role)}
                    </div>
                  </div>
                </div>
                <div className='flex min-w-0 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 md:justify-end'>
                  {v.keyHash ? (
                    <span className='inline-flex items-center gap-1 text-[12px] text-ash'>
                      <Trans>
                        key <Hash value={v.keyHash} chars={8} />
                      </Trans>
                    </span>
                  ) : null}
                  {v.address ? (
                    <span className='inline-flex items-center gap-1'>
                      <Address value={v.address} chars={4} />
                      <SourceLink address={v.address} />
                    </span>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <Callout className='mt-6' title={t`What you trust in the DKG modes`}>
        <Trans>
          Enough members of an epoch’s committee (its <Term id='threshold'>threshold</Term>) could together decrypt
          every ballot of the processes keyed on that epoch, with the organizer secret as well in locked mode; the
          design trusts them not to collude. A process’s key belongs to one epoch’s committee and cannot be moved to
          another (there is no resharing), so if more than <Formula expr='n − t' /> of its members leave before the
          process ends, its results are lost.
        </Trans>{' '}
        <Link
          to={paths.learn('key-modes')}
          className='text-pewter underline-offset-2 hover:text-emerald hover:underline'
        >
          <Trans>The key modes, explained</Trans>
        </Link>
      </Callout>
    </Panel>
  )
}

function EpochDetails({
  epoch: e,
  epochLink,
  technical,
}: {
  epoch: DkgEpochView
  epochLink: string | null
  technical: boolean
}) {
  const { i18n, t } = useLingui()
  const config = useRuntimeConfig()
  const nonce = e.nonce
  const contributions = e.contributionCount
  const committeeSize = e.committeeSize
  const minValid = e.minValidContributions
  const threshold = e.threshold
  return (
    <div className='mt-6 grid gap-6 lg:grid-cols-2' data-testid='dkg-epoch'>
      <div>
        <SubHeading>
          <Trans>Epoch #{nonce}</Trans>
        </SubHeading>
        <KeyValue
          className='mt-1'
          items={[
            {
              label: t`Epoch id`,
              value: (
                <span className='inline-flex items-center gap-2'>
                  <Hash value={e.id} chars={8} />
                  {epochLink ? <ExternalText href={epochLink}>{t`DKG explorer`}</ExternalText> : null}
                </span>
              ),
              hint: technical ? t`the manager’s 4-byte prefix and the epoch nonce` : t`the epoch’s number on the DKG`,
            },
            {
              label: t`Phase`,
              value: <DkgPhaseBadge phase={e.phase} />,
              hint: i18n._(PHASES[e.phase].description),
            },
            { label: t`Created at block`, value: <BlockCell block={e.startBlock} /> },
            {
              label: t`Contributions accepted`,
              value: t`${contributions} of ${committeeSize}`,
              hint: t`at least ${minValid} needed to finalize the epoch`,
            },
            {
              label: t`Applications`,
              value: e.applications != null ? formatNumber(e.applications) : '—',
              hint: t`DAVINCI processes and any other application on this epoch`,
            },
          ]}
        />
      </div>
      <div>
        <SubHeading>
          <Trans>Committee, in slot order</Trans>
        </SubHeading>
        <p className='mt-1 text-[12px] leading-relaxed text-ash'>
          <Trans>
            Drawn by a lottery on the chain from the registered operators, first come first served among the eligible
            ones. Any {threshold} of them can decrypt; fewer cannot.
          </Trans>
        </p>
        {e.committee.length ? (
          <ol className='mt-2 flex flex-col gap-1.5'>
            {e.committee.map((a, i) => {
              const link = dkgExplorerLink(config.dkgExplorerUrl, 'operator', a)
              return (
                <li key={a} className='flex items-center gap-2 text-[12px]'>
                  <span className='w-5 text-right font-mono text-ash'>{i + 1}</span>
                  <Address value={a} chars={6} />
                  {link ? <ExternalText href={link}>{t`operator`}</ExternalText> : null}
                </li>
              )
            })}
          </ol>
        ) : (
          <p className='mt-2 text-[12px] text-ash'>
            <Trans>Not selected yet.</Trans>
          </p>
        )}
      </div>
    </div>
  )
}

function Registration({ dkg, adapter }: { dkg: DkgDeployment; adapter: string | null }) {
  const { t } = useLingui()
  const reg = dkg.registration
  if (reg.kind === 'registrar') {
    const isAdapter = adapter != null && reg.address === adapter.toLowerCase()
    const registrar = <Address value={reg.address} chars={6} className='align-middle' />
    return (
      <Callout className='mt-6' title={t`Application registration is restricted`} tone='info'>
        {isAdapter ? (
          <Trans>
            Only {registrar}, this registry’s adapter, may register applications on this DKGAppManager, so this
            committee serves only that integrator.
          </Trans>
        ) : (
          <Trans>
            Only {registrar} may register applications on this DKGAppManager, so this committee serves only that
            integrator.
          </Trans>
        )}
      </Callout>
    )
  }
  if (reg.kind === 'unknown') return null
  const poolKeys = DKG_POOL_KEYS
  return (
    <Callout className='mt-6' title={t`Anyone can register an application`} tone='info'>
      {reg.reason === 'no-gate' ? (
        <Trans>
          The DKGAppManager has no registrar: any contract or account can register an application on a Live epoch, so
          other applications can share this committee with DAVINCI.
        </Trans>
      ) : (
        <Trans>
          The DKGAppManager has no registrar set: any contract or account can register an application on a Live epoch,
          so other applications can share this committee with DAVINCI.
        </Trans>
      )}{' '}
      <Trans>
        Each registration takes one of the epoch’s {poolKeys} pool keys. Once one key or fewer is left, the contract
        allows the next epoch early and the nodes create it; if the keys run out first, creating DKG-mode processes
        waits for it (about one epoch setup).
      </Trans>
    </Callout>
  )
}
