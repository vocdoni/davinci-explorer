import { beforeAll, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { TooltipProvider } from '~kit'
import { Term } from './Term'

// jsdom has no PointerEvent, and a touch is told apart by its pointerType.
beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    class PointerEventPolyfill extends MouseEvent {
      pointerType: string
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init)
        this.pointerType = init.pointerType ?? ''
      }
    }
    window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent
  }
})

function Where() {
  const { pathname, hash } = useLocation()
  return <output data-testid='where'>{`${pathname}${hash}`}</output>
}

function renderTerm() {
  return render(
    <MemoryRouter initialEntries={['/page']}>
      <TooltipProvider>
        <Routes>
          <Route
            path='*'
            element={
              <>
                <p>
                  Your <Term id='vote-id'>vote id</Term> is on the receipt.
                </p>
                <Where />
              </>
            }
          />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>
  )
}

describe('Term', () => {
  it('links the words to their glossary entry', () => {
    renderTerm()
    const link = screen.getByRole('link', { name: 'vote id' })
    expect(link).toHaveAttribute('href', '/learn/glossary#term-vote-id')
    fireEvent.click(link)
    expect(screen.getByTestId('where')).toHaveTextContent('/learn/glossary#term-vote-id')
  })

  it('shows the short definition on keyboard focus', async () => {
    renderTerm()
    await act(async () => screen.getByRole('link', { name: 'vote id' }).focus())
    const definitions = await screen.findAllByTestId('term-definition')
    expect(definitions[0]).toHaveTextContent('The number your voting app shows when you vote')
    expect(definitions[0]).toHaveTextContent('Read more in the glossary')
    // Escape closes it; the focus stays on the term.
    fireEvent.keyDown(screen.getByRole('link', { name: 'vote id' }), { key: 'Escape' })
    await waitFor(() => expect(screen.queryAllByTestId('term-definition')).toHaveLength(0))
    expect(screen.getByRole('link', { name: 'vote id' })).toHaveFocus()
  })

  it('shows the definition on a first tap and opens the entry on the second', async () => {
    renderTerm()
    const link = screen.getByRole('link', { name: 'vote id' })
    fireEvent.pointerDown(link, { pointerType: 'touch' })
    fireEvent.click(link)
    expect(screen.getByTestId('where')).toHaveTextContent('/page')
    expect((await screen.findAllByTestId('term-definition')).length).toBeGreaterThan(0)
    fireEvent.pointerDown(link, { pointerType: 'touch' })
    fireEvent.click(link)
    expect(screen.getByTestId('where')).toHaveTextContent('/learn/glossary#term-vote-id')
  })
})
