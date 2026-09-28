import { Trans, useLingui } from '@lingui/react/macro'
import { paths } from '~routes/paths'
import type { LearnExamples } from '../examples'
import { A, C, OL, P, Section, SeeIt, Term, UL } from '../prose'

export function Blobs({ ex }: { ex: LearnExamples }) {
  const { t } = useLingui()
  const active = ex.active
  return (
    <>
      <Section id='what-a-blob-is' title={t`What a blob is`}>
        <P>
          <Trans>
            An EIP-4844 <Term id='blob'>blob</Term> is 4096 cells of 32 bytes, each a BLS12-381 field element, carried
            next to a transaction rather than in its calldata. The chain itself keeps only the blob’s{' '}
            <Term id='versioned-hash'>versioned hash</Term>, which is derived from its{' '}
            <Term id='kzg-commitment'>KZG commitment</Term>. Beacon nodes keep the bytes for about 15 days on Gnosis
            Chain (16384 epochs of 80 s) and about 18 on Ethereum mainnet, then prune them; sequencers archive the blobs
            they saw and serve them too.
          </Trans>
        </P>
      </Section>

      <Section id='what-a-transition-publishes' title={t`What a transition publishes`}>
        <P>
          <Trans>Every settlement carries the blobs of its transition. Their cells hold, in order:</Trans>
        </P>
        <OL>
          <li>
            <Trans>the number of new vote ids, then the vote ids in ascending order;</Trans>
          </li>
          <li>
            <Trans>
              the number of slot updates, then each update in ascending slot order: the slot key followed by the
              ballot’s active ciphertexts, each point compressed to one cell;
            </Trans>
          </li>
          <li>
            <Trans>the new encrypted tally, two cells per ballot field;</Trans>
          </li>
          <li>
            <Trans>zeros to the end of the last blob.</Trans>
          </li>
        </OL>
        <P>
          <Trans>
            New votes, overwrites and silent refreshes are all slot updates in one sorted list. A slot’s first write is
            still public, because refreshes only touch occupied slots; with a Merkle census the slot follows from the
            address, so who voted and when is public. What stays hidden is which occupied slots were overwritten and
            which were only refreshed.
          </Trans>
        </P>
        <P>
          <Trans>
            A transition with <C>T</C> cells needs <C>ceil(T / 4096)</C> blobs, at most 32, and all of them ride in its
            one settlement transaction. On Gnosis a block takes at most 2 blobs, so a sequencer sizes each batch to fit
            the chain’s blob limit and settles the rest as the next transition.
          </Trans>
        </P>
      </Section>

      <Section id='built-by-the-proof-not-trusted' title={t`Built by the proof, not trusted`}>
        {/* One sentence over three paragraphs, so one message. */}
        <Trans>
          <P>
            The blob bytes are not an input the guest takes on trust: it lays out the cells itself, from state it has
            just verified. For each blob it evaluates the blob polynomial at a point bound to this process, this state
            root and this blob’s commitment,
          </P>
          <P>
            <C>z = sha256(process id ‖ root before ‖ commitment) mod r</C>, with <C>r</C> the order of the BLS12-381
            scalar field,
          </P>
          <P>
            and publishes <C>sha256(commitment₀ ‖ y₀ ‖ commitment₁ ‖ y₁ ‖ …)</C> and the blob count among its public
            values. The registry recomputes that digest from the commitments and evaluations in the transaction and asks
            the point-evaluation precompile whether each blob of the transaction opens to <C>y</C> at <C>z</C>. So the
            blobs the transaction carries are exactly the ones the proof covers.
          </P>
        </Trans>
      </Section>

      <Section id='why-it-matters' title={t`Why it matters`}>
        <UL>
          <li>
            <Trans>
              Anyone can rebuild a process’s state tree from its blobs alone. That is how sequencers that did not settle
              a batch follow along, and how an observer checks every transition without trusting the sequencer that sent
              it.
            </Trans>
          </li>
          <li>
            <Trans>A voter can find their vote id in the blob of the transition that included it.</Trans>
          </li>
          <li>
            <Trans>
              A node started after an election’s blobs were pruned cannot rebuild it from the beacon, so someone has to
              keep a node or an archive running for the whole election.
            </Trans>
          </li>
        </UL>
      </Section>

      <Section id='in-this-explorer' title={t`In this explorer`}>
        <P>
          <Trans>
            The transition page fetches the blobs from the beacon API, or from a configured sequencer once the beacon
            has pruned them, and decodes them. A blob from the beacon is tied to the transaction because its commitment
            hashes to one of the transaction’s versioned hashes; a blob from a sequencer’s archive is tied by position
            only, and the page says which. The explorer does not recompute KZG commitments from the bytes.
          </Trans>
        </P>
        {active ? (
          <SeeIt to={paths.transition(active.id, active.transitions - 1)}>
            <Trans>The blobs of a recent transition, decoded</Trans>
          </SeeIt>
        ) : null}
        <P>
          <Trans>
            Next: <A to={paths.learn('settlement')}>what the registry checks per transition</A>.
          </Trans>
        </P>
      </Section>
    </>
  )
}
