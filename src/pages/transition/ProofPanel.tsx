import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { Explain, Formula, Term } from '~components'
import { CodeBlock, Disclosure } from '~components/code'
import { useChain, useReleaseCheck } from '~data/hooks'
import type { TransitionDetail } from '~indexer/selectors'
import { Address, Badge, Hash, KeyValue, Panel, Skeleton, Tooltip } from '~kit'
import { formatBytes } from '~lib/format'
import { PIN_LABELS } from '~protocol/releases'
import { paths } from '~routes/paths'

const byteLength = (hex: string | null | undefined) => (hex ? (hex.length - 2) / 2 : null)

/** The PLONK proof, the keys it was checked against and the verifier call. */
export function ProofPanel({ detail }: { detail: TransitionDetail }) {
  const { t } = useLingui()
  const { tx } = detail
  const chain = useChain()
  const registry = chain.registry
  const release = useReleaseCheck()
  const pin = (name: 'batchProgramVK' | 'rootCVadcopFinal') => release.checks.find((c) => c.pin === name)
  const pending = <Skeleton className='inline-block h-3 w-24' />

  const pinBadge = (name: 'batchProgramVK' | 'rootCVadcopFinal') => {
    const c = pin(name)
    if (!c || c.ok == null) return null
    const known = (release.release ?? release.closest)?.label
    return c.ok ? (
      <Tooltip
        content={
          known
            ? t`Equal to the pin of ${known}. The contracts page compares every pin.`
            : t`Equal to the pin of a known release. The contracts page compares every pin.`
        }
      >
        <span className='inline-flex'>
          <Badge tone='ok' size='sm'>
            <Trans>known release</Trans>
          </Badge>
        </span>
      </Tooltip>
    ) : (
      <Tooltip content={t`Not the pin of any release this explorer knows. The contracts page has the details.`}>
        <span className='inline-flex'>
          <Badge tone='warn' size='sm'>
            <Trans>unknown release</Trans>
          </Badge>
        </span>
      </Tooltip>
    )
  }

  return (
    <Panel
      label={t`Validity`}
      title={t`The proof`}
      description={
        <Trans>
          One proof covers the whole batch: every vote’s checks, how the ballots were stored and the data it published.
          It is the same size however many votes the batch has. Technically it is a ZisK{' '}
          <Term id='plonk-proof'>PLONK proof</Term> over every ballot proof, signature, census proof, state update,
          re-encryption and the blob layout.
        </Trans>
      }
    >
      <div className='flex flex-col gap-4' data-testid='proof'>
        <KeyValue
          columns={2}
          items={[
            {
              label: (
                <span className='inline-flex items-center gap-1'>
                  <Trans>Proof size</Trans>
                  <Explain>
                    <Trans>The proof as sent (proofBytes): a PLONK proof, ABI-encoded as 24 words.</Trans>
                  </Explain>
                </span>
              ),
              value: tx ? formatBytes(byteLength(tx.proofBytes)) : pending,
              mono: true,
            },
            {
              label: (
                <span className='inline-flex items-center gap-1'>
                  <Trans>Public values</Trans>
                  <Explain>
                    <Trans>What the proof makes public (publicValues): the 64 registers above, 8 bytes each.</Trans>
                  </Explain>
                </span>
              ),
              value: tx ? formatBytes(byteLength(tx.publicValues)) : pending,
              mono: true,
            },
            {
              label: (
                <span className='inline-flex items-center gap-1'>
                  {PIN_LABELS.batchProgramVK}
                  <Explain>
                    <Trans>
                      The fingerprint of the exact program that checks each batch (batchProgramVK, its program vk). It
                      is fixed in the registry: a change to the program changes it, and that takes a new registry.
                    </Trans>
                  </Explain>
                </span>
              ),
              value: registry ? (
                <span className='inline-flex items-center gap-2'>
                  <Hash value={registry.batchProgramVK} chars={10} />
                  {pinBadge('batchProgramVK')}
                </span>
              ) : (
                pending
              ),
            },
            {
              label: (
                <span className='inline-flex items-center gap-1'>
                  {PIN_LABELS.rootCVadcopFinal}
                  <Explain>
                    <Trans>
                      The fingerprint of the ZisK proving setup (rootCVadcopFinal), fixed in the registry. It changes
                      only with a new ZisK setup, not with the program.
                    </Trans>
                  </Explain>
                </span>
              ),
              value: registry ? (
                <span className='inline-flex items-center gap-2'>
                  <Hash value={registry.rootCVadcopFinal} chars={10} />
                  {pinBadge('rootCVadcopFinal')}
                </span>
              ) : (
                pending
              ),
            },
            {
              label: (
                <span className='inline-flex items-center gap-1'>
                  <Trans>Verifier</Trans>
                  <Explain>
                    <Trans>
                      The contract that checks the proof (ZiskVerifier). Its address is fixed in the registry.
                    </Trans>
                  </Explain>
                </span>
              ),
              value: registry ? <Address value={registry.ziskVerifier} /> : pending,
            },
            {
              label: t`Releases`,
              value: (
                <Link to={paths.contracts()} className='text-silver hover:text-emerald'>
                  <Trans>Compare with the known releases</Trans>
                </Link>
              ),
            },
          ]}
        />
        <div className='flex flex-col gap-2'>
          <p className='text-[13px] leading-relaxed text-silver'>
            <Trans>
              Before accepting the batch, the registry asks the verifier contract to check the proof, and refuses the
              batch if the check fails. The verifier folds the program, the setup and the public values into the one
              value the proof must match, so a proof of another program or another setup does not verify, and neither
              does a proof whose public values were changed:
            </Trans>
          </p>
          <Formula block expr='publicInput = sha256(programVK ‖ publicValues ‖ rootCVadcopFinal)' />
          <p className='text-[12px] leading-relaxed text-ash'>
            <Trans>
              The call, made inside <code>submitStateTransition</code>, which reverts with <code>InvalidProof</code>{' '}
              when it fails:
            </Trans>
          </p>
          <CodeBlock
            code={`ZiskVerifier(${registry?.ziskVerifier ?? '<verifier>'}).verifySnarkProof(\n  batchProgramVK,    // ${registry?.batchProgramVK ?? '…'}\n  rootCVadcopFinal,  // ${registry?.rootCVadcopFinal ?? '…'}\n  publicValues,      // ${formatBytes(byteLength(tx?.publicValues))} from the calldata\n  proofBytes         // ${formatBytes(byteLength(tx?.proofBytes))} from the calldata\n)`}
            label={t`Copy the verifier call`}
          />
        </div>
        {tx?.proofBytes ? (
          <Disclosure summary={t`The proof as sent (proofBytes)`}>
            <CodeBlock code={tx.proofBytes} wrap label={t`Copy proofBytes`} maxHeight={240} />
          </Disclosure>
        ) : null}
      </div>
    </Panel>
  )
}
