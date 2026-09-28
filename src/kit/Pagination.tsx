import { useLingui } from '@lingui/react/macro'
import { cn } from '~lib/cn'
import { formatNumber } from '~lib/format'
import { Button } from './Button'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

export interface PaginationProps {
  /** Zero-based page index. */
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  /** Shown as "x–y of total" when both are given. */
  pageSize?: number
  total?: number
  className?: string
}

/** Compact pager for lists that are paginated rather than virtualised. */
export function Pagination({ page, pageCount, onPageChange, pageSize, total, className }: PaginationProps) {
  const { t } = useLingui()
  const clamped = Math.min(Math.max(page, 0), Math.max(pageCount - 1, 0))
  const from = pageSize != null ? clamped * pageSize + 1 : null
  const to = pageSize != null && total != null ? Math.min((clamped + 1) * pageSize, total) : null
  const current = formatNumber(clamped + 1)
  const pages = formatNumber(pageCount || 1)
  let range: string
  if (from != null && to != null && total != null) {
    const first = formatNumber(from)
    const last = formatNumber(to)
    const all = formatNumber(total)
    range = t`${first}–${last} of ${all}`
  } else {
    range = t`page ${current} / ${pages}`
  }
  return (
    <div className={cn('flex items-center justify-between gap-4 text-xs text-ash', className)}>
      <span className='font-mono tnum'>{range}</span>
      <div className='flex items-center gap-1'>
        <Button
          size='icon'
          variant='subtle'
          aria-label={t`Previous page`}
          disabled={clamped <= 0}
          onClick={() => onPageChange(clamped - 1)}
        >
          <ChevronLeftIcon />
        </Button>
        <span className='px-2 font-mono tnum text-silver'>
          {current} / {pages}
        </span>
        <Button
          size='icon'
          variant='subtle'
          aria-label={t`Next page`}
          disabled={clamped >= pageCount - 1}
          onClick={() => onPageChange(clamped + 1)}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  )
}
