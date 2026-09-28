import type { ReactNode } from 'react'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { MonitorIcon, MoonIcon, SunIcon, Tooltip } from '~kit'
import { cn } from '~lib/cn'
import { useTheme } from '~theme/theme-context'
import type { ThemePreference } from '~theme/theme'

const OPTIONS: Array<{ value: ThemePreference; label: MessageDescriptor; icon: ReactNode }> = [
  { value: 'system', label: msg`System theme`, icon: <MonitorIcon size={14} /> },
  { value: 'light', label: msg`Light theme`, icon: <SunIcon size={14} /> },
  { value: 'dark', label: msg`Dark theme`, icon: <MoonIcon size={14} /> },
]

/** Three-way theme switch: follow the system, or force light or dark. */
export function ThemeToggle({ className }: { className?: string }) {
  const { i18n, t } = useLingui()
  const { preference, setPreference } = useTheme()
  return (
    <div
      role='radiogroup'
      aria-label={t`Theme`}
      className={cn('inline-flex shrink-0 items-center rounded-pill border border-charcoal bg-carbon p-0.5', className)}
    >
      {OPTIONS.map((o) => {
        const active = preference === o.value
        const label = i18n._(o.label)
        return (
          <Tooltip key={o.value} content={label}>
            <button
              type='button'
              role='radio'
              aria-checked={active}
              aria-label={label}
              data-theme-option={o.value}
              onClick={() => setPreference(o.value)}
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-pill transition-colors',
                active ? 'bg-onyx text-emerald' : 'text-ash hover:text-ghost'
              )}
            >
              {o.icon}
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}
