import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import './styles/index.css'
import { activateLocale } from '~i18n/i18n'
import { DEFAULT_LOCALE, initialLocale } from '~i18n/locales'
import { App } from './App'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('No #root element in index.html')

// The first render waits for the language's catalog, so no text shows in one
// language and then flips to another. If that chunk fails, English does.
const locale = initialLocale()
activateLocale(locale)
  .catch(() => (locale === DEFAULT_LOCALE ? undefined : activateLocale(DEFAULT_LOCALE)))
  .catch(() => undefined)
  .finally(() =>
    createRoot(rootEl).render(
      <StrictMode>
        <App />
      </StrictMode>
    )
  )
