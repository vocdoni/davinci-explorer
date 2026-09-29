// A protocol word in running text, with its glossary definition one hover
// away. See docs/writing.md for when to use it.

import { useRef, useState, type ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { glossaryEntry, glossaryHref, type GlossaryId } from '~content/glossary'
import { Tooltip } from '~kit'
import { cn } from '~lib/cn'
import { RichText } from './RichText'

/**
 * `<Term id='vote-id'>vote id</Term>`: the words as written (so they read
 * naturally in the sentence and translate with it), a dotted underline, and
 * the glossary's short definition in a tooltip on hover and keyboard focus.
 * A click opens the glossary entry. On a touch screen the first tap shows the
 * definition and a second tap opens the entry. Never put a Term inside a
 * link, a button or another tooltip's trigger.
 */
export function Term({ id, children, className }: { id: GlossaryId; children: ReactNode; className?: string }) {
  const { i18n } = useLingui()
  const entry = glossaryEntry(id)
  const href = glossaryHref(id)
  const [open, setOpen] = useState(false)
  // The pointer that started the current press, and whether the tooltip was open then.
  const press = useRef<{ touch: boolean; wasOpen: boolean }>({ touch: false, wasOpen: false })
  // While the term has the focus the definition stays up: focusing an element
  // scrolls it into view, and Radix closes a tooltip on any scroll. Escape and
  // blur still close it.
  const focused = useRef(false)
  const onOpenChange = (next: boolean) => {
    if (!next && focused.current) return
    setOpen(next)
  }
  const term = typeof entry.term === 'string' ? entry.term : i18n._(entry.term)

  return (
    <Tooltip
      open={open}
      onOpenChange={onOpenChange}
      content={
        <span className='flex flex-col gap-1 py-0.5' data-testid='term-definition'>
          <span className='text-[12px] font-semibold text-ghost'>{term}</span>
          <span className='text-[12px] leading-relaxed text-silver'>
            <RichText text={i18n._(entry.short)} codeClassName='bg-carbon' />
          </span>
          <Link to={href} className='mt-0.5 w-fit text-[11px] text-emerald hover:underline'>
            <Trans>Read more in the glossary</Trans>
          </Link>
        </span>
      }
    >
      <Link
        to={href}
        data-term={id}
        className={cn(
          'underline decoration-ash decoration-dotted decoration-1 underline-offset-[3px] transition-colors',
          'hover:text-emerald hover:decoration-emerald focus-visible:text-emerald',
          className
        )}
        onFocus={() => {
          focused.current = true
        }}
        onBlur={() => {
          focused.current = false
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
        }}
        onPointerDown={(e) => {
          press.current = { touch: e.pointerType === 'touch' || e.pointerType === 'pen', wasOpen: open }
        }}
        onClick={(e) => {
          // A first tap shows the definition; the entry is one more tap away.
          if (press.current.touch && !press.current.wasOpen) {
            e.preventDefault()
            setOpen(true)
          }
          press.current = { touch: false, wasOpen: false }
        }}
      >
        {children}
      </Link>
    </Tooltip>
  )
}
