import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    root: '../../../..',
    include: ['docs/reviews/creator-analytics-265/repro/*.repro.ts'],
    globalSetup: ['packages/database/test/global-setup.ts'],
    hookTimeout: 120_000,
  },
})
