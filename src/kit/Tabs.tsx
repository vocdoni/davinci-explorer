import * as RadixTabs from '@radix-ui/react-tabs'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { cn } from '~lib/cn'

export interface TabItem {
  value: string
  label: ReactNode
  /** Small count/badge after the label. */
  meta?: ReactNode
  content: ReactNode
  disabled?: boolean
}

export interface TabsProps {
  items: TabItem[]
  /** Controlled value; omit for uncontrolled with `defaultValue`. */
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
  listClassName?: string
}

/** Underlined tabs. Active tab is emerald with an emerald rule beneath it. */
export function Tabs({ items, value, defaultValue, onValueChange, className, listClassName }: TabsProps) {
  const list = useRef<HTMLDivElement>(null)
  // On a narrow screen the strip scrolls sideways: bring the active tab into it, without scrolling the page.
  useLayoutEffect(() => {
    const strip = list.current
    const active = strip?.querySelector<HTMLElement>('[data-state="active"]')
    if (!strip || !active) return
    const left = active.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft
    if (left < strip.scrollLeft || left + active.offsetWidth > strip.scrollLeft + strip.clientWidth)
      strip.scrollLeft = Math.max(0, left - 16)
  }, [value])
  return (
    <RadixTabs.Root
      value={value}
      defaultValue={defaultValue ?? items[0]?.value}
      onValueChange={onValueChange}
      className={cn('w-full', className)}
    >
      <RadixTabs.List
        ref={list}
        className={cn('flex gap-1 overflow-x-auto border-b border-charcoal scroll-slim', listClassName)}
      >
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={cn(
              'relative -mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-[13px] font-medium',
              'text-pewter transition-colors hover:text-ghost disabled:opacity-40',
              'data-[state=active]:border-emerald data-[state=active]:text-emerald'
            )}
          >
            {item.label}
            {item.meta ? <span className='ml-2 font-mono text-[11px] tnum text-ash'>{item.meta}</span> : null}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map((item) => (
        <RadixTabs.Content key={item.value} value={item.value} className='pt-5 focus-visible:outline-none'>
          {item.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  )
}
