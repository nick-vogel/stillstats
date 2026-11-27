import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('../../../../', import.meta.url))

export default defineConfig({
  root,
  test: {
    include: ['docs/reviews/creator-analytics-4/repro/*.test.ts'],
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
