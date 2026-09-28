import { useLingui } from '@lingui/react/macro'
import { useCopy } from '~hooks/use-copy'
import { cn } from '~lib/cn'
import { CheckIcon, CopyIcon } from './icons'
import { Tooltip } from './Tooltip'

export interface CopyButtonProps {
  value: string
  /** Accessible name; defaults to "Copy" in the active language. */
  label?: string
  size?: number
  className?: string
}

/** Icon-only copy affordance. Flashes a check for 1.5 s. */
export function CopyButton({ value, label, size = 13, className }: CopyButtonProps) {
  const { t } = useLingui()
  const { copied, copy } = useCopy()
  const name = label ?? t`Copy`
  return (
    <Tooltip content={copied ? t`Copied` : name}>
      <button
        type='button'
        aria-label={name}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          copy(value)
        }}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-sm p-1 transition-colors',
          copied ? 'text-emerald' : 'text-ash hover:bg-onyx hover:text-ghost',
          className
        )}
      >
        {copied ? <CheckIcon size={size} /> : <CopyIcon size={size} />}
      </button>
    </Tooltip>
  )
}
