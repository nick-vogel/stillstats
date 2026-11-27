// Limits: these tests read the HTML and CSS the build writes, and run no script, so they cannot
// show the screens React renders. No tool here evaluates a stylesheet or a media query either, so
// no test shows the web app in the look of the site, in the light or the dark mode. Nick checks
// both modes of every screen at /app in a real browser. The one exception is the print header
// test, which resolves the served sheet's cascade for one element in happy-dom, at a phone's
// width in print and screen media; happy-dom lays nothing out and draws nothing.
// The package's tests hold the visual system's colours to the #27 rules. The web app's own sheet,
// read from source without the package it imports, may write no colour, so those rules cover
// every colour the web app serves, in light and dark mode. The package's background rule reads only
// its own sheet's backgrounds, so tests here hold every token the web app paints a background
// with to it: the own sheet's, the loading placeholders' fill included, and the served Tailwind
// utilities', the chosen Format's fill included.
// The stillness test reads the stylesheets only, so it cannot see an animation a script drives;
// Nick's browser walk does.
// The placeholder size tests compare the sizes the sheets declare, not the sizes a browser draws:
// they cannot see a rule that outranks another, a title's wrap, or the widths the note wraps at,
// which app.css takes from a measurement in Chrome. Nick's browser walk opens a video and the list,
// in Daily and in Running total mode, and the Audience screen, with every format and with Shorts,
// on a phone, a tablet in portrait, a narrow desktop window about 500px wide, a short laptop window
// under 45rem tall and a large desktop, and checks that nothing below the placeholders moves.
// docs/reviews/creator-analytics-268/repro/collapsed-sidebar-placeholders.sh lays each place out
// beside its text in Chrome at every window width from 320px to 2560px, beside the open and the
// collapsed sidebar, and `pnpm test:browser` holds each note's place as tall as its note at 768px,
// 1280px, 1920px and 2560px, open and collapsed (creator-analytics#477), and each Audience
// heading's place as tall as its heading at 320px, 1440px and those four (creator-analytics#463),
// and each one-line section heading's place on a video's page as tall as its heading at the four
// (creator-analytics#468), and each video page breakdown heading's place as tall as its heading,
// wrapped or not, at the Audience headings' six (creator-analytics#512).
// The dev-server test proves that the font URLs the dev server's stylesheet names answer as fonts,
// not what the browser draws with them.
// The inline style test reads the served markup only. A style React or a script sets at run time,
// such as a hover card's place or the video list's heading offset, could still raise a content
// security policy violation; `pnpm test:browser` walks the built app in Chrome and fails on one,
// on the routes and states it visits (creator-analytics#361). The toast's look is Tailwind utilities
// on Base UI's toast (components/ui/toast.tsx), not a rule here, so the walk, not a test of a
// selector, checks in Chrome that it stays fixed at the bottom of the screen, above the account
// menu's open popup, opaque and bordered (creator-analytics#366). Its place beside the sidebar is a
// rule here, which a test below reads, and the walk checks its centre against the screen's beside
// the open and the collapsed sidebar (creator-analytics#508).
// The video list's heading tests read the rules that move its heading rows by the offset a script
// writes (heading-hold.ts), and no test here runs that script against a real layout. Nick's browser
// pass in Safari and Chrome, wide and narrow, is the check that the rows hold under the controls
// bar (creator-analytics#155).
// The column line tests read the rules as the sheet writes them, not which rule wins a cell, so
// `pnpm test:browser` checks the lines Chrome draws, in light and dark mode, and the fixed video
// column's line as the list scrolls sideways (creator-analytics#351).
// The rule 3 test (ADR 0014) reads the CSS the build serves, so it sees what Tailwind emits and the
// visual system's tokens as built. It cannot see a colour a script sets at run time, and it lets
// any value through in a declaration of a visual system token, which the package's colour tests
// hold instead. Its shadcn values are a fixture read from shadcn's docs for one version
// (shadcn-default-theme.ts), so a default shadcn adds later is caught only once the fixture has it.
import { mkdtemp, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from '@creator-analytics/database/testing'
import {
  colourSchemesIn,
  coloursIn,
  darkTokensIn,
  declarationsIn,
  fontLicenceFiles,
  fontUrlsIn,
  isWarmTinted,
  lightTokensIn,
  lightValuesIn,
  printThemeBlockIn,
  printThemeSelector,
  responsesTo,
  rulesDeclaringIn,
  rulesIn,
  themeBlocksIn,
  valueIn,
  visualSystemSheet,
  withoutImports,
} from '@creator-analytics/visual-system/testing'
import { Window } from 'happy-dom'
import { build, createServer } from 'vite'
import {
  beforeAll,
  describe,
  expect,
  onTestFinished,
  test as testWithoutDatabase,
  vi,
} from 'vitest'
import { markdownParserMarkers } from '../../../packages/releases/test/testing.ts'
import { startApi } from '../../api/test/start-api.ts'
import { controlsBarHeightProperty } from '../src/bar-height.ts'
import { sidebarColumnQuery } from '../src/sidebar-column.ts'
import { stackedChartsQuery } from '../src/stacked-charts.ts'
import { themeCopyKey } from '../src/theme.ts'
import { detailThumbnailSizes, listThumbnailSizes, playerThumbnailSizes } from '../src/thumbnail.ts'
import { uploadMarkerRem } from '../src/upload-marker-width.ts'
import {
  classNamesIn,
  coloursOutsideTokens,
  preflightRulesIn,
  shadcnDefaultsIn,
  utilityRulesOf,
} from './built-css.ts'
import { shadcnDefaultTheme } from './shadcn-default-theme.ts'

const webDirectory = fileURLToPath(new URL('..', import.meta.url))
/**
 * The web app's own release notes and highlights: three app releases, the first two on different
 * days each listing one highlight, the third a second release on the second day listing none.
 */
const webContentRoot = fileURLToPath(new URL('./fixtures/', import.meta.url))

let webRoot = ''

async function servedPage(origin: string): Promise<string> {
  return (await fetch(`${origin}/app/`)).text()
}

/** The web app's stylesheets as the API serves them, joined into one text. */
async function servedCss(origin: string): Promise<string> {
  const html = await servedPage(origin)
  const hrefs = [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/g)].map(
    ([link]) => /\bhref="([^"]+)"/.exec(link)?.[1] ?? '',
  )
  expect(hrefs.length).toBeGreaterThan(0)
  const sheets = hrefs.map(async (href) => (await fetch(new URL(href, origin))).text())
  return (await Promise.all(sheets)).join('\n')
}

/** The scripts the served page loads and preloads, joined into one text. */
async function servedScripts(origin: string): Promise<string> {
  const html = await servedPage(origin)
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(([, src = '']) => src)
  const preloads = [...html.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*>/g)].map(
    ([link]) => /\bhref="([^"]+)"/.exec(link)?.[1] ?? '',
  )
  expect(scripts.length).toBeGreaterThan(0)
  const texts = [...scripts, ...preloads].map(async (url) =>
    (await fetch(new URL(url, origin))).text(),
  )
  return (await Promise.all(texts)).join('\n')
}

/** The size and line height of the body's text, from the `font` shorthand its rule writes. */
function bodyTextIn(css: string): { size: string; lineHeight: string } {
  const [, size = '', lineHeight = ''] =
    /([\d.]+rem)\s*\/\s*([\d.]+)/.exec(valueIn(css, 'body', 'font') ?? '') ?? []
  expect(size).not.toBe('')
  return { size, lineHeight }
}

/** The text inside every `@layer utilities` block of a stylesheet, nested blocks included. */
function utilityLayersIn(css: string): string {
  const uncommented = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...uncommented.matchAll(/@layer\s+utilities\s*\{/g)]
    .map((opening) => {
      const open = (opening.index ?? 0) + opening[0].length - 1
      let depth = 0
      for (let at = open; at < uncommented.length; at++) {
        if (uncommented[at] === '{') depth += 1
        if (uncommented[at] === '}') depth -= 1
        if (depth === 0) return uncommented.slice(open + 1, at)
      }
      return uncommented.slice(open + 1)
    })
    .join('\n')
}

async function webOwnSheet(): Promise<string> {
  return withoutImports(await readFile(new URL('../src/app.css', import.meta.url), 'utf8'))
}

/**
 * The declarations that paint (background, colour, border, outline, shadow, fill, stroke) in every
 * rule of `own` with a selector in its list that `selector` matches.
 */
function paintedBy(own: string, selector: RegExp): { property: string; value: string }[] {
  return rulesIn(own)
    .filter(({ selector: listed }) => listed.split(',').some((each) => selector.test(each)))
    .flatMap(({ body }) => body.split(';'))
    .map((declaration) => declaration.split(':').map((part) => part.trim()))
    .filter(([property]) => property)
    .map(([property = '', value = '']) => ({ property, value }))
    .filter(({ property }) =>
      /^(?:background|color|border|outline|box-shadow|fill|stroke)/.test(property),
    )
}

/**
 * The lines each of `own`'s rules naming `selector` gives it, as [condition, lines]: null outside
 * any block, else the at-rule and its condition. Outside any block first, then the @media blocks,
 * then the @container blocks, each in the sheet's order, which is the order a later rule wins in.
 */
function lineCountsIn(own: string, selector: string): [string | null, string | undefined][] {
  return rulesIn(own)
    .filter(
      ({ selector: listed, body }) =>
        listed.split(',').some((each) => each.trim() === selector) && /--lines\s*:/.test(body),
    )
    .map(({ media, container, body }) => [
      media !== null ? `@media ${media}` : container !== null ? `@container ${container}` : null,
      /--lines\s*:\s*([^;]+)/.exec(body)?.[1]?.trim(),
    ])
}

const clientIdInTheEnv = 'a-client-id-left-in-the-build-env'

beforeAll(async () => {
  webRoot = await mkdtemp(join(tmpdir(), 'web-build-'))
  // The image build always sets an OpenPanel API URL, so the test builds with a dummy one.
  vi.stubEnv('VITE_OPENPANEL_API_URL', 'https://openpanel.invalid')
  // A client ID left in the build's env, which the build must never carry (creator-analytics#575).
  vi.stubEnv('VITE_OPENPANEL_CLIENT_ID', clientIdInTheEnv)
  vi.stubEnv('RELEASE_CONTENT_ROOT', webContentRoot)
  await build({
    root: webDirectory,
    logLevel: 'silent',
    build: { outDir: webRoot, emptyOutDir: true },
  })
  vi.unstubAllEnvs()
})

describe('the web app in the visual system', () => {
  test('every font the stylesheet names answers under /app as a font', async ({ web }) => {
    const { origin } = await startApi(web, { webRoot })
    const fonts = fontUrlsIn(await servedCss(origin))

    expect(fonts.length).toBeGreaterThan(0)
    // A missing file under /app answers 200 with the entry page, so the type is the proof.
    expect(await responsesTo(origin, fonts)).toEqual(
      fonts.map(() => ({
        url: expect.stringMatching(/^\/app\//),
        status: 200,
        type: 'font/woff2',
      })),
    )
  })

  test('every font licence answers at /app/fonts/ with its text', async ({ web }) => {
    const { origin } = await startApi(web, { webRoot })
    const licences = await fontLicenceFiles()

    expect(licences.length).toBeGreaterThan(0)
    for (const { name, text } of licences) {
      const response = await fetch(`${origin}/app/fonts/${name}`)

      // A missing file under /app answers 200 with the entry page, so the text is the proof.
      expect({ name, status: response.status, text: await response.text() }).toEqual({
        name,
        status: 200,
        text,
      })
    }
  })

  test('the stylesheet the web app serves declares every token of the visual system, in both modes', async ({
    web,
  }) => {
    const { origin } = await startApi(web, { webRoot })
    const css = await servedCss(origin)
    const shared = await visualSystemSheet()

    expect(lightTokensIn(shared).length).toBeGreaterThan(0)
    expect(darkTokensIn(shared).length).toBeGreaterThan(0)
    expect(lightTokensIn(css)).toEqual(expect.arrayContaining(lightTokensIn(shared)))
    expect(darkTokensIn(css)).toEqual(expect.arrayContaining(darkTokensIn(shared)))
  })

  test('the stylesheet the web app serves applies the dark tokens under data-theme="dark", and under the system\'s dark mode only without data-theme="light", from two blocks that hold the same declarations, and sets color-scheme for each case (creator-analytics#688)', async ({
    web,
  }) => {
    const { origin } = await startApi(web, { webRoot })
    const css = await servedCss(origin)
    const { light, dark, systemDark } = themeBlocksIn(css)

    expect(darkTokensIn(css).length).toBeGreaterThan(0)
    expect(rulesDeclaringIn(css, darkTokensIn(css))).toEqual([
      { selector: ':root', media: null },
      { selector: ':root[data-theme=dark]', media: null },
      { selector: ':root:not([data-theme=light])', media: '(prefers-color-scheme:dark)' },
      // The sponsor report's print block, which puts the light values back (creator-analytics#956).
      { selector: printThemeSelector, media: 'print' },
    ])
    expect(light).toEqual({})
    expect(Object.keys(dark).length).toBeGreaterThan(0)
    expect(systemDark).toEqual(dark)
    expect(colourSchemesIn(css)).toEqual({ none: 'light dark', light: 'light', dark: 'dark' })
  })

  test("the stylesheet the web app serves prints light whatever the theme: its print block holds the light value of every dark token and color-scheme light, and hides the shell, the grain, the sponsor report's link back and button (creator-analytics#956), and its figure checklist and a refused save of it (creator-analytics#957)", async ({
    web,
  }) => {
    const { origin } = await startApi(web, { webRoot })
    const css = await servedCss(origin)
    const tokens = darkTokensIn(css)
    const light = lightValuesIn(css, tokens)

    expect(tokens.length).toBeGreaterThan(0)
    expect(Object.values(light)).not.toContain(undefined)
    expect(printThemeBlockIn(css)).toEqual({ 'color-scheme': 'light', ...light })
    for (const selector of [
      '.app-header:not([hidden])',
      '.sidebar',
      '.whats-new-banner',
      '[data-slot=toast-viewport]',
      '.sponsor-report-actions',
      '.sponsor-report-choice',
      '.sponsor-report-choice-failure',
      'body:before',
    ]) {
      expect({ selector, display: valueIn(css, selector, 'display', 'print') }).toEqual({
        selector,
        display: 'none',
      })
    }
    expect(css).toMatch(/@page\s*\{[^{}]*margin/)
  })

  test("a printed page at a phone's width hides the header, the shell's only part there, as the cascade resolves it, so no rule that shows it on screen outranks the print block (creator-analytics#956)", async ({
    web,
  }) => {
    const { origin } = await startApi(web, { webRoot })
    const css = await servedCss(origin)
    // The header as Header.tsx renders it outside a consent screen: shown, not `hidden`.
    const headerDisplayIn = (mediaType: 'screen' | 'print') => {
      const window = new Window({ width: 375, height: 667, settings: { device: { mediaType } } })
      onTestFinished(() => window.happyDOM.close())
      const style = window.document.createElement('style')
      style.textContent = css
      window.document.head.append(style)
      window.document.body.innerHTML = '<div class="app"><header class="app-header"></header></div>'
      const header = window.document.querySelector('header')
      if (!header) throw new Error('no header')
      return window.getComputedStyle(header).display
    }

    expect({ screen: headerDisplayIn('screen'), print: headerDisplayIn('print') }).toEqual({
      screen: 'flex',
      print: 'none',
    })
  })

  test("the stylesheet the web app serves holds Tailwind's theme and utilities, and no Preflight rule (creator-analytics#362)", async ({
    web,
  }) => {
    const { origin } = await startApi(web, { webRoot })
    const css = await servedCss(origin)

    expect(css).toMatch(/@layer theme\s*\{[^{}]*\{[^{}]*--/)
    expect(css).toMatch(/@layer utilities\s*\{[^{}]*\{/)
    expect(preflightRulesIn(css)).toEqual([])
  })

  test("the stylesheet the web app serves writes no colour outside the visual system's tokens, and none of shadcn's default theme values (ADR 0014 rule 3)", async ({
    web,
  }) => {
    const { origin } = await startApi(web, { webRoot })
    const css = await servedCss(origin)
    const shared = await visualSystemSheet()
    const tokens = [...lightTokensIn(shared), ...darkTokensIn(shared)]

    expect(coloursOutsideTokens(css, tokens)).toEqual([])
    expect(shadcnDefaultsIn(css, tokens, shadcnDefaultTheme)).toEqual([])
  })

  // The Card's look is the utilities in components/ui/card.tsx, so its rules are the ones the
  // served sheet emits for those classes. The whole-sheet test above covers them too; this one
  // also holds them to no motion, to a class that emits something, and to the numbers table's box.
  test("the Card writes no colour outside the tokens, none of shadcn's defaults, and no transition or animation, and its box is the numbers table's: a 1px border in the line token, a 0.75rem radius and its padding (ADR 0014 rule 3, creator-analytics#350)", async ({
    web,
  }) => {
    const { origin } = await startApi(web, { webRoot })
    const css = utilityLayersIn(await servedCss(origin))
    const shared = await visualSystemSheet()
    const tokens = [...lightTokensIn(shared), ...darkTokensIn(shared)]
    const own = await webOwnSheet()
    const source = await readFile(new URL('../src/components/ui/card.tsx', import.meta.url), 'utf8')
    const classNames = classNamesIn(source)
    const rules = classNames.map((className) => utilityRulesOf(css, className)).join('')
    const declared = new Map(
      [...rules.matchAll(/(?<=[{;])([-\w]+):([^;{}]*)/g)].map(([, property = '', value = '']) => [
        property,
        value.trim(),
      ]),
    )

    expect(classNames.length).toBeGreaterThan(0)
    // A class that emits nothing, such as shadcn's `bg-card` with no --color-card in the theme, is
    // a default that would come back the day the theme names it.
    expect(classNames.filter((className) => utilityRulesOf(css, className) === '')).toEqual([])
    expect(coloursOutsideTokens(rules, tokens)).toEqual([])
    expect(shadcnDefaultsIn(rules, tokens, shadcnDefaultTheme)).toEqual([])
    expect(
      [...declared.keys()].filter((property) => /^(?:transition|animation)/.test(property)),
    ).toEqual([])
    expect(
      [...declared.keys()].filter((property) =>
        /^(?:background|box-shadow|--tw-ring)/.test(property),
      ),
    ).toEqual([])
    expect(valueIn(own, '.numbers-table', 'border')).toBe('1px solid var(--line)')
    expect(valueIn(own, '.numbers-table', 'border-radius')).toBe('0.75rem')
    expect({
      width: declared.get('border-width'),
      colour: declared.get('border-color'),
      radius: Number.parseFloat(declared.get('border-radius') ?? ''),
      radiusUnit: declared.get('border-radius')?.replace(/^[\d.]+/, ''),
      padding: declared.get('padding'),
    }).toEqual({
      width: '1px',
      colour: 'var(--line)',
      radius: 0.75,
      radiusUnit: 'rem',
      padding: '1rem 1.25rem',
    })
  })

  // The Sidebar's, the tooltip's, the Select's, the Popover's, the Dropdown Menu's and the Calendar's look is the
  // utilities in their files under components/ui, so their rules are the ones the served sheet emits for those
  // classes, each variant's included. The sidebar's columns and its collapsed state, and the
  // Select's trigger row in the sidebar, are app.css's, which the layout tests below read, and
  // which the own sheet's tests hold to no colour and no animation.
  test.for([
    'sidebar.tsx',
    'tooltip.tsx',
    'select.tsx',
    'popover.tsx',
    'dropdown-menu.tsx',
    'calendar.tsx',
  ])(
    "%s writes no colour outside the tokens, none of shadcn's defaults, and no transition or animation, and each of its classes emits a rule (ADR 0014 rule 3, creator-analytics#417, #531, #590, #690)",
    async (file, { web }) => {
      const { origin } = await startApi(web, { webRoot })
      const css = utilityLayersIn(await servedCss(origin))
      const shared = await visualSystemSheet()
      const tokens = [...lightTokensIn(shared), ...darkTokensIn(shared)]
      const source = await readFile(
        new URL(`../src/components/ui/${file}`, import.meta.url),
        'utf8',
      )
      const classNames = classNamesIn(source)
      const rules = classNames.map((className) => utilityRulesOf(css, className)).join('')
      const properties = [...rules.matchAll(/(?<=[{;])([-\w]+):/g)].map(([, property]) => property)

      expect(classNames.length).toBeGreaterThan(0)
      // A class that emits nothing, such as shadcn's `bg-sidebar` with no --color-sidebar in the
      // theme, is a default that would come back the day the theme names it.
      expect(classNames.filter((className) => utilityRulesOf(css, className) === '')).toEqual([])
      expect(coloursOutsideTokens(rules, tokens)).toEqual([])
      expect(shadcnDefaultsIn(rules, tokens, shadcnDefaultTheme)).toEqual([])
      expect(
        properties.filter((property) => /^(?:transition|animation)/.test(property ?? '')),
      ).toEqual([])
    },
  )

  // shadcn's separator carries a margin (`-mx-1 my-1`), which the theme check above cannot see, as
  // it is a spacing utility and not a theme value. The account menu's groups are spaced by the
  // popup's gap alone.
  test("the Dropdown Menu's separator writes no margin, none of shadcn's (ADR 0014 rule 3, creator-analytics#590)", async ({
    web,
  }) => {
    const { origin } = await startApi(web, { webRoot })
    const css = utilityLayersIn(await servedCss(origin))
    const source = await readFile(
      new URL('../src/components/ui/dropdown-menu.tsx', import.meta.url),
      'utf8',
    )
    const separator = source.slice(
      source.indexOf('function DropdownMenuSeparator'),
      source.indexOf('export {'),
    )
    const classNames = classNamesIn(separator)
    const rules = classNames.map((className) => utilityRulesOf(css, className)).join('')
    const properties = [...rules.matchAll(/(?<=[{;])([-\w]+):/g)].map(([, property]) => property)

    expect(classNames).toContain('h-px')
    expect(properties.filter((property) => /^margin/.test(property ?? ''))).toEqual([])
  })

  testWithoutDatabase(
    "the web app's own sheet writes no colour: every colour comes from a visual system token",
    async () => {
      const css = await webOwnSheet()

      expect(declarationsIn(css).length).toBeGreaterThan(0)
      expect(coloursIn(css).map(({ written }) => written)).toEqual([])
    },
  )

  testWithoutDatabase(
    'the playhead on the retention plots paints in a visual system token, takes no pointer, and has no transition or animation (creator-analytics#647)',
    async () => {
      const playhead = rulesIn(await webOwnSheet()).filter(({ selector }) =>
        selector.split(',').some((listed) => /\.retention-playhead\b/.test(listed)),
      )
      const declared = playhead
        .flatMap(({ body }) => body.split(';'))
        .map((declaration) => declaration.split(':').map((part) => part.trim()))
        .filter(([property]) => property)
        .map(([property = '', value = '']) => ({ property, value }))
      const painted = declared.filter(({ property }) =>
        /^(?:background|color|border|outline|box-shadow|fill|stroke)/.test(property),
      )
      const tokens = lightTokensIn(await visualSystemSheet())

      expect(painted.length).toBeGreaterThan(0)
      for (const { property, value } of painted) {
        const token = /^var\((--[\w-]+)\)$/.exec(value)?.[1]
        expect({ property, value, token: token && tokens.includes(token) }).toEqual({
          property,
          value,
          token: true,
        })
      }
      expect(
        declared
          .map(({ property }) => property)
          .filter((property) => /^(?:transition|animation)/.test(property)),
      ).toEqual([])
      expect(valueIn(await webOwnSheet(), '.retention-playhead', 'pointer-events')).toBe('none')
    },
  )

  testWithoutDatabase(
    "an upload day's line on the plots paints only through its token class's currentColor or a visual system token, takes no pointer, and has no transition or animation (creator-analytics#763)",
    async () => {
      const own = await webOwnSheet()
      const painted = paintedBy(own, /\.upload-day-line\b/)
      const tokens = lightTokensIn(await visualSystemSheet())
      const declared = rulesIn(own)
        .filter(({ selector }) => /\.upload-day-line\b/.test(selector))
        .flatMap(({ body }) => body.split(';'))
        .map((declaration) => declaration.split(':')[0]?.trim() ?? '')

      expect(painted.length).toBeGreaterThan(0)
      for (const { property, value } of painted) {
        const ink =
          /^(?:[\d.]+(?:px|rem)\s+(?:solid|dashed|dotted)\s+)?(?:currentColor|var\((--[\w-]+)\))$/.exec(
            value,
          )
        const inked = ink !== null && (ink[1] === undefined || tokens.includes(ink[1]))
        expect({ property, value, inked }).toEqual({ property, value, inked: true })
      }
      expect(declared.filter((property) => /^(?:transition|animation)/.test(property))).toEqual([])
      expect(valueIn(own, '.upload-day-line', 'pointer-events')).toBe('none')
    },
  )

  testWithoutDatabase(
    "no token the web app's own sheet paints a background with is cream, ivory, beige or sepia, in light or dark mode",
    async () => {
      const own = rulesIn(await webOwnSheet())
        .map(({ body }) => body)
        .join(';')
      const shared = await visualSystemSheet()
      const tokens = new Set(
        [...own.matchAll(/\bbackground(?:-color|-image)?\s*:([^;}]*)/g)].flatMap(([, value = '']) =>
          [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map(([, token = '']) => token),
        ),
      )

      // The placeholders' fill, a token the visual system's own background rule does not reach.
      expect(tokens).toContain('--line')
      for (const token of tokens) {
        const colours = declarationsIn(shared)
          .filter(({ property }) => property === token)
          .flatMap(({ colours }) => colours)
        // One value in the light scheme, the dark value in each of the two dark blocks, and the
        // light value again in the print block (creator-analytics#956).
        expect({ token, values: colours.length }).toEqual({ token, values: 4 })
        for (const { written, oklab } of colours) {
          expect({ token, written, warm: isWarmTinted(oklab) }).toEqual({
            token,
            written,
            warm: false,
          })
        }
      }
    },
  )

  testWithoutDatabase(
    "nothing in the web app's stylesheets animates, and no placeholder rule has a transition (creator-analytics#71)",
    async () => {
      const own = await webOwnSheet()
      const sheets = [own, await visualSystemSheet()]

      for (const css of sheets) {
        const properties = declarationsIn(css).map(({ property }) => property)
        expect(properties.length).toBeGreaterThan(0)
        expect(properties.filter((property) => property.startsWith('animation'))).toEqual([])
        expect(css).not.toMatch(/@(?:-\w+-)?keyframes\b/)
      }
      // The hover transitions elsewhere stay: only a placeholder must hold still.
      const placeholderProperties = rulesIn(own)
        .filter(({ selector }) => /\.placeholder\b/.test(selector))
        .flatMap(({ body }) => declarationsIn(`{${body}}`).map(({ property }) => property))
      expect(placeholderProperties.length).toBeGreaterThan(0)
      expect(placeholderProperties.filter((property) => property.startsWith('transition'))).toEqual(
        [],
      )
    },
  )

  testWithoutDatabase(
    "the app's page links the site's favicon, so its browser tab shows the Stillstats icon (Nick, browser walk, 2026-10-11)",
    async () => {
      const iconLink = /<link rel="icon"[^>]*>/
      const app = await readFile(new URL('../index.html', import.meta.url), 'utf8')
      const site = await readFile(new URL('../../site/partials/head.html', import.meta.url), 'utf8')

      expect(app.match(iconLink)?.[0]).toBe(
        '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
      )
      expect(app.match(iconLink)?.[0]).toBe(site.match(iconLink)?.[0])
    },
  )

  testWithoutDatabase(
    "the signed-in app's wordmark, centered beside the avatar, starts at the site header's top space (creator-analytics#119 W3)",
    async () => {
      const own = await webOwnSheet()
      const site = withoutImports(
        await readFile(new URL('../../site/src/styles.css', import.meta.url), 'utf8'),
      )
      const avatar = valueIn(await visualSystemSheet(), '.avatar', 'height')
      const wordmark = valueIn(own, '.app-header .wordmark', 'font-size')

      // The site's header stretches its wordmark from its top. The app's header centers it beside
      // the taller avatar, half of whose extra height comes off the view's top space.
      expect(valueIn(site, '.site-header', 'align-items')).toBeUndefined()
      expect(valueIn(own, '.app-header:not([hidden])', 'align-items')).toBe('center')
      expect(valueIn(own, '.app-header .wordmark', 'align-self')).toBeUndefined()
      expect(valueIn(own, '.app-signed-in', 'padding-top')).toBe(
        `calc(${valueIn(site, '.site-header', 'padding-block')} - (${avatar} - ${wordmark}) / 2)`,
      )
    },
  )

  testWithoutDatabase(
    "the controls bar is an inset panel, still sticky on the page's background: padding on every side, a rounded line all round in the line token, and no margin into the gutter at any width (creator-analytics#350, which undoes #119 W2); and it reads as one piece once stuck, its box a square fill behind the rounded line, so nothing scrolls into view at its corners (creator-analytics#461)",
    async () => {
      // A stylesheet parse cannot see paint, so this reads the rules, and the browser walk's
      // "stuck date range bar has no gaps at its corners" step is the proof in Chrome (standard 2).
      const own = await webOwnSheet()
      const barRules = rulesIn(own).filter(({ selector }) =>
        selector.split(',').some((listed) => /\.controls-bar$/.test(listed.trim())),
      )

      expect(valueIn(own, '.controls-bar', 'position')).toBe('sticky')
      expect(valueIn(own, '.controls-bar', 'top')).toBe('0')
      expect(valueIn(own, '.controls-bar', 'background')).toBe('var(--bg)')
      // The 1px the border took from the box, so the controls sit where they did inside #350's
      // border.
      expect(valueIn(own, '.controls-bar', 'padding')).toBe('calc(0.75rem + 1px) calc(1rem + 1px)')
      // The bar's own box is square, so its fill covers its corners: a rounded box paints and hit
      // tests nothing outside its curve, and the page showed through there (creator-analytics#461).
      expect(valueIn(own, '.controls-bar', 'border')).toBeUndefined()
      expect(valueIn(own, '.controls-bar', 'border-radius')).toBeUndefined()
      // The rounded line is the bar's ::before, over its fill and under its controls: the bar is
      // sticky with a z-index, so it is the stacking context the -1 paints inside.
      const line = '.controls-bar::before'
      expect(valueIn(own, line, 'content')).toBe('""')
      expect(valueIn(own, line, 'position')).toBe('absolute')
      expect(valueIn(own, line, 'inset')).toBe('0')
      expect(valueIn(own, line, 'z-index')).toBe('-1')
      expect(valueIn(own, line, 'border')).toBe('1px solid var(--line)')
      expect(valueIn(own, line, 'border-radius')).toBe('0.75rem')
      expect(valueIn(own, line, 'pointer-events')).toBe('none')
      // Every rule naming the bar, in every media block, so no later rule takes a side's padding
      // back, rounds or borders the bar's own box again, or runs the bar into the gutter again.
      expect(barRules.length).toBeGreaterThan(0)
      expect(
        barRules.flatMap(({ selector, media, body }) =>
          declarationsIn(`{${body}}`)
            .map(({ property }) => property)
            .filter((property) => /^(?:margin|padding-|border)/.test(property))
            .map((property) => ({ selector, media, property })),
        ),
      ).toEqual([])
    },
  )

  testWithoutDatabase(
    "from the tablet width the sidebar is a column at the window's left edge, outside the scroll at the window's full height, 14rem open and 3rem collapsed, its links one under the other, with the screen to its right, where the controls bar keeps its padding on both sides (creator-analytics#274, #350, #476)",
    async () => {
      const own = await webOwnSheet()
      const tablet = sidebarColumnQuery
      const collapsed = '.sidebar[data-collapsible="icon"]'
      const shown = '.app-signed-in:has(> .signed-in-view:not([hidden]) .sidebar)'
      const shownCollapsed = `.app-signed-in:has(> .signed-in-view:not([hidden]) ${collapsed})`

      expect(valueIn(own, '.sidebar', 'position')).toBeUndefined()

      expect(valueIn(own, '.app-signed-in', '--sidebar-width')).toBe('14rem')
      expect(valueIn(own, '.app-signed-in', '--sidebar-width-icon')).toBe('3rem')
      expect(valueIn(own, '.sidebar ul', 'display', tablet)).toBe('flex')
      expect(valueIn(own, '.sidebar ul', 'flex-direction', tablet)).toBe('column')
      // Fixed to the window, top to bottom, so the window stays the page's scroller and the
      // sidebar stays where it is as the screen scrolls.
      expect(valueIn(own, '.sidebar', 'position', tablet)).toBe('fixed')
      expect(valueIn(own, '.sidebar', 'inset-block', tablet)).toBe('0')
      expect(valueIn(own, '.sidebar', 'inset-inline-start', tablet)).toBe('0')
      expect(valueIn(own, '.sidebar', 'width', tablet)).toBe('var(--sidebar-width)')
      expect(valueIn(own, collapsed, 'width', tablet)).toBe('var(--sidebar-width-icon)')
      // The screen starts right of the sidebar's width, open or collapsed, and keeps the gutter
      // beside it.
      expect(valueIn(own, shown, '--sidebar-offset', tablet)).toBe('var(--sidebar-width)')
      expect(valueIn(own, shownCollapsed, '--sidebar-offset', tablet)).toBe(
        'var(--sidebar-width-icon)',
      )
      expect(valueIn(own, shown, 'padding-inline-start', tablet)).toBe(
        'calc(var(--sidebar-offset) + var(--gutter))',
      )
      // Collapsed, each link and button shows its icon only; its text leaves the view as
      // .visually-hidden takes it, and stays its name.
      const linkText = `${collapsed} [data-slot="sidebar-menu-button"] > span`
      for (const property of ['position', 'width', 'height', 'overflow', 'clip-path']) {
        expect({ property, value: valueIn(own, linkText, property, tablet) }).toEqual({
          property,
          value: valueIn(own, '.visually-hidden', property),
        })
      }
      // The date range bar keeps sticking at the top of the window, which still scrolls.
      expect(valueIn(own, '.controls-bar', 'position')).toBe('sticky')
      expect(
        rulesIn(own).filter(
          ({ selector, media }) => media === tablet && selector.includes('.controls-bar'),
        ),
      ).toEqual([])
    },
  )

  testWithoutDatabase(
    'beside the sidebar, open and collapsed, the screen fills the window to its right with no 76rem cap, up to a 2560px window, and above it the extra width falls to its right (creator-analytics#477)',
    async () => {
      const own = await webOwnSheet()
      const tablet = sidebarColumnQuery
      const shown = '.app-signed-in:has(> .signed-in-view:not([hidden]) .sidebar)'
      const stop = valueIn(own, '.app-signed-in', '--screen-stop') ?? ''

      // 2560px at the 16px root: the whole .app box, sidebar and gutters included, which the
      // visual system sizes border-box.
      expect(stop).toMatch(/^[\d.]+rem$/)
      expect(Number.parseFloat(stop) * 16).toBe(2560)
      expect(valueIn(await visualSystemSheet(), '*', 'box-sizing')).toBe('border-box')
      expect(valueIn(own, shown, 'max-width', tablet)).toBe('var(--screen-stop)')
      expect(valueIn(own, shown, 'margin-inline-start', tablet)).toBe('0')
      // No rule beside the sidebar, open or collapsed, takes the site's measure or the 76rem cap
      // back.
      const besideSidebar = rulesIn(own).filter(
        ({ selector, media }) => media === tablet && selector.includes('.app-signed-in'),
      )
      expect(besideSidebar.length).toBeGreaterThan(0)
      expect(besideSidebar.filter(({ body }) => /--measure\b|\b76rem\b/.test(body))).toEqual([])
    },
  )

  testWithoutDatabase(
    'beside the sidebar, open and collapsed, the toast centres in the screen to its right, past a 2560px window too, and below the tablet width it centres in the window as before (creator-analytics#508)',
    async () => {
      // Each run of whitespace as one space, as the formatter wraps the collapsed rule's long
      // selector over two lines.
      const own = (await webOwnSheet()).replace(/\s+/g, ' ')
      const tablet = sidebarColumnQuery
      const viewportSlot = '[data-slot="toast-viewport"]'
      const besideShown = `body:has(.app-signed-in > .signed-in-view:not([hidden]) .sidebar) ${viewportSlot}`
      const besideCollapsed = `body:has(.app-signed-in > .signed-in-view:not([hidden]) .sidebar[data-collapsible="icon"]) ${viewportSlot}`

      // Base UI portals the viewport to the body, outside .app, so the sidebar's widths and the
      // screen stop reach it from the rule that declares them for the screen.
      for (const property of ['--sidebar-width', '--sidebar-width-icon', '--screen-stop']) {
        expect({ property, value: valueIn(own, viewportSlot, property) }).toEqual({
          property,
          value: valueIn(own, '.app-signed-in', property),
        })
      }
      // The screen's content box: from the sidebar's width and the gutter at the left, to the
      // gutter inside the window or inside the screen stop, whichever is nearer, at the right.
      expect(valueIn(own, besideShown, 'inset-inline-start', tablet)).toBe(
        'calc(var(--sidebar-width) + var(--gutter))',
      )
      expect(valueIn(own, besideCollapsed, 'inset-inline-start', tablet)).toBe(
        'calc(var(--sidebar-width-icon) + var(--gutter))',
      )
      expect(valueIn(own, besideShown, 'inset-inline-end', tablet)).toBe(
        'max(var(--gutter), 100% - var(--screen-stop) + var(--gutter))',
      )
      // Below the tablet width, and behind a consent screen, the toast keeps its own classes:
      // fixed, the gutter at both sides, and centred by its auto margins at its own width. No
      // rule there places it; the one that names it only hands it the custom properties. A
      // printed page hides it (creator-analytics issue 956), which places nothing.
      expect(
        rulesIn(own)
          .filter(
            ({ selector, media }) =>
              media !== tablet && media !== 'print' && selector.includes('toast-viewport'),
          )
          .flatMap(({ body }) => declarationsIn(`{${body}}`).map(({ property }) => property))
          .filter((property) => !property.startsWith('--')),
      ).toEqual([])
      const toastClasses = classNamesIn(
        await readFile(new URL('../src/components/ui/toast.tsx', import.meta.url), 'utf8'),
      )
      for (const className of ['fixed', 'inset-x-(--gutter)', 'mx-auto', 'w-fit']) {
        expect(toastClasses).toContain(className)
      }
    },
  )

  testWithoutDatabase(
    'the sheet\'s rules for the sidebar\'s column are written for the width the sidebar renders its column from, and the height its rows need, 38rem with the five items of the list, two channels, "Send feedback" and the support item (creator-analytics#476, #531, #577, #582, #590, #799, #890, #951)',
    async () => {
      const own = await webOwnSheet()
      // A printed page hides the sidebar at any width (creator-analytics issue 956).
      const columnMedia = rulesIn(own)
        .filter(
          ({ selector, media }) =>
            media !== null && media !== 'print' && selector.includes('.sidebar'),
        )
        .map(({ media }) => media)

      expect(columnMedia.length).toBeGreaterThan(0)
      expect(new Set(columnMedia)).toEqual(new Set([sidebarColumnQuery]))
      // The browser walk measured 565.2px for the column's rows at 1280px with "Thumbnail
      // preview" among the footer's items, 1rem apart; in the list, 0.25rem apart, it takes less.
      // The "Retention" link takes them to 597.2px (creator-analytics#951). The walk holds the
      // collapse button inside the window at 608px, 38rem.
      expect(/\(min-height:\s*([\d.]+rem)\)/.exec(sidebarColumnQuery)?.[1]).toBe('38rem')
    },
  )

  testWithoutDatabase(
    "below the column the header's Menu button sits at the row's end with the header's other items, and its panel lies over the page under the header at its width, opaque, framed in the line token, above the screen, its current item filled in the accent token as the column's is (creator-analytics#891)",
    async () => {
      const own = await webOwnSheet()
      const panel = '.header-menu-panel:not([hidden])'

      expect(valueIn(own, '.app-header:not([hidden])', 'align-items')).toBe('center')
      expect(valueIn(own, '.header-menu-button', 'margin-inline-start')).toBe('auto')
      // The panel's place is the header's box, so the page under it keeps its place as it opens.
      expect(valueIn(own, '.app-header', 'position')).toBe('relative')
      expect({
        position: valueIn(own, panel, 'position'),
        insetInline: valueIn(own, panel, 'inset-inline'),
        top: valueIn(own, panel, 'top'),
        background: valueIn(own, panel, 'background'),
        border: valueIn(own, panel, 'border'),
      }).toEqual({
        position: 'absolute',
        insetInline: '0',
        top: '100%',
        background: 'var(--bg)',
        border: '1px solid var(--line)',
      })
      // Above the sticky controls bar, which shares the page's stacking context, and below the
      // toast's 3 (components/ui/toast.tsx), which shows over everything.
      expect(Number(valueIn(own, panel, 'z-index'))).toBeGreaterThan(
        Number(valueIn(own, '.controls-bar', 'z-index')),
      )
      expect(Number(valueIn(own, panel, 'z-index'))).toBeLessThan(3)
      expect(valueIn(own, '.header-menu-panel a[aria-current="page"]', 'background')).toBe(
        'var(--accent)',
      )
      expect(valueIn(own, '.header-menu-panel a[aria-current="page"]', 'color')).toBe(
        'var(--on-accent)',
      )
      expect(valueIn(own, '.header-menu-panel hr', 'border-top')).toBe('1px solid var(--line)')
    },
  )

  testWithoutDatabase(
    'the "Thumbnail preview" item\'s external link icon is 14px and dimmed in the soft ink, its text keeps one line in the open column, and the collapsed column hides the icon so the image icon shows alone (creator-analytics#890)',
    async () => {
      const own = await webOwnSheet()
      const tablet = sidebarColumnQuery
      const icon = '.sidebar-external-icon'

      // 0.875rem is 14px at the 16px root. The sheet is unlayered, so its rule outranks the
      // button's `[&_svg]:size-4` in the utilities layer.
      expect(valueIn(own, icon, 'width')).toBe('0.875rem')
      expect(valueIn(own, icon, 'height')).toBe('0.875rem')
      expect(valueIn(own, icon, 'color')).toBe('var(--ink-soft)')
      expect(valueIn(own, '.sidebar-tool > span', 'white-space', tablet)).toBe('nowrap')
      expect(valueIn(own, `.sidebar[data-collapsible="icon"] ${icon}`, 'display', tablet)).toBe(
        'none',
      )
    },
  )

  testWithoutDatabase(
    "from the tablet width the sidebar's current item has a filled background in an accent token, open and collapsed, and its text is bold and underlined open (creator-analytics#476)",
    async () => {
      const own = await webOwnSheet()
      const tablet = sidebarColumnQuery
      const current = '.sidebar a[aria-current="page"]'

      expect(valueIn(own, current, 'background', tablet)).toBe('var(--accent)')
      expect(valueIn(own, current, 'color', tablet)).toBe('var(--on-accent)')
      expect(valueIn(own, current, 'font-weight')).toBe('600')
      expect(valueIn(own, current, 'text-decoration')).toBe('underline')
      // On the fill, the underline takes the text's colour, as an accent line would not show.
      expect(valueIn(own, current, 'text-decoration-color', tablet)).toBe('var(--on-accent)')
      // No rule of the collapsed column takes the fill away.
      expect(
        rulesIn(own)
          .filter(({ selector }) => selector.includes('[data-collapsible="icon"]'))
          .flatMap(({ body }) => declarationsIn(`{${body}}`).map(({ property }) => property))
          .filter((property) => property.startsWith('background')),
      ).toEqual([])
    },
  )

  testWithoutDatabase(
    "the support item's and the Upgrade item's hide button sits on the link's row: Hide beside it in the header's Menu panel, and from the tablet width the x at the row's end, the link taking the rest (creator-analytics#417, #476, #891, #907)",
    async () => {
      const own = await webOwnSheet()
      const tablet = sidebarColumnQuery

      const panel = '.header-menu-panel .sidebar-prompt'

      expect(valueIn(own, '.sidebar-prompt', 'display')).toBe('flex')
      expect(valueIn(own, '.sidebar-prompt', 'align-items')).toBe('baseline')
      // In the panel the link takes the row and Hide sits at its end, on its centre line.
      expect(valueIn(own, panel, 'align-items')).toBe('center')
      expect(valueIn(own, `${panel} > a`, 'flex')).toBe('1')
      expect(valueIn(own, '.sidebar-prompt', 'flex-wrap', tablet)).toBe('nowrap')
      expect(valueIn(own, '.sidebar-prompt > a', 'flex', tablet)).toBe('1')
      expect(valueIn(own, '.sidebar-prompt > a', 'min-width', tablet)).toBe('0')
      // No rule at any width, the panel's included, lays the row out other than as a row: every
      // rule whose selector, in any list entry, ends on the item itself (review pass 1 finding 2).
      expect(
        rulesIn(own)
          .filter(({ selector }) =>
            selector.split(',').some((listed) => listed.trim().endsWith('.sidebar-prompt')),
          )
          .flatMap(({ body }) => body.split(';'))
          .map((declaration) => {
            const [property = '', value = ''] = declaration.split(':').map((part) => part.trim())
            return { property, value }
          })
          .filter(
            ({ property, value }) =>
              (property === 'flex-direction' && value.includes('column')) ||
              (property === 'display' && value !== 'flex') ||
              (property === 'align-items' && !['baseline', 'center'].includes(value)),
          ),
      ).toEqual([])
    },
  )

  testWithoutDatabase(
    "the account row's two lines match the picker's: Settings at the handle's size and ink, the email at the name's size, each on one line under an ellipsis (creator-analytics#476, #590)",
    async () => {
      const own = await webOwnSheet()
      const tablet = sidebarColumnQuery
      const lookOf = (selector: string) => ({
        display: valueIn(own, selector, 'display', tablet),
        flex: valueIn(own, selector, 'flex', tablet),
        minWidth: valueIn(own, selector, 'min-width', tablet),
      })

      expect(lookOf('.account-lines')).toEqual(lookOf('.picker-lines'))
      // An email too long for the open row is cut by its ellipsis only while the lines can shrink
      // below the email's width and the avatar cannot, so the chevron stays inside the row.
      expect({
        linesMinWidth: valueIn(own, '.account-lines', 'min-width', tablet),
        avatarShrink: valueIn(own, '.sidebar-account .avatar', 'flex-shrink', tablet),
      }).toEqual({ linesMinWidth: '0', avatarShrink: '0' })
      expect({
        heading: valueIn(own, '.account-heading', 'font-size', tablet),
        headingInk: valueIn(own, '.account-heading', 'color', tablet),
        email: valueIn(own, '.sidebar-email', 'font-size', tablet),
      }).toEqual({
        heading: valueIn(own, '.picker-handle', 'font-size', tablet),
        headingInk: valueIn(own, '.picker-handle', 'color', tablet),
        email: valueIn(own, '.picker-name', 'font-size', tablet),
      })
      for (const line of ['.account-heading', '.sidebar-email']) {
        expect({
          line,
          overflow: valueIn(own, line, 'overflow', tablet),
          textOverflow: valueIn(own, line, 'text-overflow', tablet),
          whiteSpace: valueIn(own, line, 'white-space', tablet),
          minWidth: valueIn(own, line, 'min-width', tablet),
        }).toEqual({
          line,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: '0',
        })
      }
    },
  )

  testWithoutDatabase(
    "the account row's chevron is 1rem square at the row's end, and the menu header's avatar sits before the email and holds still (creator-analytics#590)",
    async () => {
      const own = await webOwnSheet()
      const shared = await visualSystemSheet()
      const tablet = sidebarColumnQuery
      const chevron = '.account-chevron'
      const header = '.account-menu-header'

      expect({
        width: valueIn(own, chevron, 'width', tablet),
        height: valueIn(own, chevron, 'height', tablet),
        shrink: valueIn(own, chevron, 'flex-shrink', tablet),
        start: valueIn(own, chevron, 'margin-inline-start', tablet),
      }).toEqual({ width: '1rem', height: '1rem', shrink: '0', start: 'auto' })
      expect({
        display: valueIn(own, header, 'display'),
        alignItems: valueIn(own, header, 'align-items'),
        gap: valueIn(own, header, 'gap'),
        cursor: valueIn(own, `${header} .avatar`, 'cursor'),
        hover: valueIn(own, `${header} .avatar:hover`, 'background'),
      }).toEqual({
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        cursor: 'default',
        hover: valueIn(shared, '.avatar', 'background'),
      })
    },
  )

  testWithoutDatabase(
    "the sidebar's footer rows sit 1rem apart, and the channel picker and the account row are full-width rows with 0.5rem inside, the links' radius, and no transition or animation; collapsed, the account row is the avatar alone (creator-analytics#531)",
    async () => {
      const own = await webOwnSheet()
      const tablet = sidebarColumnQuery
      const collapsedRow = '.sidebar[data-collapsible="icon"] .sidebar-account'

      expect(valueIn(own, '.sidebar [data-slot="sidebar-footer"]', 'gap', tablet)).toBe('1rem')
      for (const row of ['.sidebar-picker', '.sidebar-account']) {
        expect({
          row,
          width: valueIn(own, row, 'width', tablet),
          padding: valueIn(own, row, 'padding', tablet),
          radius: valueIn(own, row, 'border-radius', tablet),
        }).toEqual({
          row,
          width: '100%',
          padding: '0.5rem',
          radius: valueIn(
            own,
            '.sidebar [data-slot="sidebar-menu-button"]',
            'border-radius',
            tablet,
          ),
        })
      }
      // The 2.5rem avatar fills the 3rem column inside its 0.25rem inline padding.
      expect(valueIn(own, collapsedRow, 'padding', tablet)).toBe('0')
      // `transition: none` declares no transition: it holds the visual system's avatar still in
      // the row and the menu's header (creator-analytics#534).
      expect(
        rulesIn(own)
          .filter(({ selector }) =>
            /\.sidebar-picker|\.sidebar-account|\.picker-|\.account-/.test(selector),
          )
          .flatMap(({ body }) => body.split(';'))
          .map((declaration) => declaration.split(':').map((part) => part.trim()))
          .filter(
            ([property = '', value]) =>
              /^(?:transition|animation)/.test(property) &&
              !(property === 'transition' && value === 'none'),
          ),
      ).toEqual([])
      expect({
        row: valueIn(own, '.sidebar-account .avatar', 'transition', tablet),
        header: valueIn(own, '.account-menu-header .avatar', 'transition'),
      }).toEqual({ row: 'none', header: 'none' })
    },
  )

  testWithoutDatabase(
    "while the session is read, the sidebar's places are its rows': each link's and the toggle's as tall as a menu button with its radius, 0.25rem apart as the links are, and the account row's with its padding, its gap and its two lines' height, so the avatar's place is where the avatar lands; none animates (creator-analytics#507, #590)",
    async () => {
      const own = await webOwnSheet()
      const tablet = sidebarColumnQuery
      const button = '.sidebar [data-slot="sidebar-menu-button"]'
      const row = '.placeholder-sidebar-row'
      const account = '.sidebar-account-place'

      expect(valueIn(own, button, 'min-height', tablet)).toBe('2.5rem')
      expect({
        height: valueIn(own, row, 'height', tablet),
        radius: valueIn(own, row, 'border-radius', tablet),
        apart: valueIn(own, `${row} + ${row}`, 'margin-top', tablet),
      }).toEqual({
        height: valueIn(own, button, 'min-height', tablet),
        radius: valueIn(own, button, 'border-radius', tablet),
        apart: valueIn(own, '.sidebar ul', 'gap', tablet),
      })
      expect({
        display: valueIn(own, account, 'display', tablet),
        alignItems: valueIn(own, account, 'align-items', tablet),
        padding: valueIn(own, account, 'padding', tablet),
        gap: valueIn(own, account, 'gap', tablet),
      }).toEqual({
        display: 'flex',
        alignItems: 'center',
        padding: valueIn(own, '.sidebar-account', 'padding', tablet),
        gap: valueIn(own, '.sidebar-account', 'gap', tablet),
      })
      // The row's two lines are taller than its avatar, so the place's line is as tall as both
      // line boxes, each its size at the page's line height (creator-analytics#590).
      const lineHeight = /\/\s*([\d.]+)/.exec(
        valueIn(await visualSystemSheet(), 'body', 'font') ?? '',
      )
      expect(valueIn(own, `${account} .placeholder-line`, 'height', tablet)).toBe(
        `calc((${valueIn(own, '.account-heading', 'font-size', tablet)} + ${valueIn(own, '.sidebar-email', 'font-size', tablet)}) * ${lineHeight?.[1]})`,
      )
      expect(
        rulesIn(own)
          .filter(({ selector }) => selector.includes(row) || selector.includes(account))
          .flatMap(({ body }) => declarationsIn(`{${body}}`).map(({ property }) => property))
          .filter((property) => /^(?:transition|animation)/.test(property)),
      ).toEqual([])
    },
  )

  testWithoutDatabase(
    "the channel picker's handle line is smaller than its name line, at the footer's size, and each is cut short with an ellipsis on one line (creator-analytics#531)",
    async () => {
      const own = await webOwnSheet()
      const tablet = sidebarColumnQuery

      expect(valueIn(own, '.picker-handle', 'font-size', tablet)).toBe('0.75rem')
      expect(valueIn(own, '.picker-name', 'font-size', tablet)).toBe(
        valueIn(own, '.sidebar [data-slot="sidebar-footer"]', 'font-size', tablet),
      )
      for (const line of ['.picker-handle', '.picker-name']) {
        expect({
          line,
          overflow: valueIn(own, line, 'overflow', tablet),
          textOverflow: valueIn(own, line, 'text-overflow', tablet),
          whiteSpace: valueIn(own, line, 'white-space', tablet),
          minWidth: valueIn(own, line, 'min-width', tablet),
        }).toEqual({
          line,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: '0',
        })
      }
    },
  )

  testWithoutDatabase(
    "the sidebar's wordmark and the screen beside it start at the site header's top space (creator-analytics#119 W3, #476)",
    async () => {
      const own = await webOwnSheet()
      const site = withoutImports(
        await readFile(new URL('../../site/src/styles.css', import.meta.url), 'utf8'),
      )
      const top = valueIn(site, '.site-header', 'padding-block')
      const shown = '.app-signed-in:has(> .signed-in-view:not([hidden]) .sidebar)'

      expect(top).toBe('1.75rem')
      expect(
        valueIn(own, '.sidebar [data-slot="sidebar-header"]', 'padding-top', sidebarColumnQuery),
      ).toBe(top)
      expect(valueIn(own, '.sidebar', 'padding-block', sidebarColumnQuery)).toBe('0')
      expect(valueIn(own, shown, 'padding-top', sidebarColumnQuery)).toBe(top)
    },
  )

  testWithoutDatabase(
    "the collapsed sidebar's Stillstats mark is filled in the accent token, whose light and dark values are the favicon's two fills (creator-analytics#476)",
    async () => {
      const favicon = await readFile(
        new URL('../../site/public/favicon.svg', import.meta.url),
        'utf8',
      )
      const shared = await visualSystemSheet()

      expect(valueIn(await webOwnSheet(), '.stillstats-mark', 'fill', sidebarColumnQuery)).toBe(
        'var(--accent)',
      )
      // The favicon's light and dark fills, which the token holds in the two schemes.
      const fills = [...favicon.matchAll(/fill:\s*([^;]+);/g)].map(([, fill = '']) => fill.trim())
      expect(fills).toEqual([
        valueIn(shared, ':root', '--accent'),
        themeBlocksIn(shared).dark['--accent'],
      ])
    },
  )

  testWithoutDatabase(
    "a card's number takes a share of the card's width, from 1.125rem up to 1.75rem (creator-analytics#119 W24)",
    async () => {
      const own = await webOwnSheet()

      expect(valueIn(own, '.card', 'container-type')).toBe('inline-size')
      expect(valueIn(own, '.card .card-number', 'font-size')).toMatch(
        /^clamp\(1\.125rem, calc\(100cqi \/ .+\), 1\.75rem\)$/,
      )
    },
  )

  testWithoutDatabase(
    "a video's traffic sources and subscriber split share rows, each column at least 18rem or the whole width when narrower (creator-analytics#158)",
    async () => {
      const own = await webOwnSheet()

      expect(valueIn(own, '.video-detail-breakdowns', 'display')).toBe('grid')
      expect(valueIn(own, '.video-detail-breakdowns', 'grid-template-columns')).toBe(
        'repeat(auto-fit, minmax(min(100%, 18rem), 1fr))',
      )
      // Stacked, the sections keep the video page's gap; side by side, the columns take twice it
      // (Nick's browser walk, 2026-10-13).
      expect(valueIn(own, '.video-detail-breakdowns', 'row-gap')).toBe(
        valueIn(own, '.video-detail', 'gap'),
      )
      expect(valueIn(own, '.video-detail-breakdowns', 'column-gap')).toBe('3rem')
    },
  )

  testWithoutDatabase(
    "the web app runs wider than the site's measure, so three breakdowns columns have room (Nick's browser walk, 2026-10-13)",
    async () => {
      expect(valueIn(await visualSystemSheet(), ':root', '--measure')).toBe('68rem')
      expect(valueIn(await webOwnSheet(), '.app', '--measure')).toBe('76rem')
    },
  )

  // The Audience cards get more columns from the packing's 18rem column count (audience-columns.ts,
  // creator-analytics#711), which the browser walk holds, and the breakdowns from their auto-fit
  // tracks, which the breakdowns' test holds.
  testWithoutDatabase(
    'the charts, the numbers table and the video list fill the screen at every width, and the stacked charts stay one above the other (creator-analytics#477)',
    async () => {
      const own = await webOwnSheet()
      const filling = [
        '.metric-charts',
        '.metric-chart',
        '.chart',
        '.numbers-table',
        '.video-list',
        '.video-list-scroll',
      ]
      const lastCompoundOf = (selector: string) =>
        selector
          .trim()
          .split(/\s+|\s*[>+~]\s*/)
          .at(-1)
      const capped = rulesIn(own).flatMap(({ selector, media, container, body }) =>
        selector
          .split(',')
          .filter((listed) => filling.includes(lastCompoundOf(listed) ?? ''))
          .flatMap((listed) =>
            declarationsIn(`{${body}}`)
              .map(({ property }) => property)
              .filter((property) => /^(?:max-width|max-inline-size)$/.test(property))
              .map((property) => ({ selector: listed.trim(), media, container, property })),
          ),
      )

      expect(capped).toEqual([])
      expect(
        rulesIn(own).filter(
          ({ selector, body }) =>
            selector.split(',').some((listed) => listed.includes('.metric-charts')) &&
            /grid-template-columns\s*:/.test(body),
        ),
      ).toEqual([])
    },
  )

  testWithoutDatabase(
    "the notes, the paragraphs and Settings keep the site's 44rem reading width on a wide screen, and wrap at the screen on a narrower one (creator-analytics#477)",
    async () => {
      const own = await webOwnSheet()
      const capped = 'min(100%, var(--reading-width))'

      expect(valueIn(own, '.app', '--reading-width')).toBe('44rem')
      expect(valueIn(own, '.note', 'max-width')).toBe(capped)
      expect(valueIn(own, '.app p', 'max-width')).toBe(capped)
      expect(valueIn(own, '.settings', 'max-width')).toBe(capped)
    },
  )

  testWithoutDatabase(
    "a video's length sits at its thumbnail's bottom right, inside the thumbnail's box (creator-analytics#119 W19)",
    async () => {
      const own = await webOwnSheet()

      expect(valueIn(own, '.thumbnail-frame', 'position')).toBe('relative')
      expect(valueIn(own, '.thumbnail-length', 'position')).toBe('absolute')
      expect(valueIn(own, '.thumbnail-length', 'bottom')).toBe('0.25rem')
      expect(valueIn(own, '.thumbnail-length', 'inset-inline-end')).toBe('0.25rem')
    },
  )

  testWithoutDatabase(
    "the Settings screen's channel name keeps the place and weight the channel id had, in the body's face as a name (creator-analytics#119 W12)",
    async () => {
      const own = await webOwnSheet()

      expect(valueIn(own, '.channel-name', 'font')).toBe('500 1rem / 1.4 var(--font-body)')
    },
  )

  testWithoutDatabase(
    "the video detail head's thumbnail placeholder is the thumbnail's width and takes no share of the head's row (creator-analytics#71)",
    async () => {
      const own = await webOwnSheet()

      expect(valueIn(own, '.video-detail-head .placeholder-thumbnail', 'width')).toBe(
        valueIn(own, '.video-detail-thumbnail', 'width'),
      )
      // A div in the head, it also matches `.video-detail-head > div`, the text column's rule,
      // whose flex share outranks `.placeholder-thumbnail` and stretches it past that width.
      expect(
        Number.parseFloat(valueIn(own, '.video-detail-head > div', 'flex') ?? ''),
      ).toBeGreaterThan(0)
      expect(valueIn(own, '.video-detail-head .placeholder-thumbnail', 'flex')).toBe('none')
    },
  )

  testWithoutDatabase(
    "a list row's number placeholder is one line of the table's text (creator-analytics#71)",
    async () => {
      const own = await webOwnSheet()
      const { lineHeight } = bodyTextIn(await visualSystemSheet())

      expect(valueIn(own, '.placeholder-text', 'height')).toBe(
        `calc(${valueIn(own, '.video-list table', 'font-size')} * ${lineHeight})`,
      )
    },
  )

  testWithoutDatabase(
    "a bar row's placeholder is a name's line at the bars' text size and the body's line height, the bars' row gap and a bar's height, so a bars section holds still when its answer lands (creator-analytics#450)",
    async () => {
      const own = await webOwnSheet()
      const { lineHeight } = bodyTextIn(await visualSystemSheet())

      // A landed bar row's name takes the body's line height, since its rule sets none.
      expect(valueIn(own, '.bars li', 'line-height')).toBeUndefined()
      expect(valueIn(own, '.placeholder-bar-row .placeholder-line', 'height')).toBe(
        `calc(${valueIn(own, '.bars li', 'font-size')} * ${lineHeight})`,
      )
      // The row gap, the first value of the bar row's gap, between the name and its bar.
      const [rowGap] = valueIn(own, '.bars li', 'gap')?.split(/\s+/) ?? []
      expect(valueIn(own, '.placeholder-bar-row', 'gap')).toBe(rowGap)
      expect(valueIn(own, '.placeholder-bar', 'height')).toBe(valueIn(own, '.bar-track', 'height'))
      // The places sit in the section's grid and the landed rows in the list's, so the space
      // between rows holds only while the two gaps stay equal.
      expect(valueIn(own, '.bars', 'gap')).toBe(valueIn(own, '.video-detail-section', 'gap'))
    },
  )

  testWithoutDatabase(
    "a section heading's place is one line of the section's h2, its font size at the visual system's h2 line height, so a section holds still when its answer lands (creator-analytics#468)",
    async () => {
      const own = await webOwnSheet()
      const shared = await visualSystemSheet()
      const heading = '.video-detail-section h2'

      // A landed section heading takes the visual system's h2 line height, since its rule sets
      // none. This reads the rules as written; `pnpm test:browser` lays the two out in Chrome.
      expect(valueIn(own, heading, 'line-height')).toBeUndefined()
      expect(valueIn(own, '.placeholder-heading', 'height')).toBe(
        `calc(${valueIn(own, heading, 'font-size')} * ${valueIn(shared, 'h2', 'line-height')})`,
      )
    },
  )

  testWithoutDatabase(
    'a bar name keeps to one line, cut short with an ellipsis, so every bar row is as tall as its place at every width (creator-analytics#469, #511)',
    async () => {
      const own = await webOwnSheet()
      const row = '.bars li'
      const name = '.bars-name'

      // The name's column may be narrower than the name, or a grid item's automatic minimum
      // width keeps it at the name's width and the ellipsis never shows. Every bar list's rows,
      // not the publish day top's alone: a long country, state, city or traffic source name
      // wraps in a narrow Audience card or at 320px (the browser walk's "bar names" step).
      expect(valueIn(own, row, 'grid-template-columns')).toBe('minmax(0, 1fr) auto')
      expect(valueIn(own, name, 'overflow')).toBe('hidden')
      expect(valueIn(own, name, 'text-overflow')).toBe('ellipsis')
      expect(valueIn(own, name, 'white-space')).toBe('nowrap')
      // The line stays the body's, which the bar row's place is measured by (creator-analytics#450).
      expect(valueIn(own, row, 'line-height')).toBeUndefined()
      expect(valueIn(own, name, 'line-height')).toBeUndefined()
    },
  )

  testWithoutDatabase(
    "the video detail head's text placeholder holds the link's line and the lines half of sixteen typical titles fit in, in the head's text column at every width, stacked under the thumbnail or beside it (creator-analytics#71, #119 W30, #150, #326, #477)",
    async () => {
      const own = await webOwnSheet()
      const shared = await visualSystemSheet()
      const { size, lineHeight } = bodyTextIn(shared)
      const title = '.video-detail-head .placeholder-heading'

      // The title keeps the size it had as the app's h2 (creator-analytics#119 W9).
      expect(valueIn(own, '.video-detail-head h1', 'font-size')).toBe('1.5rem')
      expect(valueIn(own, title, 'height')).toBe(
        `calc(var(--lines) * 1.5rem * ${valueIn(shared, 'h1', 'line-height')})`,
      )
      // Every step, in the sheet's order, at the widths of the head's text column app.css gives
      // from the repro's measurement in Chrome (creator-analytics#477).
      expect(lineCountsIn(own, title)).toEqual([
        [null, '3'],
        ['@container head-text (min-width: 18.625rem)', '2'],
        ['@container head-text (min-width: 33.82rem)', '1'],
      ])
      expect(valueIn(own, '.video-detail-head .placeholder-line', 'height')).toBe(
        `calc(${size} * ${lineHeight})`,
      )
    },
  )

  testWithoutDatabase(
    "below about 36rem of content the video detail head's thumbnail and its placeholder stack above the title at the whole width (creator-analytics#119 W30)",
    async () => {
      const own = await webOwnSheet()
      const narrow = '(max-width: 40rem)'

      expect(valueIn(own, '.video-detail-head', 'flex-direction', narrow)).toBe('column')
      expect(valueIn(own, '.video-detail-thumbnail', 'width', narrow)).toBe('100%')
      expect(valueIn(own, '.video-detail-head .placeholder-thumbnail', 'width', narrow)).toBe(
        '100%',
      )
    },
  )

  testWithoutDatabase(
    "each thumbnail's sizes attribute names the widths app.css gives it: the list's 6rem, and its column's width less the cell's padding on a narrow screen; the video page's 10rem, and the content's width inside the least gutter on a narrow screen (creator-analytics#156)",
    async () => {
      const own = await webOwnSheet()
      const narrow = '(max-width: 40rem)'
      const rem = (value: string | undefined) => {
        const [, number] = /^([\d.]+)rem$/.exec(value ?? '') ?? []
        expect(number, `${value} is in rem`).toBeDefined()
        return Number(number)
      }

      const listWide = valueIn(own, '.video-list-thumbnail', 'width')
      expect(valueIn(own, '.video-list-thumbnail', 'width', narrow)).toBe('100%')
      const column = rem(valueIn(own, '.video-list .video-list-video', 'min-width', narrow))
      const [, cellInline] = (valueIn(own, '.video-list td', 'padding') ?? '').split(' ')
      expect(valueIn(own, '.video-list th', 'padding')).toBe(
        valueIn(own, '.video-list td', 'padding'),
      )
      expect(listThumbnailSizes).toBe(`${narrow} ${column - 2 * rem(cellInline)}rem, ${listWide}`)

      const detailWide = valueIn(own, '.video-detail-thumbnail', 'width')
      expect(valueIn(own, '.video-detail-thumbnail', 'width', narrow)).toBe('100%')
      const [, leastGutter] =
        /^clamp\(([\d.]+rem),/.exec(
          valueIn(await visualSystemSheet(), ':root', '--gutter') ?? '',
        ) ?? []
      expect(detailThumbnailSizes).toBe(
        `${narrow} calc(100vw - ${2 * rem(leastGutter)}rem), ${detailWide}`,
      )
    },
  )

  testWithoutDatabase(
    "the video player's placeholder thumbnail offers the browser the player box's widths: the content's width inside the least gutter on a narrow screen, else the box's widest (creator-analytics#645)",
    async () => {
      const own = await webOwnSheet()
      const narrow = '(max-width: 40rem)'
      const [, leastGutter = ''] =
        /^clamp\(([\d.]+)rem,/.exec(
          valueIn(await visualSystemSheet(), ':root', '--gutter') ?? '',
        ) ?? []

      expect(valueIn(own, '.video-player', 'width')).toBe('100%')
      expect(playerThumbnailSizes).toBe(
        `${narrow} calc(100vw - ${2 * Number(leastGutter)}rem), ${valueIn(own, '.video-player', 'max-width')}`,
      )
    },
  )

  testWithoutDatabase(
    "the video player's thumbnail and the player hold one 16:9 box, which the thumbnail and the frame each fill and the cannot-play panel adds nothing to, so nothing moves when the player is ready (creator-analytics#645, #684)",
    async () => {
      const own = await webOwnSheet()
      const fills = (selector: string) => ({
        selector,
        position: valueIn(own, selector, 'position'),
        inset: valueIn(own, selector, 'inset'),
        width: valueIn(own, selector, 'width'),
        height: valueIn(own, selector, 'height'),
      })

      expect(valueIn(own, '.video-player', 'aspect-ratio')).toBe('16 / 9')
      expect(valueIn(own, '.video-player', 'position')).toBe('relative')
      expect(
        ['.video-player-thumbnail', '.video-player-frame', '.video-player-frame > iframe'].map(
          fills,
        ),
      ).toEqual(
        ['.video-player-thumbnail', '.video-player-frame', '.video-player-frame > iframe'].map(
          (selector) => ({
            selector,
            position: 'absolute',
            inset: '0',
            width: '100%',
            height: '100%',
          }),
        ),
      )
      expect(valueIn(own, '.video-player-cannot-play', 'position')).toBe('absolute')
    },
  )

  testWithoutDatabase(
    'from the width the stacked charts show at, the video player sits in a column beside the audience retention pair, and below it the section stays one column with the player above (creator-analytics#648)',
    async () => {
      const own = await webOwnSheet()
      const [wide] = /\(min-width: [^)]+\)/.exec(stackedChartsQuery) ?? []
      const columnsOf = (media: string | null) =>
        valueIn(own, '.retention-body-with-player', 'grid-template-columns', media)

      expect(wide).toBe('(min-width: 60rem)')
      expect(valueIn(own, '.retention-body-with-player', 'align-items', wide)).toBe('start')
      expect(columnsOf(null)).toBeUndefined()
      expect(
        rulesIn(own)
          .filter(
            ({ selector, body, media }) =>
              media !== wide &&
              /\.retention-body\b/.test(selector) &&
              /grid-template-columns\s*:/.test(body),
          )
          .map(({ selector, media }) => ({ selector, media })),
      ).toEqual([])
      for (const wrapper of ['.retention-body', '.retention-pair']) {
        expect([wrapper, valueIn(own, wrapper, 'display')]).toEqual([wrapper, 'grid'])
      }
      expect(valueIn(own, '.retention-pair', 'gap')).toBe(
        valueIn(own, '.video-detail-section', 'gap'),
      )
      expect(valueIn(own, '.retention-pair', 'min-width')).toBe('0')
    },
  )

  testWithoutDatabase(
    "the video player stands 1.5rem from the audience retention pair, above it on a narrow screen and beside it from 60rem, while the pair's plots keep the section's gap (creator-analytics#685)",
    async () => {
      const own = await webOwnSheet()
      const gaps = rulesIn(own)
        .filter(({ selector }) => /\.retention-body\b/.test(selector))
        .filter(({ body }) => /(^|[\s;])(column-)?gap\s*:/.test(body))
        .map(({ selector, media }) => ({ selector, media }))

      expect(valueIn(own, '.retention-body', 'gap')).toBe('1.5rem')
      expect(gaps).toEqual([{ selector: '.retention-body', media: null }])
    },
  )

  testWithoutDatabase(
    "from 60rem the video player's column is half the section's body less half the gap, never wider than the player's own cap, and the audience retention pair takes the rest (creator-analytics#685)",
    async () => {
      const own = await webOwnSheet()
      const [wide] = /\(min-width: [^)]+\)/.exec(stackedChartsQuery) ?? []
      const [, gap] = /^([\d.]+)rem$/.exec(valueIn(own, '.retention-body', 'gap') ?? '') ?? []

      expect(gap).toBeDefined()
      expect(valueIn(own, '.retention-body-with-player', 'grid-template-columns', wide)).toBe(
        `minmax(0, min(${valueIn(own, '.video-player', 'max-width')}, calc(50% - ${Number(gap) / 2}rem))) minmax(0, 1fr)`,
      )
    },
  )

  testWithoutDatabase(
    "where the stacked charts show, the video player sticks in its column under the controls bar, at the bar's height the screen writes plus 1rem, and nowhere else (creator-analytics#685)",
    async () => {
      const own = await webOwnSheet()
      const player = '.retention-body-with-player > .video-player'

      expect(valueIn(own, player, 'position', stackedChartsQuery)).toBe('sticky')
      expect(valueIn(own, player, 'top', stackedChartsQuery)).toBe(
        `calc(var(${controlsBarHeightProperty}) + 1rem)`,
      )
      expect(
        rulesIn(own)
          .filter(({ selector, body }) => /video-player/.test(selector) && /sticky/.test(body))
          .map(({ media }) => media),
      ).toEqual([stackedChartsQuery])
    },
  )

  testWithoutDatabase(
    "an upload marker's box, a tile's included, is as wide as the width the markers join at, and a tile draws no second border (creator-analytics#283, creator-analytics#763)",
    async () => {
      const own = await webOwnSheet()

      expect(valueIn(own, '.upload-marker', 'width')).toBe(`${uploadMarkerRem}rem`)
      expect(valueIn(own, '.upload-marker', 'height')).toBe(`${uploadMarkerRem}rem`)
      expect(valueIn(own, '.upload-markers-track', 'height')).toBe(`${uploadMarkerRem}rem`)
      expect(valueIn(own, '.upload-marker-tile', 'width')).toBeUndefined()
      expect(valueIn(own, '.upload-marker-tile', 'border')).toBeUndefined()
    },
  )

  testWithoutDatabase(
    'every upload marker, a single one included, is framed in its own ink by a rounded border (creator-analytics#763)',
    async () => {
      const own = await webOwnSheet()

      expect(valueIn(own, '.upload-marker', 'border')).toBe('1px solid currentColor')
      expect(valueIn(own, '.upload-marker', 'border-radius')).toMatch(/^[\d.]+rem$/)
    },
  )

  testWithoutDatabase(
    "a hovered upload marker's frame and fill paint only in visual system tokens, and its frame darkens to the body's ink (creator-analytics#763)",
    async () => {
      const declared = paintedBy(await webOwnSheet(), /\.upload-marker:hover\b/)
      const tokens = lightTokensIn(await visualSystemSheet())

      expect(declared.map(({ property, value }) => [property, value])).toContainEqual([
        'border-color',
        'var(--ink)',
      ])
      expect(declared.some(({ property }) => /^background/.test(property))).toBe(true)
      for (const { property, value } of declared) {
        const token = /^var\((--[\w-]+)\)$/.exec(value)?.[1]
        expect({ property, value, token: token && tokens.includes(token) }).toEqual({
          property,
          value,
          token: true,
        })
      }
    },
  )

  testWithoutDatabase(
    "a Short's player box is 9:16, its height stops at 60% of the window's, and it is centred in its column (creator-analytics#648)",
    async () => {
      const own = await webOwnSheet()

      expect(valueIn(own, '.video-player-short', 'aspect-ratio')).toBe('9 / 16')
      expect(valueIn(own, '.video-player-short', 'max-height')).toBe('60vh')
      expect(valueIn(own, '.video-player-short', 'width')).toBe('min(100%, calc(60vh * 9 / 16))')
      expect(valueIn(own, '.video-player-short', 'margin-inline')).toBe('auto')
    },
  )

  testWithoutDatabase(
    "the video player's box is never smaller than Google's 200 by 200 pixel minimum for an embedded player (creator-analytics#648)",
    async () => {
      const own = await webOwnSheet()

      expect(valueIn(own, '.video-player', 'min-width')).toBe('200px')
      expect(valueIn(own, '.video-player', 'min-height')).toBe('200px')
    },
  )

  testWithoutDatabase(
    "on a narrow screen a list row's thumbnail and its placeholder stack above the title at the column's width, and the title's placeholder holds the three lines most titles wrap to there (Nick, browser walk, 2026-10-11)",
    async () => {
      const own = await webOwnSheet()
      const { lineHeight } = bodyTextIn(await visualSystemSheet())
      const narrow = '(max-width: 40rem)'

      expect(valueIn(own, '.video-list-video-cell', 'flex-direction', narrow)).toBe('column')
      expect(valueIn(own, '.video-list-thumbnail', 'width', narrow)).toBe('100%')
      expect(valueIn(own, '.video-list .placeholder-thumbnail', 'width', narrow)).toBe('100%')
      expect(valueIn(own, '.video-list .placeholder-line', 'height', narrow)).toBe(
        `calc(3 * ${valueIn(own, '.video-list table', 'font-size')} * ${lineHeight})`,
      )
    },
  )

  testWithoutDatabase(
    "a card's number keeps the place of the two lines a long amount wraps to at its least size, and the card placeholder holds that place (creator-analytics#119 W24)",
    async () => {
      const own = await webOwnSheet()

      // The least size is 1.125rem, and the number takes the line height of 1.2 its `dd` sets.
      expect(valueIn(own, '.card .card-number', 'font-size')).toMatch(/^clamp\(1\.125rem, /)
      expect(valueIn(own, '.card dd', 'font')).toMatch(/ \/ 1\.2 /)
      expect(valueIn(own, '.card .card-number', 'line-height')).toBeUndefined()
      expect(valueIn(own, '.card .card-number', 'font')).toBeUndefined()
      expect(valueIn(own, '.cards', '--card-number-place')).toBe('calc(2 * 1.125rem * 1.2)')
      expect(valueIn(own, '.card .card-number', 'min-height')).toBe('var(--card-number-place)')
      expect(valueIn(own, '.cards', '--card-place')).toContain(' + var(--card-number-place) + ')
      expect(valueIn(own, '.placeholder-card', 'height')).toBe('var(--card-place)')
    },
  )

  testWithoutDatabase(
    "in every table each column heading and the numbers under it are centered, and the first column, its heading and each row's, stays at the start (creator-analytics#119 W34)",
    async () => {
      const own = await webOwnSheet()
      const centered = [
        '.video-list th',
        '.video-list td',
        '.numbers-table thead th',
        '.numbers-table table td',
        '.since-publish thead th',
        '.since-publish table td',
      ]
      // A browser centers a th of its own, so each row's heading needs its start rule. The since
      // publish table's first heading is empty (creator-analytics#119 W22).
      const atStart = [
        '.video-list thead tr:first-child th:first-child',
        '.video-list .video-list-video',
        '.numbers-table thead tr:first-child th:first-child',
        '.numbers-table table th',
        '.since-publish table th',
      ]

      expect(centered.map((selector) => valueIn(own, selector, 'text-align'))).toEqual(
        centered.map(() => 'center'),
      )
      expect(atStart.map((selector) => valueIn(own, selector, 'text-align'))).toEqual(
        atStart.map(() => 'start'),
      )
      // `table th` puts every th of a table at the start, and `thead th` centers the headings with
      // the same specificity, so the headings are centered only when the centering comes later.
      const alignedAt = (selector: string) =>
        rulesIn(own)
          .map(
            (rule) =>
              rule.media === null &&
              rule.selector.split(',').some((listed) => listed.trim() === selector) &&
              rule.body.includes('text-align'),
          )
          .lastIndexOf(true)
      for (const table of ['.numbers-table', '.since-publish']) {
        expect(alignedAt(`${table} table th`)).toBeGreaterThan(-1)
        expect(alignedAt(`${table} thead th`)).toBeGreaterThan(alignedAt(`${table} table th`))
      }
    },
  )

  testWithoutDatabase(
    'in every table a line in the line token sits between every pair of columns, and the first column has none before it (creator-analytics#351)',
    async () => {
      const own = await webOwnSheet()
      const lined = [
        '.video-list th',
        '.video-list td',
        '.numbers-table table th',
        '.numbers-table table td',
        '.since-publish table th',
        '.since-publish table td',
      ]
      // The first heading row's first cell only: with the revenue sources shown, the second
      // heading row's first cell is the first source, after Revenue, and keeps its line.
      const firstColumn = [
        '.video-list thead tr:first-child > :first-child',
        '.video-list tbody tr > :first-child',
        '.numbers-table thead tr:first-child > :first-child',
        '.numbers-table tbody tr > :first-child',
        '.numbers-table tfoot tr > :first-child',
        '.since-publish thead tr:first-child > :first-child',
        '.since-publish tbody tr > :first-child',
      ]
      const tables = ['.video-list', '.numbers-table', '.since-publish']

      expect(lined.map((selector) => valueIn(own, selector, 'border-inline-start'))).toEqual(
        lined.map(() => '1px solid var(--line)'),
      )
      const unlined = rulesIn(own)
        .filter(
          ({ media, body }) => media === null && /border-inline-start\s*:\s*0\s*(;|$)/.test(body),
        )
        .flatMap(({ selector }) => selector.split(',').map((listed) => listed.trim()))
        .filter((selector) => tables.some((table) => selector.startsWith(`${table} `)))
      expect(unlined.toSorted()).toEqual(firstColumn.toSorted())
    },
  )

  testWithoutDatabase(
    "the numbers table's box and its placeholder take the same height for their rows, so the box holds exactly its heading, ten body rows and its total (creator-analytics#119 W25)",
    async () => {
      const own = await webOwnSheet()
      // A row: its 0.875rem text at line height 1.4, its padding above and below, and its line.
      const rows = 'calc(var(--rows) * (0.875rem * 1.4 + 0.8rem + 1px) + 2px)'

      expect(valueIn(own, '.numbers-table table', 'font-size')).toBe('0.875rem')
      expect(valueIn(own, '.numbers-table table', 'line-height')).toBe('1.4')
      expect(valueIn(own, '.numbers-table table th', 'padding')).toBe('0.4rem 0.5rem')
      expect(valueIn(own, '.numbers-table', 'max-height')).toBe(rows)
      expect(valueIn(own, '.placeholder-table', 'height')).toBe(rows)
    },
  )

  testWithoutDatabase(
    "the numbers table's total row stays at the bottom of its box on the page's background, as its heading rows stay at the top (creator-analytics#119 W8)",
    async () => {
      const own = await webOwnSheet()

      expect(valueIn(own, '.numbers-table tfoot', 'position')).toBe('sticky')
      expect(valueIn(own, '.numbers-table tfoot', 'bottom')).toBe('0')
      expect(valueIn(own, '.numbers-table thead', 'top')).toBe('0')
      expect(valueIn(own, '.numbers-table thead th', 'background')).toBe('var(--bg)')
      expect(valueIn(own, '.numbers-table tfoot td', 'background')).toBe('var(--bg)')
    },
  )

  testWithoutDatabase(
    "the numbers table's sticky heading and total rows stay below the sticky controls bar, inside the table's own stacking context (creator-analytics#119 W8)",
    async () => {
      const own = await webOwnSheet()

      // The bar comes first in the page at z-index 1, so a sticky row at the same z-index in the
      // page's stacking context paints over it.
      expect(valueIn(own, '.controls-bar', 'z-index')).toBe('1')
      expect(valueIn(own, '.numbers-table', 'position')).toBe('relative')
      expect(valueIn(own, '.numbers-table', 'z-index')).toBe('0')
    },
  )

  testWithoutDatabase(
    "the video list's heading cells move down by the heading offset on the page's background, above the body's fixed video column (creator-analytics#155)",
    async () => {
      const own = await webOwnSheet()
      const heading = '.video-list thead th'

      expect(valueIn(own, heading, 'transform')).toBe('translateY(var(--heading-offset, 0px))')
      expect(valueIn(own, heading, 'position')).toBe('relative')
      expect(valueIn(own, heading, 'background')).toBe('var(--bg)')
      expect(Number(valueIn(own, heading, 'z-index'))).toBeGreaterThan(
        Number(valueIn(own, '.video-list .video-list-video', 'z-index')),
      )
    },
  )

  testWithoutDatabase(
    "the video list's top left heading cell stays fixed at the start, above the heading cells scrolling under it sideways (creator-analytics#155)",
    async () => {
      const own = await webOwnSheet()
      const corner = '.video-list thead tr:first-child th:first-child'

      expect(valueIn(own, corner, 'position')).toBe('sticky')
      expect(valueIn(own, corner, 'inset-inline-start')).toBe('0')
      expect(Number(valueIn(own, corner, 'z-index'))).toBeGreaterThan(
        Number(valueIn(own, '.video-list thead th', 'z-index')),
      )
    },
  )

  // The second column's own line slides under the fixed column as the list scrolls sideways.
  testWithoutDatabase(
    "the video list's fixed video column draws the line after it, in the line token, so the line stays as the list scrolls sideways (creator-analytics#351)",
    async () => {
      const own = await webOwnSheet()
      const fixed = [
        '.video-list thead tr:first-child th:first-child',
        '.video-list .video-list-video',
      ]

      expect(fixed.map((selector) => valueIn(own, selector, 'position'))).toEqual([
        'sticky',
        'sticky',
      ])
      expect(fixed.map((selector) => valueIn(own, selector, 'box-shadow'))).toEqual([
        '1px 0 0 var(--line)',
        '1px 0 0 var(--line)',
      ])
    },
  )

  // A collapsed border belongs to the table, so the line under a moved heading row would stay
  // behind.
  testWithoutDatabase(
    "the video list's table draws separate borders, so the line under the heading rows moves with them (creator-analytics#155)",
    async () => {
      const own = await webOwnSheet()

      expect(valueIn(own, '.video-list table', 'border-collapse')).toBe('separate')
      expect(valueIn(own, '.video-list table', 'border-spacing')).toBe('0')
    },
  )

  testWithoutDatabase(
    "the video list's moved heading rows stay below the sticky controls bar, inside the list's own stacking context (creator-analytics#155)",
    async () => {
      const own = await webOwnSheet()

      expect(valueIn(own, '.controls-bar', 'z-index')).toBe('1')
      expect(valueIn(own, '.video-list-scroll', 'position')).toBe('relative')
      expect(valueIn(own, '.video-list-scroll', 'z-index')).toBe('0')
    },
  )

  // A sticky total row keeps its own line apart from the last day's, which the collapsed borders
  // would otherwise join: Chrome drew a 2px line under a table of three days on 2026-10-10.
  testWithoutDatabase(
    "one line, the total row's own, sits between the last day and the total row (creator-analytics#119 W8)",
    async () => {
      const own = await webOwnSheet()

      expect(valueIn(own, '.numbers-table tfoot td', 'border-top')).toBe('1px solid var(--line)')
      const lastDay = '.numbers-table tbody tr:last-child'
      expect(valueIn(own, `${lastDay} th`, 'border-bottom')).toBe('0')
      expect(valueIn(own, `${lastDay} td`, 'border-bottom')).toBe('0')
    },
  )

  // Each note's place under the charts holds the lines its note wraps to in the signed-in screen,
  // at the widths app.css gives from the repro's measurement in Chrome, every step in the sheet's
  // order, so a stray or a missing one goes red (creator-analytics#477).
  for (const [note, place, lineCounts] of [
    [
      "delay note, the longest month's,",
      '.placeholder-note',
      [
        [null, '4'],
        ['@container signed-in-screen (min-width: 18.3125rem)', '3'],
        ['@container signed-in-screen (min-width: 24.9375rem)', '2'],
      ],
    ],
    [
      'running total note',
      '.placeholder-total-note',
      [
        [null, '3'],
        ['@container signed-in-screen (min-width: 20.0625rem)', '2'],
        ['@container signed-in-screen (min-width: 38.5rem)', '1'],
      ],
    ],
    [
      "launch chart's first-10 note",
      '.placeholder-first-rows-note',
      [
        [null, '2'],
        ['@container signed-in-screen (min-width: 27.8125rem)', '1'],
      ],
    ],
    [
      "launch chart's running total note",
      '.placeholder-launch-total-note',
      [
        [null, '3'],
        ['@container signed-in-screen (min-width: 20.875rem)', '2'],
        ['@container signed-in-screen (min-width: 39.5625rem)', '1'],
      ],
    ],
    [
      "revenue sources' other sources note",
      '.placeholder-other-sources-note',
      [
        [null, '2'],
        ['@container signed-in-screen (min-width: 25.6875rem)', '1'],
      ],
    ],
  ] as const) {
    testWithoutDatabase(
      `the ${note} placeholder holds the lines the note wraps to in the screen at each width, beside the open sidebar, the collapsed one and none (creator-analytics#71, #314, #324, #375, #451, #477, #509)`,
      async () => {
        const own = await webOwnSheet()
        const { lineHeight } = bodyTextIn(await visualSystemSheet())
        const size = valueIn(own, '.note', 'font-size')

        // The note's lines and its 0.5rem padding above and below them.
        expect(valueIn(own, '.note', 'padding')).toBe('0.5rem 0.75rem')
        expect(valueIn(own, place, 'height')).toBe(
          `calc(var(--lines) * ${size} * ${lineHeight} + 1rem)`,
        )
        expect(lineCountsIn(own, place)).toEqual(lineCounts)
      },
    )
  }

  // The widths of the card's content box app.css gives each Audience note's place from the repro's
  // measurement in Chrome, so a note's lines follow its own card's width rather than the screen's
  // columns (creator-analytics#326, #350, #477, #689).
  for (const [note, place, lineCounts] of [
    [
      'countries',
      '.placeholder-countries-note',
      [
        [null, '4'],
        ['@container audience-card (min-width: 16.41rem)', '3'],
        ['@container audience-card (min-width: 23.38rem)', '2'],
      ],
    ],
    [
      'US states',
      '.placeholder-us-states-note',
      [
        [null, '4'],
        ['@container audience-card (min-width: 16.19rem)', '3'],
        ['@container audience-card (min-width: 23.54rem)', '2'],
      ],
    ],
    [
      'cities',
      '.placeholder-cities-note',
      [
        [null, '4'],
        ['@container audience-card (min-width: 15.64rem)', '3'],
        ['@container audience-card (min-width: 21.655rem)', '2'],
      ],
    ],
    [
      'every format',
      '.placeholder-every-format-note',
      [
        [null, '2'],
        ['@container audience-card (min-width: 16.4903rem)', '1'],
      ],
    ],
    [
      'gender',
      '.placeholder-gender-note',
      [
        [null, '3'],
        ['@container audience-card (min-width: 15.375rem)', '2'],
        ['@container audience-card (min-width: 28.03rem)', '1'],
      ],
    ],
  ] as const) {
    testWithoutDatabase(
      `the Audience screen's ${note} note placeholder holds the lines the note wraps to in its card at each width, beside the open sidebar, the collapsed one and none (creator-analytics#326, #350, #477)`,
      async () => {
        const own = await webOwnSheet()
        const { lineHeight } = bodyTextIn(await visualSystemSheet())
        const size = valueIn(own, '.note', 'font-size')

        // The note's lines and its 0.5rem padding above and below them.
        expect(valueIn(own, '.note', 'padding')).toBe('0.5rem 0.75rem')
        expect(valueIn(own, place, 'height')).toBe(
          `calc(var(--lines) * ${size} * ${lineHeight} + 1rem)`,
        )
        expect(lineCountsIn(own, place)).toEqual(lineCounts)
      },
    )
  }

  // The widths of the card's content box app.css gives each Audience heading's place from the
  // repro's measurement in Chrome, so a heading that wraps in a narrower card holds its second line
  // before the numbers land (creator-analytics#463).
  for (const [heading, place, lineCounts] of [
    ['countries', '.placeholder-countries-heading', [[null, '1']]],
    ['US states', '.placeholder-us-states-heading', [[null, '1']]],
    ['cities', '.placeholder-cities-heading', [[null, '1']]],
    ['age', '.placeholder-age-heading', [[null, '1']]],
    [
      'gender',
      '.placeholder-gender-heading',
      [
        [null, '2'],
        ['@container audience-card (min-width: 16.611rem)', '1'],
      ],
    ],
    ['devices', '.placeholder-devices-heading', [[null, '1']]],
    [
      'operating systems',
      '.placeholder-operating-systems-heading',
      [
        [null, '2'],
        ['@container audience-card (min-width: 16.582rem)', '1'],
      ],
    ],
    [
      'subscriber split',
      '.placeholder-subscribers-heading',
      [
        [null, '2'],
        ['@container audience-card (min-width: 23.3125rem)', '1'],
      ],
    ],
  ] as const) {
    testWithoutDatabase(
      `the Audience screen's ${heading} heading placeholder holds the lines the heading wraps to in its card at each width, beside the open sidebar, the collapsed one and none (creator-analytics#463)`,
      async () => {
        const own = await webOwnSheet()
        const shared = await visualSystemSheet()

        // Lines of the section heading's own size and the visual system's line height for an h2,
        // so a two-line place is as tall as the two-line heading.
        expect(valueIn(own, place, 'height')).toBe(
          `calc(var(--lines) * ${valueIn(own, '.video-detail-section h2', 'font-size')} * ${valueIn(shared, 'h2', 'line-height')})`,
        )
        expect(lineCountsIn(own, place)).toEqual(lineCounts)
      },
    )
  }

  // A video page's subscriber split heading wraps in a breakdowns column, the grid's track rule's
  // 18rem minimum and up, as it does in an Audience card; the width app.css steps it at comes from
  // the repro's measurement in Chrome (creator-analytics#512).
  testWithoutDatabase(
    "a video page's subscriber split heading placeholder holds the lines the heading wraps to in its breakdowns column at each width, beside the open sidebar, the collapsed one and none (creator-analytics#512)",
    async () => {
      const own = await webOwnSheet()
      const shared = await visualSystemSheet()
      const place = '.placeholder-video-subscribers-heading'

      expect(valueIn(own, place, 'height')).toBe(
        `calc(var(--lines) * ${valueIn(own, '.video-detail-section h2', 'font-size')} * ${valueIn(shared, 'h2', 'line-height')})`,
      )
      expect(lineCountsIn(own, place)).toEqual([
        [null, '2'],
        ['@container video-breakdown (min-width: 23.3rem)', '1'],
      ])
    },
  )

  testWithoutDatabase(
    "no placeholder's lines follow the window or the sidebar's state, so the open sidebar, the collapsed one and none get the same bands (creator-analytics#417, #477)",
    async () => {
      const placeholderRules = rulesIn(await webOwnSheet()).filter(({ selector }) =>
        selector.includes('.placeholder'),
      )

      expect(placeholderRules.length).toBeGreaterThan(0)
      expect(
        placeholderRules.filter(({ selector }) => /data-collapsible|data-state/.test(selector)),
      ).toEqual([])
      expect(
        placeholderRules.filter(({ media, body }) => media !== null && /--lines\s*:/.test(body)),
      ).toEqual([])
    },
  )

  testWithoutDatabase(
    "each box a placeholder's text wraps in is a size container of its name, and every @container rule queries one of them (creator-analytics#477)",
    async () => {
      const own = await webOwnSheet()
      const containers = {
        'signed-in-screen': '.signed-in-screen',
        'head-text': '.video-detail-head > div:not(.placeholder)',
        'audience-card': '.audience-column > [data-slot="card"]',
        'video-breakdown': '.video-detail-breakdowns > .video-detail-section',
      }

      for (const [name, box] of Object.entries(containers)) {
        expect({ box, container: valueIn(own, box, 'container') }).toEqual({
          box,
          container: `${name} / inline-size`,
        })
      }
      const queried = rulesIn(own).flatMap(({ container }) =>
        container === null ? [] : [container.split(/\s/)[0] ?? ''],
      )
      expect(queried.length).toBeGreaterThan(0)
      expect(queried.filter((name) => !(name in containers))).toEqual([])
    },
  )

  testWithoutDatabase(
    "the charts placeholder's legend marked for the stacked charts alone shows only where the charts stack (creator-analytics#71)",
    async () => {
      const own = await webOwnSheet()
      const legend = '.placeholder-legend.placeholder-stacked-only'

      expect(valueIn(own, legend, 'display')).toBe('none')
      expect(valueIn(own, legend, 'display', stackedChartsQuery)).toBe('block')
    },
  )

  testWithoutDatabase(
    "the charts placeholder's stacked-only chart shows under the query the charts stack at, not a copy that drifted from it (creator-analytics#71)",
    async () => {
      const own = await webOwnSheet()
      const chart = '.metric-chart.placeholder-stacked-only'

      expect(valueIn(own, chart, 'display')).toBe('none')
      expect(valueIn(own, chart, 'display', stackedChartsQuery)).toBe('grid')
    },
  )

  // A stacked chart below engaged views, the first of every stack: the plot, and the library's svg
  // inside it, whose height="100%" the base `.chart svg` rule outranks. Any later chart, not only
  // the next sibling, since the upload marker row under the first plot sits between engaged views
  // and watch hours on the channel summary (creator-analytics#763).
  const belowEngagedViews = {
    plot: '.metric-chart ~ .metric-chart .cursor-plot',
    svg: '.metric-chart ~ .metric-chart .chart svg',
    placeholder: '.metric-chart ~ .metric-chart .placeholder-chart',
  }

  testWithoutDatabase(
    'a stacked chart below engaged views plots at 6rem where the charts stack, and engaged views at 10rem (creator-analytics#418)',
    async () => {
      const own = await webOwnSheet()

      expect(valueIn(own, belowEngagedViews.plot, 'height', stackedChartsQuery)).toBe('6rem')
      expect(valueIn(own, belowEngagedViews.svg, 'height', stackedChartsQuery)).toBe('6rem')
      // Engaged views, the first chart, keeps the base heights: nothing under the query sets them.
      expect(valueIn(own, '.cursor-plot', 'height')).toBe('10rem')
      expect(valueIn(own, '.chart svg', 'height')).toBe('10rem')
      expect(valueIn(own, '.cursor-plot', 'height', stackedChartsQuery)).toBeUndefined()
      expect(valueIn(own, '.chart svg', 'height', stackedChartsQuery)).toBeUndefined()
    },
  )

  testWithoutDatabase('a chart shown alone plots at 10rem (creator-analytics#418)', async () => {
    const own = await webOwnSheet()

    // Outside the stacked query no rule shortens a chart, so the one chart takes the base heights.
    for (const selector of Object.values(belowEngagedViews)) {
      expect(valueIn(own, selector, 'height')).toBeUndefined()
    }
    expect(valueIn(own, '.cursor-plot', 'height')).toBe('10rem')
    expect(valueIn(own, '.chart svg', 'height')).toBe('10rem')
  })

  // The label's button stretches an absolute ::after over the whole card. The RPM line's own button
  // sits above it, so a press on the line chooses RPM, not revenue. The browser walk presses it.
  testWithoutDatabase(
    "the revenue card's RPM line is its own tap target, raised above the label's stretched one (creator-analytics#356)",
    async () => {
      const own = await webOwnSheet()

      expect(valueIn(own, '.card-choose::after', 'position')).toBe('absolute')
      expect(valueIn(own, '.card-choose::after', 'z-index')).toBeUndefined()
      expect(valueIn(own, '.card-choose-detail', 'position')).toBe('relative')
      expect(Number(valueIn(own, '.card-choose-detail', 'z-index'))).toBeGreaterThan(0)
    },
  )

  // The bar comes first in the page at z-index 1, so the RPM line's z-index 1 in the page's stacking
  // context painted over the stuck bar on Nick's phone. The browser walk scrolls the line under it.
  testWithoutDatabase(
    "the revenue card's raised RPM line stays below the sticky controls bar, inside the card's own stacking context (creator-analytics#268)",
    async () => {
      const own = await webOwnSheet()

      expect(valueIn(own, '.controls-bar', 'z-index')).toBe('1')
      expect(valueIn(own, '.card-chooser', 'position')).toBe('relative')
      expect(valueIn(own, '.card-chooser', 'z-index')).toBe('0')
    },
  )

  testWithoutDatabase(
    "the revenue card's RPM line shows its focus and its pressed state without colour alone (creator-analytics#356)",
    async () => {
      const own = await webOwnSheet()

      expect(valueIn(own, '.card-choose-detail:focus-visible', 'outline')).toBe(
        '2px solid var(--accent)',
      )
      expect(valueIn(own, '.card-choose-detail[aria-pressed="true"]', 'text-decoration-line')).toBe(
        'underline',
      )
    },
  )

  testWithoutDatabase(
    'the charts placeholder holds the same heights: 10rem for engaged views, 6rem for a stacked chart below it (creator-analytics#418)',
    async () => {
      const own = await webOwnSheet()

      expect(valueIn(own, '.placeholder-chart', 'height')).toBe('10rem')
      expect(valueIn(own, '.placeholder-chart', 'height')).toBe(
        valueIn(own, '.cursor-plot', 'height'),
      )
      expect(valueIn(own, belowEngagedViews.placeholder, 'height', stackedChartsQuery)).toBe('6rem')
      expect(valueIn(own, belowEngagedViews.placeholder, 'height', stackedChartsQuery)).toBe(
        valueIn(own, belowEngagedViews.plot, 'height', stackedChartsQuery),
      )
      expect(valueIn(own, '.placeholder-chart', 'height', stackedChartsQuery)).toBeUndefined()
    },
  )

  testWithoutDatabase(
    "the since publish table's placeholder is a row of the table's text at the body's line height, its padding and its line, for each row, with no box border (creator-analytics#71)",
    async () => {
      const own = await webOwnSheet()
      const { lineHeight } = bodyTextIn(await visualSystemSheet())

      // Unlike the numbers table, it sets no line height of its own and has no box.
      expect(valueIn(own, '.since-publish table', 'line-height')).toBeUndefined()
      expect(valueIn(own, '.since-publish', 'border')).toBeUndefined()
      expect(valueIn(own, '.since-publish table td', 'padding')).toBe('0.4rem 0.5rem')
      expect(valueIn(own, '.since-publish table td', 'border-bottom')).toBe('1px solid var(--line)')
      expect(valueIn(own, '.placeholder-since-publish-table', 'height')).toBe(
        `calc(var(--rows) * (${valueIn(own, '.since-publish table', 'font-size')} * ${lineHeight} + 0.8rem + 1px))`,
      )
    },
  )

  test("no token the served utilities paint a background with is cream, ivory, beige or sepia, in light or dark mode, the chosen Format's fill among them", async ({
    web,
  }) => {
    const { origin } = await startApi(web, { webRoot })
    const utilities = utilityLayersIn(await servedCss(origin))
    const shared = await visualSystemSheet()
    const tokens = new Set(
      [...utilities.matchAll(/\bbackground(?:-color|-image)?\s*:([^;}]*)/g)].flatMap(
        ([, value = '']) =>
          [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map(([, token = '']) => token),
      ),
    )

    // The chosen Format's fill, which the copied Radio Group paints with a utility.
    expect(tokens).toContain('--accent')
    for (const token of tokens) {
      const colours = declarationsIn(shared)
        .filter(({ property }) => property === token)
        .flatMap(({ colours }) => colours)
      // One value in the light scheme, the dark value in each of the two dark blocks, and the
      // light value again in the print block (creator-analytics#956).
      expect({ token, values: colours.length }).toEqual({ token, values: 4 })
      for (const { written, oklab } of colours) {
        expect({ token, written, warm: isWarmTinted(oklab) }).toEqual({
          token,
          written,
          warm: false,
        })
      }
    }
  })

  // ListSelect gives every native select its label and the copied Native Select's look and
  // chevron, so a native select rendered anywhere else would miss them. The `<select` itself sits
  // in the copied component, which only ListSelect renders. The sidebar's channel picker is Base
  // UI's Select, a button with a list, which renders no `<select` (creator-analytics#531). Limits: this reads the text of the .tsx files in src/
  // and its subfolders, so it misses a select made with createElement, and a `<select` or a
  // `<NativeSelect` in a comment fails it. The custom range Calendar's month and year dropdowns are
  // such selects: react-day-picker makes them with createElement, transparent over the caption
  // label calendar.tsx styles with its own chevron, and the Calendar's tests name them
  // (creator-analytics#690). Nick's browser walk at /app checks that every select draws the chevron.
  testWithoutDatabase(
    'ListSelect is the only web source file that renders a native select',
    async () => {
      const sources = new URL('../src/', import.meta.url)
      const files = (await readdir(sources, { recursive: true }))
        .filter((name) => name.endsWith('.tsx'))
        .sort()
      const texts = await Promise.all(files.map((name) => readFile(new URL(name, sources), 'utf8')))
      const holding = (markup: string) => files.filter((_, i) => texts[i]?.includes(markup))

      expect(holding('<select')).toEqual(['components/ui/native-select.tsx'])
      expect(holding('<NativeSelect')).toEqual(['ListSelect.tsx'])
    },
  )

  test('the web app loads no script, stylesheet or font from another origin', async ({ web }) => {
    const { origin } = await startApi(web, { webRoot })
    const html = await servedPage(origin)
    const loads = [...html.matchAll(/<(?:script|link|img|iframe)\b[^>]*\b(?:src|href)="([^"]+)"/g)]
    const offOrigin = loads
      .map(([, url = '']) => url)
      .filter((url) => new URL(url, origin).origin !== origin)
    const css = await servedCss(origin)

    expect(offOrigin).toEqual([])
    expect(css).not.toMatch(/url\(\s*["']?(?:https?:)?\/\//)
    expect(css).not.toMatch(/@import/)
  })

  test("the page's policy connects to the OpenPanel host the build names", async ({ web }) => {
    const { origin } = await startApi(web, { webRoot })
    // Vite escapes the attribute's quotes, which the browser reads back as quotes.
    const policy = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/
      .exec(await servedPage(origin))?.[1]
      ?.replaceAll('&#39;', "'")
    const connectSrc = policy
      ?.split(';')
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith('connect-src '))

    expect(connectSrc).toBe("connect-src 'self' https://openpanel.invalid")
  })

  test('the page carries its policy before any script', async ({ web }) => {
    const { origin } = await startApi(web, { webRoot })
    const html = await servedPage(origin)

    expect(html).toContain('http-equiv="Content-Security-Policy"')
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<script'))
  })

  test('the page sends only its origin as a referrer, so no product event carries an id from an address', async ({
    web,
  }) => {
    const { origin } = await startApi(web, { webRoot })

    expect(await servedPage(origin)).toContain('<meta name="referrer" content="strict-origin"')
  })

  test("the page has no inline script, which the policy's script-src 'self' would block", async ({
    web,
  }) => {
    const { origin } = await startApi(web, { webRoot })
    const inlineScripts = [
      ...(await servedPage(origin)).matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>/g),
    ]

    expect(inlineScripts).toEqual([])
  })

  // The theme (creator-analytics#691): the script that sets `data-theme` from the browser's copy
  // must run before the first paint, so it is a classic script in the head, ahead of the
  // stylesheet, which a browser waits for before it draws. It cannot be inline, as the policy's
  // script-src 'self' carries no nonce. That it runs before the first frame in Chrome is the
  // browser walk's.
  test("the head loads the theme script from the page's own origin before the stylesheet", async ({
    web,
  }) => {
    const { origin } = await startApi(web, { webRoot })
    const html = await servedPage(origin)
    const head = html.slice(0, html.indexOf('</head>'))
    const [first] = [...head.matchAll(/<script\b[^>]*>/g)]
    const tag = first?.[0] ?? ''
    const src = /\bsrc="([^"]+)"/.exec(tag)?.[1] ?? ''
    const script = await fetch(new URL(src, `${origin}/app/`))

    expect(tag).not.toMatch(/\b(type="module"|async|defer)\b/)
    expect(new URL(src, `${origin}/app/`).origin).toBe(origin)
    expect(first?.index).toBeGreaterThan(head.indexOf('Content-Security-Policy'))
    expect(first?.index).toBeLessThan(head.search(/<link\b[^>]*\brel="stylesheet"/))
    expect(script.headers.get('content-type')).toMatch(/^(text|application)\/javascript\b/)
    // The minifier may quote the key with any of the three quotes, a backtick included.
    expect(await script.text()).toMatch(new RegExp(`['"\`]${themeCopyKey}['"\`]`))
  })

  test("the page has no inline style, which the policy's style-src 'self' would block", async ({
    web,
  }) => {
    const { origin } = await startApi(web, { webRoot })
    const html = await servedPage(origin)

    expect([...html.matchAll(/<[^>]*\sstyle\s*=[^>]*>/g)].map(([tag]) => tag)).toEqual([])
    expect([...html.matchAll(/<style\b[^>]*>/g)].map(([tag]) => tag)).toEqual([])
  })
})

describe('the words the web app serves', () => {
  // Limits: the scan reads the served page and the scripts it loads and preloads, so it covers
  // every string the bundle carries from the web app's source and the workspace packages it
  // imports, and nothing a script fetches at run time, such as an API's error text. A chunk that
  // only a dynamic import loads is not read; today the build emits one script. The fonts' licence
  // is third-party legal text the creator never sees, so the scan skips it.

  // Stripe allows a donation only for a charitable purpose, and Stillstats takes tips (#338).
  test('no string the web app serves contains "donat"', async ({ web }) => {
    const { origin } = await startApi(web, { webRoot })
    const served = `${await servedPage(origin)}\n${await servedScripts(origin)}`

    expect(served.match(/.{0,40}donat.{0,40}/gi) ?? []).toEqual([])
  })
})

/** Every script the build writes, joined into one text. */
async function builtScripts(): Promise<string> {
  const files = (await readdir(webRoot, { recursive: true })).filter((file) => file.endsWith('.js'))
  expect(files.length).toBeGreaterThan(0)
  return (await Promise.all(files.map((file) => readFile(join(webRoot, file), 'utf8')))).join('\n')
}

/** Every stylesheet the build writes, joined into one text. */
async function builtCss(): Promise<string> {
  const files = (await readdir(webRoot, { recursive: true })).filter((file) =>
    file.endsWith('.css'),
  )
  expect(files.length).toBeGreaterThan(0)
  return (await Promise.all(files.map((file) => readFile(join(webRoot, file), 'utf8')))).join('\n')
}

describe("the build's YouTube player (creator-analytics#645)", () => {
  testWithoutDatabase(
    "holds none of the browser walk's fake player, and loads YouTube's own IFrame API script",
    async () => {
      const fake = await readFile(
        new URL('../../site/test/screenshot/fake-youtube-iframe-api.js', import.meta.url),
        'utf8',
      )
      const [, marker = ''] = /const marker = '([^']+)'/.exec(fake) ?? []
      const files = (await readdir(webRoot, { recursive: true, withFileTypes: true })).filter(
        (entry) => entry.isFile(),
      )
      const holding = []
      for (const entry of files) {
        const path = join(entry.parentPath, entry.name)
        if ((await readFile(path, 'utf8')).includes(marker)) holding.push(path)
      }

      expect(marker).not.toBe('')
      expect(files.length).toBeGreaterThan(0)
      expect(holding).toEqual([])
      expect(await builtScripts()).toContain('https://www.youtube.com/iframe_api')
      expect(await builtScripts()).not.toContain('youtube-iframe-api.js')
    },
  )
})

describe("the build's OpenPanel client (creator-analytics#575)", () => {
  testWithoutDatabase(
    'holds no client ID, which the API answers at load, so one build serves staging and production',
    async () => {
      const files = (await readdir(webRoot, { recursive: true, withFileTypes: true })).filter(
        (entry) => entry.isFile(),
      )
      const holding = []
      for (const entry of files) {
        const path = join(entry.parentPath, entry.name)
        if ((await readFile(path)).includes(clientIdInTheEnv)) holding.push(path)
      }

      expect(files.length).toBeGreaterThan(0)
      expect(holding).toEqual([])
    },
  )
})

describe("the build's highlights (creator-analytics#577)", () => {
  testWithoutDatabase(
    "the \"What's new\" screen's rules, as the build writes them, paint only with the visual system's tokens, write none of shadcn's defaults, and neither transition nor animate (ADR 0014 rule 3)",
    async () => {
      const shared = await visualSystemSheet()
      const tokens = [...lightTokensIn(shared), ...darkTokensIn(shared)]
      const rules = rulesIn(await builtCss()).filter(({ selector }) =>
        selector.includes('.whats-new'),
      )
      const css = rules.map(({ selector, body }) => `${selector}{${body}}`).join('\n')
      const properties = rules.flatMap(({ body }) =>
        declarationsIn(`{${body}}`).map(({ property }) => property),
      )

      expect(rules.length).toBeGreaterThan(0)
      // A highlight's box is drawn in the line token, as a channel's box on Settings is.
      expect(valueIn(css, '.whats-new-item', 'border')).toBe('1px solid var(--line)')
      expect(coloursOutsideTokens(css, tokens)).toEqual([])
      expect(shadcnDefaultsIn(css, tokens, shadcnDefaultTheme)).toEqual([])
      expect(properties.filter((property) => /^(?:transition|animation)/.test(property))).toEqual(
        [],
      )
    },
  )

  testWithoutDatabase(
    "the \"What's new\" banner's rules, as the build writes them, paint only with the visual system's tokens, write none of shadcn's defaults, and neither transition nor animate (ADR 0011, ADR 0014 rule 3, creator-analytics#580)",
    async () => {
      const shared = await visualSystemSheet()
      const tokens = [...lightTokensIn(shared), ...darkTokensIn(shared)]
      const rules = rulesIn(await builtCss()).filter(({ selector }) =>
        selector.includes('.whats-new-banner'),
      )
      const css = rules.map(({ selector, body }) => `${selector}{${body}}`).join('\n')
      const properties = rules.flatMap(({ body }) =>
        declarationsIn(`{${body}}`).map(({ property }) => property),
      )

      expect(rules.length).toBeGreaterThan(0)
      // One plain notice in the line token, as a highlight's box is: no fill, so no colour alarm.
      expect(valueIn(css, '.whats-new-banner', 'border')).toBe('1px solid var(--line)')
      expect(coloursOutsideTokens(css, tokens)).toEqual([])
      expect(shadcnDefaultsIn(css, tokens, shadcnDefaultTheme)).toEqual([])
      expect(properties.filter((property) => /^(?:transition|animation)/.test(property))).toEqual(
        [],
      )
    },
  )

  testWithoutDatabase(
    "the build carries each highlight's title and its description as HTML, from the content root it is pointed at",
    async () => {
      const scripts = await builtScripts()

      expect(
        [
          'Audience in the sidebar',
          'A page for every release',
          'Open the <strong>Audience</strong> screen from the sidebar on any channel screen.',
        ].filter((text) => !scripts.includes(text)),
      ).toEqual([])
    },
  )
})

describe('the markdown parser', () => {
  // Limits: this reads for markdown-it's own error messages, so it would miss another markdown
  // parser, and a markdown-it release that rewords both messages. A library added to the web app
  // still needs Nick's approval on its issue (ADR 0014), which names the parser it brings.
  testWithoutDatabase('no script or page the web app build writes carries its code', async () => {
    const files = (await readdir(webRoot, { recursive: true })).filter((file) =>
      /\.(?:js|html)$/.test(file),
    )
    const texts = await Promise.all(files.map((file) => readFile(join(webRoot, file), 'utf8')))

    expect(files.some((file) => file.endsWith('.js'))).toBe(true)
    expect(
      files.filter((_, i) => markdownParserMarkers.some((marker) => texts[i]?.includes(marker))),
    ).toEqual([])
  })
})

describe('the dev server', () => {
  testWithoutDatabase(
    "sends the release pages' paths to the API, which serves the site, as it does the legal pages (creator-analytics#577)",
    async () => {
      const server = await createServer({ root: webDirectory, logLevel: 'silent' })
      onTestFinished(() => server.close())
      const { proxy = {} } = server.config.server

      expect(proxy['/releases']).toBe('http://localhost:3000')
      expect(proxy['/releases']).toBe(proxy['/privacy'])
    },
  )

  testWithoutDatabase('every font the stylesheet names answers as a font', async () => {
    const server = await createServer({
      root: webDirectory,
      logLevel: 'silent',
      server: { port: 0, host: '127.0.0.1' },
    })
    onTestFinished(() => server.close())
    await server.listen()
    const [origin = ''] = server.resolvedUrls?.local ?? []
    const fonts = fontUrlsIn(await (await fetch(new URL('/app/src/app.css?direct', origin))).text())

    expect(fonts.length).toBeGreaterThan(0)
    expect(await responsesTo(origin, fonts)).toEqual(
      fonts.map((url) => ({ url, status: 200, type: 'font/woff2' })),
    )
  })
})
