import { Trans, useLingui } from '@lingui/react/macro'
import { Formula } from '~components/Formula'
import { InShort } from '~components/InShort'
import { NumberedList } from '~components/NumberedList'
import { paths } from '~routes/paths'
import type { LearnExamples } from '../examples'
import { A, Details, P, Section, SeeIt, Term, UL } from '../prose'

export function Blobs({ ex }: { ex: LearnExamples }) {
  const { t } = useLingui()
  const active = ex.active
  return (
    <>
      <InShort className='mb-8'>
        <Trans>
          Each batch publishes what it changed next to its transaction, in blobs: the new vote ids, every ballot it
          wrote (still encrypted) and the new encrypted total. The batch program lays this data out itself, so what is
          published is exactly what was proven. With it anyone can rebuild a process’s state, but the network deletes
          blobs after about two weeks.
        </Trans>
      </InShort>

      <Section id='what-a-blob-is' title={t`What a blob is`}>
        <P>
          <Trans>
            A <Term id='blob'>blob</Term> is a block of data sent along with a transaction. The chain keeps only a
            fingerprint of each blob (its <Term id='versioned-hash'>versioned hash</Term>). The data itself is kept by
            the network’s beacon nodes for about 15 days on Gnosis Chain and about 18 on Ethereum mainnet, then deleted.
            Sequencers keep the blobs they saw and serve them too.
          </Trans>
        </P>
        <Details>
          <P>
            <Trans>
              An EIP-4844 blob is 4096 cells of 32 bytes, each a BLS12-381 field element, carried next to a transaction
              rather than in its calldata. The versioned hash is derived from the blob’s{' '}
              <Term id='kzg-commitment'>KZG commitment</Term>. On Gnosis Chain beacon nodes prune blobs after 16384
              epochs of 80 s.
            </Trans>
          </P>
        </Details>
      </Section>

      <Section id='what-a-transition-publishes' title={t`What a batch publishes`}>
        <P>
          <Trans>Every settlement carries the blobs of its batch. They hold, in order:</Trans>
        </P>
        <NumberedList
          className='my-4'
          items={[
            <Trans key='ids'>the number of new vote ids, then the vote ids in ascending order;</Trans>,
            <Trans key='slots'>
              the number of ballots written (slot updates), then each one in ascending slot order: its slot, then its
              encrypted answers, two cells per answer;
            </Trans>,
            <Trans key='total'>the new encrypted total, two cells per ballot field;</Trans>,
            <Trans key='zeros'>zeros to the end of the last blob.</Trans>,
          ]}
        />
        <P>
          <Trans>
            New votes, changed votes and silent refreshes are all slot updates in one sorted list, so they look the
            same. A slot’s first write is still public, because refreshes only touch slots already in use; with a voter
            list the slot follows from the address, so who voted and when is public. What stays hidden is which slots in
            use were changed and which were only refreshed.
          </Trans>
        </P>
        <P>
          <Trans>
            A large batch needs several blobs, at most 32, and all of them travel in its one settlement transaction. On
            Gnosis Chain a block takes at most 2 blobs, so a sequencer sizes each batch to fit the chain’s blob limit
            and settles the rest as the next batch.
          </Trans>
        </P>
        <Details>
          <P>
            <Trans>
              A slot update is the slot key followed by the ballot’s active ciphertexts, each point compressed to one
              cell. A transition with <Formula expr='T' /> cells needs <Formula expr='ceil(T / 4096)' /> blobs.
            </Trans>
          </P>
        </Details>
      </Section>

      <Section id='built-by-the-proof-not-trusted' title={t`Built by the proof, not trusted`}>
        <P>
          <Trans>
            The sequencer cannot publish just any data. The batch program lays out the blob contents itself, from the
            state it has just checked, and publishes a fingerprint of them among its public values. The registry checks
            that the blobs in the transaction match that fingerprint, so the blobs a transaction carries are exactly the
            ones the proof covers.
          </Trans>
        </P>
        <Details>
          <P>
            <Trans>
              For each blob the guest evaluates the blob polynomial at a point bound to this process, this state root
              and this blob’s commitment, where <Formula expr='r' /> is the order of the BLS12-381 scalar field:
            </Trans>
          </P>
          <Formula block expr='z = sha256(processId ‖ rootBefore ‖ commitment) mod r' className='my-2' />
          <P>
            <Trans>
              It publishes the blob count and the <Term id='blob-digest'>blob digest</Term> among its public values:
            </Trans>
          </P>
          <Formula block expr='sha256(commitment₀ ‖ y₀ ‖ commitment₁ ‖ y₁ ‖ …)' className='my-2' />
          <P>
            <Trans>
              The registry recomputes that digest from the commitments and evaluations in the transaction and asks the
              point-evaluation precompile whether each blob of the transaction opens to <Formula expr='y' /> at{' '}
              <Formula expr='z' />.
            </Trans>
          </P>
        </Details>
      </Section>

      <Section id='why-it-matters' title={t`Why it matters`}>
        <UL>
          <li>
            <Trans>
              Anyone can rebuild a process’s state from its blobs alone. That is how sequencers that did not settle a
              batch follow along, and how an observer checks every batch without trusting the sequencer that sent it.
            </Trans>
          </li>
          <li>
            <Trans>A voter can find their vote id in the blob of the batch that included it.</Trans>
          </li>
          <li>
            <Trans>
              A node started after an election’s blobs were deleted cannot rebuild it from the beacon, so someone has to
              keep a node or an archive running for the whole election.
            </Trans>
          </li>
        </UL>
      </Section>

      <Section id='in-this-explorer' title={t`In this explorer`}>
        <P>
          <Trans>
            The transition page downloads the blobs from the beacon, or from a configured sequencer once the beacon has
            deleted them, and decodes them. A blob from the beacon is tied to the transaction because its commitment
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
            Next: <A to={paths.learn('settlement')}>what the chain checks for each batch</A>.
          </Trans>
        </P>
      </Section>
    </>
  )
}
