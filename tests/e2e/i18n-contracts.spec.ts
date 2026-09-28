import { expect, test, type Page } from '@playwright/test'

// The contracts and sequencers pages in each language, on the demo network.
// The same checks run in English first, so a failure in Spanish or Catalan is
// the translation, not the selectors. Commands, contract names and hex stay
// as they are in every language.

type Locale = 'en' | 'es' | 'ca'

const TEXT: Record<
  Locale,
  {
    contractsTitle: string
    onThisPage: string
    verdict: RegExp
    pinnedValues: string
    consistent: string
    source: string
    batchVk: string
    passed: string
    epochLength: string
    sequencersTitle: string
    observer: string
    account: string
  }
> = {
  en: {
    contractsTitle: 'Contracts and parameters',
    onThisPage: 'On this page',
    verdict: /All five pins match davinci-zkvm v\d/,
    pinnedValues: 'Pinned values',
    consistent: '7 of 7',
    source: 'Source',
    batchVk: 'Vote-batch program vk',
    passed: 'passed',
    epochLength: '17,280',
    sequencersTitle: 'Sequencer nodes',
    observer: 'Observer',
    account: 'Account',
  },
  es: {
    contractsTitle: 'Contratos y parámetros',
    onThisPage: 'En esta página',
    verdict: /coinciden con davinci-zkvm v\d/,
    pinnedValues: 'Valores fijados',
    consistent: '7 de 7',
    source: 'Código fuente',
    batchVk: 'vk del programa de lotes de votos',
    passed: 'superada',
    epochLength: '17.280',
    sequencersTitle: 'Nodos secuenciadores',
    observer: 'Observador',
    account: 'Cuenta',
  },
  ca: {
    contractsTitle: 'Contractes i paràmetres',
    onThisPage: 'En aquesta pàgina',
    verdict: /coincideixen amb davinci-zkvm v\d/,
    pinnedValues: 'Valors fixats',
    consistent: '7 de 7',
    source: 'Codi font',
    batchVk: 'vk del programa de lots de vots',
    passed: 'superada',
    epochLength: '17.280',
    sequencersTitle: 'Nodes seqüenciadors',
    observer: 'Observador',
    account: 'Compte',
  },
}

async function open(page: Page, path: string, locale: Locale) {
  await page.goto(`${path}?demo=1`)
  await page.getByTestId('language-select').selectOption(locale)
  await expect(page.locator('html')).toHaveAttribute('lang', locale)
}

for (const locale of ['en', 'es', 'ca'] as const) {
  const text = TEXT[locale]

  test.describe(`contracts and sequencers in ${locale}`, () => {
    test('the contracts page', async ({ page }) => {
      await open(page, '/contracts', locale)
      const root = page.getByTestId('page-contracts')
      await expect(root.getByRole('heading', { name: text.contractsTitle })).toBeVisible()
      await expect(page.getByTestId('release-summary')).toHaveText(text.verdict)
      await expect(page.getByRole('navigation', { name: text.onThisPage })).toBeVisible()
      await expect(page.locator('#parameters').getByRole('heading', { name: text.pinnedValues })).toBeVisible()
      await expect(page.getByTestId('wiring-checks')).toContainText(text.consistent)
      await expect(page.getByTestId('contract-row-registry').getByRole('link', { name: text.source })).toBeVisible()
      await expect(page.getByTestId('contract-row-registry')).toContainText('ProcessRegistry')
      await expect(page.getByTestId('pin-batchProgramVK')).toContainText(text.batchVk)
      await expect(page.getByTestId('pin-batchProgramVK').getByRole('img', { name: text.passed })).toBeVisible()
      // Numbers follow the language; commands and hex do not.
      await expect(page.locator('#dkg')).toContainText(text.epochLength)
      const script = page.getByTestId('verify-script')
      await expect(script).toContainText('python3 script/verify_deployment.py')
      await expect(script).toContainText('--registry 0x')
    })

    test('the sequencers page', async ({ page }) => {
      await open(page, '/sequencers', locale)
      const root = page.getByTestId('page-sequencers')
      await expect(root.getByRole('heading', { name: text.sequencersTitle })).toBeVisible()
      const checks = page.getByTestId('sequencer-0').getByTestId('sequencer-info-checks')
      await expect(checks.getByRole('img', { name: text.passed })).toHaveCount(5)
      await expect(checks).toContainText(text.batchVk)
      await expect(page.getByTestId('sequencer-1').getByText(text.observer, { exact: true })).toBeVisible()
      await expect(page.getByTestId('settlers').getByRole('columnheader', { name: text.account })).toBeVisible()
    })
  })
}
