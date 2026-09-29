import { expect, test, type Page } from '@playwright/test'

// The registry's grace window on the demo network (src/fixtures/synthetic.ts).
// "Assembly motion" ended moments before the demo's head and still records
// batches for a few more minutes of its clock; "Tooling survey" recorded two
// batches in a window that has closed; "Park renovation poll" had its end
// moved earlier. The demo's clock restarts at its head with every load.
const PREFIX = 'b12878d5'
const pid = (organizer: string, nonce: number) => `0x${organizer}${PREFIX}${nonce.toString(16).padStart(14, '0')}`
const ORG0 = '42fc20654efd78c6887ff0bd1cc50c9ec1dab589'
const ORG1 = '7e5f4552091a69125d5dfcb7b8c2659029395bdf'
const CLOSING = pid(ORG1, 3)
const GRACE_SETTLED = pid(ORG0, 3)
const SHORTENED = pid(ORG1, 1)

async function demo(page: Page, path: string) {
  const sep = path.includes('?') ? '&' : '?'
  await page.goto(`${path}${sep}demo=1`)
}

function noPageErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

test.describe('grace window', () => {
  test('a process past its end with the window open is closing, and its late batches are marked', async ({ page }) => {
    const errors = noPageErrors(page)
    await demo(page, `/processes/${CLOSING}`)
    const root = page.getByTestId('page-process')
    await expect(root.getByRole('heading', { name: 'Assembly motion' })).toBeVisible()
    await expect(root.getByText('Closing', { exact: true })).toBeVisible()
    await expect(page.getByTestId('process-lifecycle')).toContainText('Recording the last batches')
    await expect(page.getByTestId('process-in-short')).toContainText('grace window closes, in')
    await expect(page.getByTestId('tab-overview')).toContainText('set by the organizer')

    await page.getByRole('tab', { name: /^Batches/ }).click()
    const note = page.getByTestId('grace-note')
    await expect(note).toContainText('2 batches with')
    await expect(note).toContainText('recorded after the end')
    await expect(note).toContainText('at most 30 min after the end')
    await expect(page.getByTestId('tab-transitions').getByText('after the end', { exact: true })).toHaveCount(2)

    await page.getByRole('tab', { name: /^Results/ }).click()
    await expect(page.getByTestId('no-results')).toContainText('Recording the last votes')

    await demo(page, `/processes/${CLOSING}/transitions/4`)
    await expect(page.getByTestId('transition-after-end')).toContainText('after the election’s end')
    await expect(page.getByTestId('transition-summary').getByText('after the end', { exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('a closed window leaves the results pending', async ({ page }) => {
    await demo(page, `/processes/${GRACE_SETTLED}`)
    const root = page.getByTestId('page-process')
    await expect(root.getByText('Ended, results pending', { exact: true })).toBeVisible()
    await expect(page.getByTestId('process-lifecycle')).toContainText('2 batches recorded in it')
    await expect(page.getByTestId('process-in-short')).toContainText('the grace window has closed')
    await page.getByRole('tab', { name: /^Results/ }).click()
    await expect(page.getByTestId('no-results')).toContainText('Voting is over; results pending')
  })

  test('an end moved earlier shows in the dates and the lifecycle', async ({ page }) => {
    await demo(page, `/processes/${SHORTENED}`)
    await expect(page.getByTestId('duration-changes')).toContainText('end moved earlier to')
    await expect(page.getByTestId('process-lifecycle')).toContainText('Moved earlier by the organizer')
  })

  test('the list filters by the new phases', async ({ page }) => {
    await demo(page, '/processes?status=closing')
    await expect(page.getByLabel('Phase')).toHaveValue('closing')
    await expect(page.getByTestId('process-count')).toHaveText('1 process')
    await demo(page, '/processes?status=ended')
    await expect(page.getByTestId('process-count')).toHaveText('3 processes')
  })

  test('the contracts page lists the window settings, and the election check reads the window', async ({ page }) => {
    await demo(page, '/contracts')
    await expect(page.getByTestId('param-defaultGrace')).toContainText('3 min')
    await expect(page.getByTestId('param-graceFloor')).toContainText('2 min 30 s')
    await expect(page.getByTestId('param-graceMaxTotal')).toContainText('30 min')
    await expect(page.getByTestId('param-noticeMin')).toContainText('1 min')

    await demo(page, `/verify/election/${CLOSING}`)
    await expect(page.getByTestId('election-redo')).toContainText('getProcessGraceEnd(bytes31)(uint256)')
  })
})
