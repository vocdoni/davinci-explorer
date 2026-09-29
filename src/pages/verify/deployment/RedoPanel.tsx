import { useState, type ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { CodeBlock } from '~components/CodeBlock'
import type { ChainMeta } from '~indexer/types'
import { Card } from '~kit'
import { castCommands, releasePins, verifyDeploymentCommand } from '~pages/contracts/model'
import { Code, Segmented } from '~pages/contracts/parts'
import type { ReleaseMatch } from '~protocol/releases'

type PinSource = 'chain' | 'release'

function Heading({ children }: { children: ReactNode }) {
  return <h3 className='text-[15px] font-semibold text-ghost'>{children}</h3>
}

/**
 * The deployment checks from a terminal, against a build of the source:
 * davinci-contracts' verify_deployment.py, the same reads with cast, and how
 * to rebuild every pin.
 */
export function RedoPanel({ chain, rpc, match }: { chain: ChainMeta; rpc: string; match: ReleaseMatch }) {
  const { t } = useLingui()
  const release = match.closest
  const releaseLabel = release?.label
  const releaseZisk = release?.zisk
  const [source, setSource] = useState<PinSource>('chain')
  const r = chain.registry
  const pins =
    source === 'release' && release
      ? releasePins(release)
      : {
          batchProgramVK: r?.batchProgramVK,
          resultsProgramVK: r?.resultsProgramVK,
          rootCVadcopFinal: r?.rootCVadcopFinal,
          ballotVKHash: r?.ballotVKHash,
        }
  const chainId = r?.chainID ?? chain.chainId
  const command = verifyDeploymentCommand({ rpc, chainId, registry: chain.registryAddress, pins })
  const setup = [
    'git clone --recurse-submodules -b zkvm https://github.com/vocdoni/davinci-contracts.git',
    'cd davinci-contracts',
    'forge build',
    command,
  ].join('\n')

  return (
    <div className='flex flex-col gap-4'>
      <Card className='p-5 sm:p-6'>
        <section aria-labelledby='verify-script' data-testid='verify-script'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <Heading>
              <span id='verify-script'>
                <Trans>Compare the deployment with a build</Trans>
              </span>
            </Heading>
            <Segmented<PinSource>
              label={t`Pins in the command`}
              value={source}
              onChange={setSource}
              options={[
                { value: 'chain', label: t`Pins from the chain` },
                ...(release ? [{ value: 'release' as const, label: t`Pins of ${releaseLabel}` }] : []),
              ]}
            />
          </div>
          <p className='mt-2 text-[14px] leading-relaxed text-silver'>
            <Trans>
              One script builds the contracts from their published source and checks that the code at these addresses is
              that build, and that the registry holds the values you give it.
            </Trans>
          </p>
          <p className='mt-2 text-[13px] leading-relaxed text-ash'>
            <Trans>
              davinci-contracts ships <Code>script/verify_deployment.py</Code>. It needs Python 3, Foundry’s{' '}
              <Code>cast</Code> and a <Code>forge build</Code> with the repository’s compiler settings, since it reads{' '}
              <Code>out/</Code>. Pass <Code>--cast</Code> when cast is not at <Code>~/.foundry/bin/cast</Code>.
            </Trans>
          </p>
          <CodeBlock code={setup} label={t`Copy the commands`} className='mt-3' />
          <p className='mt-2 text-[12px] leading-relaxed text-ash'>
            {source === 'chain' ? (
              <Trans>
                With the pins the registry holds, the pin checks pass by construction and the run is about the code: it
                proves the contracts at these addresses are the ones in the repository. Switch to the release pins to
                also check that the registry holds the released keys.
              </Trans>
            ) : (
              <Trans>
                With the pins of {releaseLabel}, the run also checks that the registry holds exactly the released keys.
              </Trans>
            )}
          </p>
          <p className='mt-4 text-[13px] text-silver'>
            <Trans>It checks that:</Trans>
          </p>
          <ul className='mt-1.5 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-ash'>
            <li>
              <Trans>
                the runtime code of <Code>ProcessRegistry</Code> and <Code>ZiskVerifier</Code> matches the local build,
                with immutables masked;
              </Trans>
            </li>
            <li>
              <Trans>
                the registry’s <Code>batchProgramVK</Code>, <Code>resultsProgramVK</Code>, <Code>rootCVadcopFinal</Code>{' '}
                and <Code>ballotVKHash</Code> equal the given pins, and so does the verifier’s{' '}
                <Code>getRootCVadcopFinal()</Code>;
              </Trans>
            </li>
            <li>
              <Trans>
                the registry’s <Code>chainID</Code> equals the RPC’s chain id, and <Code>--chain-id</Code> when given;
              </Trans>
            </li>
            <li>
              <Trans>
                when <Code>dkgAdapter()</Code> is set, the adapter’s code matches the local build and{' '}
                <Code>adapter.registry()</Code> is the registry.
              </Trans>
            </li>
          </ul>
          <p className='mt-2 text-[12px] text-ash'>
            <Trans>
              Each check prints <Code>OK</Code> or <Code>FAIL</Code>, and the exit status is 1 if any fails.
            </Trans>
          </p>
        </section>
      </Card>

      <Card className='p-5 sm:p-6'>
        <section aria-labelledby='verify-cast'>
          <Heading>
            <span id='verify-cast'>
              <Trans>Read the values one by one</Trans>
            </span>
          </Heading>
          <p className='mt-2 text-[13px] leading-relaxed text-ash'>
            <Trans>
              The same reads this page makes, with <Code>cast</Code>. The last line hashes the verifier’s runtime code
              and should print the verifier code hash of the release check above.
            </Trans>
          </p>
          <CodeBlock
            code={castCommands(rpc, chain.registryAddress, r?.ziskVerifier ?? null)}
            label={t`Copy the cast commands`}
            className='mt-3'
          />
        </section>
      </Card>

      <Card className='p-5 sm:p-6'>
        <section aria-labelledby='verify-source'>
          <Heading>
            <span id='verify-source'>
              <Trans>Rebuild the pins from source</Trans>
            </span>
          </Heading>
          <p className='mt-2 text-[14px] leading-relaxed text-silver'>
            <Trans>
              Each value the release check compares can be rebuilt from the published source, so you need not take this
              explorer’s release table on trust.
            </Trans>
          </p>
          <dl className='mt-3 flex flex-col gap-4 text-[13px] leading-relaxed'>
            <div>
              <dt className='font-medium text-silver'>
                <Trans>The two program keys</Trans>
              </dt>
              <dd className='mt-1 text-ash'>
                <Trans>
                  In davinci-zkvm, <Code>scripts/build-guests.sh</Code> builds the guest programs. Source paths are
                  remapped, so any checkout builds the same bytes, and CI rebuilds the committed ELFs the same way to
                  check them. <Code>cargo-zisk setup -e &lt;elf&gt; -k &lt;proving-key&gt;</Code> then prints{' '}
                  <Code>Root hash: [w0, w1, w2, w3]</Code> for each ELF when <Code>ZISK_CACHE_DIR</Code> is empty (a
                  warm cache skips the print); the pin is those four 64-bit words as big-endian bytes, concatenated.
                  This needs the ZisK toolchain and its STARK proving key.
                </Trans>
                <CodeBlock
                  className='mt-2'
                  label={t`Copy the build commands`}
                  code={[
                    'git clone https://github.com/vocdoni/davinci-zkvm.git && cd davinci-zkvm',
                    'scripts/build-guests.sh',
                    'cargo-zisk setup -e circuit/elf/circuit.elf -k ~/.zisk/provingKey           # batchProgramVK',
                    'cargo-zisk setup -e circuit-results/elf/results.elf -k ~/.zisk/provingKey   # resultsProgramVK',
                  ].join('\n')}
                />
              </dd>
            </div>
            <div>
              <dt className='font-medium text-silver'>
                <Trans>The setup root</Trans>
              </dt>
              <dd className='mt-1 text-ash'>
                {release ? (
                  <Trans>
                    <Code>rootCVadcopFinal</Code> belongs to the ZisK snark setup (ZisK {releaseZisk} for {releaseLabel}
                    ), not to the guests. The verifier contract returns it from <Code>getRootCVadcopFinal()</Code>, and
                    every PLONK job of a davinci-zkvm prover reports it as <Code>root_c_vadcop_final</Code>.
                  </Trans>
                ) : (
                  <Trans>
                    <Code>rootCVadcopFinal</Code> belongs to the ZisK snark setup, not to the guests. The verifier
                    contract returns it from <Code>getRootCVadcopFinal()</Code>, and every PLONK job of a davinci-zkvm
                    prover reports it as <Code>root_c_vadcop_final</Code>.
                  </Trans>
                )}
              </dd>
            </div>
            <div>
              <dt className='font-medium text-silver'>
                <Trans>The verifier code hash</Trans>
              </dt>
              <dd className='mt-1 text-ash'>
                <Trans>
                  After <Code>forge build</Code> in davinci-contracts, hash the verifier’s <Code>deployedBytecode</Code>
                  . It has no immutables, so the hash equals the one of the deployed code.
                </Trans>
                <CodeBlock
                  className='mt-2'
                  label={t`Copy the hash command`}
                  code='cast keccak $(jq -r .deployedBytecode.object out/ZiskVerifier.sol/ZiskVerifier.json)'
                />
              </dd>
            </div>
            <div>
              <dt className='font-medium text-silver'>
                <Trans>The ballot key hash</Trans>
              </dt>
              <dd className='mt-1 text-ash'>
                <Trans>
                  <Code>ballotVKHash</Code> is the sha256 of the ballot proof verification key’s wire bytes,{' '}
                  <Code>davinci.BallotVKLeaf</Code> in the davinci-zkvm Go SDK. The key the sequencer accepts is the one
                  its SDK embeds, <Code>rust-sdk/assets/ballot_proof_vkey.json</Code>, davinci-circom’s current key.
                </Trans>
              </dd>
            </div>
          </dl>
        </section>
      </Card>

      <p className='px-1 text-[13px] leading-relaxed text-ash'>
        <Trans>
          Three checks refuse a mismatch outside this page: a sequencer’s boot check (it reads the same pins and the
          verifier code hash, and will not start on any difference), <Code>davinci_client::verify_registry</Code> for
          clients, and the script above.
        </Trans>
      </p>
    </div>
  )
}
