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
import { DKG_VERIFIER_LABELS, dkgExplorerLink } from './model'
import { Code, SourceLink, SubHeading } from './parts'

const PHASES: Record<DkgEpochPhase, { label: MessageDescriptor; tone: BadgeTone; description: MessageDescriptor }> = {
  none: {
    label: msg`Not created`,
    tone: 'neutral',
    description: msg`No epoch has been created yet.`,
  },
  'committee-selection': {
    label: msg`Committee selection`,
    tone: 'warn',
    description: msg`The lottery is drawing the committee: eligible operators claim slots until n are filled.`,
  },
  'key-assembly': {
    label: msg`Key assembly`,
    tone: 'warn',
    description: msg`Each member submits one proof-carrying contribution that deals its shares of all 16 pool keys.`,
  },
  live: {
    label: msg`Live`,
    tone: 'ok',
    description: msg`finalizeEpoch stored all 16 pool keys: applications can register, submit ciphertexts and get them decrypted.`,
  },
  aborted: {
    label: msg`Aborted`,
    tone: 'danger',
    description: msg`The committee did not fill in time, or too few members contributed during key assembly, so the epoch serves nobody. The nodes create the next one.`,
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
}: {
  chain: ChainMeta
  dkg: DkgDeployment | null | undefined
  loading: boolean
  error: string | null
}) {
  const { i18n, t } = useLingui()
  const config = useRuntimeConfig()
  const r = chain.registry
  const title = t`DKG committee`
  const label = t`Threshold keys`
  const description = t`The davinci-dkg committee that holds the election keys of DKG-mode processes and decrypts their tallies.`

  if (r && !r.dkgAdapter) {
    return (
      <Panel title={title} label={label} description={description}>
        <Callout title={t`The DKG key modes are disabled on this registry`}>
          <Trans>
            It was deployed without a DKG manager, so it has no adapter and <Code>newProcess</Code> in a DKG mode
            reverts with <Code>DKGDisabled</Code>. Every process here uses a sequencer key.
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
  const maxAlpha = formatNumber((dkg.maxLotteryAlphaBps ?? 0) / 10_000)
  return (
    <Panel
      title={title}
      label={label}
      description={description}
      actions={
        config.dkgExplorerUrl ? <ExternalText href={config.dkgExplorerUrl}>{t`DKG explorer`}</ExternalText> : undefined
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

      {e ? <EpochDetails epoch={e} epochLink={epochLink} /> : null}

      <div className='mt-6 grid gap-6 lg:grid-cols-2'>
        <div>
          <SubHeading>
            <Trans>Where a new DKG process gets its key</Trans>
          </SubHeading>
          <div className='mt-2 text-[13px] leading-relaxed text-ash' data-testid='registration-epoch'>
            {dkg.registrationEpoch ? (
              <Trans>
                A <span className='text-silver'>DKG automatic</span> process created now takes the next free pool key of
                epoch <Hash value={dkg.registrationEpoch} chars={8} className='align-middle' /> (the adapter’s{' '}
                <Code>registrationEpoch()</Code>: the newest Live epoch with a free key, looking back at most 8 epochs).
                A <span className='text-silver'>DKG locked</span> process names its epoch itself, because the
                organizer’s proof of possession binds it; clients read the same value.
              </Trans>
            ) : dkg.registrationEpochReverted ? (
              <Trans>
                No Live epoch with a free pool key among the last 8, so <Code>registrationEpoch()</Code> reverts and
                automatic processes revert <Code>NoLiveEpoch</Code> until a new epoch is Live. Locked processes name
                their epoch and are unaffected.
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
                hint: t`or earlier, once the newest pool is nearly spent or the epoch aborted`,
              },
              {
                label: t`Epoch policy bounds`,
                value: minThreshold != null ? `t ≥ ${minThreshold}, n ≥ ${minCommitteeSize}, 1 ≤ α ≤ ${maxAlpha}` : '…',
                hint: t`whoever creates an epoch picks t, n and α within these`,
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
          <Trans>Groth16 verifiers</Trans>
        </SubHeading>
        <p className='mt-1 text-[12px] leading-relaxed text-ash'>
          <Trans>
            Every contribution, finalization, partial decryption and combine is one proof-carrying call, checked by one
            of these; there is no dispute phase. Each verifier reports the SHA-256 of its circuit’s proving key,
            compared here with the davinci-dkg <Code>circuits-v6</Code> release, whose files the committee’s nodes
            download and check against the same hashes.
          </Trans>
        </p>
        <ul className='mt-3 flex flex-col divide-y divide-charcoal rounded-md border border-charcoal'>
          {dkg.verifiers.map((v) => {
            const expected = DKG_CIRCUITS_V6_KEY_HASHES[v.name]
            const state = v.keyHash == null ? 'unknown' : v.keyHash === expected ? 'pass' : 'fail'
            return (
              <li
                key={v.name}
                className='flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between'
                data-testid={`dkg-verifier-${v.name}`}
              >
                <div className='flex min-w-0 items-center gap-2.5'>
                  <CheckMark state={state} />
                  <span className='text-[13px] text-silver'>{DKG_VERIFIER_LABELS[v.name].name}</span>
                </div>
                <div className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 md:justify-end'>
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
          A threshold of an epoch’s committee could decrypt every ballot of the processes keyed on that epoch (with the
          organizer secret as well, in locked mode); the design trusts that threshold not to collude. A process’s key
          belongs to one epoch’s committee and there is no resharing, so if more than n − t of its members leave before
          the process ends, its results are lost.
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

function EpochDetails({ epoch: e, epochLink }: { epoch: DkgEpochView; epochLink: string | null }) {
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
              hint: t`the manager’s 4-byte prefix and the epoch nonce`,
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
              hint: t`at least ${minValid} needed to finalize`,
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
            Drawn by an on-chain lottery from the registered operators, first come first served among the eligible ones.
            Any {threshold} of them can decrypt; fewer cannot.
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
    <Callout className='mt-6' title={t`Anyone can register an application`} tone='ok'>
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
        Each registration claims one of the epoch’s {poolKeys} pool keys. Once one key or fewer is left the contract
        allows the next epoch early and the nodes create it; if the pool runs out first, DKG-mode process creation waits
        for it (about one epoch setup).
      </Trans>
    </Callout>
  )
}
