import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ConfigContext } from '~config/config-context'
import { DEMO_CONFIG } from '~config/runtime-config'
import { DataProvider } from '~data/DataProvider'
import { createExplorerData } from '~data/create'
import { demoFixture } from '~fixtures/demo'
import { activateLocale } from '~i18n/i18n'
import { RemountOnLocaleChange } from '~i18n/LocaleProvider'
import { LOCALE_STORAGE_KEY } from '~i18n/locales'
import { routes } from '~routes/router'
import { ThemeProvider } from '~theme/ThemeProvider'
import { THEME_STORAGE_KEY } from '~theme/theme'

const fixture = demoFixture()

function renderApp(path = '/') {
  const data = createExplorerData({ config: DEMO_CONFIG, demoOptions: { blockIntervalMs: 0 } })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <ThemeProvider>
      <ConfigContext.Provider value={DEMO_CONFIG}>
        <QueryClientProvider client={new QueryClient()}>
          <DataProvider source={data.source} services={data.services}>
            <RemountOnLocaleChange>
              <RouterProvider router={router} />
            </RemountOnLocaleChange>
          </DataProvider>
        </QueryClientProvider>
      </ConfigContext.Provider>
    </ThemeProvider>
  )
}

beforeEach(() => localStorage.clear())
afterEach(() => activateLocale('en'))

describe('Shell', () => {
  it('renders the brand, the navigation and the overview', async () => {
    renderApp()
    expect(screen.getByLabelText('DAVINCI explorer home')).toBeInTheDocument()
    for (const label of ['Overview', 'Processes', 'Sequencers', 'Contracts', 'Learn', 'Verify']) {
      expect(screen.getAllByRole('link', { name: label }).length).toBeGreaterThan(0)
    }
    expect(await screen.findByTestId('page-overview')).toBeInTheDocument()
    // One chain pill in the bar, one beside the search on narrower screens; CSS shows one.
    expect(screen.getAllByText('Demo network', { selector: 'span' })).toHaveLength(2)
  })

  it('persists the theme choice', async () => {
    const user = userEvent.setup()
    renderApp()
    const group = screen.getByRole('radiogroup', { name: 'Theme' })
    await user.click(within(group).getByRole('radio', { name: 'Light theme' }))
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    await user.click(within(group).getByRole('radio', { name: 'Dark theme' }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('switches the language from the top bar, with <html lang> and the stored choice', async () => {
    const user = userEvent.setup()
    renderApp('/processes')
    expect(await screen.findByTestId('page-processes')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
    const select = screen.getByRole('combobox', { name: 'Language' })
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['English', 'Español', 'Català'])

    await user.selectOptions(select, 'es')
    await waitFor(() => expect(document.documentElement.lang).toBe('es'))
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es')
    expect(screen.getAllByRole('link', { name: 'Procesos' }).length).toBeGreaterThan(0)
    expect(await screen.findByTestId('page-processes')).toHaveTextContent('Todos los procesos de votación del registro')
    expect(screen.getByRole('combobox', { name: 'Idioma' })).toHaveValue('es')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Idioma' }), 'ca')
    await waitFor(() => expect(document.documentElement.lang).toBe('ca'))
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ca')
    expect(screen.getAllByRole('link', { name: 'Processos' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('radiogroup', { name: 'Tema' })).toBeInTheDocument()
  })

  it('routes a searched process id to its page', async () => {
    const user = userEvent.setup()
    renderApp()
    const [box] = screen.getAllByRole('textbox', { name: /Search processes/ })
    await user.type(box!, `${fixture.featured.openProcess}{Enter}`)
    expect(await screen.findByTestId('page-process')).toBeInTheDocument()
  })

  it('resolves a transaction hash to its transition', async () => {
    const t = fixture.store.transitions[fixture.store.transitionOrder[3]!]!
    renderApp(`/tx/${t.tx}`)
    // The lookup plus the lazy page can outlast the default 1 s on a busy runner.
    expect(await screen.findByTestId('page-transition', {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('sends the old vote lookup and the old guides to the Verify flows', async () => {
    const { processId } = fixture.featured.settledVote
    const { unmount } = renderApp(`/votes/${processId}/0x8000000000000001`)
    expect(await screen.findByTestId('page-verify-vote')).toBeInTheDocument()
    expect(screen.getByLabelText('Election')).toHaveValue(processId)
    expect(screen.getByLabelText('Vote id')).toHaveValue('0x8000000000000001')
    unmount()

    const second = renderApp('/votes?voteId=0x8000000000000002')
    expect(await screen.findByTestId('page-verify-vote')).toBeInTheDocument()
    expect(screen.getByLabelText('Vote id')).toHaveValue('0x8000000000000002')
    second.unmount()

    const third = renderApp('/learn/verify-organizer')
    expect(await screen.findByTestId('page-verify-election')).toBeInTheDocument()
    third.unmount()

    renderApp('/learn/verify-auditor')
    expect(await screen.findByTestId('page-verify-deployment')).toBeInTheDocument()
  })

  it('shows 404 for unknown routes', async () => {
    renderApp('/nowhere')
    expect(await screen.findByTestId('page-not-found')).toBeInTheDocument()
  })
})
