import { expect, test, type Page } from '@playwright/test'

// The guide in Catalan and Spanish: the first topic, the topic list and the
// glossary with a deep link. Slugs and anchors (`#term-vote-id`) stay English in every
// language, so links into the guide work whatever the reader picked.

async function demo(page: Page, path: string) {
  const [base, hash] = path.split('#')
  const sep = base!.includes('?') ? '&' : '?'
  await page.goto(`${base}${sep}demo=1${hash ? `#${hash}` : ''}`)
}

const html = (page: Page) => page.locator('html')
const selector = (page: Page) => page.getByTestId('language-select')

test.describe('the guide in Catalan and Spanish', () => {
  test('Català: the first topic, the topic list and a term linked from it', async ({ page }) => {
    await demo(page, '/learn')
    await selector(page).selectOption('ca')
    await expect(html(page)).toHaveAttribute('lang', 'ca')
    // /learn opens on the first topic.
    const index = page.getByTestId('page-learn')
    await expect(index.getByRole('heading', { level: 1, name: 'Com funciona DAVINCI' })).toBeVisible()
    await expect(index.getByTestId('learn-topic')).toHaveAttribute('data-topic', 'how-it-works')

    // The topic list on the left links every topic under its English slug.
    await index.locator('aside nav a[href^="/learn/glossary"]').click()
    await expect(page).toHaveURL(/\/learn\/glossary$/)
    await index.locator('aside nav a[href^="/learn/how-it-works"]').click()
    await expect(page).toHaveURL(/\/learn\/how-it-works$/)
    const topic = page.getByTestId('learn-topic')
    await expect(topic).toHaveAttribute('data-topic', 'how-it-works')
    await expect(topic.getByRole('heading', { level: 1, name: 'Com funciona DAVINCI' })).toBeVisible()
    await expect(topic.getByRole('link', { name: 'Aprèn', exact: true })).toBeVisible()
    await expect(topic.locator('[id="1-a-process-is-created"]')).toBeVisible()

    // A term in the prose links to its glossary entry under the English anchor.
    await topic.locator('a[href*="#term-vote-id"]').first().click()
    await expect(page).toHaveURL(/\/learn\/glossary#term-vote-id$/)
    const entry = page.locator('#term-vote-id')
    await expect(entry).toHaveAttribute('aria-current', 'true')
    await expect(entry.getByRole('term')).toHaveText('Id de vot')
    await expect(entry).toBeInViewport()
  })

  test('Español: a glossary deep link loads in the stored language and the filter reads Spanish', async ({ page }) => {
    await demo(page, '/learn')
    await selector(page).selectOption('es')
    await expect(html(page)).toHaveAttribute('lang', 'es')
    await expect(
      page.getByTestId('page-learn').getByRole('heading', { level: 1, name: 'Cómo funciona DAVINCI' })
    ).toBeVisible()

    await demo(page, '/learn/glossary#term-process-id')
    await expect(html(page)).toHaveAttribute('lang', 'es')
    await expect(page.getByTestId('learn-topic').getByRole('link', { name: 'Aprende', exact: true })).toBeVisible()
    const entry = page.locator('#term-process-id')
    await expect(entry).toHaveAttribute('aria-current', 'true')
    await expect(entry.getByRole('term')).toHaveText('Id de proceso')
    await expect(entry).toBeInViewport()

    const list = page.getByTestId('glossary')
    await page.getByRole('searchbox').fill('censo')
    await expect(list.getByRole('term').filter({ hasText: /^Lista de votantes \(censo\)$/ })).toBeVisible()
    await expect(list.locator('#term-census')).toBeVisible()
  })
})
