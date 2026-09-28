import { useMemo } from 'react'
import { plural } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
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
          note: `${formatDate(d.day)} · ${plural(transitions, { one: '# transition', other: '# transitions' })}`,
        }
      }),
    [days]
  )
  const total = formatNumber(days.reduce((n, d) => n + d.ballots, 0))
  const empty = days.every((d) => d.ballots === 0)

  return (
    <Panel
      title={t`Ballots settled per day`}
      label={t`Last ${DAYS} days, UTC`}
      description={t`A ballot is a new voter or an overwrite of an earlier vote. The silent refreshes each batch adds are not votes and are not counted.`}
      actions={<span className='font-mono text-[12px] text-ash tnum'>{t`${total} in total`}</span>}
    >
      {!loading && empty ? (
        <EmptyState
          compact
          title={t`No ballots settled in the last ${DAYS} days`}
          description={t`Each batch a sequencer settles adds its votes to the day it landed on.`}
        />
      ) : (
        <StackedBars
          data={data}
          loading={loading}
          height={200}
          series={[
            { key: 'newVoters', label: t`new voters`, color: CHART_COLORS.emerald },
            { key: 'overwrites', label: t`overwrites`, color: CHART_COLORS.slate },
          ]}
        />
      )}
    </Panel>
  )
}
