import { useMemo } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { CheckMark, Formula, RichText, Term } from '~components'
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
  formula?: string
}

/**
 * Every rule `submitStateTransition` enforced for this batch: what it means,
 * the outcome recomputed from public data where the explorer can, and under
 * "How this is checked" the rule and the command that redoes it with nothing
 * but an RPC.
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

  // The PLONK and the openings are not recomputed here: a recorded
  // transaction is the evidence the registry accepted both.
  const onchain: CheckState = tx ? (tx.status === 'success' ? 'pass' : 'fail') : 'unknown'
  const onchainDetail = tx
    ? tx.status === 'success'
      ? t`Checked by the registry on the chain: the transaction would have failed otherwise. The explorer does not redo it.`
      : t`The transaction that sent this batch failed.`
    : t`Waiting for the transaction.`
  const rows: Row[] = CHECK_ORDER.map((id) => {
    if (id === 'plonk' || id === 'kzg-openings')
      return { id, label: i18n._(ONCHAIN_LABELS[id]), state: onchain, detail: onchainDetail }
    const c = detail.checks.find((x) => x.id === id)!
    return { id, label: c.label, state: c.state, detail: c.detail, formula: c.formula }
  })
  const rpc = config.rpcUrls[0] ?? '<rpc url>'

  return (
    <Panel
      label={t`Verify it yourself`}
      title={t`What the registry checked`}
      description={t`Before accepting this batch, the registry made the checks below, in this order, and would have refused the batch at the first one that failed. The explorer redoes every check it can from public data. Open “How this is checked” under a check for the rule and a command that redoes it on your own computer.`}
    >
      <div className='flex flex-col gap-4' data-testid='verify'>
        <Disclosure summary={t`Technical details`} variant='plain'>
          <div className='flex flex-col gap-2 text-[12px] leading-relaxed text-ash'>
            <p>
              <Trans>
                <code>submitStateTransition</code> first checks that the process is open, or past its end with its grace
                window still open (<code>getProcessGraceEnd</code>), then runs these checks in this order and reverts on
                the first that fails. The explorer redoes each one it can from the event, the call’s data and the
                previous batch. The commands need only an RPC node, Foundry’s <code>cast</code> and coreutils, and every
                one reads the node’s address from <code>$RPC</code>:
              </Trans>
            </p>
            <CodeBlock code={`export RPC=${rpc}`} label={t`Copy the RPC variable`} />
          </div>
        </Disclosure>
        <ol className='flex flex-col'>
          {rows.map((row) => {
            const copy = checkCopy(row.id, census?.origin ?? null)
            const cmd = commands[row.id]
            return (
              <li
                key={row.id}
                className='border-b border-charcoal/60 py-3.5 last:border-b-0'
                data-testid={`check-${row.id}`}
              >
                <div className='flex items-start gap-3'>
                  <CheckMark state={row.state} className='mt-0.5' />
                  <div className='min-w-0 flex-1'>
                    <div className='text-[14px] font-medium text-ghost'>{row.label}</div>
                    <p className='mt-1 text-[13px] leading-relaxed text-silver'>{i18n._(copy.meaning)}</p>
                    <p className='mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] leading-relaxed text-ash'>
                      <span>{row.detail}</span>
                      {row.formula ? <Formula expr={row.formula} /> : null}
                    </p>
                    <Disclosure summary={t`How this is checked`} variant='plain' className='mt-2'>
                      <div className='flex flex-col gap-3 rounded-sm border border-charcoal bg-obsidian/40 p-3 text-[12px] leading-relaxed text-ash'>
                        <div className='flex flex-col gap-2'>
                          <div className='label-caps text-[11px] text-pewter'>
                            <Trans>What the registry enforces</Trans>
                          </div>
                          <p>
                            <RichText text={i18n._(copy.enforced)} />
                          </p>
                          {copy.formula ? <Formula block expr={copy.formula} /> : null}
                        </div>
                        <div className='flex flex-col gap-2'>
                          <div className='label-caps text-[11px] text-pewter'>
                            <Trans>Redo it yourself</Trans>
                          </div>
                          <p>
                            <RichText text={i18n._(copy.recheck)} />
                          </p>
                          {copy.recheckFormula ? <Formula block expr={copy.recheckFormula} /> : null}
                          {cmd ? (
                            <CodeBlock code={cmd} label={t`Copy the command`} maxHeight={260} />
                          ) : (
                            <p>
                              <Trans>Waiting for the values this command needs.</Trans>
                            </p>
                          )}
                        </div>
                      </div>
                    </Disclosure>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
        <Callout title={t`Check every batch without trusting anyone`}>
          <p>
            <Trans>
              Run your own copy of the sequencer software without a signing key, as an{' '}
              <Term id='observer'>observer</Term>. It follows every election, downloads each batch’s data, rebuilds the
              state on your computer and accepts a batch only if it reaches the same fingerprint as the chain. That
              checks every batch, whoever sent it.
            </Trans>
          </p>
          <p className='mt-2 text-[12px]'>
            <Trans>
              Under the hood it fetches each batch’s data blobs, checks them against the transaction’s versioned hashes,
              applies them to its own copy of the state tree and requires the event’s new root.
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
