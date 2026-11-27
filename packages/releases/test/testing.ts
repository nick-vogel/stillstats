import { fileURLToPath } from 'node:url'

/**
 * A committed content root for tests outside this package: two app releases on one day, the
 * second listing no highlight, one extension release, and two highlights.
 */
export const fixtureContentRoot = fileURLToPath(new URL('./fixtures/', import.meta.url))

/**
 * Error messages from markdown-it 15.0.3's source, read from its published dist on 2026-11-10.
 * They are string literals, so a bundle that carries the parser carries them, minified or not.
 */
export const markdownParserMarkers = [
  'none of the block rules matched',
  "inline rule didn't increment state.pos",
]
