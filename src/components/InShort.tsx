import type { ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '~lib/cn'

/**
 * The plain summary at the top of a long page or panel: two to four short
 * sentences, or a short list, that say what the reader needs before any
 * detail. The accent bar marks it as a summary, not a status.
 */
export function InShort({
  children,
  title,
  className,
}: {
  children: ReactNode
  title?: ReactNode
  className?: string
}) {
  const { t } = useLingui()
  return (
    <section
      aria-label={t`In short`}
      data-testid='in-short'
      className={cn('rounded-md border border-charcoal border-l-2 border-l-emerald/70 bg-onyx/40 px-4 py-3', className)}
    >
      <div className='label-caps text-[11px] text-emerald'>{title ?? <Trans>In short</Trans>}</div>
      <div className='mt-1.5 text-[14px] leading-relaxed text-silver [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:marker:text-emerald'>
        {children}
      </div>
    </section>
  )
}
