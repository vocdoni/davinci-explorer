import { Trans, useLingui } from '@lingui/react/macro'
import { Formula } from '~components/Formula'
import { InShort } from '~components/InShort'
import { paths } from '~routes/paths'
import type { LearnExamples } from '../examples'
import { C, Details, P, Section, SeeIt, SimpleTable, Term, UL } from '../prose'

export function Census({ ex }: { ex: LearnExamples }) {
  const { t } = useLingui()
  return (
    <>
      <InShort className='mb-8'>
        <Trans>
          Every election has a list of voters: who may vote, and with what weight. It can be a fixed list, a list the
          organizer can update, a list kept by a contract, or a service that signs each voter’s credential. Each voter’s
          ballot is kept in one place that follows from who they are, so a new vote from them replaces the old one.
        </Trans>
      </InShort>

      <Section id='four-census-origins' title={t`Four kinds of list`}>
        <P>
          <Trans>
            The <Term id='census'>list of voters</Term> says who may vote and with what weight. The organizer picks one
            of four kinds (the <Term id='census-origin'>census origin</Term>) when creating the election. The proof of
            each batch checks every voter against the list, and the registry checks that the list used is one the
            election accepts.
          </Trans>
        </P>
        <SimpleTable
          head={[t`Origin`, t`The list of voters`, t`What a batch may be checked against`]}
          rows={[
            [
              t`1 · Fixed list`,
              t`A list of voters, downloaded from the address the election names.`,
              t`The list fixed at creation.`,
            ],
            [
              t`2 · Updatable list`,
              <Trans>
                The same, but the organizer can replace it (<C>setProcessCensus</C>).
              </Trans>,
              t`The current list only.`,
            ],
            [
              t`3 · List kept by a contract`,
              <Trans>
                A contract keeps the list; sequencers rebuild it from the contract’s <C>CensusMemberAdded</C> logs.
              </Trans>,
              t`Any version that was still the contract’s current list at or after the block that created the election.`,
            ],
            [
              t`4 · Credential service provider`,
              t`A credential service (CSP) signs each voter’s credential; its address stands for the list.`,
              t`The provider’s address.`,
            ],
          ]}
        />
        <Details>
          <P>
            <Trans>
              For origins 1 to 3 the census is a lean-IMT <Term id='merkle-tree'>Merkle tree</Term>, and a batch is
              checked against its root, the <Term id='census-root'>census root</Term>. For origin 4 the census root is
              the CSP’s address.
            </Trans>
          </P>
        </Details>
      </Section>

      <Section id='merkle-censuses' title={t`Lists of voters`}>
        <P>
          <Trans>
            With a list (origins 1 to 3), each voter shows they are on it with a short proof, and the batch proof checks
            it for every voter in the batch.
          </Trans>
        </P>
        <UL>
          <li>
            <Trans>
              <strong className='font-medium text-silver'>Origin 2.</strong> Only the organizer can replace the list,
              keeping the same origin, and only while the election is Ready or Paused and before its end. Batches proven
              against the previous list are no longer recorded, and a pending vote whose entry in the list changed ends
              in an error and has to be cast again.
            </Trans>
          </li>
          <li>
            <Trans>
              <strong className='font-medium text-silver'>Origin 3.</strong> For every batch the registry asks the
              contract that keeps the list up to which block the batch’s version was current. That block must be a real
              one, not in the future and not before the election was created. A version recorded before the election but
              still current when it was created counts. So the contract must never drop a version, or batches proven
              against it would no longer be recorded. Weights must stay fixed too, a sequencer rule: a weight change
              makes the sequencer mark the list unusable.
            </Trans>
          </li>
        </UL>
        <Details>
          <P>
            <Trans>
              A voter proves membership with a lean-IMT (Poseidon) inclusion proof. Replacing an origin-2 census is{' '}
              <C>setProcessCensus</C>, which emits <C>CensusUpdated</C>. For origin 3 the registry calls{' '}
              <C>getRootBlockNumber(root)</C> on the census contract on every settlement. It returns the last block the
              root was valid: the current block for the current root, the block it was replaced in for an older one, and
              0 for a root the contract never held. It must be non-zero, not in the future and not before the process’s
              creation block. The contract has to be append-only, since a batch proven against an evicted root would
              stop settling.
            </Trans>
          </P>
        </Details>
      </Section>

      <Section id='credential-service-providers' title={t`Credential service providers`}>
        <P>
          <Trans>
            With origin 4 there is no list. A <Term id='csp'>credential service provider</Term> signs each voter’s
            credential, the batch proof checks the signature, and the registry checks that the signer is the election’s
            provider. A credential, once signed, cannot be revoked.
          </Trans>
        </P>
        <Details>
          <P>
            <Trans>
              Each voter presents an ECDSA (secp256k1) signature from the CSP. The guest recovers the signer and
              publishes its address as the batch’s census root, which the registry compares with the process’s CSP
              address. The origin’s on-chain name, <C>CSP_EDDSA_BABYJUBJUB_V1</C>, is historical. A signed credential
              cannot be revoked inside the circuit.
            </Trans>
          </P>
        </Details>
      </Section>

      <Section id='ballot-slots' title={t`Ballot slots`}>
        <P>
          <Trans>
            Each voter’s ballot is kept in one place in the election’s state, its <Term id='slot'>slot</Term>. A new
            vote from the same voter goes to the same slot and replaces the old ballot. With a list of voters the slot
            is computed from the voter’s address; with a credential service, from the number the service signs.
          </Trans>
        </P>
        <P>
          <Trans>
            The slot is on purpose not the voter’s position in the list. The proof of membership does not fix that
            position, and it would change as the list grows. A slot computed from the address stays put however the list
            grows.
          </Trans>
        </P>
        <P>
          <Trans>
            Two voters on one slot would replace each other’s ballots, so slots must be unique. A contract that keeps a
            list refuses a registration whose slot is taken, sequencers refuse any list with two voters on one slot, and
            the batch proof refuses two votes for one slot in a batch. Making a clash on purpose would take about{' '}
            <Formula expr='2^63 / N' /> key generations in a list of <Formula expr='N' /> members.
          </Trans>
        </P>
        <Details>
          <P>
            <Trans>With a Merkle census the slot comes from the voter’s address:</Trans>
          </P>
          <Formula block expr='slot = 0x10 + (be64(sha256("davinci-slot-v1" ‖ address)[0..8]) mod (2^63 − 16))' />
          <P>
            <Trans>
              A CSP census uses <Formula expr='0x10 + index' />, with the index the CSP signs. A lean-IMT proof does not
              bind the leaf index, so a proof of one leaf also verifies at other indexes, and a slot taken from the
              position would let a growing tree move voters between slots.
            </Trans>
          </P>
        </Details>
      </Section>

      <Section id='where-to-see-it' title={t`Where to see it`}>
        <P>
          <Trans>
            A process page’s overview shows what kind of list of voters the election uses, the list’s fingerprint (its
            census root) and its address. Every batch page checks the list its proof used against the lists the election
            accepts.
          </Trans>
        </P>
        {ex.newest ? (
          <SeeIt to={paths.process(ex.newest.id)}>
            <Trans>The list of voters of the newest election</Trans>
          </SeeIt>
        ) : (
          <SeeIt to={paths.processes()}>
            <Trans>Every process, filterable by the kind of list of voters</Trans>
          </SeeIt>
        )}
      </Section>
    </>
  )
}
