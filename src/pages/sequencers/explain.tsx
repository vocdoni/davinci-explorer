import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { NumberedList, Term } from '~components'
import { ChevronDownIcon } from '~kit'
import { paths } from '~routes/paths'

const LINK = 'text-pewter underline underline-offset-2 transition-colors hover:text-emerald'

/** How a batch gets recorded (settlement), for readers who want the mechanism: closed by default. */
export function SettlementDetails() {
  const { t } = useLingui()
  return (
    <details className='group rounded-md border border-charcoal bg-carbon'>
      <summary className='flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-[13px] font-medium text-pewter hover:text-ghost [&::-webkit-details-marker]:hidden'>
        <ChevronDownIcon size={14} className='-rotate-90 transition-transform group-open:rotate-0' />
        <Trans>How a batch gets recorded</Trans>
      </summary>
      <div className='grid gap-6 border-t border-charcoal px-5 py-4 lg:grid-cols-2'>
        <div>
          <h2 className='text-[14px] font-semibold text-ghost'>
            <Trans>What a sequencer does</Trans>
          </h2>
          <NumberedList
            className='mt-3'
            items={[
              t`It collects the encrypted ballots and checks each one the way the proof will: the ballot’s own proof, the signature, the voter’s place on the list of voters and the inputs hash.`,
              t`It groups them into batches, re-encrypts every ballot, and re-encrypts a sample of other ballots already stored (silent refreshes), so nobody can tell who changed their vote.`,
              t`It has the batch proven as one proof (a ZisK PLONK).`,
              t`It records the batch on the registry in one transaction, with the data anyone needs to rebuild the state attached as data blobs.`,
            ]}
          />
          <p className='mt-3 text-[13px]'>
            <Link to={paths.learn('how-it-works')} className={LINK}>
              <Trans>How it fits together</Trans>
            </Link>
          </p>
        </div>
        <div>
          <h2 className='text-[14px] font-semibold text-ghost'>
            <Trans>Why several can serve one election</Trans>
          </h2>
          <div className='mt-2 flex flex-col gap-2 text-[13px] leading-relaxed text-ash'>
            <p>
              <Trans>
                The registry takes a batch from anyone, as long as its proof is valid and it starts from the current
                state. When two nodes race, the first transaction lands and the other fails on that check. The loser
                rebuilds the winner’s batch from its published data, queues its own votes again and builds on the new
                state. A race costs gas; no vote is lost and the state stays consistent.
              </Trans>
            </p>
            <p>
              <Trans>
                A node without a key, an <Term id='observer'>observer</Term>, follows every election the same way and
                answers questions about it (receipts for votes included), but never records a batch. With a sequencer
                key, only the node that handed out the key can publish that election’s results.
              </Trans>
            </p>
          </div>
        </div>
      </div>
    </details>
  )
}
