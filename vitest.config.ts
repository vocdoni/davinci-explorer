import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { lingui } from '@lingui/vite-plugin'
import tsconfigPaths from 'vite-tsconfig-paths'

// No tailwind plugin: vitest stubs CSS imports, so the tokens never compile
// for unit tests. The Lingui transform is the app's (vite.config.ts).
export default defineConfig({
  plugins: [react({ babel: { plugins: ['@lingui/babel-plugin-lingui-macro'] } }), lingui(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    testTimeout: 20_000,
  },
})
