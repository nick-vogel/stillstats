import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { buildHighlights } from '../../../../apps/web/highlights-plugin.ts'

const root = fileURLToPath(new URL('../../../../', import.meta.url))

export default defineConfig({
  root,
  plugins: [buildHighlights(`${root}apps/web/test/fixtures/`)],
  resolve: {
    // The repro lives outside any workspace package, so it borrows the web app's dependencies.
    alias: [
      { find: '@', replacement: `${root}apps/web/src` },
      {
        find: /^react-dom\/client$/,
        replacement: `${root}apps/web/node_modules/react-dom/client.js`,
      },
      { find: /^react-dom$/, replacement: `${root}apps/web/node_modules/react-dom/index.js` },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: `${root}apps/web/node_modules/react/jsx-dev-runtime.js`,
      },
      {
        find: /^react\/jsx-runtime$/,
        replacement: `${root}apps/web/node_modules/react/jsx-runtime.js`,
      },
      { find: /^react$/, replacement: `${root}apps/web/node_modules/react/index.js` },
    ],
  },
  test: {
    include: ['docs/reviews/creator-analytics-936/repro/retention-comparison-ui.test.ts'],
  },
})
