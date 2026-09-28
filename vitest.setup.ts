import '@testing-library/jest-dom/vitest'
import type { ComponentType, ReactElement, ReactNode } from 'react'
import type { RenderHookOptions, RenderOptions } from '@testing-library/react'
import { vi } from 'vitest'
import { i18n } from '@lingui/core'
import { messages } from './src/locales/en/messages.po'
// Sets the message compiler: text not extracted yet still renders in English.
import './src/i18n/i18n'

// The tests read English, the source language, as the app does on a browser
// that asks for it. A test that switches language switches back when done.
i18n.loadAndActivate({ locale: 'en', messages })
if (typeof document !== 'undefined') document.documentElement.lang = 'en'

// Every render and renderHook gets the Lingui context, as the app has it above
// everything else, so a test renders a component alone without wiring it.
type Wrapper = ComponentType<{ children: ReactNode }>
vi.mock('@testing-library/react', async (importOriginal) => {
  const rtl = await importOriginal<typeof import('@testing-library/react')>()
  const { createElement } = await import('react')
  const { I18nProvider } = await import('@lingui/react')
  const { i18n: global } = await import('@lingui/core')
  const withI18n = (Inner?: Wrapper): Wrapper =>
    function I18nWrapper({ children }: { children: ReactNode }) {
      return createElement(I18nProvider, { i18n: global }, Inner ? createElement(Inner, null, children) : children)
    }
  const render = (ui: ReactElement, options: RenderOptions = {}) =>
    rtl.render(ui, { ...options, wrapper: withI18n(options.wrapper as Wrapper | undefined) })
  const renderHook = (callback: (props: unknown) => unknown, options: RenderHookOptions<unknown> = {}) =>
    rtl.renderHook(callback, { ...options, wrapper: withI18n(options.wrapper as Wrapper | undefined) })
  return {
    ...rtl,
    render: render as unknown as typeof rtl.render,
    renderHook: renderHook as unknown as typeof rtl.renderHook,
  }
})

// jsdom has neither: Radix reads `matchMedia`, charts measure with a
// ResizeObserver, and the theme follows `prefers-color-scheme`.
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia
  }
  // ScrollRestoration scrolls on every navigation; jsdom does not implement it.
  window.scrollTo = (() => {}) as typeof window.scrollTo
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof window.ResizeObserver
  }
}

// React Router's data router builds a `Request` with an AbortSignal; Node's
// Request rejects jsdom's AbortSignal class. Tests never abort navigations,
// so drop the signal.
if (typeof globalThis.Request === 'function') {
  const NativeRequest = globalThis.Request
  globalThis.Request = class extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      const { signal: _signal, ...rest } = init ?? {}
      super(input, rest)
    }
  } as typeof Request
}
