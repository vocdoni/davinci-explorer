import { expect, test, type Page } from '@playwright/test'

// A process page in Catalan and Spanish on the deterministic demo network
// (src/fixtures/synthetic.ts): the tabs, the counts in the language's own
// number format, and the organizer's metadata in the visitor's language,
// which the demo documents carry next to the English default.
const PREFIX = 'b12878d5'
const pid = (organizer: string, nonce: number) => `0x${organizer}${PREFIX}${nonce.toString(16).padStart(14, '0')}`
const ORG0 = '42fc20654efd78c6887ff0bd1cc50c9ec1dab589'
/** "Community fund round": open, 40 transitions, sequencer key. */
const OPEN = pid(ORG0, 1)
/** "Board election 2026": sequencer key, zkVM results. */
const RESULTS = pid(ORG0, 0)
/** "Assembly motion": past its end, grace window open. */
const CLOSING = pid('7e5f4552091a69125d5dfcb7b8c2659029395bdf', 3)

async function demo(page: Page, path: string) {
  const sep = path.includes('?') ? '&' : '?'
  await page.goto(`${path}${sep}demo=1`)
}

/** Picks a language in the top bar and waits until it applies. */
async function speak(page: Page, locale: 'es' | 'ca') {
  await page.getByTestId('language-select').selectOption(locale)
  await expect(page.locator('html')).toHaveAttribute('lang', locale)
}

function noPageErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

test.describe('process page in Catalan', () => {
  test('header, metadata and tabs', async ({ page }) => {
    const errors = noPageErrors(page)
    await demo(page, `/processes/${OPEN}`)
    await expect(page.getByRole('heading', { name: 'Community fund round' })).toBeVisible()
    await speak(page, 'ca')

    const root = page.getByTestId('page-process')
    // The organizer's own Catalan title, not the English default.
    await expect(root.getByRole('heading', { name: 'Ronda del fons comunitari' })).toBeVisible()
    await expect(root.getByRole('heading', { name: 'Community fund round' })).toHaveCount(0)
    await expect(root.getByText('Obert', { exact: true })).toBeVisible()
    await expect(root.getByText('Votants', { exact: true })).toBeVisible()
    // 1,054 voters in English.
    await expect(root.getByText('1.054', { exact: true })).toBeVisible()
    await expect(page.getByTestId('process-lifecycle')).toContainText('Creat')

    const metadata = page.getByTestId('tab-overview').getByTestId('process-metadata')
    await expect(metadata).toContainText('Ronda del fons comunitari')
    await expect(metadata).toContainText('un procés sintètic de la xarxa de demostració')
    await expect(metadata).toContainText('Opció 16')

    for (const [name, tab] of [
      ['Lots', 'transitions'],
      ['Vots', 'votes'],
      ['Resultats', 'results'],
      ['Resum', 'overview'],
    ]) {
      await page.getByRole('tab', { name: new RegExp(`^${name}`) }).click()
      await expect(page.getByTestId(`tab-${tab}`)).toBeVisible()
    }
    expect(errors).toEqual([])
  })

  test('transitions and votes tabs', async ({ page }) => {
    await demo(page, `/processes/${OPEN}/transitions`)
    await speak(page, 'ca')
    const table = page.getByTestId('tab-transitions').locator('table')
    await expect(table.getByRole('columnheader', { name: /^Bloc/ })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: /^Transacció/ })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: /^Comissió/ })).toBeVisible()
    await expect(page.getByTestId('transition-summary').getByRole('img', { name: 'superada' })).toBeVisible()

    await page.getByRole('tab', { name: /^Vots/ }).click()
    await expect(page.getByTestId('tab-votes')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Id de vot' })).toBeVisible()
    await expect(page.getByTestId('vote-ids')).toBeVisible()
  })
})

test.describe('process page in Spanish', () => {
  test('results tab, lifecycle and the title survive a reload', async ({ page }) => {
    await demo(page, `/processes/${RESULTS}/results`)
    await speak(page, 'es')

    const root = page.getByTestId('page-process')
    await expect(root.getByRole('heading', { name: 'Elección de la junta directiva 2026' })).toBeVisible()
    await expect(page.getByRole('tab', { name: /^Resultados/ })).toHaveAttribute('aria-selected', 'true')
    const tab = page.getByTestId('tab-results')
    await expect(tab.getByTestId('tally').getByRole('listitem')).toHaveCount(4)
    // The option names come from the metadata, in Spanish.
    await expect(tab.getByTestId('tally')).toContainText('Opción 1')
    // Shares in the Spanish percent format: "25,0 %", never "25.0%".
    await expect(tab.getByTestId('tally')).toContainText(/\d,\d\s%/)
    await expect(tab.getByRole('img', { name: 'superada' })).toHaveCount(4)
    await expect(page.getByTestId('process-lifecycle')).toContainText('Creado')
    await expect(root.getByText('Votantes', { exact: true })).toBeVisible()

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    await expect(
      page.getByTestId('page-process').getByRole('heading', { name: 'Elección de la junta directiva 2026' })
    ).toBeVisible()

    await page.getByRole('tab', { name: /^Resumen/ }).click()
    const metadata = page.getByTestId('tab-overview').getByTestId('process-metadata')
    await expect(metadata).toContainText('un proceso sintético de la red de demostración')
    await expect(metadata).toContainText('Opción 4')
  })
})

test.describe('the grace window in Spanish and Catalan', () => {
  test('a closing process: its phase, lifecycle and the batches recorded after the end', async ({ page }) => {
    await demo(page, `/processes/${CLOSING}/transitions`)
    await speak(page, 'es')
    const root = page.getByTestId('page-process')
    await expect(root.getByText('En cierre', { exact: true })).toBeVisible()
    await expect(page.getByTestId('process-lifecycle')).toContainText('Periodo de gracia')
    await expect(page.getByTestId('grace-note')).toContainText('2 lotes anotados tras el final')
    await expect(page.getByTestId('tab-transitions').getByText('tras el final', { exact: true })).toHaveCount(2)

    await speak(page, 'ca')
    await expect(page.getByTestId('page-process').getByText('En tancament', { exact: true })).toBeVisible()
    await expect(page.getByTestId('grace-note')).toContainText('2 lots anotats després del final')
    await page.getByRole('tab', { name: /^Resum/ }).click()
    await expect(page.getByTestId('tab-overview')).toContainText('Tancament del període de gràcia')
  })
})
