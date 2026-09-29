import { expect, test, type Page } from '@playwright/test'

// Metadata bound to its on-chain hash, on the deterministic demo network
// (src/fixtures/synthetic.ts): a document that matches, one replaced while
// voting was open, and one whose URI serves another document.
const PREFIX = 'b12878d5'
const pid = (organizer: string, nonce: number) => `0x${organizer}${PREFIX}${nonce.toString(16).padStart(14, '0')}`
const ORG0 = '42fc20654efd78c6887ff0bd1cc50c9ec1dab589'
const ORG1 = '7e5f4552091a69125d5dfcb7b8c2659029395bdf'
/** Open, 40 transitions: its document matches. */
const OPEN = pid(ORG0, 1)
/** Upcoming: a second version set before voting opens. */
const BEFORE_START = pid(ORG0, 2)
/** DKG automatic, with results: its URI serves another document than the committed one. */
const TAMPERED = pid(ORG1, 0)
/** Open: a second version set after votes had settled. */
const AFTER_VOTES = pid(ORG1, 1)

async function demo(page: Page, path: string) {
  const sep = path.includes('?') ? '&' : '?'
  await page.goto(`${path}${sep}demo=1`)
}

test.describe('metadata', () => {
  test('a document that matches its hash reads as the organizer’s', async ({ page }) => {
    await demo(page, `/processes/${OPEN}`)
    const check = page.getByTestId('metadata-check')
    await expect(check).toHaveAttribute('data-status', 'matches')
    await expect(check).toContainText('The document matches the on-chain hash')
    await expect(page.getByTestId('page-process').getByTestId('unverified-mark')).toHaveCount(0)
    await expect(page.getByTestId('metadata-history').getByRole('listitem')).toHaveCount(1)
  })

  test('another document is marked unverified in the header, the list and the results', async ({ page }) => {
    await demo(page, `/processes/${TAMPERED}`)
    await expect(page.getByTestId('metadata-check')).toHaveAttribute('data-status', 'differs')
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toContainText('Budget allocation')
    await expect(heading.getByTestId('unverified-mark')).toBeVisible()
    await heading.getByTestId('unverified-mark').hover()
    await expect(page.getByRole('tooltip')).toContainText('not the one the organizer committed on-chain')

    await page.getByRole('tab', { name: 'Results' }).click()
    const tally = page.getByTestId('tally')
    await expect(tally.getByTestId('unverified-label')).toHaveCount(6)
    await expect(tally.getByRole('listitem').first()).toContainText('Field 1')

    await demo(page, '/processes')
    const row = page.getByRole('row').filter({ hasText: 'Budget allocation' })
    await expect(row.getByTestId('unverified-mark')).toBeVisible()
    await expect(page.getByTestId('unverified-mark')).toHaveCount(1)
  })

  test('a change made while voting was open is flagged', async ({ page }) => {
    await demo(page, `/processes/${AFTER_VOTES}`)
    await expect(page.getByTestId('metadata-version-2')).toContainText('changed while voting was open')
    await expect(page.getByTestId('metadata-version-1')).not.toContainText('changed while voting was open')

    await demo(page, `/processes/${BEFORE_START}`)
    await expect(page.getByTestId('metadata-version-2')).toContainText('current')
    await expect(page.getByTestId('metadata-version-2')).not.toContainText('changed while voting was open')
  })

  test('the election check says whether the description is the committed one', async ({ page }) => {
    await demo(page, `/verify/election/${AFTER_VOTES}`)
    await expect(page.getByTestId('check-metadata')).toHaveAttribute('data-status', 'pass')
    const history = page.getByTestId('check-metadata-history')
    await expect(history).toHaveAttribute('data-status', 'attention')
    await expect(history).toContainText('Changed while open')

    await demo(page, `/verify/election/${TAMPERED}`)
    const check = page.getByTestId('check-metadata')
    await expect(check).toHaveAttribute('data-status', 'fail')
    await check.getByText('How this is checked').click()
    await expect(check.getByText(/curl -fsSL 'https:\/\/metadata\.example\.org\//)).toBeVisible()
    await expect(page.getByTestId('election-summary')).toHaveAttribute('data-status', 'fail')

    await demo(page, `/verify/vote?pid=${TAMPERED}&voteId=0x8000000000000001`)
    await expect(page.getByTestId('election-metadata')).toHaveAttribute('data-status', 'differs')
  })

  test('reads on a phone without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    for (const path of [`/processes/${TAMPERED}`, `/processes/${AFTER_VOTES}`, `/verify/election/${AFTER_VOTES}`]) {
      await demo(page, path)
      await expect(page.locator('[data-testid="metadata-check"], [data-testid="check-metadata"]').first()).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      expect(overflow, path).toBe(false)
    }
  })
})
