import * as RadixTooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { cn } from '~lib/cn'

/** Mount once, near the root. Radix requires a provider above every tooltip. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RadixTooltip.Provider delayDuration={120} skipDelayDuration={300}>
      {children}
    </RadixTooltip.Provider>
  )
}

export interface TooltipProps {
  content: ReactNode
  /**
   * The content is a value (a hash, an address, a URI): monospace, as wide as
   * the value up to the viewport, and broken anywhere past that. Prose
   * tooltips stay a readable column.
   */
  value?: boolean
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  /** Controlled open state, for a trigger that also opens on tap (see `Term`). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Rendered as-is; must accept a ref (Radix asChild). */
  children: ReactNode
  className?: string
}

export function Tooltip({
  content,
  value = false,
  side = 'top',
  align = 'center',
  open,
  onOpenChange,
  children,
  className,
}: TooltipProps) {
  if (content == null || content === '') return <>{children}</>
  return (
    <RadixTooltip.Root open={open} onOpenChange={onOpenChange}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            'z-50 rounded-sm border border-charcoal bg-onyx px-2.5 py-1.5',
            'text-[11px] leading-snug text-silver shadow-pop',
            // 16 px: the collision padding on both sides. A 66-character hex
            // string is ~440 px in the mono font, so it fits on one line
            // from a tablet up and wraps in two on a phone.
            value
              ? 'w-max max-w-[min(48rem,calc(100vw-16px))] font-mono break-all'
              : 'max-w-[min(20rem,calc(100vw-16px))] [overflow-wrap:anywhere]',
            className
          )}
        >
          {content}
          <RadixTooltip.Arrow className='fill-onyx' width={8} height={4} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  )
}
