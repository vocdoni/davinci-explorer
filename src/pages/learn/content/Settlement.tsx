import { Trans, useLingui } from '@lingui/react/macro'
import { paths } from '~routes/paths'
import type { LearnExamples } from '../examples'
import { A, C, OL, P, Section, SeeIt, SimpleTable, Term, UL } from '../prose'

export function Settlement({ ex }: { ex: LearnExamples }) {
  const { t } = useLingui()
  const active = ex.active
  return (
    <>
      <Section id='the-call' title={t`The call`}>
        <P>
          <Trans>
            A sequencer settles a batch with{' '}
            <C>submitStateTransition(processId, publicValues, proofBytes, commitments, ys, kzgProofs)</C>, sent as a
            blob transaction that carries exactly the transition’s blobs, in order. Anyone may send it; the checks below
            decide whether it lands.
          </Trans>
        </P>
      </Section>

      <Section id='the-checks-in-order' title={t`The checks, in order`}>
        <OL>
          <li>
            <Trans>The process exists, is Ready and is inside its voting window.</Trans>
          </li>
          <li>
            <Trans>
              <C>publicValues</C> is 512 bytes, the guest’s <C>ok</C> is 1 and its <C>fail_mask</C> is 0.
            </Trans>
          </li>
          <li>
            <Trans>
              The state root before the batch equals the process’s <C>latestStateRoot</C>. This is root continuity: a
              batch built on an old root, such as the loser of a race, reverts here.
            </Trans>
          </li>
          <li>
            <Trans>
              The census root matches. For origins 1, 2 and 4 it equals the stored root; for an on-chain census the
              census contract’s <C>getRootBlockNumber(root)</C> must be non-zero, at most the current block and at least
              the process’s creation block.
            </Trans>
          </li>
          <li>
            <Trans>
              <C>occupied_before</C> equals <C>votersCount</C>, the number of distinct ballot slots written so far. The
              guest cannot see the tree, so the registry pins it.
            </Trans>
          </li>
          <li>
            <Trans>
              The batch does not take the process past its maximum number of voters:{' '}
              <C>votersCount + votes − overwrites ≤ maxVoters</C>.
            </Trans>
          </li>
          <li>
            <Trans>
              There is at least one blob, the three blob arrays have <C>n_blobs</C> entries each, the transaction
              carries no blob past them, and <C>sha256(commitment₀ ‖ y₀ ‖ …)</C> equals the blob digest in the public
              values.
            </Trans>
          </li>
          <li>
            <Trans>
              The verifier accepts the PLONK proof:{' '}
              <C>verifySnarkProof(batchProgramVK, rootCVadcopFinal, publicValues, proofBytes)</C>. It hashes the{' '}
              <Term id='program-vk'>program vk</Term>, the public values and the setup root together, so a proof of
              another program or made under another setup fails.
            </Trans>
          </li>
          <li>
            <Trans>
              Every blob opens to its <C>y</C> at <C>z = sha256(process id ‖ root before ‖ commitment) mod r</C>,
              checked with the point-evaluation precompile against the transaction’s blob hashes.
            </Trans>
          </li>
        </OL>
        <P>
          <Trans>
            On success <C>latestStateRoot</C> becomes the root after, <C>votersCount</C> grows by{' '}
            <C>votes − overwrites</C>, <C>overwrittenVotesCount</C> by the overwrites and <C>batchNumber</C> by one, and
            the registry emits <C>ProcessStateTransitioned</C>.
          </Trans>
        </P>
      </Section>

      <Section id='the-public-values-it-reads' title={t`The public values it reads`}>
        <P>
          <Trans>
            The <Term id='public-values'>public values</Term> are the guest’s 64 output registers, each written as an
            8-byte little-endian word. A 256-bit value spans 8 registers.
          </Trans>
        </P>
        <SimpleTable
          head={[t`Registers`, t`Value`]}
          rows={[
            ['0', <C key='ok'>ok</C>],
            ['1', <C key='fm'>fail_mask</C>],
            ['2–9', t`State root before`],
            ['10–17', t`State root after`],
            ['18', t`Votes in the batch`],
            ['19', t`Overwrites among them`],
            ['20–27', t`Census root`],
            ['28–35', t`Blob digest`],
            ['36', <C key='nb'>n_blobs</C>],
            ['42', <C key='ob'>occupied_before</C>],
          ]}
        />
      </Section>

      <Section
        id='what-the-guest-proves-and-what-is-left-to-the-registry'
        title={t`What the guest proves, and what is left to the registry`}
      >
        <P>
          <Trans>
            The guest proves a transition from whatever root and census it is given. The registry adds what only the
            chain knows: the process’s last root, its census root, its count of voters, and every blob against its
            versioned hash. Together they make each transition a valid step from the previous one.
          </Trans>
        </P>
        <UL>
          <li>
            <Trans>
              The explorer recomputes most of these from public data: the guest’s verdict, root continuity, the census
              root, <C>occupied_before</C>, the vote counts, the blob count, the versioned hashes and the blob digest.
              It does not recompute the census root of an on-chain census (origin 3), and for an updated origin-2 census
              it only checks the root against the roots it has seen.
            </Trans>
          </li>
          <li>
            <Trans>
              The PLONK proof and the KZG openings are verified on chain; the explorer shows the program vk and setup
              root they were checked against.
            </Trans>
          </li>
        </UL>
        {active ? (
          <SeeIt to={paths.transition(active.id, active.transitions - 1)}>
            <Trans>The checks of a recent transition</Trans>
          </SeeIt>
        ) : null}
        <SeeIt to={`${paths.contracts()}#parameters`}>
          <Trans>The program vk and setup root this registry pins</Trans>
        </SeeIt>
        <P>
          <Trans>
            Next: <A to={paths.learn('results')}>how results are produced</A>.
          </Trans>
        </P>
      </Section>
    </>
  )
}
