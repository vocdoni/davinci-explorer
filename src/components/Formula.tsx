// Formulas in prose: `sha256(programVK ‖ publicValues ‖ rootCVadcopFinal)`
// set in the mono font with function names, variables, literals and
// operators in their own colours, `||` shown as ‖, and line breaks only at
// the spaces around operators and after commas. The expression is code: it is
// never translated, so pass it as `expr` and it stays out of the catalogs.

import { Fragment } from 'react'
import { cn } from '~lib/cn'
import { tokenizeFormula, type FormulaTokenKind } from './formula-tokens'

const TOKEN_CLASS: Record<Exclude<FormulaTokenKind, 'space'>, string> = {
  fn: 'text-violet font-medium',
  var: 'text-blue',
  lit: 'text-amber',
  op: 'text-emerald',
  punct: 'text-pewter',
}

/**
 * An expression such as `sha256(commitment ‖ y …)`. Inline by default, inside
 * a sentence; `block` sets it apart on its own line, for the formula a
 * paragraph is about (without vertical margin: the container spaces it).
 */
export function Formula({
  expr,
  children,
  block = false,
  className,
}: {
  /** The expression. Preferred over `children`: it keeps the formula out of the translation. */
  expr?: string
  children?: string
  block?: boolean
  className?: string
}) {
  const source = expr ?? children ?? ''
  const tokens = tokenizeFormula(source)
  const Tag = block ? 'div' : 'span'
  return (
    <Tag
      data-formula=''
      className={cn(
        'font-mono text-[0.88em] leading-relaxed',
        block
          ? 'scroll-slim block overflow-x-auto rounded-sm border border-charcoal border-l-2 border-l-emerald/60 bg-onyx/50 px-3 py-2'
          : 'rounded-sm bg-onyx px-1 py-px [box-decoration-break:clone]',
        className
      )}
    >
      {tokens.map((tok, i) =>
        tok.kind === 'space' ? (
          <Fragment key={i}> </Fragment>
        ) : (
          <span
            key={i}
            className={cn(
              TOKEN_CLASS[tok.kind],
              // A long hex literal may break anywhere; nothing else breaks inside itself.
              tok.kind === 'lit' && tok.text.length > 24 ? 'break-all' : 'whitespace-nowrap'
            )}
          >
            {tok.text}
          </span>
        )
      )}
    </Tag>
  )
}
