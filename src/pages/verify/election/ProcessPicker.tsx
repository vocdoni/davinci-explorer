import { useMemo, useState } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { KeyModeBadge, ProcessPhaseBadge } from '~components'
import { useIndexer, useProcesses } from '~data/hooks'
import { Button, Card, EmptyState, Input, SearchIcon, SkeletonText } from '~kit'
import { formatDate, formatNumber } from '~lib/format'
import { isProcessId, normalizeProcessId } from '~protocol/process-id'
import { paths } from '~routes/paths'
import { ArrowRightIcon } from '../icons'
import { useProcessTitles } from '../titles'

const FIRST = 8

/** Search the registry's elections by title or id; the newest come first. */
export function ProcessPicker() {
  const { t } = useLingui()
  const { loading } = useIndexer()
  const rows = useProcesses()
  const titled = useMemo(() => rows.slice(0, 200), [rows])
  const titles = useProcessTitles(titled)
  const [query, setQuery] = useState('')
  const [all, setAll] = useState(false)
  const q = query.trim().toLowerCase()
  const matches = useMemo(
    () =>
      q
        ? rows.filter((r) => r.id.includes(q) || r.organizer.includes(q) || titles.get(r.id)?.toLowerCase().includes(q))
        : rows,
    [rows, titles, q]
  )
  const shown = all || q ? matches : matches.slice(0, FIRST)
  const pasted = isProcessId(query.trim()) ? normalizeProcessId(query.trim()) : null
  const total = rows.length
  const count = formatNumber(total)

  return (
    <Card flush className='overflow-hidden' data-testid='process-picker'>
      <div className='border-b border-charcoal p-4 sm:p-5'>
        <Input
          label={t`Find the election`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t`Title, process id or organizer`}
          iconLeft={<SearchIcon size={14} />}
          autoComplete='off'
          spellCheck={false}
          type='search'
          hint={t`The newest elections come first. Titles come from each organizer’s own description.`}
        />
      </div>
      {loading ? (
        <div className='p-5'>
          <SkeletonText lines={4} />
        </div>
      ) : shown.length === 0 ? (
        pasted ? (
          <div className='p-5'>
            <Link to={paths.verifyElection(pasted)} className='text-[14px] text-emerald hover:underline'>
              <Trans>Check election {pasted}</Trans>
            </Link>
          </div>
        ) : (
          <EmptyState
            title={total ? t`No election matches` : t`No elections on this registry yet`}
            description={total ? t`Try part of the title, or paste the whole process id.` : undefined}
          />
        )
      ) : (
        <ul className='divide-y divide-charcoal'>
          {shown.map((r) => {
            const title = titles.get(r.id)
            const created = r.createdAt != null ? formatDate(r.createdAt) : null
            const ballots = r.votersCount + r.overwrittenVotesCount
            return (
              <li key={r.id}>
                <Link
                  to={paths.verifyElection(r.id)}
                  data-testid='picker-row'
                  className='group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-onyx sm:px-5'
                >
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate text-[14px] font-medium text-ghost group-hover:text-emerald'>
                      {title ?? t`Untitled election`}
                    </span>
                    <span className='mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ash'>
                      <span className='font-mono'>
                        {r.id.slice(0, 10)}…{r.id.slice(-4)}
                      </span>
                      {created ? (
                        <span>
                          <Trans>created {created}</Trans>
                        </span>
                      ) : null}
                      <span>
                        <Plural value={ballots} one='# ballot' other='# ballots' />
                      </span>
                    </span>
                  </span>
                  <span className='hidden shrink-0 items-center gap-2 sm:flex'>
                    {r.keyMode ? <KeyModeBadge mode={r.keyMode} /> : null}
                    <ProcessPhaseBadge phase={r.phase} />
                  </span>
                  <span className='shrink-0 sm:hidden'>
                    <ProcessPhaseBadge phase={r.phase} />
                  </span>
                  <ArrowRightIcon size={14} className='hidden shrink-0 text-ash group-hover:text-emerald sm:block' />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {!q && !all && matches.length > FIRST ? (
        <div className='border-t border-charcoal p-3 text-center'>
          <Button variant='subtle' size='sm' onClick={() => setAll(true)}>
            <Trans>Show all {count} elections</Trans>
          </Button>
        </div>
      ) : null}
    </Card>
  )
}
