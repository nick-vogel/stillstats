import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('../../../../', import.meta.url))

export default defineConfig({
  root,
  resolve: {
    // The repro lives outside any workspace package, so it borrows the API app's dependency.
    alias: [
      {
        find: /^@hono\/node-server$/,
        replacement: `${root}apps/api/node_modules/@hono/node-server`,
      },
    ],
  },
  test: {
    include: ['docs/reviews/creator-analytics-2/repro/quota-rollback.test.ts'],
    globalSetup: ['packages/database/test/global-setup.ts'],
    hookTimeout: 120_000,
  },
})
