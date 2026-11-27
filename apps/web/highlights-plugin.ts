import { readReleaseContent, releasePagePath } from '@creator-analytics/releases'
import type { Plugin } from 'vite'
import type { BuiltHighlight } from './src/whats-new.ts'

const moduleId = 'virtual:highlights'
const resolvedId = `\0${moduleId}`

/**
 * Serves `virtual:highlights`, whose default export is every highlight in the release content at
 * `root`, newest release first, as data: each one's title, its description as the HTML the
 * release content package wrote, its release, that release's day and page, and its screen when it
 * has one. It reads the content at build time, on the build's own machine, so no markdown code reaches
 * the browser, and a note or highlight that breaks a rule throws here, which fails the build.
 */
export function buildHighlights(root: string): Plugin {
  return {
    name: 'build-highlights',
    resolveId(id) {
      return id === moduleId ? resolvedId : undefined
    },
    load(id) {
      if (id !== resolvedId) return undefined
      const { releases, highlights: read } = readReleaseContent(root)
      // Each highlight's release is one of the releases read, so every lookup finds its day.
      const dayOf = new Map(releases.map(({ version, date }) => [version, date]))
      const highlights: BuiltHighlight[] = read.map(({ name, title, html, release, screen }) => ({
        name,
        title,
        html,
        release,
        releaseDate: dayOf.get(release) as string,
        releasePath: releasePagePath(release),
        ...(screen === undefined ? {} : { screen }),
      }))
      return `export default ${JSON.stringify(highlights)}`
    },
  }
}
