import { useMemo } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { CheckMark } from '~components'
import { CodeBlock, Disclosure } from '~components/code'
import { useRuntimeConfig } from '~config/config-context'
import { useChain } from '~data/hooks'
import type { CheckState, TransitionDetail } from '~indexer/selectors'
import { Callout, Panel } from '~kit'
import { blobEvaluationPoint } from '~protocol/blob'
import { CHECK_ORDER, checkCopy, ONCHAIN_LABELS } from './checks'
import { observerCommand, recheckCommands, type RecheckId } from './commands'

interface Row {
  id: RecheckId
  label: string
  state: CheckState
  detail: string
}

/**
 * Every rule `submitStateTransition` enforced for this batch, recomputed
 * from public data where the explorer can, and the commands to recheck each
 * one with nothing but an RPC.
 */
export function VerifyPanel({ detail }: { detail: TransitionDetail }) {
  const { i18n, t } = useLingui()
  const config = useRuntimeConfig()
  const chain = useChain()
  const { tx, transition: tr, process, publics } = detail
  const census = process.state?.census ?? null

  const commands = useMemo(
    () =>
      recheckCommands({
        registry: chain.registryAddress,
        verifier: chain.registry?.ziskVerifier ?? null,
        processId: tr.processId,
        createdBlock: process.createdBlock,
        block: tr.block,
        tx: tr.tx,
        census: {
          origin: census?.origin ?? null,
          contract: census && census.origin === 'onchain-dynamic' ? census.contractAddress : null,
          root: publics?.censusRoot ?? null,
        },
        batchProgramVK: chain.registry?.batchProgramVK ?? null,
        rootCVadcopFinal: chain.registry?.rootCVadcopFinal ?? null,
        publicValues: tx?.publicValues ?? null,
        proofBytes: tx?.proofBytes ?? null,
        versionedHashes: tx?.blobVersionedHashes ?? [],
        commitments: tx?.commitments ?? [],
        ys: tx?.ys ?? [],
        kzgProofs: tx?.kzgProofs ?? [],
        evaluationPoints: tx ? tx.commitments.map((c) => blobEvaluationPoint(tr.processId, tr.rootBefore, c)) : [],
      }),
    // Leaf values, not the containers: the indexer updates them in place.
    [chain.registryAddress, chain.registry, tr, process.createdBlock, census, publics, tx]
  )

  // The PLONK and the openings are not recomputed here: a settled
  // transaction is the evidence the registry accepted both.
  const onchain: CheckState = tx ? (tx.status === 'success' ? 'pass' : 'fail') : 'unknown'
  const onchainDetail = tx
    ? tx.status === 'success'
      ? t`Verified on-chain: the settlement would have reverted otherwise. The explorer does not re-run it.`
      : t`The settlement transaction reverted.`
    : t`Waiting for the transaction`
  const rows: Row[] = CHECK_ORDER.map((id) => {
    if (id === 'plonk' || id === 'kzg-openings')
      return { id, label: i18n._(ONCHAIN_LABELS[id]), state: onchain, detail: onchainDetail }
    const c = detail.checks.find((x) => x.id === id)!
    return { id, label: c.label, state: c.state, detail: c.detail }
  })
  const rpc = config.rpcUrls[0] ?? '<rpc url>'

  return (
    <Panel
      label={t`Verify it yourself`}
      title={t`What the registry checked`}
      description={t`submitStateTransition first checks that the process is open and inside its voting window, then runs these checks in this order and reverts on the first that fails. The explorer redoes each one it can from the event, the calldata and the previous transition; the commands under each row redo it again with only an RPC, Foundry's cast and coreutils.`}
    >
      <div className='flex flex-col gap-4' data-testid='verify'>
        <CodeBlock code={`export RPC=${rpc}`} label={t`Copy the RPC variable`} />
        <ol className='flex flex-col'>
          {rows.map((row) => {
            const copy = checkCopy(row.id, census?.origin ?? null)
            const cmd = commands[row.id]
            return (
              <li
                key={row.id}
                className='border-b border-charcoal/60 py-3 last:border-b-0'
                data-testid={`check-${row.id}`}
              >
                <div className='flex items-start gap-3'>
                  <CheckMark state={row.state} className='mt-0.5' />
                  <div className='min-w-0 flex-1'>
                    <div className='text-[13px] font-medium text-ghost'>{row.label}</div>
                    <div className='font-mono text-[11px] break-words text-ash'>{row.detail}</div>
                    <p className='mt-1.5 text-[13px] leading-relaxed text-ash'>{i18n._(copy.enforced)}</p>
                    <Disclosure summary={t`Recheck it`} variant='plain' className='mt-2'>
                      <p className='mb-2 text-[12px] leading-relaxed text-ash'>{i18n._(copy.recheck)}</p>
                      {cmd ? (
                        <CodeBlock code={cmd} label={t`Copy the command`} maxHeight={260} />
                      ) : (
                        <p className='text-[12px] text-ash'>
                          <Trans>Waiting for the values this command needs.</Trans>
                        </p>
                      )}
                    </Disclosure>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
        <Callout title={t`Replay the whole process`}>
          <p>
            <Trans>
              A sequencer node without a signing key runs as an observer: it follows every process, fetches each
              transition's blobs, checks them against the versioned hashes, applies them to its own copy of the state
              tree and requires the event's new root. That checks every transition independently of whoever settled it.
            </Trans>
          </p>
          <CodeBlock
            className='mt-2'
            code={observerCommand({
              chainId: config.chainId,
              registry: chain.registryAddress,
              startBlock: config.startBlock,
              beaconUrl: config.beaconUpstream ?? config.beaconUrl ?? null,
            })}
            label={t`Copy the observer command`}
          />
        </Callout>
      </div>
    </Panel>
  )
}
