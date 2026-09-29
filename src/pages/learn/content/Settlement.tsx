import { Trans, useLingui } from '@lingui/react/macro'
import { Formula } from '~components/Formula'
import { InShort } from '~components/InShort'
import { NumberedList } from '~components/NumberedList'
import { paths } from '~routes/paths'
import type { LearnExamples } from '../examples'
import { A, C, Details, OL, P, Section, SeeIt, SimpleTable, Term, UL } from '../prose'

export function Settlement({ ex }: { ex: LearnExamples }) {
  const { t } = useLingui()
  const active = ex.active
  return (
    <>
      <InShort className='mb-8'>
        <Trans>
          The registry records a batch only if the election is open, the proof is valid and says every check passed, the
          batch starts from the latest state, its voters were checked against the right list of voters, the voter limit
          holds and the published data matches the proof. If any check fails the transaction is refused and nothing
          changes.
        </Trans>
      </InShort>

      <Section id='the-call' title={t`The call`}>
        <P>
          <Trans>
            A sequencer sends a batch to the registry in one transaction, which also carries the batch’s data blobs.
            Anyone may send it; the checks below decide whether it is recorded (in technical terms, whether the batch
            settles).
          </Trans>
        </P>
        <Details>
          <Formula
            block
            expr='submitStateTransition(processId, publicValues, proofBytes, commitments, ys, kzgProofs)'
            className='mb-2'
          />
          <P>
            <Trans>It is sent as a blob transaction that carries exactly the transition’s blobs, in order.</Trans>
          </P>
        </Details>
      </Section>

      <Section id='the-checks-in-order' title={t`The checks, in order`}>
        <NumberedList
          className='my-4 [&_li]:text-[14px]'
          items={[
            <Trans key='1'>The election exists, is open and is inside its voting window.</Trans>,
            <Trans key='2'>The proof’s public values have the right size and say every check passed.</Trans>,
            <Trans key='3'>
              The batch starts from the election’s latest state. A batch built on an older state, such as the loser of a
              race between two sequencers, is refused here.
            </Trans>,
            <Trans key='4'>The voters were checked against a list of voters the election accepts.</Trans>,
            <Trans key='5'>
              The number of voters before the batch matches the registry’s own count. The proof cannot see the whole
              state, so the registry supplies it.
            </Trans>,
            <Trans key='6'>The batch does not take the election past its maximum number of voters.</Trans>,
            <Trans key='7'>
              The published data matches the proof: the right number of data blobs, and a fingerprint of them equal to
              the one in the proof.
            </Trans>,
            <Trans key='8'>
              The proof itself is valid, and was made by the released batch program under the released proving setup.
            </Trans>,
            <Trans key='9'>Each data blob really contains the data the proof computed.</Trans>,
          ]}
        />
        <P>
          <Trans>
            When every check passes, the election moves to its new state, its counts of voters, changed votes and
            batches go up, and the registry announces the new state in an event.
          </Trans>
        </P>
        <Details summary={<Trans>The exact checks</Trans>}>
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
                The state root before the batch equals the process’s <C>latestStateRoot</C> (root continuity).
              </Trans>
            </li>
            <li>
              <Trans>
                The census root matches. For origins 1, 2 and 4 it equals the stored root; for an on-chain census the
                census contract’s <C>getRootBlockNumber(root)</C>, the last block the root was valid, must be non-zero,
                at most the current block and at least the process’s creation block.
              </Trans>
            </li>
            <li>
              <Trans>
                <C>occupied_before</C> equals <C>votersCount</C>, the number of distinct ballot slots written so far.
                The guest cannot see the tree, so the registry pins it.
              </Trans>
            </li>
            <li>
              <Formula expr='votersCount + votes − overwrites ≤ maxVoters' />
            </li>
            <li>
              <Trans>
                There is at least one blob, the three blob arrays have <C>n_blobs</C> entries each, the transaction
                carries no blob past them, and <Formula expr='sha256(commitment₀ ‖ y₀ ‖ …)' /> equals the blob digest in
                the public values.
              </Trans>
            </li>
            <li>
              <Trans>
                The verifier accepts the PLONK proof,{' '}
                <Formula expr='verifySnarkProof(batchProgramVK, rootCVadcopFinal, publicValues, proofBytes)' />. It
                hashes the <Term id='program-vk'>program vk</Term>, the public values and the setup root together,{' '}
                <Formula expr='sha256(programVK ‖ publicValues ‖ rootCVadcopFinal) mod r_BN254' />, so a proof of
                another program or made under another setup fails.
              </Trans>
            </li>
            <li>
              <Trans>
                Every blob opens to its <Formula expr='y' /> at{' '}
                <Formula expr='z = sha256(be32(processId) ‖ reverse(rootBefore) ‖ commitment) mod r_BLS' />, checked
                with the point-evaluation precompile against the transaction’s blob hashes. The process id is padded to
                32 bytes, the root before the batch is taken with its bytes reversed, the commitment is 48 bytes, and{' '}
                <Formula expr='r_BLS' /> is the order of the BLS12-381 scalar field.
              </Trans>
            </li>
          </OL>
          <P>
            <Trans>
              On success <C>latestStateRoot</C> becomes the root after, <C>votersCount</C> grows by{' '}
              <Formula expr='votes − overwrites' />, <C>overwrittenVotesCount</C> by the overwrites and{' '}
              <C>batchNumber</C> by one, and the registry emits <C>ProcessStateTransitioned</C>.
            </Trans>
          </P>
        </Details>
      </Section>

      <Section id='the-public-values-it-reads' title={t`What the registry reads from the proof`}>
        <P>
          <Trans>
            A proof makes a short list of numbers public, its <Term id='public-values'>public values</Term>. They say
            whether every check passed and give the fingerprints of the state before and after, the number of votes and
            of changed votes, the fingerprint of the list of voters used, a fingerprint of the published data with the
            number of data blobs, and how many voters had voted before the batch.
          </Trans>
        </P>
        <Details>
          <P>
            <Trans>
              The public values are the guest’s 64 output registers, each written as an 8-byte little-endian word. A
              256-bit value spans 8 registers.
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
        </Details>
      </Section>

      <Section
        id='what-the-guest-proves-and-what-is-left-to-the-registry'
        title={t`What the proof covers, and what the registry adds`}
      >
        <P>
          <Trans>
            The proof shows that a batch was processed correctly from whatever starting state and list of voters it was
            given. The registry adds what only the chain knows: the election’s latest state, its list of voters, its
            count of voters, and the fingerprints of the data blobs the transaction carries. Together they make each
            batch a valid step from the previous one.
          </Trans>
        </P>
        <UL>
          <li>
            <Trans>
              The explorer redoes most of these checks from public data: the proof’s verdict, the chain of states, the
              list of voters used, the count of earlier voters, the vote counts and the published data. It cannot check
              the list for a list kept by a contract (origin 3), and for a replaced list (origin 2) it only knows the
              lists it has seen.
            </Trans>
          </li>
          <li>
            <Trans>
              The proof itself and the checks of the published data are verified on the chain; the explorer shows the
              program’s fingerprint and the proving setup they were checked against.
            </Trans>
          </li>
        </UL>
        <Details>
          <P>
            <Trans>
              Recomputed: <C>ok</C> and <C>fail_mask</C>, root continuity, the census root, <C>occupied_before</C>, the
              vote counts, the blob count, the versioned hashes and the blob digest. Not recomputed: the census root of
              an origin-3 census, which the registry checked with the census contract’s <C>getRootBlockNumber(root)</C>;
              for origin 2 the root is only checked against the roots of the <C>CensusUpdated</C> events seen. The PLONK
              proof and the KZG openings were verified on the chain, against the program vk and <C>rootCVadcopFinal</C>{' '}
              the registry pins.
            </Trans>
          </P>
        </Details>
        {active ? (
          <SeeIt to={paths.transition(active.id, active.transitions - 1)}>
            <Trans>The checks of a recent batch</Trans>
          </SeeIt>
        ) : null}
        <SeeIt to={`${paths.contracts()}#parameters`}>
          <Trans>The program fingerprints and proving setup this registry pins</Trans>
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
