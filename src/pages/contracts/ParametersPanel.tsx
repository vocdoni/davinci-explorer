import { useState, type ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Formula } from '~components/Formula'
import { RichText } from '~components/RichText'
import { useNetworkStats } from '~data/hooks'
import type { DeploymentDetails } from '~data/deployment'
import type { ChainMeta } from '~indexer/types'
import { Address, Hash, Panel, Skeleton, Toggle } from '~kit'
import { formatNumber } from '~lib/format'
import { PIN_LABELS } from '~protocol/releases'
import { PIN_DETAILS } from './model'
import { Code, TechnicalToggle } from './parts'

interface Param {
  id: string
  title: string
  /** How the value is read: code, never translated, shown with `Formula`. */
  source: string
  value: ReactNode
  /** What it is, in everyday words. */
  what: ReactNode
  /** Why it matters, in everyday words. */
  why: ReactNode
  /** The mechanism and the exact names, shown with the technical details. */
  detail?: ReactNode
  /** The relation `detail` refers to. Code, never translated. */
  formula?: string
  hint?: ReactNode
}

export function ParametersPanel({
  chain,
  details,
  technical = false,
  onTechnical,
}: {
  chain: ChainMeta
  details: DeploymentDetails | undefined
  /** Show each value's mechanism. */
  technical?: boolean
  onTechnical?: (on: boolean) => void
}) {
  const { i18n, t } = useLingui()
  const [full, setFull] = useState(false)
  const stats = useNetworkStats()
  const r = chain.registry
  const hash = (v: string | null | undefined) =>
    v ? <Hash value={v} chars={10} full={full} /> : <Skeleton className='h-4 w-40' />
  const loading = <Skeleton className='h-4 w-24' />

  const pin = (id: 'batchProgramVK' | 'resultsProgramVK' | 'rootCVadcopFinal' | 'ballotVKHash'): Param => ({
    id,
    title: PIN_LABELS[id],
    source: PIN_DETAILS[id].source,
    value: hash(r?.[id]),
    what: i18n._(PIN_DETAILS[id].what),
    why: i18n._(PIN_DETAILS[id].why),
    detail: <RichText text={i18n._(PIN_DETAILS[id].detail)} />,
    formula: PIN_DETAILS[id].formula,
  })
  const indexed = formatNumber(stats.processes)

  const params: Param[] = [
    pin('batchProgramVK'),
    pin('resultsProgramVK'),
    pin('rootCVadcopFinal'),
    pin('ballotVKHash'),
    {
      id: 'ziskVerifier',
      title: t`Proof verifier`,
      source: 'registry.ziskVerifier()',
      value: r ? <Address value={r.ziskVerifier} chars={6} /> : loading,
      what: t`The contract the registry asks whether a proof is valid. It is fixed when the registry is deployed.`,
      why: t`Every batch, and the results a sequencer decrypts, are accepted or refused by this contract, so its code has to be the released one (next row).`,
      detail: (
        <Trans>
          The ZisK PLONK verifier. The registry calls its <Code>verifySnarkProof</Code> with the program vk, the setup
          root, the public values and the proof.
        </Trans>
      ),
    },
    {
      id: 'ziskVerifierCodeHash',
      title: PIN_LABELS.ziskVerifierCodeHash,
      source: PIN_DETAILS.ziskVerifierCodeHash.source,
      value: r ? hash(r.ziskVerifierCodeHash) : loading,
      what: i18n._(PIN_DETAILS.ziskVerifierCodeHash.what),
      why: i18n._(PIN_DETAILS.ziskVerifierCodeHash.why),
      detail: <RichText text={i18n._(PIN_DETAILS.ziskVerifierCodeHash.detail)} />,
    },
    {
      id: 'verifierRootC',
      title: t`Setup the verifier was built for`,
      source: 'verifier.getRootCVadcopFinal()',
      value: details ? hash(details.verifierRootC) : loading,
      what: t`The proving setup compiled into the verifier contract.`,
      why: t`It must be the same as the registry’s own copy (the proving setup above): a sequencer refuses to start otherwise.`,
      detail: (
        <Trans>
          A sequencer checks at boot that it equals the registry’s <Code>rootCVadcopFinal</Code>.
        </Trans>
      ),
    },
    {
      id: 'chainID',
      title: t`Chain id`,
      source: 'registry.chainID()',
      value: r ? <span className='font-mono tnum text-ghost'>{r.chainID}</span> : loading,
      what: t`The chain the registry was deployed for.`,
      why: t`It is part of every process id, through the prefix below, and sequencers refuse to start unless it equals the chain’s own id.`,
      detail: <Trans>A constructor argument of the registry.</Trans>,
    },
    {
      id: 'pidPrefix',
      title: t`Process id prefix`,
      source: 'registry.pidPrefix()',
      value: r ? (
        <span className='font-mono tnum text-ghost'>0x{r.pidPrefix.toString(16).padStart(8, '0')}</span>
      ) : (
        loading
      ),
      what: t`A 4-byte code that stands for this registry on this chain.`,
      why: t`Every process id carries it, right after the organizer’s address, so an id made for another registry or chain is refused.`,
      detail: (
        <Trans>
          The last 4 bytes of the keccak256 below, over the registry’s chain id as 4 bytes (<Code>uint32</Code>) and its
          20-byte address, packed. It sits in bytes 20 to 23 of every process id; an id with another prefix reverts with{' '}
          <Code>UnknownProcessIdPrefix</Code>.
        </Trans>
      ),
      formula: 'pidPrefix = uint32(keccak256(abi.encodePacked(chainID, registry)))',
    },
    {
      id: 'processCount',
      title: t`Processes created`,
      source: 'registry.processCount()',
      value: r ? <span className='font-mono tnum text-ghost'>{formatNumber(r.processCount)}</span> : loading,
      hint: r ? t`${indexed} indexed by this explorer` : null,
      what: t`How many elections this registry has created.`,
      why: t`The explorer’s own index should reach the same number once its scan has caught up.`,
    },
    {
      id: 'dkgAdapter',
      title: t`Key committee adapter`,
      source: 'registry.dkgAdapter()',
      value: r ? (
        r.dkgAdapter ? (
          <Address value={r.dkgAdapter} chars={6} />
        ) : (
          <span className='text-[13px] text-ash'>{t({ message: 'none', context: 'no address' })}</span>
        )
      ) : (
        loading
      ),
      what: t`The registry’s link to the key committee (davinci-dkg). It exists only when the registry was deployed with one.`,
      why: t`Without it the committee key modes are off. With it, it is the only address allowed to hand these elections’ encrypted totals to the committee.`,
      detail: (
        <Trans>
          Created by the registry’s constructor when a DKG manager was given. When it is zero, <Code>newProcess</Code>{' '}
          in a DKG mode reverts with <Code>DKGDisabled</Code>; otherwise it is the only ciphertext submitter for these
          processes.
        </Trans>
      ),
    },
  ]

  return (
    <Panel
      title={t`Pinned values`}
      label={t`Registry parameters`}
      description={t`What the registry was deployed with. None of these can change: a new program or a new proving setup needs a new registry.`}
      actions={
        <div className='flex flex-wrap items-center gap-x-5 gap-y-2'>
          <Toggle checked={full} onChange={setFull} label={t`Full values`} />
          {onTechnical ? <TechnicalToggle checked={technical} onChange={onTechnical} /> : null}
        </div>
      }
    >
      <ul className='-my-3 divide-y divide-charcoal'>
        {params.map((p) => (
          <li
            key={p.id}
            data-testid={`param-${p.id}`}
            className='grid gap-x-8 gap-y-2 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'
          >
            <div className='min-w-0'>
              <div className='text-[13px] font-semibold text-ghost'>{p.title}</div>
              <div className='mt-0.5 text-[12px]'>
                <Formula expr={p.source} />
              </div>
              <div className='mt-2 min-w-0'>{p.value}</div>
              {p.hint ? <div className='mt-1 text-[11px] text-ash'>{p.hint}</div> : null}
            </div>
            <div className='min-w-0 text-[12px] leading-relaxed text-ash'>
              <p>
                <span className='text-pewter'>
                  <Trans>What it is.</Trans>
                </span>{' '}
                <span className='text-silver'>{p.what}</span>
              </p>
              <p className='mt-1'>
                <span className='text-pewter'>
                  <Trans>Why it matters.</Trans>
                </span>{' '}
                {p.why}
              </p>
              {technical && (p.detail || p.formula) ? (
                <div
                  className='mt-2 border-l-2 border-charcoal pl-3 [&_code]:text-[0.88em] [&_code]:text-pewter'
                  data-testid='param-detail'
                >
                  {p.detail ? <p>{p.detail}</p> : null}
                  {p.formula ? <Formula block expr={p.formula} className='mt-1.5' /> : null}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
