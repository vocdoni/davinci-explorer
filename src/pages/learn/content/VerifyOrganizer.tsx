import { Trans, useLingui } from '@lingui/react/macro'
import { checksum } from '~kit'
import { paths } from '~routes/paths'
import type { LearnExamples } from '../examples'
import { A, C, P, Section, SeeIt, Step, Steps, Term, UL } from '../prose'

export function VerifyOrganizer({ ex }: { ex: LearnExamples }) {
  const { t } = useLingui()
  const p = ex.newest
  const organizer = p ? checksum(p.organizer) : null
  return (
    <>
      <Section id='what-you-can-check' title={t`What you can check`}>
        <P>
          <Trans>
            That the registry stored the process you meant to create, that the key is the one you expect, that batches
            settle as votes come in, and that the results arrive. The explorer is read-only: the controls at the end of
            this guide are calls you make to the registry from your own account.
          </Trans>
        </P>
      </Section>

      <Section id='step-by-step' title={t`Step by step`}>
        <Steps>
          <Step n={1} title={t`Find your processes`}>
            <P>
              <Trans>
                Paste your address in the search box at the top, or filter the process list by organizer. The organizer
                is the account that called <C>newProcess</C>, and it is the first 20 bytes of every process id it
                created.
              </Trans>
            </P>
            {p ? (
              <SeeIt to={paths.processes({ organizer: p.organizer })} hint={t`For example ${organizer}.`}>
                <Trans>The processes of one organizer</Trans>
              </SeeIt>
            ) : (
              <SeeIt to={paths.processes()}>
                <Trans>All processes</Trans>
              </SeeIt>
            )}
          </Step>
          <Step n={2} title={t`Check what the registry stored`}>
            <P>
              <Trans>
                The overview tab shows the ballot mode in words, the census (origin, root and URI), the voting window,
                the maximum number of voters and your metadata. The process id, the ballot mode, the key and the census
                origin are fixed in the genesis state root, so they cannot change later.
              </Trans>
            </P>
          </Step>
          <Step n={3} title={t`Check the key`}>
            <P>
              <Trans>
                The encryption key tab shows the key mode and the key. With a sequencer key it should be the one the
                node gave you for this process id. With a DKG key it shows the epoch, the application id and the pool
                key; in locked mode, whether your secret has been revealed.
              </Trans>
            </P>
            <UL>
              <li>
                <Trans>
                  Keep the organizer secret of a locked process. Without it the committee never decrypts the tally.
                </Trans>
              </li>
              <li>
                <Trans>
                  A reveal works at any time, but revealing during voting drops the process to the automatic trust
                  model.
                </Trans>
              </li>
            </UL>
            {ex.dkg ? (
              <SeeIt to={paths.process(ex.dkg.id, 'key')}>
                <Trans>A DKG-mode key</Trans>
              </SeeIt>
            ) : null}
          </Step>
          <Step n={4} title={t`Watch the batches settle`}>
            <P>
              <Trans>
                The transitions tab lists every settled batch with its new voters and overwrites, and the chain of state
                roots from genesis to the registry’s latest root; a gap would show there. The votes tab lists the vote
                ids read from the blobs.
              </Trans>
            </P>
            {ex.active ? (
              <SeeIt to={paths.process(ex.active.id, 'transitions')}>
                <Trans>The transitions of an active process</Trans>
              </SeeIt>
            ) : null}
          </Step>
          <Step n={5} title={t`Get the results`}>
            <P>
              <Trans>
                Nothing settles after the end time. With a sequencer key, the node that holds the key publishes the
                results once the process has ended; it is the only one that can. With a DKG key anyone can ask the
                committee to decrypt, and sequencers do on their first heartbeat after the end; in locked mode the
                decryption waits for your reveal (<C>revealProcessKey</C> on the registry). The results tab shows how
                the tally was produced.
              </Trans>
            </P>
          </Step>
        </Steps>
      </Section>

      <Section id='your-controls' title={t`Your controls`}>
        <P>
          <Trans>Only the organizer can make these calls; each one shows up in the process’s history.</Trans>
        </P>
        <UL>
          <li>
            <Trans>
              <C>setProcessStatus</C>: from Ready or Paused, to Paused, Ready, Canceled or Ended. Pausing stops
              settlement but not the clock; votes can still queue at a sequencer and settle after you resume. Ending by
              hand also shortens the duration to the time elapsed. Canceled and Results are final.
            </Trans>
          </li>
          <li>
            <Trans>
              <C>setProcessDuration</C>: only longer, while Ready or Paused and before the current end.
            </Trans>
          </li>
          <li>
            <Trans>
              <C>setProcessMaxVoters</C>: while Ready or Paused, never below the voters already counted.
            </Trans>
          </li>
          <li>
            <Trans>
              <C>setProcessCensus</C>: only for an updatable Merkle census (origin 2), before the end. Batches proven
              against the old root stop settling.
            </Trans>
          </li>
        </UL>
        <P>
          <Trans>
            In the DKG modes, once a sequencer has requested the decryption the process is Ended and out of your hands,
            so the tally cannot be canceled after it becomes readable. See{' '}
            <A to={paths.learn('key-modes')}>key modes</A> and <Term id='census'>census origins</Term>.
          </Trans>
        </P>
      </Section>
    </>
  )
}
