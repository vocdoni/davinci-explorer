import { Fragment } from 'react'
import { cn } from '~lib/cn'

/**
 * Plain text with `backtick` spans shown as inline code: the glossary's
 * definitions, and any other translated string that names an identifier.
 */
export function RichText({ text, codeClassName }: { text: string; codeClassName?: string }) {
  const parts = text.split('`')
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <code key={i} className={cn('rounded-sm bg-onyx px-1 py-px text-[0.88em] break-words', codeClassName)}>
            {part}
          </code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  )
}
