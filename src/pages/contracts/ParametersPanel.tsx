import { useState, type ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useNetworkStats } from '~data/hooks'
import type { DeploymentDetails } from '~data/deployment'
import type { ChainMeta } from '~indexer/types'
import { Address, Hash, Panel, Skeleton, Toggle } from '~kit'
import { formatNumber } from '~lib/format'
import { PIN_LABELS } from '~protocol/releases'
import { PIN_DETAILS } from './model'
import { Code } from './parts'

interface Param {
  id: string
  title: string
  /** How the value is read: code, never translated. */
  source: string
  value: ReactNode
  what: ReactNode
  why: ReactNode
  hint?: ReactNode
}

export function ParametersPanel({ chain, details }: { chain: ChainMeta; details: DeploymentDetails | undefined }) {
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
      source: 'registry ziskVerifier()',
      value: r ? <Address value={r.ziskVerifier} chars={6} /> : loading,
      what: t`The ZisK PLONK verifier contract the registry calls. It is fixed at deployment.`,
      why: t`Every transition and every sequencer-key tally is accepted or refused by this contract, so its code has to be the released one (next row).`,
    },
    {
      id: 'ziskVerifierCodeHash',
      title: PIN_LABELS.ziskVerifierCodeHash,
      source: PIN_DETAILS.ziskVerifierCodeHash.source,
      value: r ? hash(r.ziskVerifierCodeHash) : loading,
      what: i18n._(PIN_DETAILS.ziskVerifierCodeHash.what),
      why: i18n._(PIN_DETAILS.ziskVerifierCodeHash.why),
    },
    {
      id: 'verifierRootC',
      title: t`Verifier’s own setup root`,
      source: 'verifier getRootCVadcopFinal()',
      value: details ? hash(details.verifierRootC) : loading,
      what: t`The setup root compiled into the verifier contract.`,
      why: t`A sequencer refuses to start unless the verifier answers with the pinned root, so the registry’s copy and the verifier’s must agree.`,
    },
    {
      id: 'chainID',
      title: t`Chain id`,
      source: 'registry chainID()',
      value: r ? <span className='font-mono tnum text-ghost'>{r.chainID}</span> : loading,
      what: t`The chain the registry was deployed for, a constructor argument.`,
      why: t`It is folded into every process id through the prefix below, and sequencers refuse to start unless it equals the chain’s own id.`,
    },
    {
      id: 'pidPrefix',
      title: t`Process id prefix`,
      source: 'registry pidPrefix()',
      value: r ? (
        <span className='font-mono tnum text-ghost'>0x{r.pidPrefix.toString(16).padStart(8, '0')}</span>
      ) : (
        loading
      ),
      what: (
        <Trans>
          The low 4 bytes of <Code>keccak256(chainID ‖ registry)</Code>.
        </Trans>
      ),
      why: (
        <Trans>
          Every process id carries it in bytes 20 to 23, after the organizer address, so an id from another registry or
          chain reverts with <Code>UnknownProcessIdPrefix</Code>.
        </Trans>
      ),
    },
    {
      id: 'processCount',
      title: t`Processes created`,
      source: 'registry processCount()',
      value: r ? <span className='font-mono tnum text-ghost'>{formatNumber(r.processCount)}</span> : loading,
      hint: r ? t`${indexed} indexed by this explorer` : null,
      what: t`How many processes this registry has created.`,
      why: t`The explorer’s own index should reach the same number once its scan has caught up.`,
    },
    {
      id: 'dkgAdapter',
      title: t`DKG adapter`,
      source: 'registry dkgAdapter()',
      value: r ? (
        r.dkgAdapter ? (
          <Address value={r.dkgAdapter} chars={6} />
        ) : (
          <span className='text-[13px] text-ash'>{t({ message: 'none', context: 'no address' })}</span>
        )
      ) : (
        loading
      ),
      what: t`The registry’s link to davinci-dkg, created by its constructor when a DKG manager was given.`,
      why: (
        <Trans>
          Zero means the DKG key modes are disabled and <Code>newProcess</Code> in a DKG mode reverts{' '}
          <Code>DKGDisabled</Code>. Otherwise it is the only address allowed to submit ciphertexts to the committee for
          these processes.
        </Trans>
      ),
    },
  ]

  return (
    <Panel
      title={t`Pinned values`}
      label={t`Registry parameters`}
      description={t`What the registry was deployed with. None of these can change: a new guest or a new ZisK setup needs a new registry.`}
      actions={<Toggle checked={full} onChange={setFull} label={t`Full values`} />}
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
              <div className='mt-0.5 font-mono text-[11px] text-ash'>{p.source}</div>
              <div className='mt-2 min-w-0'>{p.value}</div>
              {p.hint ? <div className='mt-1 text-[11px] text-ash'>{p.hint}</div> : null}
            </div>
            <div className='min-w-0 text-[12px] leading-relaxed text-ash'>
              <p>
                <span className='text-pewter'>
                  <Trans>What it is.</Trans>
                </span>{' '}
                {p.what}
              </p>
              <p className='mt-1'>
                <span className='text-pewter'>
                  <Trans>Why it matters.</Trans>
                </span>{' '}
                {p.why}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
