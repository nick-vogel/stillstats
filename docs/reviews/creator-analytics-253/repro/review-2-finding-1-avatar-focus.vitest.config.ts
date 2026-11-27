import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('../../../../', import.meta.url))

export default defineConfig({
  root,
  test: {
    include: ['docs/reviews/creator-analytics-253/repro/review-2-finding-1-avatar-focus.test.ts'],
  },
})
