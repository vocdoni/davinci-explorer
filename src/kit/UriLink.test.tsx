import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test-utils'
import { Hash, Tooltip, UriLink, uriHost } from '~kit'

describe('uriHost', () => {
  it('keeps where a URI points, short', () => {
    expect(uriHost('https://metadata.example.org/processes/0x42/meta.json')).toBe('metadata.example.org')
    expect(uriHost('ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi')).toBe('ipfs · bafybeig…fbzdi')
    expect(uriHost('ipfs://QmShort')).toBe('ipfs · QmShort')
    expect(uriHost('file:///home/someone/census/census-1.json')).toBe('file · census-1.json')
    expect(uriHost('data:')).toBe('data')
    expect(uriHost('not a uri at all, just a long string')).toBe('not a uri at all, …tring')
  })
})

describe('UriLink', () => {
  it('shows what it opens and the host, never the whole URI', () => {
    const uri = 'https://metadata.example.org/a/very/long/path/to/the/organizer/document.json'
    renderWithProviders(<UriLink uri={uri} href={uri} label='Open the document' />)
    const link = screen.getByRole('link', { name: /Open the document/ })
    expect(link).toHaveAttribute('href', uri)
    expect(link).toHaveTextContent('metadata.example.org')
    expect(screen.queryByText(uri)).toBeNull()
    expect(screen.getByRole('button', { name: 'Copy URI' })).toBeInTheDocument()
  })

  it('shows a URI no browser opens by where it points, with no link', () => {
    renderWithProviders(<UriLink uri='file:///tmp/census.json' href={null} label='Open the census file' />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('file · census.json')).toBeInTheDocument()
  })
})

describe('Tooltip', () => {
  it('shows a value whole, in the mono font and broken anywhere', async () => {
    const value = `0x${'ab'.repeat(32)}`
    renderWithProviders(<Hash value={value} copy={false} />)
    await userEvent.hover(screen.getByText('0xababab…abab'))
    const tip = (await screen.findAllByText(value)).find((n) => n.closest('[data-side]'))!
    const box = tip.closest('[data-side]')!
    expect(box.className).toContain('font-mono')
    expect(box.className).toContain('break-all')
    expect(box.className).toContain('w-max')
  })

  it('keeps prose in a readable column', async () => {
    renderWithProviders(
      <Tooltip content='A plain explanation.'>
        <button type='button'>info</button>
      </Tooltip>
    )
    await userEvent.hover(screen.getByRole('button', { name: 'info' }))
    const tip = (await screen.findAllByText('A plain explanation.')).find((n) => n.closest('[data-side]'))!
    const box = tip.closest('[data-side]')!
    expect(box.className).not.toContain('font-mono')
    expect(box.className).toContain('max-w-[min(20rem')
  })
})
