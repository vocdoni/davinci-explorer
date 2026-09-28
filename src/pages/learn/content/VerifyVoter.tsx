import { Trans, useLingui } from '@lingui/react/macro'
import { paths } from '~routes/paths'
import type { LearnExamples } from '../examples'
import { A, C, P, Section, SeeIt, Step, Steps, Term } from '../prose'

export function VerifyVoter({ ex }: { ex: LearnExamples }) {
  const { t } = useLingui()
  return (
    <>
      <Section id='what-you-can-check' title={t`What you can check`}>
        <P>
          <Trans>
            That your vote reached the chain in a proven transition, that it is under a state root the registry holds,
            and that it went into the tally that was decrypted.
          </Trans>
        </P>
        <P>
          <Trans>
            Your ballot stays encrypted on chain. Only the holder of the election key can open it: the sequencer that
            issued it in sequencer mode, or a threshold of the committee in the DKG modes. After re-encryption the
            stored ballot no longer matches the one your client sent, so you cannot prove which ballot your slot holds.
          </Trans>
        </P>
      </Section>

      <Section id='step-by-step' title={t`Step by step`}>
        <Steps>
          <Step n={1} title={t`Keep your process id and vote id`}>
            <P>
              <Trans>
                Keep both from your voting app: the <Term id='process-id'>process id</Term> of the election, <C>0x</C>{' '}
                and 62 hex digits, and the <Term id='vote-id'>vote id</Term> of your ballot, <C>0x</C> and 16 hex
                digits.
              </Trans>
            </P>
          </Step>
          <Step n={2} title={t`Look it up`}>
            <P>
              <Trans>
                Open the vote lookup and enter both. If this explorer is configured with a sequencer, it shows the
                status that node reports: pending (queued), aggregated (in a batch being proved), processed (proved,
                settlement pending), settled (on chain), or an error with its reason.
              </Trans>
            </P>
            <SeeIt to={paths.votes()}>
              <Trans>The vote lookup</Trans>
            </SeeIt>
          </Step>
          <Step n={3} title={t`Find the transition that included it`}>
            <P>
              <Trans>
                The explorer reads the blobs of the process’s transitions and finds the one that lists your vote id.
                That transition is on chain: the registry verified its proof and checked its blobs against it. A blob
                from the beacon is tied to the transaction by its commitment’s versioned hash. One from a sequencer’s
                archive is tied by position only, not checked against the transaction’s blob hashes, and the page says
                which.
              </Trans>
            </P>
          </Step>
          <Step n={4} title={t`Check the tracker proof`}>
            <P>
              <Trans>
                With a sequencer configured, the explorer also fetches your{' '}
                <Term id='tracker-proof'>tracker proof</Term>: the path from your vote id’s leaf to a state root. Your
                browser checks that the path reaches that root and that the root is one the registry has held for the
                process. That shows your vote was recorded as cast.
              </Trans>
            </P>
          </Step>
          <Step n={5} title={t`See it counted`}>
            <P>
              <Trans>
                When results are in, the process’s Results tab shows the tally. The guest added your ballot to the
                encrypted tally in the transition that included it, and what gets decrypted is the tally under the final
                state root, which grows from that transition. The registry checks that link before it accepts the
                results.
              </Trans>
            </P>
            {ex.withResults ? (
              <SeeIt to={paths.process(ex.withResults.id, 'results')}>
                <Trans>The results of a finished process</Trans>
              </SeeIt>
            ) : null}
          </Step>
        </Steps>
      </Section>

      <Section id='if-you-voted-more-than-once' title={t`If you voted more than once`}>
        <P>
          <Trans>
            Your latest vote replaces the earlier one in your ballot slot, and only it is counted. Your earlier vote ids
            stay in the tree, since vote ids are only ever added. Watching the chain, nobody can tell whether your slot
            was overwritten or only refreshed. Its first write is public, and with a Merkle census so is whose slot it
            is: see <A to={paths.learn('silent-revoting')}>revoting and silent refreshes</A>.
          </Trans>
        </P>
      </Section>
    </>
  )
}
