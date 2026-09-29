import { Trans, useLingui } from '@lingui/react/macro'
import { InShort } from '~components/InShort'
import { paths } from '~routes/paths'
import type { LearnExamples } from '../examples'
import { A, C, Details, P, Section, SeeIt, Term, UL } from '../prose'

export function HowItWorks({ ex }: { ex: LearnExamples }) {
  const { t } = useLingui()
  const active = ex.active
  return (
    <>
      <InShort className='mb-8'>
        <ul>
          <li>
            <Trans>An organizer creates an election on a public contract, the registry.</Trans>
          </li>
          <li>
            <Trans>
              Voters send encrypted ballots. They are added up while still encrypted, and only the final total is
              decrypted.
            </Trans>
          </li>
          <li>
            <Trans>
              Nodes called sequencers group the votes into batches and record each batch on the chain with a proof that
              it was counted correctly.
            </Trans>
          </li>
          <li>
            <Trans>
              What each batch changed is published, so anyone can check what was counted without trusting the
              sequencers.
            </Trans>
          </li>
        </ul>
      </InShort>

      <Section id='the-parts' title={t`Who does what`}>
        <P>
          <Trans>
            DAVINCI is a voting protocol in which every step of the count is proven. Four parties take part in an
            election, which the registry and this explorer call a <Term id='process'>process</Term>:
          </Trans>
        </P>
        <UL>
          <li>
            <Trans>
              <strong className='font-medium text-silver'>The organizer</strong> creates the election on the{' '}
              <Term id='registry'>registry</Term> contract, <C>ProcessRegistry</C>, and sets its rules.
            </Trans>
          </li>
          <li>
            <Trans>
              <strong className='font-medium text-silver'>Voters</strong> encrypt their ballots in their voting app and
              send them to a sequencer.
            </Trans>
          </li>
          <li>
            <Trans>
              <strong className='font-medium text-silver'>Sequencers</strong> collect the votes, prove them in batches
              and record each batch on the registry (in technical terms, they settle it).
            </Trans>
          </li>
          <li>
            <Trans>
              <strong className='font-medium text-silver'>The key holder</strong> decrypts the final total when voting
              ends, and that step is proven too. It is one sequencer, or a <Term id='committee'>key committee</Term> of
              independent operators (davinci-dkg).
            </Trans>
          </li>
        </UL>
        <P>
          <Trans>
            This explorer reads what was recorded from the chain: the registry’s events, the transactions that recorded
            each batch and the data blobs they carry, which a beacon node serves. What only a sequencer can tell
            (whether a vote is still pending, receipts for votes, data the beacon has already deleted) is labelled as
            coming from a sequencer.
          </Trans>
        </P>
      </Section>

      <Section id='1-a-process-is-created' n={1} title={t`An election is created`}>
        <P>
          <Trans>
            The organizer creates the election on the registry and fixes its rules: when voting opens and closes, how
            many people may vote at most, what a valid ballot looks like (the <Term id='ballot-mode'>ballot rules</Term>
            ), who may vote (the <Term id='census'>list of voters</Term>) and who holds the key that will decrypt the
            results (the <Term id='key-mode'>key mode</Term>). The registry gives the election a unique{' '}
            <Term id='process-id'>process id</Term>.
          </Trans>
        </P>
        <P>
          <Trans>
            The registry then takes a <Term id='fingerprint'>fingerprint</Term> of the starting state itself. Every
            later state grows from it, so none of these rules can be swapped afterwards.
          </Trans>
        </P>
        <P>
          <Trans>
            The title, the question and the names of the options are not on the chain. They are in a description
            document the organizer publishes, and the registry records its address and its fingerprint (the{' '}
            <Term id='metadata-hash'>metadata hash</Term>). The explorer shows the document’s text as the organizer’s
            only when the two match. The organizer can publish a new version until voting ends; a version published
            while voting was open is flagged, because votes cast before it were cast under the previous one.
          </Trans>
        </P>
        <Details>
          <P>
            <Trans>
              The organizer calls <C>newProcess</C> with the voting window, the maximum number of voters, the ballot
              mode, the census and the key mode. The process id is the organizer’s address, a 4-byte prefix of this
              registry and a 7-byte per-organizer nonce.
            </Trans>
          </P>
          <P>
            <Trans>
              The fingerprint is the <Term id='genesis-root'>genesis state root</Term>: the root of a SHA-256 sparse
              Merkle tree with six leaves (the process id, the packed ballot mode, a hash of the encryption key, an
              empty results accumulator, the census origin and the ballot VK hash).
            </Trans>
          </P>
          <P>
            <Trans>
              The chain knows a ballot only as numbers in fields. <C>newProcess</C> records the metadata document’s
              address together with its metadata hash, the SHA-256 of its exact bytes, and the explorer downloads the
              document and hashes it. New versions go through <C>setProcessMetadata</C> until voting ends; after that
              the document is frozen. Every version stays on the registry’s log.
            </Trans>
          </P>
        </Details>
        <SeeIt to={paths.processes()}>
          <Trans>Every election on this registry, with its rules</Trans>
        </SeeIt>
      </Section>

      <Section id='2-voters-cast-ballots' n={2} title={t`Voters send encrypted ballots`}>
        <P>
          <Trans>
            The voting app encrypts each answer before it leaves the device, so the <Term id='ballot'>ballot</Term>{' '}
            travels and is stored as numbers only the key holder could read. With it, the app sends a{' '}
            <Term id='ballot-proof'>ballot proof</Term>: a proof that the encrypted ballot follows the rules of the
            election, which does not reveal what it says.
          </Trans>
        </P>
        <P>
          <Trans>
            The app signs the ballot, adds the voter’s proof of being on the list of voters and sends everything to a
            sequencer. It shows the voter a <Term id='vote-id'>vote id</Term>, the number to find the vote again later.
          </Trans>
        </P>
        <Details>
          <P>
            <Trans>
              A ballot is 16 ElGamal ciphertexts on the BabyJubJub curve, encrypted under the process key; the ballot
              mode says how many of them carry values and which values are allowed. The ballot proof is a Groth16 proof
              of the davinci-circom circuit that the ballot is a correct encryption for this process. Its inputs hash
              commits to the process id, the ballot mode, the key, the voter’s address, the vote id, the ciphertexts and
              the voter’s weight.
            </Trans>
          </P>
          <P>
            <Trans>
              The client signs the vote id with the voter’s Ethereum key and sends ballot, proof, signature and census
              proof to a sequencer.
            </Trans>
          </P>
        </Details>
      </Section>

      <Section id='3-sequencers-batch-them' n={3} title={t`Sequencers batch them`}>
        <P>
          <Trans>
            A <Term id='sequencer'>sequencer</Term> checks each ballot as it arrives, so that one bad ballot cannot
            spoil a whole <Term id='batch'>batch</Term>. It closes a batch when enough votes are waiting or the oldest
            has waited long enough: at most 1024 votes, and at most one per voter.
          </Trans>
        </P>
        <P>
          <Trans>
            Before storing the ballots it scrambles their encryption with a fresh secret (
            <Term id='re-encryption'>re-encryption</Term>), so nobody can match a stored ballot to the one a voter sent.
            It also refreshes some stored ballots that did not change, so that a changed vote does not stand out.{' '}
            <A to={paths.learn('silent-revoting')}>Changing your vote, privately</A> explains both.
          </Trans>
        </P>
        <Details>
          <P>
            <Trans>
              The sequencer checks every ballot the way the zkVM guest will: ballot proof, signature, census proof and
              inputs hash. A batch holds at most one vote per ballot slot.
            </Trans>
          </P>
          <P>
            <Trans>
              For each batch it draws a fresh secret seed, re-encrypts every ballot from it, silently re-randomizes
              other occupied slots, and builds the state-tree updates, the data blobs and the public values it expects
              the proof to produce.
            </Trans>
          </P>
        </Details>
        <SeeIt to={paths.sequencers()}>
          <Trans>Sequencers and the accounts that recorded batches</Trans>
        </SeeIt>
      </Section>

      <Section id='4-one-zkvm-proof-per-batch' n={4} title={t`One proof per batch`}>
        <P>
          <Trans>
            One program checks the whole batch, and its run is proven: the result is a small{' '}
            <Term id='proof'>proof</Term> that the chain can check quickly instead of redoing the work. The program
            checks every ballot proof, every signature and every voter’s place on the list of voters, stores the ballots
            and updates the encrypted total.
          </Trans>
        </P>
        <P>
          <Trans>
            What the proof makes public (its <Term id='public-values'>public values</Term>) is a short summary: the
            fingerprints of the state before and after, how many votes and changed votes the batch holds, and whether
            every check passed.
          </Trans>
        </P>
        <Details>
          <P>
            <Trans>
              The program is the vote-batch <Term id='guest'>guest</Term>, running in the ZisK{' '}
              <Term id='zkvm'>zkVM</Term>. In one execution it checks every ballot proof, every signature, census
              membership, the state-tree updates, every re-encryption and silent refresh, the homomorphic tally and the
              layout of the data blobs.
            </Trans>
          </P>
          <P>
            <Trans>
              The ZisK proof is wrapped into a <Term id='plonk-proof'>PLONK proof</Term>: 768 bytes of proof plus 512
              bytes of public values, whatever the size of the batch. The public values are the guest’s output
              registers: the state roots before and after, the census root, the vote and overwrite counts, the blob
              digest and count, <C>occupied_before</C>, and the <C>ok</C> flag with its <C>fail_mask</C>.
            </Trans>
          </P>
        </Details>
        {active ? (
          <SeeIt to={paths.transition(active.id, active.transitions - 1)} hint={t`Every value with its meaning.`}>
            <Trans>The decoded public values of a recent batch</Trans>
          </SeeIt>
        ) : null}
      </Section>

      <Section id='5-settlement-with-blobs' n={5} title={t`The batch is recorded, with its data`}>
        <P>
          <Trans>
            The sequencer sends the batch and its proof to the registry in one transaction. The registry records it only
            if the proof is valid, the batch starts from the latest state of the election, its voters were checked
            against the right list of voters and the voter limit holds. The election then moves to its new state. In
            technical terms the batch is settled, and a recorded batch is a{' '}
            <Term id='state-transition'>state transition</Term>.
          </Trans>
        </P>
        <P>
          <Trans>
            The same transaction carries the batch’s data in <Term id='blob'>data blobs</Term>: the new vote ids, every
            ballot the batch wrote (still encrypted) and the new encrypted total. It shows when a voter’s ballot place
            is used for the first time and, with a list of voters built from addresses, whose place it is. It does not
            show whether a voter who had already voted changed their vote or only had their stored ballot refreshed.
          </Trans>
        </P>
        <Details>
          <P>
            <Trans>
              The sequencer sends <C>submitStateTransition</C> as an EIP-4844 blob transaction. The registry verifies
              the PLONK proof against its pinned <Term id='program-vk'>program vk</Term>, checks that the batch starts
              at the process’s latest root, that the census root and the occupied-slot count match, that the voter limit
              holds, and that each blob opens to the value the guest computed. Then the process’s <C>latestStateRoot</C>{' '}
              moves to the new root and the registry emits <C>ProcessStateTransitioned</C>.
            </Trans>
          </P>
          <P>
            <Trans>
              A slot’s first write is public because refreshes only touch occupied slots; with a Merkle census the slot
              follows from the voter’s address, so who voted and when is public. What stays hidden is which occupied
              slots were overwritten and which were only refreshed.
            </Trans>
          </P>
        </Details>
        <SeeIt to={paths.learn('settlement')}>
          <Trans>Every check before a batch is recorded, in order</Trans>
        </SeeIt>
      </Section>

      <Section id='6-anyone-can-rebuild-the-state' n={6} title={t`Anyone can rebuild the state`}>
        <P>
          <Trans>
            Anyone may record batches (settlement is permissionless), so several sequencers can serve one election. A
            sequencer that loses a race, and an <Term id='observer'>observer</Term> that never records batches, rebuild
            each batch from its published data and accept it only if replaying it gives the new fingerprint the registry
            recorded. Anyone can do the same, without asking a sequencer, to check that what was counted is what was
            recorded.
          </Trans>
        </P>
      </Section>

      <Section id='7-results' n={7} title={t`Results`}>
        <P>
          <Trans>
            When voting ends, and the short <Term id='grace-window'>grace window</Term> that lets the last batches in
            has closed, the <Term id='accumulator'>encrypted total</Term> is decrypted and published as the results. The
            protocol decrypts only that final total, never a single ballot. The key holder could still decrypt any
            ballot or any earlier total from the published data, which is why the key mode matters.
          </Trans>
        </P>
        <UL>
          <li>
            <Trans>
              With a sequencer key, the sequencer that holds the key decrypts the total and proves the decryption with a
              second program. The registry checks that proof, and that it was made on the election’s final state.
            </Trans>
          </li>
          <li>
            <Trans>
              With a committee key, the key committee decrypts the total together, after the registry has checked it
              against the final state. Each of their steps carries a proof.
            </Trans>
          </li>
        </UL>
        <Details>
          <P>
            <Trans>
              The accumulator is state leaf <C>0x04</C>. With a sequencer key the second program is the results guest,
              and the registry verifies its proof against <C>resultsProgramVK</C> and checks it was made on the
              process’s final root. With a DKG key a davinci-dkg committee threshold-decrypts it after the registry has
              checked the accumulator against the final root; every partial decryption and every combine carries a
              Groth16 proof.
            </Trans>
          </P>
        </Details>
        {ex.withResults ? (
          <SeeIt to={paths.process(ex.withResults.id, 'results')}>
            <Trans>The results of a finished election</Trans>
          </SeeIt>
        ) : (
          <P>
            <Trans>
              Read on: <A to={paths.learn('results')}>how results are produced</A> and{' '}
              <A to={paths.learn('key-modes')}>who holds the key</A>.
            </Trans>
          </P>
        )}
      </Section>
    </>
  )
}
