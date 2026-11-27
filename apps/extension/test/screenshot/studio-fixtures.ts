// The saved Studio pages in test/fixtures/studio, and the Studio stylesheet the screenshots draw
// them with (studio.css, which extract-studio-styles.ts writes).
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export const fixtureNames = ['dashboard', 'content-list', 'video-analytics'] as const
export type FixtureName = (typeof fixtureNames)[number]

const fixturesDirectory = new URL('../fixtures/studio/', import.meta.url)

export const studioStylesPath = fileURLToPath(new URL('studio.css', fixturesDirectory))

/**
 * Studio's stylesheet for the screenshots. It is YouTube's own file, so it is written locally by
 * extract-studio-styles.ts and never committed (creator-analytics#942), and a clone has none.
 */
export async function readStudioStyles(): Promise<string> {
  try {
    return await readFile(studioStylesPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    throw new Error(
      `${studioStylesPath} is absent. It is YouTube Studio's own stylesheet, which the repository does not hold. Write it from the three full Studio saves first: node apps/extension/test/screenshot/extract-studio-styles.ts <dashboard> <content list> <video analytics>`,
      { cause: error },
    )
  }
}

export interface StudioFixture {
  /** The Studio URL the page was saved from, from the file's first line. */
  url: string
  /** The page, without that first line. */
  html: string
}

export async function readFixture(name: FixtureName): Promise<StudioFixture> {
  const file = await readFile(new URL(`${name}.html`, fixturesDirectory), 'utf8')
  const saved = /^<!-- (https:\/\/studio\.youtube\.com\/\S+) saved \S+ -->\n/.exec(file)
  if (!saved?.[1]) throw new Error(`${name}.html does not open with its Studio URL`)
  return { url: saved[1], html: file.slice(saved[0].length) }
}

/** The id of the style element `withStyles` adds. */
export const studioStylesId = 'stillstats-screenshot-studio-css'

/** `html` with `css` as a style element at the end of its head. */
export function withStyles(html: string, css: string): string {
  const end = html.indexOf('</head>')
  if (end < 0) throw new Error('The page has no head')
  if (css.includes('</style')) throw new Error('The stylesheet closes its own style element')
  return `${html.slice(0, end)}<style id="${studioStylesId}">${css}</style>${html.slice(end)}`
}
