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
    include: ['docs/reviews/creator-analytics-266/repro/review-6-dropped-disconnect-toast.test.ts'],
  },
})
