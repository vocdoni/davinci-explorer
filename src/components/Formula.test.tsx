import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Formula } from './Formula'
import { tokenizeFormula } from './formula-tokens'

const kinds = (expr: string) =>
  tokenizeFormula(expr)
    .filter((t) => t.kind !== 'space')
    .map((t) => `${t.kind}:${t.text}`)

describe('tokenizeFormula', () => {
  it('tells functions, variables, literals and operators apart', () => {
    expect(kinds('sha256(programVK ‖ publicValues ‖ rootCVadcopFinal)')).toEqual([
      'fn:sha256',
      'punct:(',
      'var:programVK',
      'op:‖',
      'var:publicValues',
      'op:‖',
      'var:rootCVadcopFinal',
      'punct:)',
    ])
    expect(kinds('leaf = (address << 88) | weight')).toEqual([
      'var:leaf',
      'op:=',
      'punct:(',
      'var:address',
      'op:<<',
      'lit:88',
      'punct:)',
      'op:|',
      'var:weight',
    ])
  })

  it('writes || as ‖ and spaces binary operators', () => {
    const text = tokenizeFormula('sha256(a||b)')
      .map((t) => t.text)
      .join('')
    expect(text).toBe('sha256(a ‖ b)')
  })

  it('reads hex, strings, ranges and word operators', () => {
    expect(kinds('0x01 ‖ sha256(commitment)[1..]')).toEqual([
      'lit:0x01',
      'op:‖',
      'fn:sha256',
      'punct:(',
      'var:commitment',
      'punct:)',
      'punct:[',
      'lit:1',
      'punct:..',
      'punct:]',
    ])
    expect(kinds('sha256("davinci-slot-v1" ‖ address) mod r')).toContain('lit:"davinci-slot-v1"')
    expect(kinds('x mod r')).toEqual(['var:x', 'op:mod', 'var:r'])
  })

  it('keeps the sign of a negative exponent with it, as a minus sign', () => {
    expect(kinds('2^−7.6')).toEqual(['lit:2', 'op:^', 'lit:−7.6'])
    expect(kinds('2^-7.6')).toEqual(['lit:2', 'op:^', 'lit:−7.6'])
    expect(kinds('2^-k')).toEqual(['lit:2', 'op:^', 'var:−k'])
    // Only right after a caret: elsewhere a minus is still a spaced operator.
    const text = tokenizeFormula('2^63 − 16')
      .map((t) => t.text)
      .join('')
    expect(text).toBe('2^63 − 16')
    expect(kinds('a-1')).toEqual(['var:a', 'op:-', 'lit:1'])
  })
})

describe('Formula', () => {
  it('renders the expression as text, inline or as a block', () => {
    const { container, rerender } = render(<Formula expr='sha256(a || b)' />)
    expect(container.textContent).toBe('sha256(a ‖ b)')
    expect(container.querySelector('span[data-formula]')).not.toBeNull()
    rerender(<Formula expr='y = f(x)' block />)
    expect(container.querySelector('div[data-formula]')).toHaveTextContent('y = f(x)')
  })
  it('sets an exponent as a superscript and keeps the caret for copying', () => {
    const { container } = render(<Formula expr='10^12 / maxVoters' />)
    expect(container.querySelector('sup')).toHaveTextContent('12')
    expect(container.textContent).toBe('10^12 / maxVoters')
  })
  it('sets a negative exponent, sign included, as a superscript', () => {
    for (const expr of ['2^−7.6', '2^-7.6']) {
      const { container, unmount } = render(<Formula expr={expr} />)
      expect(container.querySelector('sup')).toHaveTextContent(/^−7\.6$/)
      expect(container.textContent).toBe('2^−7.6')
      unmount()
    }
  })
})
