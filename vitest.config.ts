import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { buildHighlights } from './apps/web/highlights-plugin.ts'

export default defineConfig({
  // The web app's highlights, for its tests that render the app here: its own fixtures, two app
  // releases on different days, each listing one highlight, and a second release on the later day
  // listing none (apps/web/vite.config.ts).
  plugins: [buildHighlights(fileURLToPath(new URL('./apps/web/test/fixtures/', import.meta.url)))],
  // The web app's `@/` alias (apps/web/vite.config.ts), for its tests that render the app here.
  resolve: { alias: { '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)) } },
  test: {
    // The env wrapper's tests (scripts/lib), with the packages', so CI runs them bare.
    include: ['{apps,packages}/*/{src,test}/**/*.test.ts', 'scripts/**/*.test.mjs'],
    globalSetup: ['packages/database/test/global-setup.ts'],
    hookTimeout: 120_000,
    server: {
      deps: {
        inline: [
          /\/node_modules\/wxt\/dist\/(browser|utils\/)/,
          /\/node_modules\/@wxt-dev\/browser\//,
        ],
      },
    },
  },
})
