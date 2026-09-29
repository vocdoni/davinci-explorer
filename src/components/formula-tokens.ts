// Splits a formula into the tokens `Formula` colours. Pure, unit-tested.

export type FormulaTokenKind = 'fn' | 'var' | 'lit' | 'op' | 'punct' | 'space'

export interface FormulaToken {
  kind: FormulaTokenKind
  text: string
}

// Longest first, so `<<` wins over `<`.
const OPERATORS = [
  '<<',
  '>>',
  '==',
  '!=',
  '<=',
  '>=',
  '→',
  '←',
  '‖',
  '=',
  '+',
  '−',
  '-',
  '·',
  '×',
  '*',
  '/',
  '^',
  '|',
  '&',
  '<',
  '>',
  '≤',
  '≥',
  '≠',
  '%',
]
const WORD_OPERATORS = new Set(['mod', 'xor', 'and', 'or'])
const PUNCT = new Set(['(', ')', '[', ']', '{', '}', ',', ';', ':', '…'])
// Binary operators that read better with a space on each side.
const SPACED = new Set(['‖', '=', '==', '!=', '+', '−', '·', '×', '<<', '>>', '|', '&', '→', '←', '≤', '≥', '≠', 'mod'])

const IDENT = /^[\p{L}_][\p{L}\p{N}_.']*/u
const NUMBER = /^(0x[0-9a-fA-F]+|\d+(\.\d+)?)/
const STRING = /^("[^"]*"|'[^']*')/
// A signed exponent right after `^`: `2^−7.6`, `2^-k`. The sign is part of the exponent.
const SIGNED_EXPONENT = /^[−-](\d+(\.\d+)?|[\p{L}_][\p{L}\p{N}_]*)/u

/** Splits an expression into coloured tokens. `||` is concatenation and becomes ‖. */
export function tokenizeFormula(expr: string): FormulaToken[] {
  const src = expr.replace(/\|\|/g, '‖')
  const out: FormulaToken[] = []
  let i = 0
  while (i < src.length) {
    const rest = src.slice(i)
    const ws = /^\s+/.exec(rest)
    if (ws) {
      out.push({ kind: 'space', text: ' ' })
      i += ws[0].length
      continue
    }
    const last = out[out.length - 1]
    const signed = last?.kind === 'op' && last.text === '^' ? SIGNED_EXPONENT.exec(rest) : null
    if (signed) {
      // Typeset with a real minus sign, one token, so it is never spaced like a subtraction.
      out.push({ kind: /\d/.test(signed[1]![0]!) ? 'lit' : 'var', text: `−${signed[1]}` })
      i += signed[0].length
      continue
    }
    const str = STRING.exec(rest)
    if (str) {
      out.push({ kind: 'lit', text: str[0] })
      i += str[0].length
      continue
    }
    const num = NUMBER.exec(rest)
    if (num) {
      out.push({ kind: 'lit', text: num[0] })
      i += num[0].length
      continue
    }
    const id = IDENT.exec(rest)
    if (id) {
      const word = id[0]
      const after = src.slice(i + word.length).trimStart()
      out.push({
        kind: WORD_OPERATORS.has(word) ? 'op' : after.startsWith('(') ? 'fn' : 'var',
        text: word,
      })
      i += word.length
      continue
    }
    if (rest.startsWith('..')) {
      out.push({ kind: 'punct', text: '..' })
      i += 2
      continue
    }
    const op = OPERATORS.find((o) => rest.startsWith(o))
    if (op) {
      out.push({ kind: 'op', text: op })
      i += op.length
      continue
    }
    const ch = [...rest][0]!
    out.push({ kind: PUNCT.has(ch) ? 'punct' : 'var', text: ch })
    i += ch.length
  }
  // A space on each side of a spaced binary operator, however it was typed.
  const spaced: FormulaToken[] = []
  for (let k = 0; k < out.length; k++) {
    const tok = out[k]!
    if (tok.kind === 'op' && SPACED.has(tok.text)) {
      if (spaced.length && spaced[spaced.length - 1]!.kind !== 'space') spaced.push({ kind: 'space', text: ' ' })
      spaced.push(tok)
      if (out[k + 1] && out[k + 1]!.kind !== 'space') spaced.push({ kind: 'space', text: ' ' })
      continue
    }
    spaced.push(tok)
  }
  return spaced
}
