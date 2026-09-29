// Formulas in prose: `sha256(programVK ‖ publicValues ‖ rootCVadcopFinal)`
// set in the mono font with function names, variables, literals and
// operators in their own colours, `||` shown as ‖, `2^63` and `2^−7.6` as
// superscripts, and line breaks only at the spaces around operators and after commas. The expression is code: it is
// never translated, so pass it as `expr` and it stays out of the catalogs.

import { Fragment } from 'react'
import { cn } from '~lib/cn'
import { tokenizeFormula, type FormulaToken, type FormulaTokenKind } from './formula-tokens'

const TOKEN_CLASS: Record<Exclude<FormulaTokenKind, 'space'>, string> = {
  fn: 'text-violet font-medium',
  var: 'text-blue',
  lit: 'text-amber',
  op: 'text-emerald',
  punct: 'text-pewter',
}

/** A token that reads as an exponent after `^`: a number or a short name, with its sign (`−7.6`). */
function isExponent(tok: FormulaToken | undefined): boolean {
  return tok != null && (tok.kind === 'lit' || tok.kind === 'var') && tok.text.length <= 8
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
        // A short formula stays on one line; a long one breaks at its operators.
        !block && source.length <= 32 && 'whitespace-nowrap',
        className
      )}
    >
      {tokens.map((tok, i) => {
        if (tok.kind === 'space') return <Fragment key={i}> </Fragment>
        // `2^63`: the exponent as a superscript; the caret stays for copying and screen readers.
        const prev = tokens[i - 1]
        if (tok.kind === 'op' && tok.text === '^' && isExponent(tokens[i + 1])) {
          return (
            <span key={i} className='sr-only'>
              ^
            </span>
          )
        }
        const sup = prev?.kind === 'op' && prev.text === '^' && isExponent(tok)
        const Inner = sup ? 'sup' : 'span'
        return (
          <Inner
            key={i}
            className={cn(
              TOKEN_CLASS[tok.kind],
              sup && 'text-[0.8em]',
              // A long hex literal may break anywhere; nothing else breaks inside itself.
              tok.kind === 'lit' && tok.text.length > 24 ? 'break-all' : 'whitespace-nowrap'
            )}
          >
            {tok.text}
          </Inner>
        )
      })}
    </Tag>
  )
}
