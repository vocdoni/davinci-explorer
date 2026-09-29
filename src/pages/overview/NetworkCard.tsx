import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { CheckMark, Explain, RichText, Timestamp } from '~components'
import { useNetworkName } from '~config/config-context'
import { useChain, useIndexer, useReleaseCheck } from '~data/hooks'
import { Address, Badge, BlockCell, buttonClasses, Hash, KeyValue, Panel, Skeleton, Tooltip } from '~kit'
import { formatNumber } from '~lib/format'
import { PIN_LABELS, type PinCheck } from '~protocol/releases'
import { paths } from '~routes/paths'

// Plain words first, the pin's own name in `code`.
const PIN_HELP: Record<PinCheck['pin'], MessageDescriptor> = {
  batchProgramVK: msg({
    message:
      'The program that checks every batch of votes. The registry accepts a batch only with a proof of exactly this program (`batchProgramVK`).',
  }),
  resultsProgramVK: msg({
    message:
      'The program that proves the results of an election with a sequencer key. The registry accepts such results only with a proof of this program (`resultsProgramVK`).',
  }),
  rootCVadcopFinal: msg({
    message:
      'The proving setup every proof is made with. It changes with a new release of the proving system, not with the programs (`rootCVadcopFinal`, the ZisK setup both kinds of proof are wrapped with).',
  }),
  ziskVerifierCodeHash: msg({
    message:
      'The fingerprint of the code of the verifier contract, which checks every proof for the registry (`ziskVerifierCodeHash`, the keccak256 of its runtime code).',
  }),
  ballotVKHash: msg({
    message:
      'The fingerprint of the key that checks voters’ ballot proofs. Every election starts with it in its state, and the batch program accepts ballot proofs only under that key (`ballotVKHash`, leaf `0x07`).',
  }),
}

/** Chain, head, the deployment's contracts and its pins against the known releases. */
export function NetworkCard() {
  const { i18n, t } = useLingui()
  const networkName = useNetworkName()
  const chain = useChain()
  const release = useReleaseCheck()
  const { loading, lastBlock } = useIndexer()
  const registry = chain.registry
  const indexedTo = formatNumber(lastBlock)
  const chainId = chain.chainId
  const matched = release.release?.label
  const closest = release.closest?.label

  return (
    <Panel
      title={t`Network`}
      label={t`Deployment`}
      description={t`Where this explorer reads from, and whether the deployment runs a known release.`}
      actions={
        <Link to={paths.verifyDeployment()} className={buttonClasses('ghost', 'sm')}>
          <Trans>Verify the deployment</Trans>
        </Link>
      }
    >
      <KeyValue
        items={[
          {
            label: t`Chain`,
            value: (
              <>
                {networkName}{' '}
                <span className='font-mono text-ash'>
                  <Trans>· id {chainId}</Trans>
                </span>
              </>
            ),
          },
          {
            label: t`Head block`,
            value: chain.headBlock ? (
              <span className='inline-flex items-center gap-2'>
                <BlockCell block={chain.headBlock} />
                <Timestamp value={chain.headTimestamp} className='text-ash' />
              </span>
            ) : (
              <Skeleton className='h-3 w-24' />
            ),
            hint: lastBlock ? t`registry read up to block ${indexedTo}` : undefined,
          },
          {
            label: (
              <span className='inline-flex items-center gap-1'>
                <Trans>Registry</Trans>
                <Explain>
                  <Trans>
                    The voting contract (ProcessRegistry). It keeps every election, and records each batch of votes and
                    the results only after checking their proofs.
                  </Trans>
                </Explain>
              </span>
            ),
            value: <Address value={chain.registryAddress} />,
          },
          {
            label: (
              <span className='inline-flex items-center gap-1'>
                <Trans>Verifier</Trans>
                <Explain>
                  <Trans>
                    The contract that checks every proof for the registry, for each batch and for the results. It is the
                    ZisK PLONK verifier.
                  </Trans>
                </Explain>
              </span>
            ),
            value: registry ? <Address value={registry.ziskVerifier} /> : <Skeleton className='h-3 w-28' />,
          },
          {
            label: (
              <span className='inline-flex items-center gap-1'>
                <Trans>Key committee adapter</Trans>
                <Explain>
                  <Trans>
                    The registry’s link to the key committee’s contracts (davinci-dkg). Without it, no election can use
                    a committee key.
                  </Trans>
                </Explain>
              </span>
            ),
            value: registry ? (
              registry.dkgAdapter ? (
                <Address value={registry.dkgAdapter} />
              ) : (
                <span className='text-ash'>
                  <Trans>none: committee keys disabled</Trans>
                </span>
              )
            ) : (
              <Skeleton className='h-3 w-28' />
            ),
          },
        ]}
      />

      <div className='mt-4 border-t border-charcoal pt-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <span className='label-caps inline-flex items-center gap-1 text-[11px] text-pewter'>
            <Trans>Release check</Trans>
            <Explain>
              <Trans>
                The registry fixes which programs its proofs must come from, with five values set when it was deployed.
                The explorer compares them with the davinci-zkvm releases it knows: a full match means this registry
                accepts proofs from that release’s programs, and from nothing else.
              </Trans>
            </Explain>
          </span>
          {release.release ? (
            <Badge tone='ok'>
              <Trans>matches {matched}</Trans>
            </Badge>
          ) : loading || !release.complete ? (
            <Badge>
              <Trans>reading…</Trans>
            </Badge>
          ) : (
            <Badge tone='danger'>
              <Trans>no known release</Trans>
            </Badge>
          )}
        </div>
        <ul className='mt-3 flex flex-col gap-2' aria-label={t`Release pin checks`}>
          {release.checks.map((c) => (
            <li key={c.pin} className='flex min-w-0 items-center gap-2 text-[13px]'>
              <CheckMark state={c.ok == null ? 'unknown' : c.ok ? 'pass' : 'fail'} />
              <Tooltip content={<RichText text={i18n._(PIN_HELP[c.pin])} codeClassName='bg-carbon' />}>
                <span className='min-w-0 flex-1 truncate text-silver'>{PIN_LABELS[c.pin]}</span>
              </Tooltip>
              {c.actual ? <Hash value={c.actual} chars={6} /> : <span className='text-[12px] text-ash'>…</span>}
            </li>
          ))}
        </ul>
        {release.closest && !release.release && release.complete ? (
          <p className='mt-3 text-xs leading-relaxed text-ash'>
            <Trans>
              Compared with {closest}, the closest release the explorer knows. A difference means a newer release the
              explorer does not list yet, or other programs; the contracts page has the details.
            </Trans>
          </p>
        ) : null}
      </div>
    </Panel>
  )
}
