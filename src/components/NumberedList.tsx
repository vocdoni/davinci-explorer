import type { ReactNode } from 'react'
import { cn } from '~lib/cn'

/** Steps or rules in order, each with its number in a small accent circle. */
export function NumberedList({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <ol className={cn('flex flex-col gap-2.5', className)}>
      {items.map((item, i) => (
        <li key={i} className='flex gap-3 text-[13px] leading-relaxed text-silver'>
          <span
            aria-hidden='true'
            className='mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald/40 font-mono text-[11px] text-emerald'
          >
            {i + 1}
          </span>
          <div className='min-w-0 flex-1'>{item}</div>
        </li>
      ))}
    </ol>
  )
}
