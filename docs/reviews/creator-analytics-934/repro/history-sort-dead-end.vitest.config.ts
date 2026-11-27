import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('../../../../', import.meta.url))

export default defineConfig({
  root,
  resolve: { alias: { '@': fileURLToPath(new URL('../../../../apps/web/src', import.meta.url)) } },
  test: {
    include: ['docs/reviews/creator-analytics-934/repro/history-sort-dead-end.test.ts'],
  },
})
