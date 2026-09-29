import { expect, test, type Page } from '@playwright/test'

// The language: the first visit follows the browser, the top-bar selector
// switches it (text, numbers, dates, `<html lang>`), and the choice survives a
// reload. Demo network, so the numbers are fixed. Add a test per page as its
// text is translated.

async function demo(page: Page, path: string) {
  const sep = path.includes('?') ? '&' : '?'
  await page.goto(`${path}${sep}demo=1`)
}

const html = (page: Page) => page.locator('html')
const selector = (page: Page) => page.getByTestId('language-select')

test.describe('language', () => {
  test('English by default, with each language named in its own words', async ({ page }) => {
    await demo(page, '/')
    await expect(html(page)).toHaveAttribute('lang', 'en')
    await expect(selector(page)).toHaveValue('en')
    await expect(selector(page).locator('option')).toHaveText(['English', 'Español', 'Català'])
  })

  test('the selector switches to Catalan and the choice survives a reload', async ({ page }) => {
    await demo(page, '/')
    await selector(page).selectOption('ca')
    await expect(html(page)).toHaveAttribute('lang', 'ca')
    const root = page.getByTestId('page-overview')
    await expect(root.getByText('Paperetes liquidades', { exact: true })).toBeVisible()
    await expect(root.getByText(/coincideix amb davinci-zkvm/)).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Processos' })
    ).toBeVisible()
    // Numbers follow the language: 1,766 ballots in English.
    await expect(root.getByText('1.766', { exact: true })).toBeVisible()

    await page.reload()
    await expect(html(page)).toHaveAttribute('lang', 'ca')
    await expect(selector(page)).toHaveValue('ca')
    await expect(page.getByTestId('page-overview').getByRole('heading', { name: 'Xarxa de demostració' })).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: 'Tema' })).toBeVisible()
  })

  test('Spanish on the processes list: filters, counts and the table', async ({ page }) => {
    await demo(page, '/processes')
    await selector(page).selectOption('es')
    await expect(html(page)).toHaveAttribute('lang', 'es')
    const root = page.getByTestId('page-processes')
    await expect(root.getByRole('heading', { name: 'Todos los procesos de votación del registro' })).toBeVisible()
    await expect(page.getByTestId('process-count')).toHaveText('10 procesos')
    await page.getByLabel('Fase').selectOption('results')
    await expect(page.getByTestId('process-count')).toHaveText('2 procesos')
    await expect(root).toContainText('coinciden, de 10 en el registro.')
    await expect(root.getByRole('columnheader', { name: /Organizador/ })).toBeVisible()
    await page.getByRole('button', { name: 'Quitar los filtros' }).first().click()
    await expect(page.getByTestId('process-count')).toHaveText('10 procesos')

    // The route and the language both survive a reload.
    await page.reload()
    await expect(html(page)).toHaveAttribute('lang', 'es')
    await expect(page.getByTestId('process-count')).toHaveText('10 procesos')
  })

  test('the 404 page and the search box speak the chosen language', async ({ page }) => {
    await demo(page, '/')
    await selector(page).selectOption('es')
    await expect(html(page)).toHaveAttribute('lang', 'es')
    const search = page.getByRole('textbox', { name: /Buscar procesos/ }).first()
    await search.fill('hello')
    await search.press('Enter')
    await expect(page.getByRole('alert')).toContainText('Ningún proceso')
    await demo(page, '/no/such/page')
    await expect(
      page.getByTestId('page-not-found').getByRole('heading', { name: 'Esta página no existe' })
    ).toBeVisible()
  })
})

test.describe('first visit', () => {
  test.use({ locale: 'ca-ES' })

  test('follows the browser language until the visitor picks another', async ({ page }) => {
    await demo(page, '/')
    await expect(html(page)).toHaveAttribute('lang', 'ca')
    await expect(selector(page)).toHaveValue('ca')
    await expect(page.getByTestId('page-overview').getByText('Paperetes liquidades', { exact: true })).toBeVisible()
    await selector(page).selectOption('en')
    await expect(html(page)).toHaveAttribute('lang', 'en')
    await page.reload()
    await expect(html(page)).toHaveAttribute('lang', 'en')
    await expect(page.getByTestId('page-overview').getByText('Votes recorded', { exact: true })).toBeVisible()
  })
})
