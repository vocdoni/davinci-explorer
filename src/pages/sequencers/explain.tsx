import { Trans } from '@lingui/react/macro'
import { Link } from 'react-router'
import { ChevronDownIcon } from '~kit'
import { paths } from '~routes/paths'

const LINK = 'text-pewter underline underline-offset-2 transition-colors hover:text-emerald'

/** How settlement works, for readers who want the mechanism: closed by default. */
export function SettlementDetails() {
  return (
    <details className='group rounded-md border border-charcoal bg-carbon'>
      <summary className='flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-[13px] font-medium text-pewter hover:text-ghost [&::-webkit-details-marker]:hidden'>
        <ChevronDownIcon size={14} className='-rotate-90 transition-transform group-open:rotate-0' />
        <Trans>How settlement works</Trans>
      </summary>
      <div className='grid gap-6 border-t border-charcoal px-5 py-4 lg:grid-cols-2'>
        <div>
          <h2 className='text-[14px] font-semibold text-ghost'>
            <Trans>What a sequencer does</Trans>
          </h2>
          <p className='mt-2 text-[13px] leading-relaxed text-ash'>
            <Trans>
              A sequencer takes encrypted ballots and checks each one the way the zkVM guest will: the ballot proof, the
              signature, the census proof and the inputs hash. It groups them into batches, re-encrypts every ballot,
              silently refreshes other occupied slots, has the batch proven as one ZisK PLONK and settles it on the
              registry in a blob transaction that carries everything needed to rebuild the state.
            </Trans>{' '}
            <Link to={paths.learn('how-it-works')} className={LINK}>
              <Trans>How it fits together</Trans>
            </Link>
          </p>
        </div>
        <div>
          <h2 className='text-[14px] font-semibold text-ghost'>
            <Trans>Why several can serve one process</Trans>
          </h2>
          <p className='mt-2 text-[13px] leading-relaxed text-ash'>
            <Trans>
              Settlement is permissionless: the registry takes a transition from anyone, as long as the proof verifies
              and it starts at the current state root. When two nodes race, the first transaction lands and the other
              reverts on that root check; the loser rebuilds the winner’s transition from its blobs, requeues its votes
              and builds on the new root. A race costs gas, never state. A node without a key, an observer, follows
              every process the same way and serves reads and tracker proofs, but never settles. With a sequencer key,
              only the node that handed out the key can publish that process’s results.
            </Trans>
          </p>
        </div>
      </div>
    </details>
  )
}
