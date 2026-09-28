import { Trans, useLingui } from '@lingui/react/macro'
import { paths } from '~routes/paths'
import type { LearnExamples } from '../examples'
import { A, C, OL, P, Section, SeeIt, Term } from '../prose'

export function Results({ ex }: { ex: LearnExamples }) {
  const { t } = useLingui()
  return (
    <>
      <Section id='what-gets-decrypted' title={t`What gets decrypted`}>
        <P>
          <Trans>
            Every batch adds its ballots to one encrypted tally, the results <Term id='accumulator'>accumulator</Term>{' '}
            (state leaf <C>0x04</C>): 16 ElGamal ciphertexts, one per ballot field. Result <C>i</C> is the sum of field{' '}
            <C>i</C> over every counted ballot. Only the final sum is decrypted by the protocol. The holder of the
            election key could decrypt any intermediate accumulator or ballot in the blobs.
          </Trans>
        </P>
        <P>
          <Trans>
            A process takes results once it is Ended, or Ready or Paused with its end time past. How the sum is
            decrypted and proven depends on the <A to={paths.learn('key-modes')}>key mode</A>.
          </Trans>
        </P>
      </Section>

      <Section id='sequencer-key-a-results-proof' title={t`Sequencer key: a results proof`}>
        <P>
          <Trans>
            Once the process has ended and its tree is at the final on-chain root, the node holding the election key
            decrypts the accumulator (by a bounded search: at creation the registry requires the largest possible tally,
            maximum voters times the ballot’s maximum value, to stay within 10<sup>12</sup>). It then proves the
            decryption with the results guest, which checks:
          </Trans>
        </P>
        <OL>
          <li>
            <Trans>
              that the encryption key (leaf <C>0x03</C>) and the accumulator (leaf <C>0x04</C>) are leaves of the final
              state tree;
            </Trans>
          </li>
          <li>
            <Trans>
              one Chaum–Pedersen proof per ciphertext, showing each plaintext is the correct decryption under that key;
            </Trans>
          </li>
          <li>
            <Trans>that every coordinate and scalar is in range, so no value has a second encoding.</Trans>
          </li>
        </OL>
        <P>
          <Trans>
            <C>setProcessResults</C> then requires a sequencer-key process that has ended, <C>ok = 1</C> and{' '}
            <C>fail_mask = 0</C>, a state root equal to the process’s <C>latestStateRoot</C>, and a PLONK proof verified
            against <C>resultsProgramVK</C>. It stores one result per ballot field and moves the process to Results.
          </Trans>
        </P>
      </Section>

      <Section id='dkg-key-threshold-decryption' title={t`DKG key: threshold decryption`}>
        <OL>
          <li>
            <Trans>
              After the end, anyone can call <C>requestResultsDecryption</C> with the accumulator and its inclusion
              proof; sequencers do it on their first heartbeat after the end. The registry checks every coordinate is
              below the field, that the accumulator is leaf <C>0x04</C> under <C>latestStateRoot</C>, and moves the
              process to Ended, which the organizer can no longer change.
            </Trans>
          </li>
          <li>
            <Trans>
              It skips fields that are the identity in both halves (they count as 0, and only a process that never
              tallied a ballot has them), submits the rest to the committee through the adapter, and emits{' '}
              <C>ResultsDecryptionRequested</C>.
            </Trans>
          </li>
          <li>
            <Trans>
              Committee members post partial decryptions, each with a Groth16 proof against their committed share. Once
              a threshold has, one combines them, again with a Groth16 proof, and the plaintext is stored on the DKG. In
              locked mode none of this starts before the organizer reveals its secret.
            </Trans>
          </li>
          <li>
            <Trans>
              Anyone then calls <C>finalizeResultsFromDKG</C>, which reads the plaintexts, stores the results in field
              order and moves the process to Results. Until every ciphertext is combined it reverts with{' '}
              <C>ResultsNotReady</C>.
            </Trans>
          </li>
        </OL>
        <P>
          <Trans>
            There is no results PLONK in the DKG modes: the committee’s proofs of every partial decryption and combine,
            and the registry’s own inclusion check, replace it. DKG liveness is election liveness: once the ciphertexts
            are submitted there is no fallback.
          </Trans>
        </P>
      </Section>

      <Section id='where-to-see-it' title={t`Where to see it`}>
        {ex.withResults ? (
          <SeeIt to={paths.process(ex.withResults.id, 'results')}>
            <Trans>The tally of a finished process and how it was produced</Trans>
          </SeeIt>
        ) : (
          <SeeIt to={paths.processes({ status: 'results' })}>
            <Trans>Processes with results</Trans>
          </SeeIt>
        )}
        <P>
          <Trans>
            Next: check it yourself, as a <A to={paths.learn('verify-voter')}>voter</A>, an{' '}
            <A to={paths.learn('verify-organizer')}>organizer</A> or an{' '}
            <A to={paths.learn('verify-auditor')}>auditor</A>.
          </Trans>
        </P>
      </Section>
    </>
  )
}
