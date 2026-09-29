import { Trans, useLingui } from '@lingui/react/macro'
import { Formula } from '~components/Formula'
import { InShort } from '~components/InShort'
import { NumberedList } from '~components/NumberedList'
import { paths } from '~routes/paths'
import type { LearnExamples } from '../examples'
import { A, C, Details, OL, P, Section, SeeIt, Term } from '../prose'

export function Results({ ex }: { ex: LearnExamples }) {
  const { t } = useLingui()
  return (
    <>
      <InShort className='mb-8'>
        <Trans>
          Every batch adds its ballots to one encrypted total. When voting ends only that total is decrypted, and the
          decryption is proven: with a sequencer key by a second proof the registry checks, with a committee key by the
          key committee’s proofs of each step. The registry records the results only when those proofs hold.
        </Trans>
      </InShort>

      <Section id='what-gets-decrypted' title={t`What gets decrypted`}>
        <P>
          <Trans>
            Each batch adds its ballots to one <Term id='accumulator'>encrypted total</Term>, with one encrypted number
            per ballot field. Result <Formula expr='i' /> is the sum of field <Formula expr='i' /> over every counted
            ballot. The protocol decrypts only the final total, never a single ballot. The key holder could decrypt any
            earlier total or any ballot in the published data.
          </Trans>
        </P>
        <P>
          <Trans>
            An election can get its results once its voting time is over and the{' '}
            <A to={`${paths.learn('settlement')}#after-the-end`}>grace window</A> after it has closed, so the results
            count every recorded vote. How the total is decrypted and proven depends on{' '}
            <A to={paths.learn('key-modes')}>who holds the key</A>.
          </Trans>
        </P>
        <Details>
          <P>
            <Trans>
              The accumulator is state leaf <C>0x04</C>: 16 ElGamal ciphertexts, one per ballot field.
            </Trans>
          </P>
        </Details>
      </Section>

      <Section id='sequencer-key-a-results-proof' title={t`Sequencer key: a results proof`}>
        <P>
          <Trans>
            Once the election has ended and its grace window has closed, so its state is final, the sequencer holding
            the key decrypts the total. It then proves the decryption with a second program, the results program, which
            checks:
          </Trans>
        </P>
        <NumberedList
          className='my-4 [&_li]:text-[14px]'
          items={[
            <Trans key='leaves'>
              that the key and the encrypted total it used are the ones in the election’s final state;
            </Trans>,
            <Trans key='cp'>that each decrypted number is the correct decryption of its encrypted number;</Trans>,
            <Trans key='range'>
              that every value is written in its only valid form, so none has a second encoding.
            </Trans>,
          ]}
        />
        <P>
          <Trans>
            The registry records the results only for an election with a sequencer key that has ended, when the proof
            says every check passed, was made on the election’s latest state and comes from the released results
            program. It stores one result per ballot field and moves the election to Results.
          </Trans>
        </P>
        <Details>
          <P>
            <Trans>
              Decryption is a bounded search. At creation, and whenever the organizer changes the voter limit (
              <C>setProcessMaxVoters</C>), the registry requires the largest possible total, the maximum number of
              voters times the ballot’s maximum value, to stay within the bound below.
            </Trans>
          </P>
          <Formula block expr='maxValue × maxVoters ≤ 10^12' className='my-2' />
          <P>
            <Trans>
              The results guest checks that the encryption key (leaf <C>0x03</C>) and the accumulator (leaf <C>0x04</C>)
              are leaves of the final state tree, one <Term id='chaum-pedersen-proof'>Chaum–Pedersen proof</Term> per
              ciphertext showing each plaintext is the correct decryption under that key, and that every coordinate and
              scalar is in range.
            </Trans>
          </P>
          <P>
            <Trans>
              <C>setProcessResults</C> then requires a sequencer-key process that has ended and whose grace window has
              closed (<C>GraceOpen</C> otherwise), <Formula expr='ok = 1, fail_mask = 0' />, a state root equal to the
              process’s <C>latestStateRoot</C>, and a PLONK proof verified against <C>resultsProgramVK</C>.
            </Trans>
          </P>
        </Details>
      </Section>

      <Section id='dkg-key-threshold-decryption' title={t`Committee key: decryption in shares`}>
        <P>
          <Trans>
            With a committee key there is no second program. The registry and the key committee do the checking:
          </Trans>
        </P>
        <NumberedList
          className='my-4 [&_li]:text-[14px]'
          items={[
            <Trans key='request'>
              Once the grace window after the end has closed, anyone can ask for the decryption; sequencers ask on their
              own shortly after. The registry checks that the encrypted total is the one in the election’s final state,
              and moves the election to Ended, which the organizer can no longer change.
            </Trans>,
            <Trans key='skip'>
              It skips fields that never received anything (they count as 0, and only an election that never counted a
              ballot has them) and sends the rest to the committee.
            </Trans>,
            <Trans key='partials'>
              Committee members post their parts of the decryption, each with a proof. Once enough have, one of them
              combines the parts, again with a proof, and the decrypted value is stored with the committee. In locked
              mode none of this starts before the organizer reveals its secret.
            </Trans>,
            <Trans key='finalize'>
              Anyone then asks the registry to collect the decrypted values. It stores them in field order and moves the
              election to Results; until every value is ready, the call is refused.
            </Trans>,
          ]}
        />
        <P>
          <Trans>
            There is no results proof in the committee modes: the committee’s proofs of every step and the registry’s
            own check of the encrypted total replace it. So the election’s results depend on the committee staying
            available: once the encrypted total is handed over there is no fallback.
          </Trans>
        </P>
        <Details>
          <OL>
            <li>
              <Trans>
                <C>requestResultsDecryption</C> takes the accumulator and its inclusion proof; sequencers call it on
                their first heartbeat after the grace window closes, and before that it reverts with <C>GraceOpen</C>.
                The registry checks every coordinate is below the field and that the accumulator is leaf <C>0x04</C>{' '}
                under <C>latestStateRoot</C>.
              </Trans>
            </li>
            <li>
              <Trans>
                Skipped fields are the identity in both halves. The rest go to the committee through the adapter, and
                the registry emits <C>ResultsDecryptionRequested</C>.
              </Trans>
            </li>
            <li>
              <Trans>
                Each partial decryption carries a Groth16 proof against the member’s committed share, and the combine
                carries another. The plaintext is stored on the DKG.
              </Trans>
            </li>
            <li>
              <Trans>
                <C>finalizeResultsFromDKG</C> reads the plaintexts. Until every ciphertext is combined it reverts with{' '}
                <C>ResultsNotReady</C> (<C>GraceOpen</C> while the grace window is open).
              </Trans>
            </li>
          </OL>
          <P>
            <Trans>There is no results PLONK in the DKG modes. DKG liveness is election liveness.</Trans>
          </P>
        </Details>
      </Section>

      <Section id='where-to-see-it' title={t`Where to see it`}>
        {ex.withResults ? (
          <SeeIt to={paths.process(ex.withResults.id, 'results')}>
            <Trans>The results of a finished election and how they were produced</Trans>
          </SeeIt>
        ) : (
          <SeeIt to={paths.processes({ status: 'results' })}>
            <Trans>Processes with results</Trans>
          </SeeIt>
        )}
        <P>
          <Trans>
            Next: check it yourself, as a <A to={paths.votes()}>voter</A>, an{' '}
            <A to={paths.verifyElection()}>organizer</A> or an <A to={paths.verifyDeployment()}>auditor</A>.
          </Trans>
        </P>
      </Section>
    </>
  )
}
