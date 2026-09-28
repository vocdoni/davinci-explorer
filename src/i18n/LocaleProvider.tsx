import { Fragment, type ReactNode } from 'react'
import { i18n } from '@lingui/core'
import { I18nProvider, useLingui } from '@lingui/react'

/**
 * The Lingui context every `<Trans>` and `useLingui()` reads. A language must
 * be active before it mounts (main.tsx waits for the catalog).
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

/**
 * Remounts its children when the language changes, so text made outside the
 * Lingui hooks (the formatters, the selectors, memoised rows) is made again
 * in the new language. It wraps the router: the data layer and the query
 * cache above it keep running.
 */
export function RemountOnLocaleChange({ children }: { children: ReactNode }) {
  const { i18n: active } = useLingui()
  return <Fragment key={active.locale}>{children}</Fragment>
}
