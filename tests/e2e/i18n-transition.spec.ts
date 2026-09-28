import { expect, test, type Page } from '@playwright/test'

// The transition page and the vote lookup in Catalan and Spanish, on the
// deterministic demo network (src/fixtures/synthetic.ts): the open process has
// 40 transitions and #37 spans four blobs.
const OPEN_PID = '0x42fc20654efd78c6887ff0bd1cc50c9ec1dab589b12878d500000000000001'
const MULTI_BLOB = 37

async function demo(page: Page, path: string) {
  const sep = path.includes('?') ? '&' : '?'
  await page.goto(`${path}${sep}demo=1`)
}

/** Opens a page and switches the language with the top-bar selector. */
async function openIn(page: Page, path: string, locale: 'es' | 'ca') {
  await demo(page, path)
  await page.getByTestId('language-select').selectOption(locale)
  await expect(page.locator('html')).toHaveAttribute('lang', locale)
}

test.describe('transition page', () => {
  test('in Catalan: heading, summary, publics and the registry checks', async ({ page }) => {
    await openIn(page, `/processes/${OPEN_PID}/transitions/${MULTI_BLOB}`, 'ca')
    const root = page.getByTestId('page-transition')
    await expect(root.getByRole('heading', { name: `Transició núm. ${MULTI_BLOB}` })).toBeVisible()

    const summary = page.getByTestId('transition-summary')
    for (const label of ['Procés', 'Bloc', 'Transacció', 'Comissió']) {
      await expect(summary.getByText(label, { exact: true })).toBeVisible()
    }
    // Numbers follow the language: 524,288 blob gas in English.
    await expect(summary).toContainText('524.288')
    await expect(summary).not.toContainText('524,288')

    const publics = page.getByTestId('publics')
    await expect(publics).toContainText('1 quan el programa va superar totes les comprovacions.')
    await expect(publics.getByText('overall_ok', { exact: true })).toBeVisible()

    const verify = page.getByTestId('verify')
    await expect(verify.getByTestId('check-guest-ok')).toContainText('El programa del zkVM va acceptar el lot')
    await expect(verify.getByTestId('check-root-continuity')).toContainText("Parteix de l'arrel anterior")
    // Commands stay as they are.
    await verify.getByTestId('check-plonk').locator('summary').click()
    await expect(verify.getByTestId('check-plonk').locator('pre')).toContainText('cast call')
  })

  test('in Spanish: the blobs, their content and a transition that does not exist', async ({ page }) => {
    await openIn(page, `/processes/${OPEN_PID}/transitions/${MULTI_BLOB}`, 'es')
    await expect(
      page.getByTestId('page-transition').getByRole('heading', { name: `Transición n.º ${MULTI_BLOB}` })
    ).toBeVisible()
    await expect(page.getByTestId('blob-list').locator('tbody tr')).toHaveCount(4)

    const content = page.getByTestId('blob-content')
    await expect(content.getByRole('tab', { name: /Ids de voto/ })).toBeVisible()
    // The last tab counts the cells of four blobs: 16,384 in English.
    await expect(content.getByRole('tab').last()).toContainText('16.384')
    await content.getByRole('tab', { name: /Casillas actualizadas/ }).click()
    await content
      .getByTestId('slot-update-list')
      .getByRole('button', { name: 'Mostrar los textos cifrados' })
      .first()
      .click()
    await expect(content.getByTestId('slot-update-list').getByRole('columnheader', { name: 'c1' })).toBeVisible()

    await demo(page, `/processes/${OPEN_PID}/transitions/999`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    await expect(page.getByText('No se ha encontrado la transición')).toBeVisible()
    await expect(page.getByText(/El registro no tiene la transición/)).toContainText('999')
  })
})

test.describe('vote check', () => {
  // The election field is new text; it is found by its process list.
  const electionInput = (page: Page) => page.getByTestId('page-verify-vote').locator('input[list]')

  test('in Spanish: a vote id from a transition, found on-chain', async ({ page }) => {
    await openIn(page, `/processes/${OPEN_PID}/transitions/${MULTI_BLOB}`, 'es')
    const link = page.getByTestId('vote-id-list').locator('a').first()
    const id = (await link.textContent())!.trim()
    await link.click()
    await expect(page).toHaveURL(new RegExp(`/verify/vote\\?pid=${OPEN_PID}&voteId=${id}`))
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    await expect(electionInput(page)).toHaveValue(OPEN_PID)
    await expect(page.getByLabel('Id de voto')).toHaveValue(id)
    const settled = page.getByTestId('check-settled')
    await expect(settled).toContainText(`#${MULTI_BLOB}`, { timeout: 15_000 })
    await settled.locator('summary').click()
    for (const label of ['Bloque', 'Transacción']) {
      await expect(settled.getByText(label, { exact: true })).toBeVisible()
    }
    await expect(page.getByRole('navigation', { name: 'Principal' }).locator('a[href="/verify"]')).toBeVisible()
  })

  test('in Catalan: the form, and the language survives a lookup', async ({ page }) => {
    await openIn(page, '/verify/vote', 'ca')
    await electionInput(page).fill(OPEN_PID)
    await page.getByLabel('Id de vot').fill('0x1')
    await page.getByTestId('page-verify-vote').locator('form button[type="submit"]').click()
    await expect(page).toHaveURL(/\/verify\/vote\?demo=1$/)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'ca')
    await expect(page.getByLabel('Id de vot')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Principal' }).locator('a[href="/verify"]')).toBeVisible()
  })
})
