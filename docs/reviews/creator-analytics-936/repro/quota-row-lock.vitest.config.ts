import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('../../../../', import.meta.url))

export default defineConfig({
  root,
  resolve: {
    // The repro lives outside any workspace package, so it borrows the worker's dependencies.
    alias: [
      { find: /^pg$/, replacement: `${root}apps/worker/node_modules/pg` },
      { find: /^drizzle-orm$/, replacement: `${root}apps/worker/node_modules/drizzle-orm` },
    ],
  },
  test: {
    include: ['docs/reviews/creator-analytics-936/repro/quota-row-lock.test.ts'],
    globalSetup: ['packages/database/test/global-setup.ts'],
    hookTimeout: 120_000,
  },
})
