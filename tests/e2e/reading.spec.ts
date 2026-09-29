import { expect, test, type Page } from '@playwright/test'

// The reading aids and the small fixes around them, on the demo network
// (src/fixtures/synthetic.ts): glossary terms, the declared ballot kind,
// sequencer links and search, and a virtualised table on a phone.
const PREFIX = 'b12878d5'
const pid = (organizer: string, nonce: number) => `0x${organizer}${PREFIX}${nonce.toString(16).padStart(14, '0')}`
/** "Community fund round": open, 40 transitions, sequencer key, a quadratic preset. */
const OPEN = pid('42fc20654efd78c6887ff0bd1cc50c9ec1dab589', 1)

async function demo(page: Page, path: string) {
  const sep = path.includes('?') ? '&' : '?'
  await page.goto(`${path}${sep}demo=1`)
}

test.describe('glossary terms', () => {
  test('a term shows its definition on hover and opens the glossary on click', async ({ page }) => {
    await demo(page, `/processes/${OPEN}/votes`)
    const term = page.getByTestId('tab-votes').locator('a[data-term="vote-id"]').first()
    await term.hover()
    await expect(page.getByRole('tooltip')).toContainText('The number your voting app shows when you vote')
    await term.click()
    await expect(page).toHaveURL(/\/learn\/glossary#term-vote-id$/)
  })

  test('keyboard focus shows the definition too', async ({ page }) => {
    await demo(page, `/processes/${OPEN}/votes`)
    await page.getByTestId('tab-votes').locator('a[data-term="vote-id"]').first().focus()
    await expect(page.getByRole('tooltip')).toContainText('Read more in the glossary')
  })
})

test.describe('on a touch screen', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('the first tap on a term shows the definition, the second opens the glossary', async ({ page }) => {
    await demo(page, `/processes/${OPEN}/votes`)
    const term = page.getByTestId('tab-votes').locator('a[data-term="vote-id"]').first()
    await term.tap()
    await expect(page.getByRole('tooltip')).toContainText('The number your voting app shows when you vote')
    await expect(page).toHaveURL(new RegExp(`/processes/${OPEN}/votes`))
    await term.tap()
    await expect(page).toHaveURL(/\/learn\/glossary#term-vote-id$/)
  })

  test('a virtualised table scrolls sideways inside its card, not the page', async ({ page }) => {
    await demo(page, '/kit')
    const table = page.locator('[data-virtualized]').first()
    await expect(table).toBeVisible()
    const { scroll, client } = await table.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }))
    expect(scroll).toBeGreaterThan(client)
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(pageWidth).toBeLessThanOrEqual(390)
  })

  test('the Verify pill lines up with the other menu items', async ({ page }) => {
    await demo(page, '/processes')
    await page.getByRole('button', { name: 'Open menu' }).click()
    const menu = page.getByRole('navigation', { name: 'Primary' })
    const textLeft = (name: string) =>
      menu.getByRole('link', { name, exact: true }).evaluate((el) => {
        const range = document.createRange()
        range.selectNodeContents(el)
        return Math.round(range.getBoundingClientRect().left)
      })
    expect(await textLeft('Verify')).toBe(await textLeft('Processes'))
  })
})

test.describe('sequencers', () => {
  test('a transition sender links to its sequencer page, and the search finds it', async ({ page }) => {
    await demo(page, `/processes/${OPEN}/transitions`)
    const sender = page.getByTestId('tab-transitions').locator('table a[href^="/sequencers/0x"]').first()
    const href = (await sender.getAttribute('href'))!
    const address = href.split('/').pop()!
    await sender.click()
    await expect(page).toHaveURL(new RegExp(`/sequencers/${address}$`))

    await demo(page, '/')
    const search = page.getByRole('textbox', { name: /Search processes/ }).first()
    await search.fill(address)
    await search.press('Enter')
    await expect(page).toHaveURL(new RegExp(`/sequencers/${address}$`))
  })
})

test.describe('ballot panel', () => {
  test('shows the kind the organizer declared beside the one read from the rules', async ({ page }) => {
    await demo(page, `/processes/${OPEN}`)
    const kind = page.getByTestId('ballot-kind')
    await expect(kind).toContainText('Reads as: Quadratic voting')
    await expect(kind.getByTestId('ballot-kind-declared')).toContainText('Declared by the organizer: Quadratic voting')
  })
})
