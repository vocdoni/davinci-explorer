import { Trans, useLingui } from '@lingui/react/macro'
import { paths } from '~routes/paths'
import type { LearnExamples } from '../examples'
import { A, C, P, Section, SeeIt, Term, UL } from '../prose'

export function HowItWorks({ ex }: { ex: LearnExamples }) {
  const { t } = useLingui()
  const active = ex.active
  return (
    <>
      <Section id='the-parts' title={t`The parts`}>
        <P>
          <Trans>
            DAVINCI is a voting protocol in which every change to the tally is proven. An organizer creates a{' '}
            <Term id='process'>process</Term> on the <C>ProcessRegistry</C> contract. Voters send encrypted ballots to
            sequencers, which prove them in batches and settle each batch on the registry. When voting ends the
            encrypted tally is decrypted, and that step is proven too. In the DKG key modes a davinci-dkg committee
            holds the key.
          </Trans>
        </P>
        <P>
          <Trans>
            Settled data is read from the chain and the beacon: the registry’s events, the settlement transactions and
            the blobs they carry. What comes from a sequencer (vote status, tracker proofs, blobs the beacon has pruned)
            is labelled as such.
          </Trans>
        </P>
      </Section>

      <Section id='1-a-process-is-created' title={t`1. A process is created`}>
        <P>
          <Trans>
            The organizer calls <C>newProcess</C> with the voting window, the maximum number of voters, the{' '}
            <Term id='ballot-mode'>ballot mode</Term>, the <Term id='census'>census</Term> and the{' '}
            <Term id='key-mode'>key mode</Term>. The registry assigns the <Term id='process-id'>process id</Term>: the
            organizer’s address, a 4-byte prefix of this registry and a 7-byte per-organizer nonce.
          </Trans>
        </P>
        <P>
          <Trans>
            It then computes the <Term id='genesis-root'>genesis state root</Term> itself: the root of a SHA-256 sparse
            Merkle tree with six leaves (the process id, the packed ballot mode, a hash of the encryption key, an empty
            results accumulator, the census origin and the ballot VK hash). Every later state of the process grows from
            that root, so none of these can be swapped afterwards.
          </Trans>
        </P>
        <P>
          <Trans>
            The title, the question and the names of the options are not on the chain, which knows a ballot only as
            numbers in fields. They are in the organizer’s metadata document, and <C>newProcess</C> records its address
            together with its <Term id='metadata-hash'>metadata hash</Term>, the SHA-256 of its exact bytes. The
            explorer downloads the document, hashes it and shows its text as the organizer’s only when the two match.
          </Trans>
        </P>
        <P>
          <Trans>
            The organizer can publish a new version with <C>setProcessMetadata</C> until voting ends; after that the
            document is frozen. Every version stays on the registry’s log, and one set while voting was open is flagged:
            votes cast before it were cast under the previous version.
          </Trans>
        </P>
        <SeeIt to={paths.processes()}>
          <Trans>Every process on this registry, with its parameters</Trans>
        </SeeIt>
      </Section>

      <Section id='2-voters-cast-ballots' title={t`2. Voters cast ballots`}>
        <P>
          <Trans>
            A <Term id='ballot'>ballot</Term> is 16 ElGamal ciphertexts on the BabyJubJub curve, encrypted under the
            process key; the ballot mode says how many of them carry values and which values are allowed. The voter’s
            client proves, with a Groth16 <Term id='ballot-proof'>ballot proof</Term> of the davinci-circom circuit,
            that the ballot is a correct encryption for this process. The proof’s inputs hash commits to the process id,
            the ballot mode, the key, the voter’s address, the vote id, the ciphertexts and the voter’s weight.
          </Trans>
        </P>
        <P>
          <Trans>
            The client signs the ballot’s <Term id='vote-id'>vote id</Term> with the voter’s Ethereum key and sends
            ballot, proof, signature and census proof to a sequencer. The vote id is how the voter finds the vote again
            later.
          </Trans>
        </P>
      </Section>

      <Section id='3-sequencers-batch-them' title={t`3. Sequencers batch them`}>
        <P>
          <Trans>
            A <Term id='sequencer'>sequencer</Term> checks every ballot the way the zkVM guest will (ballot proof,
            signature, census proof, inputs hash) so that one bad ballot cannot sink a batch. It seals a{' '}
            <Term id='batch'>batch</Term> when enough votes are pending or the oldest has waited long enough, at most
            1024 votes and one per ballot slot.
          </Trans>
        </P>
        <P>
          <Trans>
            For each batch it draws a fresh secret seed, <Term id='re-encryption'>re-encrypts</Term> every ballot from
            it, silently re-randomizes other occupied slots, and builds the state-tree updates, the data blobs and the
            public values it expects the proof to produce.
          </Trans>
        </P>
        <SeeIt to={paths.sequencers()}>
          <Trans>Sequencers and the accounts that settled transitions</Trans>
        </SeeIt>
      </Section>

      <Section id='4-one-zkvm-proof-per-batch' title={t`4. One zkVM proof per batch`}>
        <P>
          <Trans>
            The whole batch is proven by one program, the vote-batch <Term id='guest'>guest</Term>, running in the ZisK
            zkVM. In one execution it checks every ballot proof, every signature, census membership, the state-tree
            updates, every re-encryption and silent refresh, the homomorphic tally and the layout of the data blobs.
          </Trans>
        </P>
        <P>
          <Trans>
            The ZisK proof is wrapped into a <Term id='plonk-proof'>PLONK proof</Term>: 768 bytes of proof plus 512
            bytes of <Term id='public-values'>public values</Term>, whatever the size of the batch. The public values
            are the guest’s output registers: the state roots before and after, the census root, the vote and overwrite
            counts, the blob digest and count, <C>occupied_before</C>, and the <C>ok</C> flag with its <C>fail_mask</C>.
          </Trans>
        </P>
        {active ? (
          <SeeIt to={paths.transition(active.id, active.transitions - 1)} hint={t`Every register with its meaning.`}>
            <Trans>The decoded public values of a recent transition</Trans>
          </SeeIt>
        ) : null}
      </Section>

      <Section id='5-settlement-with-blobs' title={t`5. Settlement, with blobs`}>
        <P>
          <Trans>
            The sequencer sends <C>submitStateTransition</C> as an EIP-4844 blob transaction. The{' '}
            <Term id='blob'>blobs</Term> publish what changed: the new vote ids, every ballot slot written, and the new
            encrypted tally. A slot’s first write is public, because refreshes only touch occupied slots; with a Merkle
            census the slot follows from the address, so who voted and when is public. What stays hidden is which
            occupied slots were overwritten and which were only refreshed.
          </Trans>
        </P>
        <P>
          <Trans>
            The registry verifies the PLONK proof against its pinned <Term id='program-vk'>program vk</Term>, checks
            that the batch starts at the process’s latest root, that the census root and the occupied-slot count match,
            that the voter limit holds, and that each blob opens to the value the guest computed. Then the process’s{' '}
            <C>latestStateRoot</C> moves to the new root and the registry emits <C>ProcessStateTransitioned</C>.
          </Trans>
        </P>
        <SeeIt to={paths.learn('settlement')}>
          <Trans>Every check of a settlement, in order</Trans>
        </SeeIt>
      </Section>

      <Section id='6-anyone-can-rebuild-the-state' title={t`6. Anyone can rebuild the state`}>
        <P>
          <Trans>
            Settlement is permissionless, so several sequencers can serve one process. A node that loses a race, and an{' '}
            <Term id='observer'>observer</Term> that never settles, rebuild each transition from its blobs and accept it
            only if replaying it gives the event’s new root. That is also how anyone can check, without a sequencer,
            that what was tallied is what was recorded.
          </Trans>
        </P>
      </Section>

      <Section id='7-results' title={t`7. Results`}>
        <P>
          <Trans>
            When the voting window ends, the encrypted tally (the results <Term id='accumulator'>accumulator</Term>,
            state leaf <C>0x04</C>) is decrypted. Only the final sum is decrypted by the protocol, and no ballot is
            opened on chain. The holder of the election key could decrypt any intermediate accumulator or ballot in the
            blobs.
          </Trans>
        </P>
        <UL>
          <li>
            <Trans>
              With a sequencer key, the node that holds the key decrypts the sum and proves the decryption with a second
              guest, the results guest. The registry verifies it against <C>resultsProgramVK</C> and checks it was made
              on the process’s final root.
            </Trans>
          </li>
          <li>
            <Trans>
              With a DKG key, a davinci-dkg committee threshold-decrypts it after the registry has checked the
              accumulator against the final root; every partial decryption and every combine carries a Groth16 proof.
            </Trans>
          </li>
        </UL>
        {ex.withResults ? (
          <SeeIt to={paths.process(ex.withResults.id, 'results')}>
            <Trans>The results of a finished process</Trans>
          </SeeIt>
        ) : (
          <P>
            <Trans>
              Read on: <A to={paths.learn('results')}>how results are produced</A> and{' '}
              <A to={paths.learn('key-modes')}>whom each key mode trusts</A>.
            </Trans>
          </P>
        )}
      </Section>
    </>
  )
}
