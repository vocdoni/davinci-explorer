import { useMemo, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router/dom'
import { ConfigProvider } from '~config/ConfigProvider'
import { useRuntimeConfig } from '~config/config-context'
import { DataProvider } from '~data/DataProvider'
import { createExplorerData } from '~data/create'
import { LocaleProvider, RemountOnLocaleChange } from '~i18n/LocaleProvider'
import { router } from '~routes/router'
import { ThemeProvider } from '~theme/ThemeProvider'

// Provider order:
//   Locale:      the active language (main.tsx loads it before the first render),
//                so the config screens are translated too.
//   Theme:       no dependencies; the config error screen is themed too.
//   Config:      gates on /config.json; nothing chain-aware mounts before it.
//   QueryClient: on-demand reads (blobs, sequencers, DKG).
//   Data:        the indexer (or the demo fixture) and the services, built from the config.
//   Router:      last, so route elements can use all of the above. A language
//                switch remounts it; the data and the query cache stay.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function Data({ children }: { children: ReactNode }) {
  const config = useRuntimeConfig()
  const data = useMemo(() => createExplorerData({ config }), [config])
  return (
    <DataProvider source={data.source} services={data.services}>
      {children}
    </DataProvider>
  )
}

export function App() {
  return (
    <LocaleProvider>
      <ThemeProvider>
        <ConfigProvider>
          <QueryClientProvider client={queryClient}>
            <Data>
              <RemountOnLocaleChange>
                <RouterProvider router={router} />
              </RemountOnLocaleChange>
            </Data>
          </QueryClientProvider>
        </ConfigProvider>
      </ThemeProvider>
    </LocaleProvider>
  )
}
