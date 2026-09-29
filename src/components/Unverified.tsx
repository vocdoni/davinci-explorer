import { useLingui } from '@lingui/react/macro'
import { Tooltip, WarningIcon } from '~kit'
import { cn } from '~lib/cn'

/**
 * The mark beside organizer text (a title, a description, option names) read
 * from a document whose hash is not the one committed on-chain. Inside a
 * link, pass `focusable={false}`: the link takes the focus.
 */
export function UnverifiedMark({
  compact = false,
  focusable = true,
  className,
}: {
  compact?: boolean
  focusable?: boolean
  className?: string
}) {
  const { t } = useLingui()
  const label = t`unverified`
  return (
    <Tooltip
      content={t`Unverified: the document this comes from is not the one whose fingerprint the organizer recorded on the chain, so it may not be what voters were shown.`}
    >
      <span
        tabIndex={focusable ? 0 : undefined}
        data-testid='unverified-mark'
        role={compact ? 'img' : undefined}
        aria-label={compact ? label : undefined}
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-pill border border-red/35 bg-red/12 align-middle text-red',
          compact ? 'p-0.5' : 'px-1.5 py-px text-[10px] leading-none font-medium tracking-[0.02em] whitespace-nowrap',
          className
        )}
      >
        <WarningIcon size={10} />
        {compact ? null : label}
      </span>
    </Tooltip>
  )
}
