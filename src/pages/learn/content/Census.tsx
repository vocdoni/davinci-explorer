import { Trans, useLingui } from '@lingui/react/macro'
import { paths } from '~routes/paths'
import type { LearnExamples } from '../examples'
import { C, P, Section, SeeIt, SimpleTable, Term, UL } from '../prose'

export function Census({ ex }: { ex: LearnExamples }) {
  const { t } = useLingui()
  return (
    <>
      <Section id='four-census-origins' title={t`Four census origins`}>
        <P>
          <Trans>
            The census says who may vote and with what weight. Every process picks one of four origins at creation. The
            guest checks each voter’s membership in the batch it proves, and the registry checks that the census root
            the proof used is one the process accepts.
          </Trans>
        </P>
        <SimpleTable
          head={[t`Origin`, t`Census`, t`Root a transition may use`]}
          rows={[
            [
              t`1 · Merkle tree, fixed`,
              t`A lean-IMT Merkle tree, downloaded from the census URI.`,
              t`The root fixed at creation.`,
            ],
            [
              t`2 · Merkle tree, updatable`,
              <Trans>
                The same, but the organizer can replace it with <C>setProcessCensus</C>.
              </Trans>,
              t`The current root only.`,
            ],
            [
              t`3 · On-chain census contract`,
              <Trans>
                A contract; sequencers build the tree from its <C>CensusMemberAdded</C> logs.
              </Trans>,
              t`Any root the contract recorded at or after the process’s creation block.`,
            ],
            [
              t`4 · Credential service provider`,
              t`A signature from a census provider (CSP), whose address is the census root.`,
              t`The CSP address.`,
            ],
          ]}
        />
      </Section>

      <Section id='merkle-censuses' title={t`Merkle censuses`}>
        <P>
          <Trans>
            For origins 1 to 3 a voter proves membership with a lean-IMT (Poseidon) inclusion proof, and the guest
            checks it for every voter of the batch.
          </Trans>
        </P>
        <UL>
          <li>
            <Trans>
              <strong className='font-medium text-silver'>Origin 2.</strong> Only the organizer can call{' '}
              <C>setProcessCensus</C>, keeping the same origin, while the process is Ready or Paused and before its end.
              It emits <C>CensusUpdated</C>, and batches proven against the previous root no longer settle. A pending
              vote whose census entry changed ends in an error and has to be cast again.
            </Trans>
          </li>
          <li>
            <Trans>
              <strong className='font-medium text-silver'>Origin 3.</strong> On every settlement the registry asks the
              census contract for <C>getRootBlockNumber(root)</C>: it must be non-zero, not in the future and not before
              the process’s creation block. The contract has to be append-only, since a batch proven against an evicted
              root would stop settling. Weights must stay fixed too, a sequencer rule: a weight change makes the node
              mark the census unusable.
            </Trans>
          </li>
        </UL>
      </Section>

      <Section id='credential-service-providers' title={t`Credential service providers`}>
        <P>
          <Trans>
            With origin 4 each voter presents an ECDSA (secp256k1) signature from the CSP. The guest recovers the signer
            and publishes its address as the batch’s census root, which the registry compares with the process’s CSP
            address. The origin’s on-chain name, <C>CSP_EDDSA_BABYJUBJUB_V1</C>, is historical. A signed credential
            cannot be revoked inside the circuit.
          </Trans>
        </P>
      </Section>

      <Section id='ballot-slots' title={t`Ballot slots`}>
        <P>
          <Trans>
            Each voter’s ballot lives at one <Term id='slot'>slot</Term> of the state tree, and a revote overwrites it
            there. With a Merkle census the slot comes from the voter’s address:
          </Trans>
        </P>
        <P>
          <C>slot = 0x10 + (be64(sha256(&quot;davinci-slot-v1&quot; ‖ address)[0..8]) mod (2^63 − 16))</C>
        </P>
        <P>
          <Trans>
            A CSP census uses <C>0x10 + index</C>, with the index the CSP signs. The slot is not the voter’s position in
            the census tree: a lean-IMT proof does not bind the leaf index, so a proof of one leaf also verifies at
            other indexes, and a growing tree would move voters between slots. An address-derived slot stays put however
            the census grows.
          </Trans>
        </P>
        <P>
          <Trans>
            Two members on one slot would overwrite each other’s ballots, so slots must be unique. The census contract
            rejects a registration whose slot is taken, sequencers refuse any Merkle census with colliding slots, and
            the guest rejects two votes for one slot in a batch. Grinding a colliding address into a census of N members
            costs about 2<sup>63</sup>/N key generations.
          </Trans>
        </P>
      </Section>

      <Section id='where-to-see-it' title={t`Where to see it`}>
        <P>
          <Trans>
            A process’s overview shows its census origin, root and URI. Every transition page checks the census root its
            proof used against the roots the process accepts.
          </Trans>
        </P>
        {ex.newest ? (
          <SeeIt to={paths.process(ex.newest.id)}>
            <Trans>The census of the newest process</Trans>
          </SeeIt>
        ) : (
          <SeeIt to={paths.processes()}>
            <Trans>Processes, filterable by census origin</Trans>
          </SeeIt>
        )}
      </Section>
    </>
  )
}
