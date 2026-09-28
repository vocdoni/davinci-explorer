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
})

describe('Formula', () => {
  it('renders the expression as text, inline or as a block', () => {
    const { container, rerender } = render(<Formula expr='sha256(a || b)' />)
    expect(container.textContent).toBe('sha256(a ‖ b)')
    expect(container.querySelector('span[data-formula]')).not.toBeNull()
    rerender(<Formula expr='y = f(x)' block />)
    expect(container.querySelector('div[data-formula]')).toHaveTextContent('y = f(x)')
  })
})
