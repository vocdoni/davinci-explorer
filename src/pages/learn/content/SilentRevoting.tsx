import { Trans, useLingui } from '@lingui/react/macro'
import { Formula } from '~components/Formula'
import { InShort } from '~components/InShort'
import { paths } from '~routes/paths'
import type { LearnExamples } from '../examples'
import { A, C, Details, H3, P, Section, SeeIt, Term, UL } from '../prose'

export function SilentRevoting({ ex }: { ex: LearnExamples }) {
  const { t } = useLingui()
  const active = ex.active
  return (
    <>
      <InShort className='mb-8'>
        <Trans>
          While voting is open you may vote again, and the new ballot replaces the old one. Every batch also refreshes
          ballots nobody changed, so a changed vote looks like routine upkeep. The published data shows when a voter’s
          ballot place is first used, but not whether that voter changed their vote later.
        </Trans>
      </InShort>

      <Section id='revoting' title={t`Voting again`}>
        <P>
          <Trans>
            A voter may vote again while the process is open. The new ballot goes to the same{' '}
            <Term id='slot'>slot</Term> and replaces the old one: the batch proof takes the old ballot out of the
            encrypted total and adds the new one. The registry counts how many different voters have voted and how many
            ballots were replaced (<Term id='overwrite'>overwrites</Term>).
          </Trans>
        </P>
        <P>
          <Trans>
            Voting again only helps a voter if nobody can tell whose ballot was replaced. Two mechanisms make that so:
            re-encryption, and silent refreshes of ballots the batch did not change.
          </Trans>
        </P>
        <Details>
          <P>
            <Trans>
              The registry’s counters are <C>votersCount</C>, the distinct slots written, and{' '}
              <C>overwrittenVotesCount</C>.
            </Trans>
          </P>
        </Details>
      </Section>

      <Section id='re-encryption' title={t`Re-encryption`}>
        <P>
          <Trans>
            Before a ballot is stored, the sequencer changes how its encryption looks without changing what it says (
            <Term id='re-encryption'>re-encryption</Term>). Without the batch’s secret, nobody can match the ballot a
            voter sent to the one stored, so a voter cannot prove which ballot their slot holds.
          </Trans>
        </P>
        <P>
          <Trans>
            It does not hide whose slot it is: the sequencer that sealed the batch knows the secret, and with a voter
            list the slot follows from the voter’s address.
          </Trans>
        </P>
        <P>
          <Trans>
            The secret exists in the sequencer’s memory for one batch only and is never written or logged. The prover
            deletes its copy of the input after proving only when it runs without <C>DAVINCI_KEEP_INPUTS=1</C>. That is
            an operator setting you have to trust; nothing on chain shows it.
          </Trans>
        </P>
        <Details>
          <P>
            <Trans>
              Re-encryption adds an encryption of zero with a fresh random scalar to every ciphertext; the plaintext
              does not change. The scalars come from one secret seed per batch, drawn from the operating system’s
              randomness, through a SHA-256 chain that also takes the state root before the batch. Every element is used
              once, so no scalar repeats within a transition or across them. The guest recomputes the chain from the
              seed and verifies every re-encryption.
            </Trans>
          </P>
        </Details>
      </Section>

      <Section id='silent-refreshes' title={t`Silent refreshes`}>
        <P>
          <Trans>
            Every batch also refreshes some stored ballots it did not change: the same re-encryption, applied in place,
            so what they say stays the same. The sequencer picks them at random, never from public data, because a
            choice anyone could compute would let them take the refreshes out and spot the changed votes.
          </Trans>
        </P>
        <P>
          <Trans>
            A batch must refresh at least 16 ballots, at least twice as many as its changed votes and at least as many
            as its votes (the requirement stops at 2048), or every stored ballot it did not change when there are fewer.
            The refreshed ballots are written back like any other, and their refreshes are added to the encrypted total
            as well, so the total moves with every ballot the batch touched.
          </Trans>
        </P>
        <Details>
          <P>
            <Trans>
              Refreshes re-randomize occupied slots the batch did not write, with no change of plaintext, and the guest
              adds their encryptions of zero to the accumulator. The guest requires at least this many refreshes per
              batch:
            </Trans>
          </P>
          <Formula block expr='min(target, occupied_before − overwrites)' className='my-2' />
          <P>
            <Trans>with</Trans>
          </P>
          <Formula block expr='target = min(2048, max(16, 2 · overwrites, votes))' className='my-2' />
        </Details>
      </Section>

      <Section id='what-an-observer-can-and-cannot-see' title={t`What an observer can and cannot see`}>
        <div className='grid gap-x-8 sm:grid-cols-2'>
          <div>
            <H3>
              <Trans>What anyone can see</Trans>
            </H3>
            <UL>
              <li>
                <Trans>
                  Every slot each batch wrote, in one sorted list in the batch’s <Term id='blob'>blob</Term>.
                </Trans>
              </li>
              <li>
                <Trans>
                  When a slot is written for the first time, because refreshes only touch slots already in use. With a
                  voter list (origins 1 to 3) the slot follows from the voter’s address, so who voted and when is
                  public.
                </Trans>
              </li>
              <li>
                <Trans>
                  How many votes and how many changed votes each batch carried: they are in the proof’s public values
                  and in the registry’s counters.
                </Trans>
              </li>
              <li>
                <Trans>
                  <C>occupied_before</C>, the number of slots written before the batch. The proof cannot see the whole
                  state, so the registry checks it against its own count of voters.
                </Trans>
              </li>
              <li>
                <Trans>
                  Your own <Term id='vote-id'>vote id</Term>, in the blob of the batch that included it. Vote ids are
                  only ever added, so an earlier vote id stays after a revote; only the latest ballot of the slot is
                  counted.
                </Trans>
              </li>
            </UL>
          </div>
          <div>
            <H3>
              <Trans>What stays hidden</Trans>
            </H3>
            <UL>
              <li>
                <Trans>
                  Which slots already in use were changed and which were only refreshed: in the blob they look the same.
                </Trans>
              </li>
              <li>
                <Trans>Which slots were overwritten, even though the number of overwrites is public.</Trans>
              </li>
              <li>
                <Trans>Which stored ballot matches the one a voter sent, without the batch’s secret.</Trans>
              </li>
            </UL>
          </div>
        </div>
        <Details>
          <P>
            <Trans>
              One known limit: re-encryption scalars are SHA-256 digests reduced modulo the BN254 prime, which leaves
              them 2<sup>−7.6</sup> away from uniform modulo the subgroup order.
            </Trans>
          </P>
        </Details>
      </Section>

      <Section id='where-to-see-it' title={t`Where to see it`}>
        {active ? (
          <SeeIt
            to={paths.transition(active.id, active.transitions - 1)}
            hint={t`Overwrites and refreshes look alike; first writes do not.`}
          >
            <Trans>The slot updates of a recent transition</Trans>
          </SeeIt>
        ) : null}
        <SeeIt to={paths.votes()}>
          <Trans>Look up a vote</Trans>
        </SeeIt>
        <P>
          <Trans>
            Next: <A to={paths.learn('blobs')}>what the blobs publish</A>.
          </Trans>
        </P>
      </Section>
    </>
  )
}
