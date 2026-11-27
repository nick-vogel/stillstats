import { fileURLToPath } from 'node:url'
import { packageContentRoot } from '@creator-analytics/releases'
import { contentSecurityPolicy, fonts } from '@creator-analytics/visual-system/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { buildHighlights } from './highlights-plugin.ts'
import { themeScript } from './theme-script-plugin.ts'

export default defineConfig({
  // The API serves the site at / and the web app under /app.
  base: '/app/',
  plugins: [
    react(),
    tailwindcss(),
    // The web app test points this at its fixture notes, as the site test does the site's.
    buildHighlights(process.env.RELEASE_CONTENT_ROOT || packageContentRoot),
    fonts(),
    // The head script that sets the theme before the first paint (creator-analytics#691).
    themeScript(),
    contentSecurityPolicy(),
  ],
  // The shadcn CLI writes its components' imports through `@/` (components.json).
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // The API also serves the built site's pages, which the web app links to: the legal pages, and
  // the release pages "What's new" links each highlight to.
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/privacy': 'http://localhost:3000',
      '/terms': 'http://localhost:3000',
      '/releases': 'http://localhost:3000',
    },
  },
})
