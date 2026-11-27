import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('../../../../', import.meta.url))

export default defineConfig({
  root,
  test: {
    include: ['docs/reviews/creator-analytics-640/repro/prune-on-failed-send.test.ts'],
    globalSetup: ['packages/database/test/global-setup.ts'],
    hookTimeout: 120_000,
  },
})
