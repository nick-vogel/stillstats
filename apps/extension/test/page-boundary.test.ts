// Limits: a scan of every page surface's and selector's source, Studio's and youtube.com's, for the
// ways a script reads what a page shows. It cannot see a read a dependency makes, or one a built
// bundle adds, and it trusts that the only attribute read is a link's href.
// src/surfaces/card.test.ts, src/surfaces/content-list.test.ts and src/surfaces/analytics.test.ts
// show the ids asked for come from the URL and the card's link, the rows' links or the header's
// dashboard link; creator-analytics#99 walks real Studio. The youtube.com surfaces read a link's
// href and the page URL only, and no tile id, watch `v` or Shorts id leaves a youtube.com tab
// (creator-analytics#520): src/surfaces/channel-page.test.ts, src/surfaces/watch-page.test.ts,
// src/surfaces/shorts.test.ts and src/surfaces/feed.test.ts show the ids are matched in the browser
// against the held channels' uploads, each test checking that no video id was sent, and
// src/background-answer.test.ts that the background answers a youtube.com tab's read of videos
// failed. The watch page matches its block's `video-id` against the URL's `v` in a selector and never
// reads it, and the Shorts player reads its channel bar's href only to tell a bar YouTube has not
// redrawn since the last Short, never to decide whose a Short is. creator-analytics#143 walks real
// youtube.com.
import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

const src = join(import.meta.dirname, '../src')

const pageSources = globSync('{selectors,surfaces}/**/*.ts', { cwd: src })
  .filter((file) => !file.endsWith('.test.ts'))
  .map((file) => ({ file, source: readFileSync(join(src, file), 'utf8') }))

test('the scan covers the page surfaces and their selectors, so a moved or emptied folder fails it rather than shrinking it', () => {
  const files = pageSources.map(({ file }) => file)
  expect(files).toEqual(
    expect.arrayContaining([
      'selectors/analytics.ts',
      'selectors/card.ts',
      'selectors/channel-page.ts',
      'selectors/content-list.ts',
      'selectors/feed.ts',
      'selectors/lockup.ts',
      'selectors/shorts.ts',
      'selectors/watch-page.ts',
      'surfaces/analytics.ts',
      'surfaces/card.ts',
      'surfaces/channel-page.ts',
      'surfaces/content-list.ts',
      'surfaces/feed.ts',
      'surfaces/mark.ts',
      'surfaces/page-watcher.ts',
      'surfaces/public-pages.ts',
      'surfaces/render.ts',
      'surfaces/shorts.ts',
      'surfaces/states.ts',
      'surfaces/studio-url.ts',
      'surfaces/watch-page.ts',
      'surfaces/youtube-surfaces.ts',
      'surfaces/youtube-url.ts',
    ]),
  )
  // Apart from the files named above: a folder the glob no longer finds fails here even once that
  // list changes.
  for (const folder of ['selectors/', 'surfaces/']) {
    expect(files.filter((file) => file.startsWith(folder))).not.toEqual([])
  }
})

/**
 * The ways the surfaces read a node's text, a value or its look today, in `selectors/` and
 * `surfaces/` only (`dom.ts`, `messages.ts` and the content entrypoint are not scanned). Layout
 * reads (`getBoundingClientRect`, `offset*`, `client*`), `.title`, `.ariaLabel` and other `aria*`
 * properties, `.className`, `.text`, `.label`, `outerText`, `getAttribute` (how the selectors read
 * a link's href, which the file's header trusts) and attribute-value selectors are not matched.
 */
const pageRead =
  /\b(?:textContent|innerText|innerHTML|outerHTML|nodeValue|wholeText|dataset|attributes|getComputedStyle)\b|\.value\b|\.data\b/g

test('the page surfaces and their selectors read no text, value or style from the page, and write text only in render.ts by assignment', () => {
  const reads = pageSources.flatMap(({ file, source }) =>
    source.split('\n').flatMap((line, index) =>
      [...line.matchAll(pageRead)]
        .filter((match) => {
          const assigned = /^\s*=[^=]/.test(line.slice((match.index ?? 0) + match[0].length))
          return !(file === 'surfaces/render.ts' && match[0] === 'textContent' && assigned)
        })
        .map(() => `${file}:${index + 1}: ${line.trim()}`),
    ),
  )

  expect(reads).toEqual([])
})

test("the only attribute the page surfaces and their selectors read is a link's href", () => {
  const attributeReads = pageSources.flatMap(({ file, source }) =>
    [...source.matchAll(/getAttribute(?:NS|Node)?\s*\(([^)]*)\)/g)]
      .filter(([, name]) => name?.trim() !== "'href'")
      .map(([call]) => `${file}: ${call}`),
  )

  expect(attributeReads).toEqual([])
})
