import { fileURLToPath } from 'node:url'
import { fonts } from '@creator-analytics/visual-system/vite'
import { defineConfig } from 'wxt'
import { apiOriginOf, manifestOf } from './src/manifest.ts'
import { accessHeadersOf } from './src/staging-access.ts'

export default defineConfig({
  srcDir: 'src',
  imports: false,
  manifest: ({ browser, mode }) => manifestOf({ browser, mode }),
  vite: ({ mode }) => ({
    plugins: [fonts()],
    define: {
      // Written in at build time, so a production build's scripts carry no local API origin.
      'import.meta.env.API_ORIGIN': JSON.stringify(apiOriginOf(mode)),
      // Read here, from the environment `pnpm build:extension:staging` builds from the local env
      // (scripts/with-env.mjs). A staging build without the token fails here. Only the
      // background reads it, so no content script or popup carries the token.
      'import.meta.env.API_HEADERS': JSON.stringify(accessHeadersOf(mode, process.env)),
    },
  }),
  // The sources ZIP Firefox Add-ons asks for (`wxt zip -b firefox`, creator-analytics#100). The
  // extension builds from workspace packages, so the ZIP holds the workspace root's files and the
  // packages the build reads, and a reviewer rebuilds it as SOURCE_CODE_REVIEW.md says. It leaves
  // out every test, the saved Studio pages, which hold a creator's data, and the store screenshots.
  // The root is absolute: WXT 0.21.4 spreads this object over its resolved config, so a relative
  // root would be read from whatever folder `wxt zip` runs in.
  zip: {
    sourcesRoot: fileURLToPath(new URL('../..', import.meta.url)),
    includeSources: [
      '.node-version',
      '.npmrc',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'tsconfig.base.json',
      'apps/extension/**',
      'packages/api-types/**',
      'packages/visual-system/**',
    ],
    excludeSources: [
      'apps/extension/store-assets/**',
      'apps/extension/test/**',
      'packages/*/test/**',
      '**/*.test.ts',
    ],
  },
})
