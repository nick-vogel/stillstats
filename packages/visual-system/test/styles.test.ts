// Limits: these tests read the stylesheet as written, and evaluate no media query and no
// data-theme selector, so they cannot show either mode as a browser draws it. The colour rules measure each colour on its own, not a
// translucent colour composited over the page, the blend along a gradient, or the grain overlay.
// Nick checks the light and dark modes of the site and the web app in a real browser.
import { access, readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { fontshareFiles } from '../src/fontshare.ts'
import {
  avoidedColoursNear,
  backgroundColoursIn,
  colourSchemesIn,
  darkTokensIn,
  declarationsIn,
  fontUrlsIn,
  isWarmTinted,
  lightTokensIn,
  lightValuesIn,
  printThemeBlockIn,
  printThemeSelector,
  rulesDeclaringIn,
  themeBlocksIn,
} from './testing.ts'

const stylesheetUrl = new URL('../src/styles.css', import.meta.url)
const css = await readFile(stylesheetUrl, 'utf8')

describe('the visual system', () => {
  test('every colour sits a clear distance from anthropic.com and Plausible colours', () => {
    const colours = declarationsIn(css).flatMap(({ colours }) => colours)

    expect(colours.length).toBeGreaterThan(0)
    for (const { written, oklab } of colours) {
      expect({ written, tooClose: avoidedColoursNear(oklab) }).toEqual({ written, tooClose: [] })
    }
  })

  test('no background token or background declaration is cream, ivory, beige or sepia', () => {
    const backgrounds = backgroundColoursIn(css)

    expect(backgrounds.length).toBeGreaterThan(0)
    for (const { written, oklab } of backgrounds) {
      expect({ written, warm: isWarmTinted(oklab) }).toEqual({ written, warm: false })
    }
  })

  test('the dark scheme sets every colour token the light scheme sets', () => {
    const writesAColour = new Set(
      declarationsIn(css)
        .filter(({ colours }) => colours.length > 0)
        .map(({ property }) => property),
    )
    const colourTokens = lightTokensIn(css).filter((token) => writesAColour.has(token))

    expect(colourTokens.length).toBeGreaterThan(0)
    expect(darkTokensIn(css)).toEqual(expect.arrayContaining(colourTokens))
  })

  test('the dark tokens apply under data-theme="dark", and under the system\'s dark mode only on a root without data-theme="light"', () => {
    expect(darkTokensIn(css).length).toBeGreaterThan(0)
    expect(rulesDeclaringIn(css, darkTokensIn(css))).toEqual([
      { selector: ':root', media: null },
      { selector: ':root[data-theme=dark]', media: null },
      { selector: ':root:not([data-theme=light])', media: '(prefers-color-scheme:dark)' },
      { selector: printThemeSelector, media: 'print' },
    ])
  })

  test('a printed page takes the light value of every dark token, and color-scheme light (creator-analytics#956)', () => {
    const light = lightValuesIn(css, darkTokensIn(css))

    expect(Object.values(light)).not.toContain(undefined)
    expect(printThemeBlockIn(css)).toEqual({ 'color-scheme': 'light', ...light })
  })

  test('data-theme="light" declares no token, so the light tokens hold on a dark system too', () => {
    expect(themeBlocksIn(css).light).toEqual({})
  })

  test('the two dark blocks hold the same declarations', () => {
    const { dark, systemDark } = themeBlocksIn(css)

    expect(Object.keys(dark).length).toBeGreaterThan(0)
    expect(systemDark).toEqual(dark)
  })

  test('the color-scheme is light dark with no data-theme, light under data-theme="light" and dark under data-theme="dark"', () => {
    expect(colourSchemesIn(css)).toEqual({ none: 'light dark', light: 'light', dark: 'dark' })
  })

  // A Fontshare font is in the folder only once `pnpm fonts` has copied it there (fontshare.ts).
  test('every font names a file by a path relative to the stylesheet, and only a Fontshare font may be absent', async () => {
    const sources = fontUrlsIn(css)

    expect(sources.length).toBeGreaterThan(0)
    for (const source of sources) {
      const present = await access(fileURLToPath(new URL(source, stylesheetUrl))).then(
        () => true,
        () => false,
      )
      const fontshare = (fontshareFiles as readonly string[]).includes(basename(source))
      // A path from the origin's root breaks under /app, where the web app's build puts its assets.
      expect({ source, relative: source.startsWith('../'), present: present || fontshare }).toEqual(
        {
          source,
          relative: true,
          present: true,
        },
      )
    }
  })
})
