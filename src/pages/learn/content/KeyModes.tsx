import { Trans, useLingui } from '@lingui/react/macro'
import { Formula } from '~components/Formula'
import { InShort } from '~components/InShort'
import { paths } from '~routes/paths'
import type { LearnExamples } from '../examples'
import { A, C, Details, H3, P, Section, SeeIt, SimpleTable, Term, UL } from '../prose'

export function KeyModes({ ex }: { ex: LearnExamples }) {
  const { t } = useLingui()
  return (
    <>
      <InShort className='mb-8'>
        <Trans>
          Ballots are encrypted to one key per process. Whoever holds the matching secret could read the ballots, and is
          the one who can publish the results. There are three choices: one sequencer holds it, a committee holds it in
          shares, or the committee and the organizer each hold a part.
        </Trans>
      </InShort>

      <Section id='why-the-key-matters' title={t`Why the key matters`}>
        <P>
          <Trans>
            Every ballot is encrypted to the process’s key. Whoever can use the matching secret could open any ballot in
            the published blobs, and is the one who can publish the results. The organizer decides who that is when
            creating the process (the <Term id='key-mode'>key mode</Term>). The programs that check the batches are the
            same in every mode.
          </Trans>
        </P>
        <SimpleTable
          head={[t`Mode`, t`Who holds the secret`, t`How the results come out`]}
          rows={[
            [
              t`Sequencer key`,
              t`One sequencer node, the one that handed out the key.`,
              t`That node decrypts the total and proves the decryption is correct.`,
            ],
            [
              t`DKG automatic`,
              t`Nobody holds it whole: each member of a committee holds one share.`,
              t`Enough committee members decrypt together, once voting has ended.`,
            ],
            [
              t`DKG locked`,
              t`The committee, plus a secret the organizer keeps.`,
              t`The committee decrypts only after the organizer reveals its secret.`,
            ],
          ]}
        />
        <Details>
          <P>
            <Trans>
              The key mode is chosen in <C>newProcess</C>. The organizer only ever talks to the registry; in the DKG
              modes the davinci-dkg committee sits behind it. The zkVM guests are the same in every mode; with a
              sequencer key the node proves the tally with the results guest.
            </Trans>
          </P>
        </Details>
      </Section>

      <Section id='sequencer-key' title={t`Sequencer key`}>
        <P>
          <Trans>
            The organizer asks a sequencer for the key before creating the process. That sequencer is then the only one
            that can publish the results, and it could also open every ballot in the blobs. This mode trusts one node
            with ballot secrecy: it suits testing, and organizers who accept that trust.
          </Trans>
        </P>
        <Details>
          <P>
            <Trans>
              The request is <C>POST /processes/keys</C>, for the process id the organizer is about to create. The node
              derives the secret from its own master secret and the process id, so it stores nothing per process, and a
              key handed out for one id is useless under any other. The results come out through a results proof.
            </Trans>
          </P>
        </Details>
      </Section>

      <Section id='dkg-automatic' title={t`DKG automatic`}>
        <P>
          <Trans>
            The key comes from a <Term id='committee'>committee</Term> of independent operators, which creates keys
            together so that no member ever knows a whole secret: each holds one share. No sequencer and no organizer
            holds the secret.
          </Trans>
        </P>
        <P>
          <Trans>
            After voting ends, anyone can ask for the results; sequencers ask on their own shortly after the end. The
            registry first checks that the encrypted total is the one in the process’s final state, then hands it to the
            committee. Enough members (the <Term id='threshold'>threshold</Term>) decrypt it together, each step with a
            proof.
          </Trans>
        </P>
        <Details>
          <P>
            <Trans>
              The process key is one of the <Term id='pool-key'>pool keys</Term> of a davinci-dkg{' '}
              <Term id='epoch'>epoch</Term>. The registry’s adapter registers a DKG application for the process on the
              newest Live epoch with a free pool key, and the key of the process is that pool key.
            </Trans>
          </P>
          <P>
            <Trans>
              Sequencers ask for the decryption on their first heartbeat after the end. The registry checks the
              encrypted tally against the final state root and hands one ciphertext per ballot field to the committee;
              each member’s partial decryption carries a Groth16 proof.
            </Trans>
          </P>
        </Details>
      </Section>

      <Section id='dkg-locked' title={t`DKG locked`}>
        <P>
          <Trans>
            The key combines a committee key with a key of the organizer’s. The organizer receives its secret when
            creating the process, and the registry never stores it. The committee cannot start decrypting until the
            organizer reveals the secret, so the organizer decides when the results appear, but not what they are.
          </Trans>
        </P>
        <UL>
          <li>
            <Trans>Losing the organizer secret loses the results.</Trans>
          </li>
          <li>
            <Trans>
              The secret can be revealed at any time. An organizer that reveals it while voting is open leaves the
              process with the trust of the automatic mode.
            </Trans>
          </li>
          <li>
            <Trans>
              The organizer’s proof of owning its key names the committee round (the epoch), so a locked process names
              its epoch; apps read it from the adapter’s <C>registrationEpoch()</C>.
            </Trans>
          </li>
        </UL>
        <Details>
          <P>
            <Trans>
              The process key is the pool key plus the organizer key, <Formula expr='P_j + PK_org' />. The organizer’s
              secret <Formula expr='sk_org' /> is returned to the organizer at creation and never stored by the
              registry. The committee’s partial decryptions do not begin until the organizer calls{' '}
              <C>revealProcessKey</C> with it. The organizer’s proof of possession binds the epoch.
            </Trans>
          </P>
        </Details>
      </Section>

      <Section id='what-the-committee-never-does' title={t`What the committee never does`}>
        <P>
          <Trans>
            The committee never rebuilds the process’s secret, which would open every ballot in the blobs. It decrypts
            only the final total, one encrypted number per ballot field. A field whose encrypted total is still empty
            (as in a process that never counted a ballot) decrypts to 0 under any key, so the registry records 0 for it
            without asking the committee.
          </Trans>
        </P>
        <Details>
          <P>
            <Trans>
              The committee threshold-decrypts only the final accumulator, one ciphertext per ballot field. An empty
              field is one whose ciphertext is the identity.
            </Trans>
          </P>
        </Details>
      </Section>

      <Section id='trust-and-accepted-risks' title={t`Trust and accepted risks`}>
        <H3>
          <Trans>Sequencer key</Trans>
        </H3>
        <UL>
          <li>
            <Trans>
              The sequencer that holds the key can decrypt every ballot and is the only party able to publish the
              results.
            </Trans>
          </li>
        </UL>
        <H3>
          <Trans>DKG keys</Trans>
        </H3>
        <UL>
          <li>
            <Trans>
              Enough members of one committee round (a threshold of the epoch’s committee) could together decrypt every
              ballot of the processes keyed on that round, with the organizer secret as well in locked mode. The design
              trusts the threshold not to collude.
            </Trans>
          </li>
          <li>
            <Trans>
              A process’s key belongs to one round’s committee and cannot move to another (there is no resharing). If
              more than <Formula expr='n − t' /> of its members leave before the process ends, its results are lost.
            </Trans>
          </li>
          <li>
            <Trans>
              The committee’s search for a decrypted value stops at <Formula expr='2^50' /> per field. DAVINCI caps
              results well below that.
            </Trans>
          </li>
          <li>
            <Trans>
              Anyone can register applications on the committee, and each takes one of the round’s pool keys, so sixteen
              cheap calls use a round up. The operators then create the next round at once, and creating DKG-mode
              processes pauses for one round’s setup.
            </Trans>
          </li>
          <li>
            <Trans>
              Between the end and the first decryption request, the organizer can still cancel a Ready or Paused process
              without having seen the results, the same power it has with a sequencer key. The request itself moves the
              process to Ended, which only the registry can leave, because the decrypted values become public on the DKG
              before they reach the registry.
            </Trans>
          </li>
        </UL>
      </Section>

      <Section id='where-to-see-it' title={t`Where to see it`}>
        <P>
          <Trans>
            A process’s <strong className='font-medium text-silver'>Encryption key</strong> tab shows its mode and its
            key and, in the DKG modes, the epoch, the application id, the pool key and whether the organizer secret was
            revealed. The contracts page shows the committee itself.
          </Trans>
        </P>
        {ex.dkg ? (
          <SeeIt to={paths.process(ex.dkg.id, 'key')}>
            <Trans>The key of a DKG-mode process</Trans>
          </SeeIt>
        ) : ex.newest ? (
          <SeeIt to={paths.process(ex.newest.id, 'key')}>
            <Trans>The key of the newest process</Trans>
          </SeeIt>
        ) : null}
        <SeeIt to={`${paths.contracts()}#dkg`}>
          <Trans>The DKG committee behind this registry</Trans>
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
