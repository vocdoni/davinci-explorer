import { expect, test, type Page } from '@playwright/test'

// The Verify pages on the deterministic demo network (src/fixtures/synthetic.ts):
// the landing, the election and deployment checks, and how they read on a
// phone. The vote check is in b-pages.spec.ts, next to the transition page it
// links from.
const PREFIX = 'b12878d5'
const pid = (organizer: string, nonce: number) => `0x${organizer}${PREFIX}${nonce.toString(16).padStart(14, '0')}`
const ORG0 = '42fc20654efd78c6887ff0bd1cc50c9ec1dab589'
const ORG2 = '2b5ad5c4795c026514f8317c7a215e218dccd6cf'
/** Sequencer key, zkVM results. */
const RESULTS = pid(ORG0, 0)
/** Open, 40 transitions, on-chain census. */
const OPEN = pid(ORG0, 1)
/** DKG locked, tally submitted, organizer secret sealed. */
const AWAITING_REVEAL = pid(ORG2, 0)

async function demo(page: Page, path: string) {
  const sep = path.includes('?') ? '&' : '?'
  await page.goto(`${path}${sep}demo=1`)
}

function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

test.describe('verify', () => {
  test('the landing offers the three checks, and the header leads there', async ({ page }) => {
    await demo(page, '/')
    const nav = page.getByRole('navigation', { name: 'Primary' })
    await expect(nav.getByRole('link')).toHaveText([
      'Overview',
      'Processes',
      'Sequencers',
      'Contracts',
      'Learn',
      'Verify',
    ])
    await nav.getByRole('link', { name: 'Verify' }).click()
    const root = page.getByTestId('page-verify')
    await expect(root.getByRole('heading', { level: 1, name: 'Check it yourself' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Verify' })).toHaveAttribute('aria-current', 'page')
    for (const [choice, testId] of [
      ['verify-choice-vote', 'page-verify-vote'],
      ['verify-choice-election', 'page-verify-election'],
      ['verify-choice-deployment', 'page-verify-deployment'],
    ]) {
      await demo(page, '/verify')
      await page.getByTestId(choice!).click()
      await expect(page.getByTestId(testId!)).toBeVisible()
      await expect(page.getByTestId('verify-stepper')).toBeVisible()
    }
  })

  test('an election: picked from the list, then every group of checks', async ({ page }) => {
    const errors = watchErrors(page)
    await demo(page, '/verify/election')
    const picker = page.getByTestId('process-picker')
    await expect(picker.getByTestId('picker-row')).toHaveCount(8)
    await picker.getByRole('button', { name: 'Show all 11 elections' }).click()
    await picker.getByLabel('Find the election').fill(RESULTS)
    await expect(picker.getByTestId('picker-row')).toHaveCount(1)
    await picker.getByTestId('picker-row').click()
    await expect(page).toHaveURL(new RegExp(`/verify/election/${RESULTS}`))
    await expect(page.getByTestId('chosen-election')).toContainText(RESULTS)
    for (const id of ['census', 'key', 'rules', 'metadata', 'batches', 'chain', 'published', 'produced', 'tally']) {
      await expect(page.getByTestId(`check-${id}`)).toHaveAttribute('data-status', 'pass', { timeout: 15_000 })
    }
    await expect(page.getByTestId('election-summary')).toContainText('All 9 checks passed.')
    // Each batch row links to its transition.
    await page.getByTestId('batch-list').getByRole('link', { name: '#0' }).click()
    await expect(page.getByTestId('page-transition')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('an election waiting for its organizer: the result is not decided yet', async ({ page }) => {
    await demo(page, `/verify/election/${AWAITING_REVEAL}`)
    await expect(page.getByTestId('check-key')).toContainText('locked with a secret the organizer keeps')
    await expect(page.getByTestId('check-published')).toHaveAttribute('data-status', 'pending')
    await expect(page.getByTestId('check-batches')).toHaveAttribute('data-status', 'pass', { timeout: 15_000 })
  })

  test('an open election explains its census and how to redo the checks', async ({ page }) => {
    await demo(page, `/verify/election/${OPEN}`)
    const census = page.getByTestId('check-census')
    await expect(census).toHaveAttribute('data-status', 'pass', { timeout: 15_000 })
    await census.getByText('How this is checked').click()
    await expect(census).toContainText('getRootBlockNumber')
    await expect(page.getByTestId('election-redo')).toContainText('cast logs --from-block')
    await page
      .getByTestId('verify-stepper')
      .getByRole('link', { name: /Redo it yourself/ })
      .click()
    await expect(page).toHaveURL(/#redo$/)
    await expect(page.getByTestId('election-redo')).toBeInViewport()
  })

  test('the deployment: pins, contracts, committee and the commands', async ({ page }) => {
    const errors = watchErrors(page)
    await demo(page, '/verify/deployment')
    for (const id of ['release', 'contracts', 'dkg']) {
      await expect(page.getByTestId(`check-${id}`)).toHaveAttribute('data-status', 'pass', { timeout: 15_000 })
    }
    const release = page.getByTestId('check-release')
    for (const pin of [
      'batchProgramVK',
      'resultsProgramVK',
      'rootCVadcopFinal',
      'ziskVerifierCodeHash',
      'ballotVKHash',
    ]) {
      await expect(release.getByTestId(`pin-${pin}`)).toHaveAttribute('data-state', 'pass')
    }
    await release.getByText('How this is checked').click()
    await expect(release.locator('[data-formula]').first()).toContainText(
      'publicInput = sha256(programVK ‖ publicValues ‖ rootCVadcopFinal) mod r_BN254'
    )
    await expect(page.getByTestId('contract-row-registry').getByRole('link', { name: 'Source' })).toHaveAttribute(
      'href',
      /\/address\/0x[0-9a-fA-F]{40}#code$/
    )
    await expect(page.getByTestId('verify-script')).toContainText('python3 script/verify_deployment.py')
    expect(errors).toEqual([])
  })

  test('on a phone every Verify page fits the screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    for (const path of [
      '/verify',
      `/verify/vote?pid=${OPEN}&voteId=0x8000000000000001`,
      '/verify/election',
      `/verify/election/${RESULTS}`,
      '/verify/deployment',
    ]) {
      await demo(page, path)
      await expect(page.locator('[data-testid^="page-verify"]')).toBeVisible()
      await page.waitForTimeout(300)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      expect(overflow, path).toBe(false)
    }
  })
})
