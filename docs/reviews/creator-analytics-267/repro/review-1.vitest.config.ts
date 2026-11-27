import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('../../../../', import.meta.url))

export default defineConfig({
  root,
  resolve: {
    alias: {
      react: fileURLToPath(new URL('../../../../apps/web/node_modules/react', import.meta.url)),
    },
  },
  test: {
    include: ['docs/reviews/creator-analytics-267/repro/review-1.test.ts'],
  },
})
