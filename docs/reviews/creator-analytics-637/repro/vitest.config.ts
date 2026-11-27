import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { buildHighlights } from '../../../../apps/web/highlights-plugin.ts'

const root = fileURLToPath(new URL('../../../../', import.meta.url))

export default defineConfig({
  root,
  plugins: [buildHighlights(fileURLToPath(new URL('apps/web/test/fixtures/', `file://${root}`)))],
  resolve: { alias: { '@': fileURLToPath(new URL('apps/web/src', `file://${root}`)) } },
  test: {
    include: ['docs/reviews/creator-analytics-637/repro/*.test.ts'],
  },
})
