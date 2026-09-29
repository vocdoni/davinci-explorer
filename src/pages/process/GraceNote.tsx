import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Term, Timestamp } from '~components'
import { useChain, type ProcessView } from '~data/hooks'
import { Callout } from '~kit'
import { formatSeconds, formatTimestamp } from '~lib/format'

/**
 * What the grace window let in: the batches recorded after the end, why the
 * registry accepts them, and what that asks you to trust. Context, not an
 * alarm, so the info tone. Nothing while the window has not opened.
 */
export function GraceNote({ view }: { view: ProcessView }) {
  const { t } = useLingui()
  const registry = useChain().registry
  const { row } = view
  const closing = row.phase === 'closing'
  const batches = row.graceBatches
  if (!closing && batches === 0) return null
  const votes = row.graceVotes
  const maxTotal = registry ? formatSeconds(registry.graceMaxTotal) : null
  const cap = row.graceCap != null ? formatTimestamp(row.graceCap) : null
  const title =
    batches > 0
      ? t`${plural(batches, { one: '# batch', other: '# batches' })} with ${plural(votes, { one: '# vote', other: '# votes' })} recorded after the end`
      : t`The grace window is open`
  return (
    <div data-testid='grace-note'>
      <Callout tone='info' title={title}>
        <p>
          <Trans>
            Sequencers record votes in batches, so votes cast just before the end can still be on their way when it
            passes. The registry keeps recording batches for a short <Term id='grace-window'>grace window</Term> after
            the end, and accepts the results only once it closes.
          </Trans>
        </p>
        {closing ? (
          <p className='mt-1.5'>
            {cap ? (
              <Trans>
                It closes <Timestamp value={row.graceEnd} />, later if another batch arrives, and at {cap} at the
                latest.
              </Trans>
            ) : (
              <Trans>
                It closes <Timestamp value={row.graceEnd} />, later if another batch arrives.
              </Trans>
            )}
          </p>
        ) : null}
        <p className='mt-1.5'>
          {maxTotal ? (
            <Trans>
              The registry cannot tell when a vote was cast, so a sequencer could also include a vote cast after the
              end. That is bounded: the window closes at most {maxTotal} after the end, and every batch’s time is
              public, as in the list below.
            </Trans>
          ) : (
            <Trans>
              The registry cannot tell when a vote was cast, so a sequencer could also include a vote cast after the
              end. That is bounded: the window is short and capped, and every batch’s time is public, as in the list
              below.
            </Trans>
          )}
        </p>
      </Callout>
    </div>
  )
}
