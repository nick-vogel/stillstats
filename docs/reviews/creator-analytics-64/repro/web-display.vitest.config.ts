import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('../../../../', import.meta.url))

export default defineConfig({
  root,
  test: {
    include: ['docs/reviews/creator-analytics-64/repro/web-display.test.ts'],
  },
})
