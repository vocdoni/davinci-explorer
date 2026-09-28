import type { ReactNode } from 'react'
import { cn } from '~lib/cn'
import { DotIcon } from './icons'

/**
 * Status tones (`ok`, `accent`, `done`, `info`, `warn`, `danger`, `neutral`)
 * and two category tints (`slate`, `violet`) for values that sit beside a
 * status, like a census origin or a key mode.
 */
export type BadgeTone = 'ok' | 'accent' | 'done' | 'info' | 'warn' | 'danger' | 'neutral' | 'slate' | 'violet'

// Every tone is filled: a tint of its hue behind text of the same hue, so no
// badge reads as "transparent, doesn't matter".
const TONES: Record<BadgeTone, string> = {
  ok: 'text-emerald border-emerald/30 bg-emerald/12',
  accent: 'text-emerald border-emerald/45 bg-emerald/18',
  done: 'text-green border-green/40 bg-green/16',
  info: 'text-blue border-blue/35 bg-blue/12',
  warn: 'text-amber border-amber/35 bg-amber/12',
  danger: 'text-red border-red/35 bg-red/12',
  neutral: 'text-pewter border-pewter/25 bg-pewter/12',
  slate: 'text-slate border-slate/30 bg-slate/12',
  violet: 'text-violet border-violet/30 bg-violet/12',
}

export interface BadgeProps {
  tone?: BadgeTone
  /** Prefix the label with a filled dot — for live/phase states. */
  dot?: boolean
  size?: 'sm' | 'md'
  title?: string
  className?: string
  children: ReactNode
}

/** Pill badge: emerald for live/ok, deeper green for done, blue for not yet, amber for warnings, red for failures. */
export function Badge({ tone = 'neutral', dot = false, size = 'md', title, className, children }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border font-medium tracking-[0.02em]',
        size === 'sm' ? 'px-2 py-[1px] text-[10px]' : 'px-2.5 py-[3px] text-[11px]',
        TONES[tone],
        className
      )}
    >
      {dot ? <DotIcon size={6} className='shrink-0' /> : null}
      {children}
    </span>
  )
}
