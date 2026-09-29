import { useMemo } from 'react'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Term } from '~components'
import { useIndexer, useVotesPerDay } from '~data/hooks'
import { EmptyState, Panel } from '~kit'
import { CHART_COLORS, StackedBars, type BarDatum } from '~kit/charts'
import { formatDate, formatNumber } from '~lib/format'

const DAYS = 30

/** Ballots settled per UTC day: new voters and overwrites, stacked. */
export function VotesPerDayPanel() {
  const { t } = useLingui()
  const days = useVotesPerDay(DAYS)
  const { loading } = useIndexer()
  // Remade after a language switch: the router below the locale remounts.
  const data = useMemo<BarDatum[]>(
    () =>
      days.map((d) => {
        const transitions = d.transitions
        return {
          label: formatDate(d.day, 'short'),
          values: { newVoters: d.newVoters, overwrites: d.overwrites },
          note: `${formatDate(d.day)} · ${plural(transitions, { one: '# batch', other: '# batches' })}`,
        }
      }),
    [days]
  )
  const total = formatNumber(days.reduce((n, d) => n + d.ballots, 0))
  const empty = days.every((d) => d.ballots === 0)

  return (
    <Panel
      title={t`Votes recorded per day`}
      label={t`Last ${DAYS} days, UTC`}
      description={
        <Trans>
          Each vote is a new voter or a <Term id='overwrite'>changed vote</Term> that replaces an earlier one. The{' '}
          <Term id='silent-refresh'>silent refreshes</Term> each batch adds are not votes and are not counted.
        </Trans>
      }
      actions={<span className='font-mono text-[12px] text-ash tnum'>{t`${total} in total`}</span>}
    >
      {!loading && empty ? (
        <EmptyState
          compact
          title={t`No votes recorded in the last ${DAYS} days`}
          description={t`Each batch of votes counts on the day it was recorded on the chain.`}
        />
      ) : (
        <StackedBars
          data={data}
          loading={loading}
          height={200}
          series={[
            { key: 'newVoters', label: t`new voters`, color: CHART_COLORS.emerald },
            { key: 'overwrites', label: t`changed votes`, color: CHART_COLORS.slate },
          ]}
        />
      )}
    </Panel>
  )
}
