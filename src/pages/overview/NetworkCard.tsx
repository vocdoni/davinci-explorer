import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { CheckMark, Explain, Timestamp } from '~components'
import { useNetworkName } from '~config/config-context'
import { useChain, useIndexer, useReleaseCheck } from '~data/hooks'
import { Address, Badge, BlockCell, buttonClasses, Hash, KeyValue, Panel, Skeleton, Tooltip } from '~kit'
import { formatNumber } from '~lib/format'
import { PIN_LABELS, type PinCheck } from '~protocol/releases'
import { paths } from '~routes/paths'

const PIN_HELP: Record<PinCheck['pin'], MessageDescriptor> = {
  batchProgramVK: msg`Identifies the vote-batch zkVM program. The registry verifies every state transition against it, so a proof of any other program fails.`,
  resultsProgramVK: msg`Identifies the results zkVM program that proves a sequencer-key tally.`,
  rootCVadcopFinal: msg`Root of the ZisK proving setup both proofs are wrapped under.`,
  ziskVerifierCodeHash: msg`keccak256 of the PLONK verifier contract code the registry calls.`,
  ballotVKHash: msg`Hash of the verification key of the voter ballot proofs. It becomes state leaf 0x07 at creation, and the batch program checks the key it uses against it.`,
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
            hint: lastBlock ? t`events indexed to block ${indexedTo}` : undefined,
          },
          {
            label: (
              <span className='inline-flex items-center gap-1'>
                <Trans>Registry</Trans>
                <Explain>
                  <Trans>
                    The ProcessRegistry contract: it stores every process and settles every state transition and result
                    after verifying its proof.
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
                  <Trans>The ZisK PLONK verifier the registry calls for every batch and results proof.</Trans>
                </Explain>
              </span>
            ),
            value: registry ? <Address value={registry.ziskVerifier} /> : <Skeleton className='h-3 w-28' />,
          },
          {
            label: (
              <span className='inline-flex items-center gap-1'>
                <Trans>DKG adapter</Trans>
                <Explain>
                  <Trans>
                    The registry's link to the davinci-dkg committee contracts. Without it the two DKG key modes are
                    disabled.
                  </Trans>
                </Explain>
              </span>
            ),
            value: registry ? (
              registry.dkgAdapter ? (
                <Address value={registry.dkgAdapter} />
              ) : (
                <span className='text-ash'>
                  <Trans>none: DKG key modes disabled</Trans>
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
            <Trans>Release pins</Trans>
            <Explain>
              <Trans>
                The registry fixes what its proofs must come from: two program keys, the ZisK setup root, the ballot
                proof key and the verifier code. The explorer compares each with the davinci-zkvm releases it knows. A
                full match means this registry accepts proofs from that release's programs only.
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
              <Tooltip content={i18n._(PIN_HELP[c.pin])}>
                <span className='min-w-0 flex-1 truncate text-silver'>{PIN_LABELS[c.pin]}</span>
              </Tooltip>
              {c.actual ? <Hash value={c.actual} chars={6} /> : <span className='text-[12px] text-ash'>…</span>}
            </li>
          ))}
        </ul>
        {release.closest && !release.release && release.complete ? (
          <p className='mt-3 text-xs leading-relaxed text-ash'>
            <Trans>
              Compared with {closest}, the closest known release. A mismatch is either a newer release this explorer
              does not list yet or a deployment of other programs; check it on the contracts page.
            </Trans>
          </p>
        ) : null}
      </div>
    </Panel>
  )
}
