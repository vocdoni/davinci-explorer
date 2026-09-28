import { defineConfig } from '@lingui/cli'
import { formatter } from '@lingui/format-po'
import { LOCALES } from './src/i18n/locales'

// English is written inline in the code and is the source; the others are
// translated in src/locales/<locale>/messages.po. The languages are LOCALES
// in src/i18n/locales.ts, shared with the app (see docs/translations.md).
//
// `i18n:check` extracts into a scratch copy of the catalogs by setting
// LINGUI_CATALOGS (scripts/i18n-check.mjs); nothing else sets it.
const catalogs = process.env.LINGUI_CATALOGS ?? '<rootDir>/src/locales'

export default defineConfig({
  sourceLocale: 'en',
  locales: [...LOCALES],
  fallbackLocales: { default: 'en' },
  catalogs: [
    {
      path: `${catalogs}/{locale}/messages`,
      include: ['<rootDir>/src'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '<rootDir>/src/test-utils.tsx'],
    },
  ],
  // File paths without line numbers: moving code around must not change the
  // catalogs, only adding, editing or removing text does. Messages are grouped
  // by the file they come from, so a translator reads a page's text together.
  format: formatter({ lineNumbers: false }),
  orderBy: 'origin',
})
