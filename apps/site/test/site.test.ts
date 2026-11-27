// Limits: these tests read the HTML and CSS the build writes, and run no script. They cannot prove
// that the homepage's and the tool page's sign-in buttons reach Google, that OpenPanel receives the
// page views and `sign_in_clicked` with its `source`, or the web app's agreement notice, which
// React renders and no tool here can render. Nick checks all three on the deployed product. No tool here evaluates a media query
// either, so no test covers the light and dark modes: Nick checks both in a real browser.
// The package's tests hold the visual system's colours to the #27 rules. The site's own sheet,
// read from source without the package it imports, may write no colour, so those rules and the
// favicon's own test cover every colour the site serves. The colour rules measure each colour as
// written, on its own. They cannot see what the page shows once colours combine: a translucent
// colour composited over the page, the blend along a gradient, or the grain overlay. Nick's
// real-browser check of both modes covers what the page actually shows.
// The dev-server test proves that the font URLs the dev server's stylesheet names answer as fonts,
// not what the browser draws with them.
// The signed-in header and hero come from main.ts, which no test here runs: these tests read the
// empty avatar place the pages hold and the sizes the sheets declare, signed-in.test.ts the
// answers to GET /api/me, and main.test.ts what main.ts does to the homepage and the tool page in
// happy-dom, which lays nothing out. Nick's browser walk, signed in and signed out, on every
// page, in light and dark mode and at 375px wide, checks the avatar, the "Open your dashboard"
// link, the hidden agreement notice, that nothing moves when /api/me answers, and that the console shows no
// content security policy report and no failed request (creator-analytics#157).
// The structured data tests read the homepage's and the tool page's graphs' shape and values, not
// whether Google accepts them. Nick runs the deployed homepage and tool page through Google's Rich
// Results Test and the Schema Markup Validator, and expects no rich result for the homepage, since
// its graph states no rating (creator-analytics#253).
// The tool page's tests read the page the build writes, not the page in a browser: the browser
// walk, not this file, opens it signed out and signed in (creator-analytics#793). No test here runs
// the thumbnail preview tool's island either: analytics.test.ts holds what a tool event hands
// OpenPanel, and the walk loads a file into the tool and measures its tiles. The component has no
// unit test of its own, by #732's testing decisions (creator-analytics#794).
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { maxComparedCurves, productOrigin } from '@creator-analytics/api-types'
import { listedChannel } from '@creator-analytics/api-types/testing'
import type { WebDatabase } from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import { purgeDateOf } from '@creator-analytics/entitlements'
import { readReleaseContent } from '@creator-analytics/releases'
import { fixtureContentRoot, markdownParserMarkers } from '@creator-analytics/releases/testing'
import { fontsDirectory as thumbnailPreviewFonts } from '@creator-analytics/thumbnail-preview/fonts'
import { ALLOWED_COPY_NUMBERS } from '@creator-analytics/thumbnail-preview/sizes'
import {
  avoidedColoursNear,
  coloursIn,
  declarationsIn,
  fontLicenceFiles,
  fontUrlsIn,
  responsesTo,
  valueIn,
  visualSystemSheet,
  withoutImports,
} from '@creator-analytics/visual-system/testing'
import { build, createServer } from 'vite'
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  onTestFinished,
  test as testWithoutDatabase,
  vi,
} from 'vitest'
import { startApi } from '../../api/test/start-api.ts'
import { apiOriginOf, hostOriginsOf, manifestOf } from '../../extension/src/manifest.ts'
import { type PopupLink, type PopupRead, popupViewOf } from '../../extension/src/popup.ts'
import { settingsName } from '../../web/src/settings-name.ts'
import { themeCopyKey } from '../../web/src/theme.ts'

const notFoundPath = '/no-such-page'

const siteDirectory = fileURLToPath(new URL('..', import.meta.url))

let siteRoot = ''

/**
 * Every page a site build holds but the not-found page, in any folder, by the clean path the API
 * serves it at: a folder's index.html at the folder, any other page at its path without `.html`.
 */
async function pagesAtCleanPaths(root = siteRoot): Promise<{ path: string; file: string }[]> {
  const files = (await readdir(root, { recursive: true }))
    .filter((file) => file.endsWith('.html') && file !== '404.html')
    .sort()
  return files.map((file) => {
    const page = file.slice(0, -'.html'.length)
    return { path: `/${page === 'index' ? '' : page.replace(/\/index$/, '/')}`, file }
  })
}

/** Every page a site build holds, the not-found page included, as the API serves it. */
async function servedPages(
  origin: string,
  root = siteRoot,
): Promise<{ path: string; html: string }[]> {
  const paths = [...(await pagesAtCleanPaths(root)).map(({ path }) => path), notFoundPath]
  return Promise.all(
    paths.map(async (path) => ({ path, html: await (await fetch(`${origin}${path}`)).text() })),
  )
}

/** The API started over a site build, and every page as it serves them. */
async function servedSite(
  web: WebDatabase,
  root = siteRoot,
): Promise<{
  origin: string
  pages: { path: string; html: string }[]
}> {
  const { origin } = await startApi(web, { siteRoot: root })
  return { origin, pages: await servedPages(origin, root) }
}

/** The site built into a new temporary folder, from the release notes under `contentRoot`. */
async function builtSite(contentRoot: string): Promise<string> {
  const outDir = await mkdtemp(join(tmpdir(), 'site-build-'))
  vi.stubEnv('RELEASE_CONTENT_ROOT', contentRoot)
  try {
    await build({ root: siteDirectory, logLevel: 'silent', build: { outDir, emptyOutDir: true } })
  } finally {
    vi.stubEnv('RELEASE_CONTENT_ROOT', fixtureContentRoot)
  }
  return outDir
}

function hrefsOf(html: string, rel: string): string[] {
  return [...html.matchAll(/<link\b[^>]*>/g)]
    .filter(([link]) => link.includes(`rel="${rel}"`))
    .map(([link]) => /\bhref="([^"]+)"/.exec(link)?.[1] ?? '')
}

/** Every file the served pages link with `rel`, as the API serves it, joined into one text. */
async function servedLinks(
  origin: string,
  pages: { html: string }[],
  rel: string,
): Promise<string> {
  const hrefs = new Set(pages.flatMap(({ html }) => hrefsOf(html, rel)))
  const files = [...hrefs].map(async (href) => (await fetch(new URL(href, origin))).text())
  return (await Promise.all(files)).join('\n')
}

async function siteOwnSheet(): Promise<string> {
  return withoutImports(await readFile(new URL('../src/styles.css', import.meta.url), 'utf8'))
}

/**
 * The first `<tag>` element, with `id` when one is given, and everything inside it, or '' when
 * there is none. The match ends at the first closing tag, so it suits an element that nests no
 * element of its own tag.
 */
function elementOf(html: string, tag: string, id?: string): string {
  const opening = id === undefined ? `<${tag}\\b` : `<${tag}\\b[^>]*\\bid="${id}"`
  return new RegExp(`${opening}[\\s\\S]*?</${tag}>`).exec(html)?.[0] ?? ''
}

function homepageOf(pages: { path: string; html: string }[]): string {
  return pages.find(({ path }) => path === '/')?.html ?? ''
}

async function homepageSection(web: WebDatabase, id: string): Promise<string> {
  return elementOf(homepageOf((await servedSite(web)).pages), 'section', id)
}

/**
 * A WebP's width and height, from its first chunk, or null for a chunk this does not read. Per
 * Google's RIFF container spec, an extended file's 'VP8X' chunk holds the canvas width and height
 * less one as 24-bit little-endian numbers at bytes 24 and 27, and a simple lossy file's 'VP8 '
 * frame header holds them as 14-bit numbers at bytes 26 and 28.
 */
function webpSizeOf(file: DataView): { width: number; height: number } | null {
  const chunk = String.fromCharCode(...new Uint8Array(file.buffer, file.byteOffset + 12, 4))
  const uint24 = (at: number) => file.getUint16(at, true) + (file.getUint8(at + 2) << 16)
  if (chunk === 'VP8X') return { width: uint24(24) + 1, height: uint24(27) + 1 }
  if (chunk === 'VP8 ') {
    return { width: file.getUint16(26, true) & 0x3fff, height: file.getUint16(28, true) & 0x3fff }
  }
  return null
}

/**
 * A PNG's width and height, which its IHDR chunk holds as big-endian numbers at bytes 16 and 20.
 */
function pngSizeOf(file: DataView): { width: number; height: number } {
  return { width: file.getUint32(16), height: file.getUint32(20) }
}

/** An attribute value with its HTML character references decoded, as a browser reads it. */
function decodedOf(value: string): string {
  return value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|(amp|quot|apos|lt|gt));/gi,
    (_, decimal, hex, name) => {
      if (decimal !== undefined) return String.fromCodePoint(Number(decimal))
      if (hex !== undefined) return String.fromCodePoint(Number.parseInt(hex, 16))
      return (
        { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' }[(name as string).toLowerCase()] ?? ''
      )
    },
  )
}

/** Every `<meta>` on the page as its decoded attributes. */
function metasOf(html: string): Record<string, string>[] {
  return [...html.matchAll(/<meta\b[^>]*>/g)].map(([meta]) =>
    Object.fromEntries(
      [...meta.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, name = '', value = '']) => [
        name,
        decodedOf(value),
      ]),
    ),
  )
}

/** The content of every `<meta>` whose `name` or `property` is `key`. */
function metaContentsOf(html: string, key: string): string[] {
  return metasOf(html)
    .filter((meta) => meta.name === key || meta.property === key)
    .map((meta) => meta.content ?? '')
}

function titleOf(html: string): string {
  return decodedOf(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '')
}

/** An attribute's value in a tag's attribute text, decoded, or null when the tag has none. */
function attributeOf(attrs: string, name: string): string | null {
  const value = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1]
  return value === undefined ? null : decodedOf(value)
}

/**
 * The header's navigation split in two: the small screen's Menu panel, the element the Menu
 * button names, and the rest of the navigation, which holds the wide list.
 */
function siteNavOf(html: string): { wide: string; panel: string } {
  const nav = elementOf(elementOf(html, 'header'), 'nav')
  const menuButton = [...nav.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find(
    ([, , inner = '']) => textOf(inner) === 'Menu',
  )
  const panelId = attributeOf(menuButton?.[1] ?? '', 'aria-controls') ?? ''
  const panel = elementOf(nav, 'div', panelId)
  return { wide: panel ? nav.replace(panel, '') : nav, panel }
}

/** Each link in the markup, as the navigation test reads it. */
function navLinksOf(html: string) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attrs = '', inner = '']) => ({
    text: textOf(inner),
    href: attributeOf(attrs, 'href'),
    target: attributeOf(attrs, 'target'),
    rel: attributeOf(attrs, 'rel'),
    label: attributeOf(attrs, 'aria-label'),
    // Lucide's external link icon, by its arrow's path, hidden from the accessibility tree.
    externalLinkIcon: /<svg class="icon" aria-hidden="true"[^>]*>[\s\S]*?d="M15 3h6v6"/.test(inner),
  }))
}

function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The text of every JSON-LD block on the page, as written. A script element's content is raw
 * text, so nothing in it is an HTML character reference, and `JSON.parse` reads it as it is.
 */
function jsonLdBlocksOf(html: string): string[] {
  return [
    ...html.matchAll(/<script\b[^>]*\btype="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
  ].map(([, json = '']) => json)
}

function locsOf(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(([, loc = '']) => decodedOf(loc))
}

const clientIdInTheEnv = 'a-client-id-left-in-the-build-env'

beforeAll(async () => {
  // The spec's test seam builds the site with a dummy OpenPanel API URL, the way the image build
  // always sets one.
  vi.stubEnv('VITE_OPENPANEL_API_URL', 'https://openpanel.invalid')
  // A client ID left in the build's env, which the build must never carry (creator-analytics#575).
  vi.stubEnv('VITE_OPENPANEL_CLIENT_ID', clientIdInTheEnv)
  // The image build passes the GlitchTip DSN to the site's build too, so its policy names both hosts.
  vi.stubEnv('VITE_GLITCHTIP_DSN', 'https://public-key@glitchtip.invalid/1')
  // The fixture release notes, so every page rule below covers the release pages too.
  siteRoot = await builtSite(fixtureContentRoot)
})

afterAll(() => {
  vi.unstubAllEnvs()
})

describe('seam 1: the API serves the site', () => {
  test('every site page answers at its clean path', async ({ web }) => {
    const { origin } = await startApi(web, { siteRoot })

    for (const { path, file } of await pagesAtCleanPaths()) {
      const response = await fetch(`${origin}${path}`)

      expect({ path, status: response.status }).toEqual({ path, status: 200 })
      expect(await response.text()).toBe(await readFile(join(siteRoot, file), 'utf8'))
    }
  })

  test('a GET for a path with no page, outside /app, answers 404 with the not-found page', async ({
    web,
  }) => {
    const { origin } = await startApi(web, { siteRoot })

    for (const path of [
      notFoundPath,
      '/channels/connect',
      '/application',
      '/404',
      '/index',
      '/index.html',
      '/404.html',
    ]) {
      const response = await fetch(`${origin}${path}`)

      expect({ path, status: response.status }).toEqual({ path, status: 404 })
      expect(await response.text()).toBe(await readFile(join(siteRoot, '404.html'), 'utf8'))
    }
  })

  // Google approved OAuth verification (creator-analytics#254), so search engines may index the site.
  test('no site page carries a robots meta tag', async ({ web }) => {
    for (const { path, html } of (await servedSite(web)).pages) {
      expect({ path, robots: html.includes('<meta name="robots"') }).toEqual({
        path,
        robots: false,
      })
    }
  })

  test('no site page contains an em-dash', async ({ web }) => {
    for (const { path, html } of (await servedSite(web)).pages) {
      expect({ path, emDash: html.includes('—') }).toEqual({ path, emDash: false })
    }
  })

  // Stripe allows a donation only for a charitable purpose, and Stillstats takes tips (#338).
  test('no site page contains "donat"', async ({ web }) => {
    for (const { path, html } of (await servedSite(web)).pages) {
      expect({ path, donat: /donat/i.test(html) }).toEqual({ path, donat: false })
    }
  })

  // Google approved Stillstats's OAuth verification on 2026-10-26 (#34). A verified app gets
  // neither Google's unverified-app warning at connection nor its 100-user cap.
  test("no site page tells a visitor about Google's unverified-app warning or its 100-user cap", async ({
    web,
  }) => {
    const aboutUnverifiedApp = (sentence: string) =>
      (/\bGoogle\b/.test(sentence) && /\b(?:verif|warn)/i.test(sentence)) ||
      /\b100 (?:creators|people|users)\b/i.test(sentence)

    for (const { path, html } of (await servedSite(web)).pages) {
      const sentences = textOf(html).split(/(?<=[.?!])\s+/)

      expect({ path, claims: sentences.filter(aboutUnverifiedApp) }).toEqual({ path, claims: [] })
    }
  })

  test('every sign-in button on a site page has the agreement notice beside it', async ({
    web,
  }) => {
    const { pages } = await servedSite(web)

    const buttonsOn = (html: string) =>
      [...html.matchAll(/<button\b[^>]*>\s*Sign in with Google\s*<\/button>/g)].length
    expect(buttonsOn(homepageOf(pages))).toBeGreaterThan(0)
    for (const { path, html } of pages) {
      const notices = [
        ...html.matchAll(/Sign in with Google\s*<\/button>([\s\S]*?Privacy Policy\s*<\/a>)/g),
      ].map(([, notice = '']) => notice)

      expect({ path, notices: notices.length }).toEqual({ path, notices: buttonsOn(html) })
      for (const notice of notices) {
        expect(notice).toContain('<a href="/terms">Terms</a>')
        expect(notice).toContain('<a href="/privacy">Privacy Policy</a>')
      }
    }
  })

  // `/application` and `/apiary` are site 404s whose paths start with the web app's and the API's.
  test('no response the site serves carries X-Robots-Tag', async ({ web }) => {
    const { origin } = await startApi(web, { siteRoot })
    const requests: [string, RequestInit][] = [
      ...(await pagesAtCleanPaths()).map(({ path }): [string, RequestInit] => [path, {}]),
      [notFoundPath, {}],
      [notFoundPath, { method: 'POST' }],
      ['/og-image.png', {}],
      ['/favicon.svg', {}],
      ['/robots.txt', {}],
      ['/sitemap.xml', {}],
      ['/application', {}],
      ['/apiary', {}],
    ]

    for (const [path, init] of requests) {
      const response = await fetch(`${origin}${path}`, init)

      expect({ path, robots: response.headers.get('x-robots-tag') }).toEqual({
        path,
        robots: null,
      })
    }
  })

  // The web app's entry page is a signed-out sign-in shell and the API answers JSON: neither holds
  // anything a searcher wants.
  test('every response from the web app and the API carries X-Robots-Tag: noindex', async ({
    web,
  }) => {
    const { origin } = await startApi(web, { siteRoot })
    const requests: [string, RequestInit][] = [
      ['/app', {}],
      ['/app/', {}],
      ['/app/channels', {}],
      ['/health', {}],
      ['/api/me', {}],
      ['/api/auth/callback/google?code=forged&state=forged', { redirect: 'manual' }],
      ['/api/no-such-route', {}],
    ]

    for (const [path, init] of requests) {
      const response = await fetch(`${origin}${path}`, init)

      expect({ path, robots: response.headers.get('x-robots-tag') }).toEqual({
        path,
        robots: 'noindex',
      })
    }
  })
})

describe('seam 1: the page shell', () => {
  // The two user data policies are the ones the Limited Use statements name: Google's for OAuth
  // verification, the Chrome Web Store's for the extension's listing (creator-analytics#100).
  test('the footer on every site page links /principles, /privacy, /terms and both user data policies', async ({
    web,
  }) => {
    const required = [
      '/principles',
      '/privacy',
      '/terms',
      'https://developers.google.com/terms/api-services-user-data-policy',
      'https://developer.chrome.com/docs/webstore/program-policies/limited-use',
    ]

    for (const { path, html } of (await servedSite(web)).pages) {
      const footer = elementOf(html, 'footer')
      const links = required.filter((href) => footer.includes(`href="${href}"`))

      expect({ path, links }).toEqual({ path, links: required })
    }
  })

  // A rule over the page list, so a tool page added later needs its footer link too.
  test('the footer on every site page links every tool page the site serves', async ({ web }) => {
    const toolPaths = (await pagesAtCleanPaths())
      .map(({ path }) => path)
      .filter((path) => path.startsWith('/tools/'))

    expect(toolPaths.length).toBeGreaterThan(0)
    for (const { path, html } of (await servedSite(web)).pages) {
      const footer = elementOf(html, 'footer')
      const links = toolPaths.filter((href) => footer.includes(`href="${href}"`))

      expect({ path, links }).toEqual({ path, links: toolPaths })
    }
  })

  test('every site page links a favicon the API serves as SVG', async ({ web }) => {
    const { origin, pages } = await servedSite(web)

    for (const { path, html } of pages) {
      const icons = hrefsOf(html, 'icon')

      expect({ path, linksAnIcon: icons.length > 0 }).toEqual({ path, linksAnIcon: true })
      for (const href of icons) {
        const icon = await fetch(new URL(href, origin))

        expect({ path, href, status: icon.status, type: icon.headers.get('content-type') }).toEqual(
          { path, href, status: 200, type: expect.stringContaining('image/svg+xml') },
        )
      }
    }
  })

  // creator-analytics#888: the header holds the wordmark, the site's navigation and the avatar's
  // place, in that order, so the avatar stays at the right end.
  test("every site page's header holds the wordmark, one navigation named Site, and one empty avatar place last", async ({
    web,
  }) => {
    for (const { path, html } of (await servedSite(web)).pages) {
      const header = elementOf(html, 'header')
      const places = [...html.matchAll(/<[^>]*\bdata-avatar-place\b[^>]*>/g)]
      const navs = [...header.matchAll(/<nav\b([^>]*)>/g)].map(([, attrs = '']) =>
        attributeOf(attrs, 'aria-label'),
      )

      expect({ path, places: places.length, navs }).toEqual({ path, places: 1, navs: ['Site'] })
      expect({ path, header }).toEqual({
        path,
        header: expect.stringMatching(
          /^<header class="site-header">\s*<a class="wordmark"[^>]*>[^<]*<\/a>\s*<nav\b[\s\S]*<\/nav>\s*<([a-z]+)\b[^>]*\bdata-avatar-place\b[^>]*><\/\1>\s*<\/header>$/,
        ),
      })
    }
  })

  // The links the navigation shows wide, and the same four in the small screen's Menu panel, in
  // order. site-nav.test.ts holds the header's new-tab names to the web app's own helper and the
  // Mid-Roll Manager link to the web app's free tools list, which this file's Node types cannot
  // import, so the two apps cannot drift.
  const navLinks = [
    { text: 'Thumbnail preview', href: '/tools/thumbnail-preview', newTab: false },
    { text: 'Mid-Roll Manager', href: 'https://nlvogel.com/tools/mid-roll-manager', newTab: true },
    {
      text: 'Stillstats for Chrome',
      href: 'https://chromewebstore.google.com/detail/dmfiepibjgpmholeacigjgejjgohdnhm',
      newTab: true,
    },
    {
      text: 'Stillstats for Firefox',
      href: 'https://addons.mozilla.org/en-US/firefox/addon/stillstats/',
      newTab: true,
    },
  ].map(({ text, href, newTab }) => ({
    text,
    href,
    target: newTab ? '_blank' : null,
    rel: newTab ? 'noopener' : null,
    label: newTab ? `${text} (opens in a new tab)` : null,
    externalLinkIcon: newTab,
  }))

  test("the header's navigation links each place by its href, and each new-tab link carries the web app's new-tab name and the external link icon, in the wide list and in the Menu panel alike", async ({
    web,
  }) => {
    for (const { path, html } of (await servedSite(web)).pages) {
      const { wide, panel } = siteNavOf(html)

      expect({ path, wide: navLinksOf(wide) }).toEqual({ path, wide: navLinks })
      expect({ path, panel: navLinksOf(panel) }).toEqual({ path, panel: navLinks })
    }
  })

  test("the header's Extensions and Menu buttons start closed, each naming the hidden element it opens", async ({
    web,
  }) => {
    for (const { path, html } of (await servedSite(web)).pages) {
      const nav = elementOf(elementOf(html, 'header'), 'nav')
      const buttons = [...nav.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(
        ([, attrs = '', inner = '']) => {
          const controls = attributeOf(attrs, 'aria-controls') ?? ''
          const controlled = new RegExp(`<[a-z]+\\b[^>]*\\bid="${controls}"[^>]*>`).exec(nav)?.[0]
          return {
            text: textOf(inner),
            type: attributeOf(attrs, 'type'),
            expanded: attributeOf(attrs, 'aria-expanded'),
            controlsHidden: controlled !== undefined && /\shidden[\s>=]/.test(controlled),
          }
        },
      )

      expect({ path, buttons }).toEqual({
        path,
        buttons: ['Extensions', 'Menu'].map((text) => ({
          text,
          type: 'button',
          expanded: 'false',
          controlsHidden: true,
        })),
      })
    }
  })

  test('the tool page marks its two header links to itself as the current page, and no other page and no footer link carries aria-current', async ({
    web,
  }) => {
    for (const { path, html } of (await servedSite(web)).pages) {
      const current = [...elementOf(html, 'header').matchAll(/<a\b([^>]*)>/g)]
        .filter(([, attrs = '']) => attributeOf(attrs, 'aria-current') !== null)
        .map(
          ([, attrs = '']) => `${attributeOf(attrs, 'href')} ${attributeOf(attrs, 'aria-current')}`,
        )

      expect({ path, current }).toEqual({
        path,
        current:
          path === '/tools/thumbnail-preview'
            ? ['/tools/thumbnail-preview page', '/tools/thumbnail-preview page']
            : [],
      })
      expect({ path, footer: elementOf(html, 'footer').includes('aria-current') }).toEqual({
        path,
        footer: false,
      })
    }
  })

  testWithoutDatabase(
    "the avatar place is the avatar's size, and its block margins take back what it adds over the wordmark's height, so the header keeps its height when the avatar shows (creator-analytics#157)",
    async () => {
      const own = await siteOwnSheet()
      const shared = await visualSystemSheet()
      const avatar = valueIn(shared, '.avatar', 'height')
      const wordmark = valueIn(shared, '.wordmark', 'font-size')

      expect(avatar).toBeDefined()
      expect(valueIn(shared, '.avatar', 'width')).toBe(avatar)
      expect(valueIn(shared, '.wordmark', 'line-height')).toBe('1')
      expect(valueIn(own, '.site-header .wordmark', 'font-size')).toBeUndefined()
      expect(valueIn(own, '.avatar-place', 'width')).toBe(avatar)
      expect(valueIn(own, '.avatar-place', 'height')).toBe(avatar)
      expect(valueIn(own, '.avatar-place', 'margin-block')).toBe(
        `calc((${wordmark} - ${avatar}) / 2)`,
      )
    },
  )

  testWithoutDatabase(
    "the link that takes a sign-in button's place keeps its label on one line, so pinned to the button's width it keeps the button's height (creator-analytics#157)",
    async () => {
      expect(valueIn(await siteOwnSheet(), 'a.button', 'white-space')).toBe('nowrap')
    },
  )

  test('no site page loads a script, stylesheet or font from another origin', async ({ web }) => {
    const { origin, pages } = await servedSite(web)
    const css = await servedLinks(origin, pages, 'stylesheet')

    for (const { path, html } of pages) {
      const loads = [...html.matchAll(/<(?:script|link|img|iframe)\b[^>]*>/g)]
        // A canonical link names the page's address on the product origin and loads nothing.
        .filter(([tag]) => !tag.includes('rel="canonical"'))
        .flatMap(([tag]) => /\b(?:src|href)="([^"]+)"/.exec(tag)?.[1] ?? [])
      const offOrigin = loads.filter((url) => new URL(url, origin).origin !== origin)

      expect({ path, offOrigin }).toEqual({ path, offOrigin: [] })
    }
    expect(css).not.toMatch(/url\(\s*["']?(?:https?:)?\/\//)
    expect(css).not.toMatch(/@import/)
  })
})

describe('seam 1: the content security policy', () => {
  /** Every content security policy meta tag on the page, each as its directives by name. */
  function policiesOf(html: string): Record<string, string>[] {
    return metasOf(html)
      .filter((meta) => meta['http-equiv'] === 'Content-Security-Policy')
      .map(({ content = '' }) =>
        Object.fromEntries(
          content.split(';').map((directive) => {
            const [name = '', ...sources] = directive.trim().split(/\s+/)
            return [name, sources.join(' ')]
          }),
        ),
      )
  }

  // The HTML standard's JavaScript MIME type essences. A script of any other type, such as an
  // application/ld+json block, is a data block the browser never runs and no policy checks.
  const javaScriptType =
    /^(?:(?:application|text)\/(?:x-)?(?:java|ecma)script|text\/(?:javascript1\.[0-5]|jscript|livescript))$/i

  /** Every script tag the browser would run from the page's own text, not from a file. */
  function inlineScriptsOf(html: string): string[] {
    return [...html.matchAll(/<script\b[^>]*>/g)]
      .map(([tag]) => tag)
      .filter((tag) => !/\ssrc=/.test(tag))
      .filter((tag) => {
        const type = /\stype="([^"]*)"/.exec(tag)?.[1]?.trim()
        return !type || type === 'module' || javaScriptType.test(type)
      })
  }

  test('every site page carries one policy, before any script and any stylesheet', async ({
    web,
  }) => {
    for (const { path, html } of (await servedSite(web)).pages) {
      const policyAt = html.indexOf('http-equiv="Content-Security-Policy"')
      // A meta policy governs only what the page loads after it.
      const loadsAt = [...html.matchAll(/<script\b|<link\b[^>]*\brel="stylesheet"/g)].map(
        ({ index }) => index,
      )

      expect({ path, policies: policiesOf(html).length }).toEqual({ path, policies: 1 })
      expect({ path, loadsBefore: loadsAt.filter((at) => at < policyAt) }).toEqual({
        path,
        loadsBefore: [],
      })
    }
  })

  test("every site page's policy allows only the site's own origin by default and for styles and fonts, scripts from the site's origin and YouTube's player API host, and no plugin", async ({
    web,
  }) => {
    for (const { path, html } of (await servedSite(web)).pages) {
      const [policy = {}] = policiesOf(html)
      const { 'default-src': defaultSrc, 'script-src': scriptSrc } = policy
      const { 'style-src': styleSrc, 'font-src': fontSrc } = policy
      const { 'object-src': objectSrc, 'base-uri': baseUri } = policy

      expect({ path, defaultSrc, scriptSrc, styleSrc, fontSrc, objectSrc, baseUri }).toEqual({
        path,
        defaultSrc: "'self'",
        scriptSrc: "'self' https://www.youtube.com",
        styleSrc: "'self'",
        fontSrc: "'self'",
        objectSrc: "'none'",
        baseUri: "'self'",
      })
    }
  })

  test("every site page's policy connects only to the site and the OpenPanel and GlitchTip hosts the build names", async ({
    web,
  }) => {
    for (const { path, html } of (await servedSite(web)).pages) {
      const connectSrc = policiesOf(html)[0]?.['connect-src']

      expect({ path, connectSrc }).toEqual({
        path,
        connectSrc: "'self' https://openpanel.invalid https://glitchtip.invalid",
      })
    }
  })

  const toolPagePath = '/tools/thumbnail-preview'

  // ADR 0021: the tool shows a creator's own files through object URLs, which are blob: URLs.
  test("the tool page's policy allows blob: images, and no other site page's policy, the 404's included, names blob:", async ({
    web,
  }) => {
    const { pages } = await servedSite(web)
    const toolPage = pages.find(({ path }) => path === toolPagePath)?.html ?? ''
    const otherPages = pages.filter(({ path }) => path !== toolPagePath)

    expect(policiesOf(toolPage)[0]?.['img-src']?.split(' ')).toContain('blob:')
    expect(otherPages.map(({ path }) => path)).toContain(notFoundPath)
    for (const { path, html } of otherPages) {
      const policy = JSON.stringify(policiesOf(html))

      expect({ path, policy: policy.length > 2, blob: policy.includes('blob:') }).toEqual({
        path,
        policy: true,
        blob: false,
      })
    }
  })

  test('every site page but the tool page carries one policy, the tool page that policy with blob: added to img-src and no other directive different, and neither names the OpenPanel client ID', async ({
    web,
  }) => {
    const { pages } = await servedSite(web)
    const [toolPagePolicy = {}] = policiesOf(
      pages.find(({ path }) => path === toolPagePath)?.html ?? '',
    )
    const policies = pages
      .filter(({ path }) => path !== toolPagePath)
      .map(({ html }) => policiesOf(html)[0])
    const [first = {}] = policies

    expect(policies.length).toBeGreaterThan(1)
    expect(policies.every((policy) => JSON.stringify(policy) === JSON.stringify(first))).toBe(true)
    expect(toolPagePolicy).toEqual({ ...first, 'img-src': `${first['img-src']} blob:` })
    expect(JSON.stringify([first, toolPagePolicy])).not.toContain(clientIdInTheEnv)
  })

  test("no site page has an inline script or an inline style, which the policy's script-src and style-src 'self' would block", async ({
    web,
  }) => {
    for (const { path, html } of (await servedSite(web)).pages) {
      const inlineStyles = [
        ...[...html.matchAll(/<[^>]*\sstyle\s*=[^>]*>/g)].map(([tag]) => tag),
        ...[...html.matchAll(/<style\b[^>]*>/g)].map(([tag]) => tag),
      ]

      expect({ path, inlineScripts: inlineScriptsOf(html), inlineStyles }).toEqual({
        path,
        inlineScripts: [],
        inlineStyles: [],
      })
    }
  })
})

describe("the build's OpenPanel client (creator-analytics#575)", () => {
  testWithoutDatabase(
    'holds no client ID, which the API answers at load, so one build serves staging and production',
    async () => {
      const files = (await readdir(siteRoot, { recursive: true, withFileTypes: true })).filter(
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

describe('seam 1: what a page tells a search engine and a link preview', () => {
  /** Every page but the not-found page, as the API serves it at its clean path. */
  async function pagesWithPreviews(web: WebDatabase): Promise<{
    origin: string
    pages: { path: string; html: string }[]
  }> {
    const { origin, pages } = await servedSite(web)
    return { origin, pages: pages.filter(({ path }) => path !== notFoundPath) }
  }

  test('every page but the 404 has exactly one non-empty meta description', async ({ web }) => {
    const { pages } = await pagesWithPreviews(web)

    expect(pages.length).toBeGreaterThan(0)
    for (const { path, html } of pages) {
      const descriptions = metaContentsOf(html, 'description')

      expect({ path, descriptions }).toEqual({ path, descriptions: [expect.stringMatching(/\S/)] })
    }
  })

  test('every page but the 404 has one canonical URL, the product origin plus the clean path it is served at', async ({
    web,
  }) => {
    for (const { path, html } of (await pagesWithPreviews(web)).pages) {
      expect({ path, canonical: hrefsOf(html, 'canonical').map(decodedOf) }).toEqual({
        path,
        canonical: [`${productOrigin}${path}`],
      })
    }
  })

  test("og:url, og:title and og:description are the page's canonical URL, title and description", async ({
    web,
  }) => {
    for (const { path, html } of (await pagesWithPreviews(web)).pages) {
      expect({
        path,
        url: metaContentsOf(html, 'og:url'),
        title: metaContentsOf(html, 'og:title'),
        description: metaContentsOf(html, 'og:description'),
      }).toEqual({
        path,
        url: hrefsOf(html, 'canonical').map(decodedOf),
        title: [titleOf(html)],
        description: metaContentsOf(html, 'description'),
      })
    }
  })

  test('the preview image is absolute on the product origin with alt text, shown as a large card, and no twitter:site is named', async ({
    web,
  }) => {
    for (const { path, html } of (await pagesWithPreviews(web)).pages) {
      const images = metaContentsOf(html, 'og:image')
      const alts = metaContentsOf(html, 'og:image:alt')

      expect({ path, origins: images.map((image) => new URL(image).origin) }).toEqual({
        path,
        origins: [productOrigin],
      })
      expect({ path, alts }).toEqual({ path, alts: [expect.stringMatching(/\S/)] })
      expect({
        path,
        twitterAlts: metaContentsOf(html, 'twitter:image:alt'),
        card: metaContentsOf(html, 'twitter:card'),
        site: metaContentsOf(html, 'twitter:site'),
      }).toEqual({ path, twitterAlts: alts, card: ['summary_large_image'], site: [] })
    }
  })

  // 1200 by 630 is the preview image size the spec on #253 sets.
  test('the preview image the API serves is a PNG of the type, width and height every page declares, 1200 by 630', async ({
    web,
  }) => {
    const { origin, pages } = await pagesWithPreviews(web)

    for (const { path, html } of pages) {
      const [image = ''] = metaContentsOf(html, 'og:image')
      const response = await fetch(new URL(new URL(image).pathname, origin))
      const declared = {
        type: metaContentsOf(html, 'og:image:type'),
        width: metaContentsOf(html, 'og:image:width').map(Number),
        height: metaContentsOf(html, 'og:image:height').map(Number),
      }
      const { width, height } = pngSizeOf(new DataView(await response.arrayBuffer()))

      expect({ path, status: response.status, declared }).toEqual({
        path,
        status: 200,
        declared: {
          type: [response.headers.get('content-type')],
          width: [width],
          height: [height],
        },
      })
      expect({ path, width, height }).toEqual({ path, width: 1200, height: 630 })
    }
  })

  test('the 404 page has no canonical URL and no og: or twitter: tags', async ({ web }) => {
    const { pages } = await servedSite(web)
    const notFound = pages.find(({ path }) => path === notFoundPath)?.html ?? ''
    const previewKeys = metasOf(notFound)
      .flatMap((meta) => [meta.name ?? '', meta.property ?? ''])
      .filter((key) => /^(?:og|twitter):/.test(key))

    expect(notFound).toContain('<title>')
    expect({ canonical: hrefsOf(notFound, 'canonical'), previewKeys }).toEqual({
      canonical: [],
      previewKeys: [],
    })
  })
})

describe('seam 1: the homepage structured data', () => {
  test('the homepage holds exactly one JSON-LD block, and it parses', async ({ web }) => {
    const blocks = jsonLdBlocksOf(homepageOf((await servedSite(web)).pages))

    expect(blocks).toHaveLength(1)
    expect(JSON.parse(blocks[0] ?? '')).toEqual(expect.any(Object))
  })

  /** The homepage's one JSON-LD block, parsed. */
  async function homepageStructuredData(web: WebDatabase): Promise<{
    html: string
    data: { '@graph'?: Record<string, unknown>[] }
  }> {
    const html = homepageOf((await servedSite(web)).pages)
    const [block = '{}'] = jsonLdBlocksOf(html)
    return { html, data: JSON.parse(block) }
  }

  // The values are the graph creator-analytics#271 sets: the operating entity, and the free tier
  // as an offer of 0, a string, as schema.org writes a price. The Studio extension's node holds the
  // two store listings creator-analytics#100 published, and its name is the manifest's, which is the
  // name each store lists (creator-analytics#290).
  test('the homepage graph names Stillstats as a web application, the Studio extension in its two stores, its operator and its site, linked by @id', async ({
    web,
  }) => {
    const { data } = await homepageStructuredData(web)
    const organization = { '@id': `${productOrigin}/#organization` }

    expect(data['@graph']).toHaveLength(4)
    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${productOrigin}/#organization`,
          name: 'Stillstats',
          legalName: 'MIDLO WEB DESIGN, LLC',
          url: `${productOrigin}/`,
        },
        {
          '@type': 'WebSite',
          '@id': `${productOrigin}/#website`,
          name: 'Stillstats',
          url: `${productOrigin}/`,
          publisher: organization,
        },
        {
          '@type': 'WebApplication',
          '@id': `${productOrigin}/#application`,
          name: 'Stillstats',
          url: `${productOrigin}/`,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          image: `${productOrigin}/og-image.png`,
          screenshot: `${productOrigin}/app-screenshot.webp`,
          publisher: organization,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        },
        {
          '@type': 'SoftwareApplication',
          '@id': `${productOrigin}/#extension`,
          name: manifestOf({ browser: 'chrome', mode: 'production' }).name,
          url: `${productOrigin}/`,
          applicationCategory: 'BrowserApplication',
          operatingSystem: 'Chrome, Firefox',
          installUrl: [
            'https://chromewebstore.google.com/detail/dmfiepibjgpmholeacigjgejjgohdnhm',
            'https://addons.mozilla.org/en-US/firefox/addon/stillstats/',
          ],
          publisher: organization,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        },
      ],
    })
  })

  test("the web application's description is the homepage's meta description", async ({ web }) => {
    const { html, data } = await homepageStructuredData(web)
    const application = data['@graph']?.find((node) => node['@type'] === 'WebApplication')
    const descriptions = metaContentsOf(html, 'description')

    expect(descriptions).toHaveLength(1)
    expect(application?.description).toBe(descriptions[0])
  })

  /** Every key and the value under it, at every depth of a parsed JSON value. */
  function entriesOf(value: unknown): [string, unknown][] {
    if (Array.isArray(value)) return value.flatMap(entriesOf)
    if (typeof value !== 'object' || value === null) return []
    return Object.entries(value).flatMap((entry) => [entry, ...entriesOf(entry[1])])
  }

  // A rating may come only from real reviews, so there is none to state (creator-analytics#253).
  test('the structured data states no rating and no review', async ({ web }) => {
    const keys = entriesOf((await homepageStructuredData(web)).data).map(([key]) => key)

    expect(keys.length).toBeGreaterThan(0)
    expect(keys.filter((key) => key === 'aggregateRating' || key === 'review')).toEqual([])
  })

  // The store listings are the one place the graph leaves the product origin (creator-analytics#290).
  test('every URL in the homepage graph is absolute, on the product origin or its store, and unchanged by encoding it again', async ({
    web,
  }) => {
    const graph = (await homepageStructuredData(web)).data['@graph']
    const urlsUnder = (keys: string[]): string[] =>
      entriesOf(graph)
        .filter(([key]) => keys.includes(key))
        .flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
        .map(String)
    const productUrls = urlsUnder(['@id', 'url', 'image', 'screenshot'])
    const storeUrls = urlsUnder(['installUrl'])
    const storeOrigins = ['https://chromewebstore.google.com', 'https://addons.mozilla.org']

    expect(productUrls.length).toBeGreaterThan(0)
    for (const url of productUrls) {
      expect({ url, origin: new URL(url).origin, encoded: new URL(url).href }).toEqual({
        url,
        origin: productOrigin,
        encoded: url,
      })
    }
    expect(storeUrls.map((url) => new URL(url).origin)).toEqual(storeOrigins)
    for (const url of storeUrls) {
      expect({ url, protocol: new URL(url).protocol, encoded: new URL(url).href }).toEqual({
        url,
        protocol: 'https:',
        encoded: url,
      })
    }
  })

  // Google asks that markup describe what a reader can see, so the page links every store the
  // graph installs from. The expectation is the served graph's, never the build's list. Copy is
  // held by Nick's approval on creator-analytics#478, so nothing here reads the block's words.
  test('the homepage shows the Studio extension its graph marks up: a block between the differentiators points and the privacy points links each store the extension installs from, in the graph order', async ({
    web,
  }) => {
    const { html, data } = await homepageStructuredData(web)
    const extension = data['@graph']?.find((node) => node['@type'] === 'SoftwareApplication')
    const installUrl = Array.isArray(extension?.installUrl) ? extension.installUrl : []
    const block = elementOf(html, 'div', 'extension')
    const links = [...block.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map(([, href = '']) =>
      decodedOf(href),
    )
    const differentiators = elementOf(html, 'section', 'differentiators')
    const [heading, extensionBlock, proofHeading] = [
      'id="differentiators-heading"',
      'id="extension"',
      'class="proof-heading"',
    ].map((marker) => differentiators.indexOf(marker))

    expect(installUrl.length).toBeGreaterThan(0)
    expect(block).not.toBe('')
    expect(links).toEqual(installUrl)
    expect(heading).toBeGreaterThanOrEqual(0)
    expect(extensionBlock).toBeGreaterThan(heading ?? -1)
    expect(proofHeading).toBeGreaterThan(extensionBlock ?? -1)
  })

  test('no page but the homepage and the tool page carries a JSON-LD block', async ({ web }) => {
    const { pages } = await servedSite(web)
    const withStructuredData = ['/', '/tools/thumbnail-preview']

    expect(pages.length).toBeGreaterThan(withStructuredData.length)
    for (const { path, html } of pages.filter(({ path }) => !withStructuredData.includes(path))) {
      expect({ path, blocks: jsonLdBlocksOf(html) }).toEqual({ path, blocks: [] })
    }
  })
})

describe('seam 1: what a crawler reads', () => {
  /** Each `field: value` line of a robots.txt, trimmed, the field as written. */
  function robotsLinesOf(text: string): { field: string; value: string }[] {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.includes(':'))
      .map((line) => {
        const at = line.indexOf(':')
        return { field: line.slice(0, at).trim(), value: line.slice(at + 1).trim() }
      })
  }

  test('/robots.txt answers as plain text, allows / for every user agent, and names the sitemap', async ({
    web,
  }) => {
    const { origin } = await startApi(web, { siteRoot })
    const response = await fetch(`${origin}/robots.txt`)
    const lines = robotsLinesOf(await response.text())
    const everyAgent = lines.findIndex(
      ({ field, value }) => field.toLowerCase() === 'user-agent' && value === '*',
    )
    const groupEnd = lines.findIndex(
      ({ field }, index) => index > everyAgent && field.toLowerCase() === 'user-agent',
    )
    const everyAgentRules = lines.slice(everyAgent + 1, groupEnd === -1 ? undefined : groupEnd)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/plain')
    expect(everyAgent).toBeGreaterThanOrEqual(0)
    expect(everyAgentRules).toContainEqual({ field: 'Allow', value: '/' })
    expect(everyAgentRules.filter(({ field }) => field.toLowerCase() === 'disallow')).toEqual([])
    expect(lines.filter(({ field }) => field.toLowerCase() === 'sitemap')).toEqual([
      { field: 'Sitemap', value: `${productOrigin}/sitemap.xml` },
    ])
  })

  test('/sitemap.xml answers as XML listing exactly the canonical URL of every page but the 404, with no lastmod', async ({
    web,
  }) => {
    const { origin } = await startApi(web, { siteRoot })
    const response = await fetch(`${origin}/sitemap.xml`)
    const xml = await response.text()
    // A plain string sort puts `/` first and the rest in name order, the order the spec on #270
    // gives, so this pins the order as well as the list.
    const canonicalUrls = (await pagesAtCleanPaths())
      .map(({ path }) => path)
      .sort()
      .map((path) => `${productOrigin}${path}`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('xml')
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(locsOf(xml)).toEqual(canonicalUrls)
    expect(xml).not.toMatch(/<(?:lastmod|changefreq|priority)\b/)
  })
})

describe('seam 1: the visual system', () => {
  test('every font the stylesheet names answers as a font', async ({ web }) => {
    const { origin, pages } = await servedSite(web)
    const fonts = fontUrlsIn(await servedLinks(origin, pages, 'stylesheet'))

    expect(fonts.length).toBeGreaterThan(0)
    expect(await responsesTo(origin, fonts)).toEqual(
      fonts.map((url) => ({ url, status: 200, type: 'font/woff2' })),
    )
  })

  test('every font licence answers at /fonts/ with its text', async ({ web }) => {
    const { origin } = await startApi(web, { siteRoot })
    // The visual system's licences, and the thumbnail preview package's for its Roboto.
    const licences = [
      ...(await fontLicenceFiles()),
      ...(await fontLicenceFiles(thumbnailPreviewFonts)),
    ]

    expect(licences.map(({ name }) => name)).toContain('LICENSE-roboto-OFL.txt')
    for (const { name, text } of licences) {
      const response = await fetch(`${origin}/fonts/${name}`)

      expect({ name, status: response.status, text: await response.text() }).toEqual({
        name,
        status: 200,
        text,
      })
    }
  })

  test('every colour the favicon writes sits a clear distance from anthropic.com and Plausible colours', async ({
    web,
  }) => {
    const { origin, pages } = await servedSite(web)
    const colours = coloursIn(await servedLinks(origin, pages, 'icon'))

    expect(colours.length).toBeGreaterThan(0)
    for (const { written, oklab } of colours) {
      expect({ written, tooClose: avoidedColoursNear(oklab) }).toEqual({ written, tooClose: [] })
    }
  })

  testWithoutDatabase(
    "the site's own sheet writes no colour: every colour comes from a visual system token",
    async () => {
      const css = await siteOwnSheet()

      expect(declarationsIn(css).length).toBeGreaterThan(0)
      expect(coloursIn(css).map(({ written }) => written)).toEqual([])
    },
  )
})

describe('the dev server', () => {
  testWithoutDatabase('every font the stylesheet names answers as a font', async () => {
    const server = await createServer({
      root: siteDirectory,
      logLevel: 'silent',
      server: { port: 0, host: '127.0.0.1' },
    })
    onTestFinished(() => server.close())
    await server.listen()
    const [origin = ''] = server.resolvedUrls?.local ?? []
    const fonts = fontUrlsIn(await (await fetch(new URL('/src/styles.css?direct', origin))).text())

    expect(fonts.length).toBeGreaterThan(0)
    expect(await responsesTo(origin, fonts)).toEqual(
      fonts.map((url) => ({ url, status: 200, type: 'font/woff2' })),
    )
  })
})

describe('seam 1: the homepage', () => {
  /** The homepage's sections by id, in the order the page shows them. */
  function sectionIdsOf(html: string): string[] {
    return [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map(([, id = '']) => id)
  }

  test('the sections run hero, differentiators, comparison, pricing, principles', async ({
    web,
  }) => {
    const html = homepageOf((await servedSite(web)).pages)

    expect(sectionIdsOf(html)).toEqual([
      'hero',
      'differentiators',
      'comparison',
      'pricing',
      'principles',
    ])
  })

  // Limits: this test proves the hero serves an image, not that the image shows the app. No tool
  // here can see what an image shows, so Nick checks that the screenshot is of the app at /app.
  // The image is the signed-in channel screen with a made-up sample channel (#39, ADR 0009), which
  // `pnpm --filter @creator-analytics/site screenshot` retakes from test/screenshot/.
  test('the hero shows a screenshot of the app the API serves and the sign-in button', async ({
    web,
  }) => {
    const { origin, pages } = await servedSite(web)
    const hero = elementOf(homepageOf(pages), 'section', 'hero')
    const screenshots = [...hero.matchAll(/<img\b[^>]*>/g)].map(([img]) => img)

    expect(screenshots).toHaveLength(1)
    const [screenshot = ''] = screenshots
    expect(screenshot).toMatch(/\balt="[^"]+"/)
    const src = /\bsrc="([^"]+)"/.exec(screenshot)?.[1] ?? ''
    const image = await fetch(new URL(src, origin))
    expect({ src, status: image.status, type: image.headers.get('content-type') }).toEqual({
      src,
      status: 200,
      type: 'image/webp',
    })
    expect({
      width: Number(/\bwidth="(\d+)"/.exec(screenshot)?.[1]),
      height: Number(/\bheight="(\d+)"/.exec(screenshot)?.[1]),
    }).toEqual(webpSizeOf(new DataView(await image.arrayBuffer())))
    expect(hero).toMatch(/<button\b[^>]*\bdata-sign-in\b[^>]*>\s*Sign in with Google\s*<\/button>/)
  })

  // ADR 0009 asks for the sample data label. Its wording is held by approval, not here.
  test('the screenshot has a caption under it', async ({ web }) => {
    const hero = elementOf(homepageOf((await servedSite(web)).pages), 'section', 'hero')
    const figure = elementOf(hero, 'figure')

    expect(figure).toMatch(/^<figure\b[^>]*>\s*<img\b[^>]*\bsrc="\/app-screenshot\.webp"/)
    expect(textOf(elementOf(figure, 'figcaption'))).not.toBe('')
    expect(figure).toMatch(/<\/figcaption>\s*<\/figure>$/)
  })

  // creator-analytics#790: the price is the one ADR 0022 sets, $7 a month or $70 a year. The paid
  // card names both, so no billing toggle is needed, and the free card names none.
  test("pricing shows two tier cards of one kind, Pro's monthly and annual price, no 'Coming later' and no billing toggle", async ({
    web,
  }) => {
    const pricing = await homepageSection(web, 'pricing')
    const cards = [...pricing.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/g)]

    expect(cards).toHaveLength(2)
    // creator-analytics#913: the paid card's heading is the tier's name, Pro.
    expect(
      cards.map(([, , body = '']) => textOf(/<h3\b[^>]*>([\s\S]*?)<\/h3>/.exec(body)?.[1] ?? '')),
    ).toEqual(['Free', 'Pro'])
    const [freeClass, paidClass] = cards.map(
      ([, attributes = '']) => /\bclass="([^"]*)"/.exec(attributes)?.[1] ?? '',
    )
    expect(freeClass).not.toBe('')
    expect(freeClass).toBe(paidClass)
    const [freeText = '', paidText = ''] = cards.map(([, , body = '']) => textOf(body))
    expect({
      freePrice: /[$€£]\s*\d/.test(freeText),
      monthly: /\$7 a month/.test(paidText),
      annual: /\$70 a year/.test(paidText),
      comingLater: /coming later|no price yet/i.test(textOf(pricing)),
    }).toEqual({ freePrice: false, monthly: true, annual: true, comingLater: false })
    expect(pricing).not.toMatch(/<(?:input|select)\b|role="switch"/)
  })

  // creator-analytics#907: the Pro card's "Subscribe" opens the upgrade screen in the web app,
  // which signs a visitor in first when needed, so it is a plain link and needs no agreement
  // notice of its own: the web app's sign-in screen carries it.
  test("the Pro card holds one Subscribe link to the web app's upgrade screen, and the Free card none", async ({
    web,
  }) => {
    const pricing = await homepageSection(web, 'pricing')
    const [free = '', paid = ''] = [
      ...pricing.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g),
    ].map(([, body = '']) => body)
    const linksIn = (card: string) =>
      [...card.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attributes = '', text = '']) => ({
        href: /\bhref="([^"]*)"/.exec(attributes)?.[1],
        tracked: /\bdata-upgrade-link\b/.test(attributes),
        text: textOf(text),
      }))

    expect({ free: linksIn(free), paid: linksIn(paid) }).toEqual({
      free: [],
      paid: [{ href: '/app/upgrade', tracked: true, text: 'Subscribe' }],
    })
  })

  // A limit of up to some number of videos. The rest of the Pro copy's "up to" counts days of
  // history or channels.
  const comparedVideosLimit = /\bup to (\d+)\b[^.,]*?\bvideos\b/g

  // creator-analytics#952: Pro draws up to `maxComparedCurves` of a channel's stored audience
  // retention curves on one chart (#951). The line's words rest on Nick's approval on the epic's PR.
  test("the Pro card's limit on compared videos is the one the comparison enforces", async ({
    web,
  }) => {
    const pricing = await homepageSection(web, 'pricing')
    const [, paid = ''] = [...pricing.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].map(
      ([, body = '']) => body,
    )
    const limits = [...paid.matchAll(/<li>([\s\S]*?)<\/li>/g)].flatMap(([, item = '']) =>
      [...textOf(item).matchAll(comparedVideosLimit)].map(([, count]) => Number(count)),
    )

    expect(limits).toEqual([maxComparedCurves])
  })

  // creator-analytics#945: the repackaging view's item, word for word, a draft for Nick's approval
  // on the epic's PR. It sits after the impressions and click-through rate item it builds on.
  test('the Pro card lists the repackaging view right after the impressions and click-through rate item, with no em-dash', async ({
    web,
  }) => {
    const pricing = await homepageSection(web, 'pricing')
    const paid =
      /<article\b[^>]*\baria-labelledby="plan-paid"[^>]*>[\s\S]*?<\/article>/.exec(pricing)?.[0] ??
      ''
    const items = [...paid.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(([, item = '']) =>
      textOf(item),
    )

    expect(items.slice(-4, -2)).toEqual([
      "Impressions and click-through rate beside engaged views, in your summary, charts, video list and traffic sources, and in a video's sponsor report",
      'Your video list sorted by click-through rate or impressions, for all traffic sources or just one, without videos under a minimum number of impressions',
    ])
    expect(textOf(paid)).not.toContain('\u2014')
  })

  test('the principles summary links /principles', async ({ web }) => {
    const principles = await homepageSection(web, 'principles')

    expect(principles).toContain('href="/principles"')
  })

  // creator-analytics#790: the FAQ, in the footer of every page, answers the Pro question
  // with the price ADR 0022 sets, and by the spec on #5 never says YouTube deletes the creator's
  // history. Only the Reporting API's files expire (ADR 0006), so no sentence of the answer says
  // what YouTube holds, keeps or deletes: with impressions and click-through rate beside it, any
  // such sentence reads as YouTube losing the creator's own numbers.
  test("the FAQ's Pro answer names the monthly and annual price and the 60 days it starts with, no 'no price yet' and never says what YouTube holds or deletes", async ({
    web,
  }) => {
    const footer = elementOf(homepageOf((await servedSite(web)).pages), 'footer')
    const answers = [...footer.matchAll(/<details>([\s\S]*?)<\/details>/g)]
      .map(([, details = '']) => textOf(details))
      .filter((details) => /Stillstats Pro/.test(details))

    expect(answers).toHaveLength(1)
    const [answer = ''] = answers
    expect({
      monthly: /\$7 a month/.test(answer),
      annual: /\$70 a year/.test(answer),
      sixtyDays: /\b60 days\b/.test(answer),
      noPriceYet: /no price yet/i.test(answer),
      youtubeKeepsOrDeletes:
        /\bYouTube\b[^.]*\b(?:hold|keep|delet|eras|remov|expir|los|drop|purg)\w*/i.test(answer),
    }).toEqual({
      monthly: true,
      annual: true,
      sixtyDays: true,
      noPriceYet: false,
      youtubeKeepsOrDeletes: false,
    })
  })

  // creator-analytics#952: Pro draws up to `maxComparedCurves` of a channel's stored audience
  // retention curves on one chart (#951). The answer's words rest on Nick's approval on the epic's
  // PR.
  test("the FAQ's Pro answer's limit on compared videos is the one the comparison enforces", async ({
    web,
  }) => {
    const footer = elementOf(homepageOf((await servedSite(web)).pages), 'footer')
    const [answer = ''] = [...footer.matchAll(/<details>([\s\S]*?)<\/details>/g)]
      .map(([, details = '']) => textOf(details))
      .filter((details) => /Stillstats Pro/.test(details))
    const limits = [...answer.matchAll(comparedVideosLimit)].map(([, count]) => Number(count))

    expect(limits).toEqual([maxComparedCurves])
  })

  // creator-analytics#945: the repackaging view's sentence, word for word, a draft for Nick's
  // approval on the epic's PR. It sits in the one Pro answer, after the impressions and
  // click-through rate sentence and before the history's.
  test("the FAQ's Pro answer names the repackaging view after impressions and click-through rate and before the history, with no em-dash", async ({
    web,
  }) => {
    const footer = elementOf(homepageOf((await servedSite(web)).pages), 'footer')
    const [answer = ''] = [...footer.matchAll(/<details>([\s\S]*?)<\/details>/g)]
      .map(([, details = '']) => textOf(details))
      .filter((details) => /Stillstats Pro/.test(details))
    const sentences = answer.split(/(?<=\.)\s+/)
    const at = sentences.indexOf(
      'Your video list sorts by click-through rate or impressions, for all traffic sources or just one, and hides videos under a minimum number of impressions you set.',
    )

    expect(at).toBeGreaterThan(0)
    expect(sentences[at - 1]).toMatch(/^Your impressions and click-through rate show beside/)
    expect(sentences.findIndex((sentence) => / history starts /.test(sentence))).toBeGreaterThan(at)
    expect(answer).not.toContain('\u2014')
  })
})

describe('seam 1: the privacy policy and the terms', () => {
  // Limits: these tests prove each page carries the links it must, that the Studio extension
  // section names the manifest's hosts, the required ones and the optional one asked for on request,
  // and that the policy and the terms make the tip disclosures #338's spec requires: Stripe and what
  // it receives in the sharing section, the tip event in the analytics section, and the tip clause
  // with its refund window in the terms' Price section. The tip tests hold the facts each
  // disclosure names, inside its own section, not its sentences. The hosts come from
  // the source `manifestOf`, which is what WXT writes into the build; the extension's manifest test
  // holds the built manifest to it (#137). The rest of the wording (the global rule
  // `tests-state-a-rule`), and whether the policy's claims (the scopes, the stored data, the cookies, the encryption,
  // the retention windows) match what the code does, rest on Nick's copy approval on #5, #29, #61, #98,
  // #120, #202, #338, #488, #539, #582, #657, #691, #732, #779, #790 and #950. The feedback message tests hold
  // the facts its two items name, not their sentences, and so do the reach report tests (#779), the
  // Pro tests (#790) and the thumbnail preview tool's analytics test (#732), which holds the
  // facts its sentence names. The Studio extension section's tests hold the sentences
  // #488 and #539 approve, word for word, but for its usage events sentence: a fact test holds that
  // every popup link with a click event goes to the host the section says a link click is sent for,
  // and the rest of the events that sentence names rest on that approval (#751). Whether the events
  // it names are the ones the extension sends rests on the extension's event tests, and whether the activity record is kept as the policy says rests on the API's and
  // the worker's tests (#640). The youtube.com paragraph's other claims (it reads only links on the
  // page and its address, sends no video id from the page, reads no number and uses no YouTube
  // sign-in) rest on that approval and on the public page surfaces' boundary scan and seam tests
  // (#138 to #141, #520), not on this file. The footer links the same policies on every page, so these tests read each page's
  // own <main> alone.

  async function pageAt(web: WebDatabase, path: string): Promise<string> {
    const { origin } = await startApi(web, { siteRoot })
    const response = await fetch(`${origin}${path}`)

    expect({ path, status: response.status }).toEqual({ path, status: 200 })
    return response.text()
  }

  async function privacyMain(web: WebDatabase): Promise<string> {
    return elementOf(await pageAt(web, '/privacy'), 'main')
  }

  test('the privacy policy links both user data policies, the Google Privacy Policy and the Google security permissions page', async ({
    web,
  }) => {
    const main = await privacyMain(web)
    const required = [
      'https://developers.google.com/terms/api-services-user-data-policy',
      'https://developer.chrome.com/docs/webstore/program-policies/limited-use',
      'https://www.google.com/policies/privacy',
      'https://security.google.com/settings/security/permissions',
    ]

    expect(required.filter((href) => !main.includes(`href="${href}"`))).toEqual([])
  })

  /** A page's section with this heading, from its <h2> to the next <h2>, or ''. */
  function sectionOf(main: string, heading: string): string {
    const start = main.indexOf(`<h2>${heading}</h2>`)
    if (start === -1) return ''
    const next = main.indexOf('<h2', start + 1)
    return main.slice(start, next === -1 ? undefined : next)
  }

  test("the privacy policy's Studio extension section names every host the shipped extension asks for", async ({
    web,
  }) => {
    const text = textOf(sectionOf(await privacyMain(web), 'The Studio extension'))
    const hosts = hostOriginsOf('production').map((origin) => new URL(origin).hostname)

    expect(hosts).toEqual(['studio.youtube.com', 'stillstats.com'])
    expect(hosts.filter((host) => !text.includes(host))).toEqual([])
  })

  test.for(['chrome', 'firefox'] as const)(
    "the privacy policy's Studio extension section names every host the %s extension asks for on request",
    async (browser, { web }) => {
      const text = textOf(sectionOf(await privacyMain(web), 'The Studio extension'))
      const optional: string[] =
        manifestOf({ browser, mode: 'production' }).optional_host_permissions ?? []
      const hosts = optional.map((origin) => new URL(origin).hostname)

      expect(hosts).toEqual(['www.youtube.com'])
      expect(hosts.filter((host) => !text.includes(host))).toEqual([])
    },
  )

  // Every popup state's links, in the production build. A link with a click event sends a usage
  // event when the creator clicks it, so the section must say so for that link's host (#751).
  test("the privacy policy's Studio extension section says a click on the popup's links to their host sends a usage event", async ({
    web,
  }) => {
    const text = textOf(sectionOf(await privacyMain(web), 'The Studio extension'))
    const reads: PopupRead[] = [
      { state: 'signed-in', channels: [listedChannel({})] },
      { state: 'signed-in', channels: [] },
      { state: 'signed-out' },
      { state: 'failed' },
      { state: 'host-access-missing' },
    ]
    const clicked = reads
      .map((read) => popupViewOf({ read, origin: apiOriginOf('production'), youtubeAccess: false }))
      .flatMap((view) => Object.values(view))
      .filter((part): part is PopupLink => typeof part === 'object' && 'href' in part)
      .flatMap(({ href, clickEvent }) => (clickEvent ? [{ href, event: clickEvent.name }] : []))
    const hosts = [...new Set(clicked.map(({ href }) => new URL(href).hostname))]

    expect(new Set(clicked.map(({ event }) => event))).toContain('extension_popup_feedback_opened')
    expect(hosts).toEqual(['stillstats.com'])
    expect(
      hosts.filter(
        (host) =>
          !new RegExp(`click[^.]*\\blinks?\\b[^.]*${host.replaceAll('.', '\\.')}`).test(text),
      ),
    ).toEqual([])
  })

  // The sentences Nick approved word for word on #488 and #539, on 2026-11-11.
  test("the privacy policy's Studio extension section says where the extension works, and says no video id from a youtube.com page leaves the browser", async ({
    web,
  }) => {
    const text = textOf(sectionOf(await privacyMain(web), 'The Studio extension'))
    const approved = [
      'The Stillstats extension for Chrome and Firefox works on studio.youtube.com and stillstats.com, and on www.youtube.com only if you turn that on.',
      'It does not read the numbers, text or anything else on the page.',
      `If you turn on "Show engaged views on youtube.com" in the extension's popup, the extension also works on www.youtube.com. There it reads the links to videos and channels on the page, and the page address. It asks Stillstats for the videos of the channels you connected, with your Stillstats sign-in, and matches them on your device, so no video id from www.youtube.com leaves your browser. It reads no number from the page, and does not use your YouTube sign-in. You can turn it off in the popup or in your browser's extension settings.`,
    ]

    expect(approved.filter((sentence) => !text.includes(sentence))).toEqual([])
    expect({
      worksOnlyOnStudio: /works only on/.test(text),
      readsNoOtherSite: /does not read any other site/.test(text),
    }).toEqual({ worksOnlyOnStudio: false, readsNoOtherSite: false })
  })

  test("the privacy policy's sharing section names Stripe and what Stripe receives", async ({
    web,
  }) => {
    const text = textOf(sectionOf(await privacyMain(web), 'How Stillstats shares your data'))
    const facts = ['Stripe', "Stripe's page", 'account ID', 'tip']

    expect(facts.filter((fact) => !text.includes(fact))).toEqual([])
  })

  // The tip link carries the account ID as client_reference_id (#338), so opening it sends the ID
  // to Stripe before any payment, and a creator who cancels on Stripe's page has sent it too.
  test("the privacy policy's sharing section says Stripe receives the account ID from the tip link, even with no tip", async ({
    web,
  }) => {
    const text = textOf(sectionOf(await privacyMain(web), 'How Stillstats shares your data'))

    expect({
      opensLink: /open the tip link/.test(text),
      evenWithoutPaying: /even if you do not pay/.test(text),
      claimsTipOnly: /only when you choose to tip|If you never tip/.test(text),
    }).toEqual({ opensLink: true, evenWithoutPaying: true, claimsTipOnly: false })
  })

  // creator-analytics#790: Checkout and the Customer Portal are Stripe's own pages, opened by a
  // redirect that carries the channel's ID and, for a returning channel, its earlier Stripe customer
  // (#780, #787), and Stripe sells Pro as the merchant of record (ADR 0022).
  test("the privacy policy's sharing section names Stripe for Pro, what Checkout receives and Stripe as the merchant of record", async ({
    web,
  }) => {
    const text = textOf(sectionOf(await privacyMain(web), 'How Stillstats shares your data'))
    const facts = [
      /Stillstats Pro/,
      /Checkout/,
      /Customer Portal/,
      /channel's Stillstats ID/,
      /earlier Stripe customer/,
      /\bStripe\b[^,.]*\bmerchant of record/,
      /Managed Payments/,
    ]

    expect(facts.filter((fact) => !affirms(text, fact))).toEqual([])
  })

  // creator-analytics#794: the site's tool page sends the thumbnail preview tool's events, so the
  // analytics section says the site records them, and that none carries what the creator loads or
  // types. `ThumbnailToolEvent`'s closed property types are what hold the events to that.
  // creator-analytics#888: a click on a link in the site's navigation sends `site_nav_clicked`, so
  // the same sentence names those clicks.
  // creator-analytics#907: a click on the Pro card's "Subscribe" sends `upgrade_link_clicked`, so
  // the same sentence names that click too.
  test("the privacy policy's analytics section says the site records the thumbnail preview tool's actions and the clicks on the sign-in button, Pro's Subscribe button and the navigation's links, and no tool event carries an image, a file name or a title", async ({
    web,
  }) => {
    const text = textOf(sectionOf(await privacyMain(web), 'Product analytics and error reports'))

    expect({
      toolActions: /actions in the thumbnail preview tool/.test(text),
      noImageNameOrTitle: /No tool event carries an image, a file name or a title/.test(text),
      onlyPageViewsAndSignIn: /records page views and clicks on the sign-in button\./.test(text),
      siteClicks:
        /clicks on the sign-in button, on Stillstats Pro's "Subscribe" button and on the links in the site's navigation/.test(
          text,
        ),
    }).toEqual({
      toolActions: true,
      noImageNameOrTitle: true,
      onlyPageViewsAndSignIn: false,
      siteClicks: true,
    })
  })

  // creator-analytics#589: the web app's profile screen became Settings. The policy tells a
  // creator where to act in the web app, so it names that screen as the web app's menu and heading
  // do, and it says "profile" only of the Google profile picture, as the web app has no profile.
  test("the privacy policy names the web app's settings screen by the web app's own name, and says profile only of a profile picture", async ({
    web,
  }) => {
    const text = textOf(await privacyMain(web))
    const named = [...text.matchAll(new RegExp(`(\\S+) ${settingsName}\\b`, 'g'))]

    expect(named.length).toBeGreaterThan(0)
    expect(named.map(([, before]) => before)).toEqual(named.map(() => 'in'))
    expect(text.match(/\bprofile\b(?! picture)/gi) ?? []).toEqual([])
  })

  // creator-analytics#691: the web app keeps a copy of the theme in the browser's local storage, so
  // the policy's device storage section names that copy by the key the app writes it under.
  test("the privacy policy's device storage section names the theme's copy by the web app's own key", async ({
    web,
  }) => {
    const section = sectionOf(await privacyMain(web), 'Cookies and device storage')

    expect(section).toContain(`<code>${themeCopyKey}</code>`)
  })

  /** The items of a section's list that mention a feedback message, as text. */
  function feedbackItemsOf(section: string): string[] {
    return [...section.matchAll(/<li>([\s\S]*?)<\/li>/g)]
      .map(([, item]) => textOf(item ?? ''))
      .filter((item) => /feedback message/i.test(item))
  }

  // creator-analytics#582: a feedback message is stored data, so the policy names it and what it
  // holds where it lists what Stillstats stores, and how long it stays where it lists the windows.
  // The facts, not the sentences, which wait on Nick's approval.
  test("the privacy policy's storage section names the feedback message and everything it holds, the reply address only by choice", async ({
    web,
  }) => {
    const [item = ''] = feedbackItemsOf(sectionOf(await privacyMain(web), 'What Stillstats stores'))
    const facts = [
      /\btype\b/,
      /\btext\b/,
      /\bscreen\b/,
      /\bversion\b/,
      /reply address only when you choose/,
    ]

    expect(facts.filter((fact) => !fact.test(item))).toEqual([])
  })

  test("the privacy policy's retention section keeps a feedback message until the account goes, or a year after it is handled", async ({
    web,
  }) => {
    const [item = ''] = feedbackItemsOf(
      sectionOf(await privacyMain(web), 'How long Stillstats keeps your data'),
    )
    const facts = [/delete your account/, /one year after it is handled/]

    expect(facts.filter((fact) => !fact.test(item))).toEqual([])
  })

  /** The items of a section's list that mention the daily reach report, as text. */
  function reachReportItemsOf(section: string): string[] {
    return [...section.matchAll(/<li>([\s\S]*?)<\/li>/g)]
      .map(([, item]) => textOf(item ?? ''))
      .filter((item) => /reach report/i.test(item))
  }

  // creator-analytics#779: connecting a channel asks YouTube to prepare its daily reach report, so
  // the policy says so where it lists what Stillstats accesses. The facts, not the sentences, which
  // wait on Nick's approval.
  test("the privacy policy's accesses section says Stillstats asks YouTube for a daily reach report of impressions and click-through rate for each connected channel", async ({
    web,
  }) => {
    const [item = ''] = reachReportItemsOf(
      sectionOf(await privacyMain(web), 'What Stillstats accesses'),
    )
    const facts = [
      /asks YouTube to prepare a daily reach report/,
      /each channel you connect/,
      /impressions/,
      /click-through rate/,
      /asks again each day until YouTube has it/,
    ]

    expect(facts.filter((fact) => !fact.test(item))).toEqual([])
    // A stored job is never checked at Google again, so the policy claims no daily check (#779 review).
    expect(item).not.toMatch(/checks once a day/)
  })

  test("the privacy policy's storage section names the reach report job's ID, and that the free tier stores nothing from the report", async ({
    web,
  }) => {
    const [item = ''] = reachReportItemsOf(
      sectionOf(await privacyMain(web), 'What Stillstats stores'),
    )
    const facts = [/\bID\b/, /free tier stores nothing from the report/]

    expect(facts.filter((fact) => !fact.test(item))).toEqual([])
  })

  /** The text of each item in a section's lists that matches `pattern`. */
  function itemsMatching(section: string, pattern: RegExp): string[] {
    return [...section.matchAll(/<li>([\s\S]*?)<\/li>/g)]
      .map(([, item]) => textOf(item ?? ''))
      .filter((item) => pattern.test(item))
  }

  /**
   * Each negation in `text` and the rest of its clause: to the sentence's end, or to a comma that
   * opens a new clause or an aside, so "no email, name, card or amount" is one negated span and
   * "no email, but it holds your name" is not.
   */
  function negatedSpansOf(text: string): [number, number][] {
    return [
      ...text.matchAll(
        /\b(?:no|not|never|nothing|none|nor|without)\b(?:[^,.;:!?]|,(?!\s+(?:and|but|so|which|while|until|an?|as)\b))*/gi,
      ),
    ].map(({ 0: span, index }) => [index, index + span.length])
  }

  /** The matches of `fact` in `text`, with where each starts. */
  function matchesOf(text: string, fact: RegExp): { match: string; index: number }[] {
    const every = new RegExp(fact.source, fact.flags.includes('g') ? fact.flags : `${fact.flags}g`)
    return [...text.matchAll(every)].map(({ 0: match, index }) => ({ match, index }))
  }

  /**
   * Whether `text` states `fact` and does not negate it: a match that holds a negation, or sits
   * inside a negation's clause ("with no refund of the unused part"), does not count. A bare
   * keyword test passes copy that states the opposite of the fact; this one does not.
   */
  function affirms(text: string, fact: RegExp): boolean {
    const negated = negatedSpansOf(text)
    return matchesOf(text, fact).some(
      ({ match, index }) =>
        !/\b(?:no|not|never|nothing|none|nor|without)\b/i.test(match) &&
        !negated.some(([start, end]) => index >= start && index < end),
    )
  }

  /** Whether `text` names `fact`, and only ever inside a negation's clause. */
  function denies(text: string, fact: RegExp): boolean {
    const negated = negatedSpansOf(text)
    const matches = matchesOf(text, fact)
    return (
      matches.length > 0 &&
      matches.every(({ index }) => negated.some(([start, end]) => index >= start && index < end))
    )
  }

  // creator-analytics#790: Pro stores a reach history at the grain `reach_history` holds
  // (#783: video, day and traffic source type, and the days in `reach_history_days`), and a
  // subscription row that holds the Stripe IDs, plan, status, period end and purge date and no
  // email, name, card or amount (#780, #787), with the Stripe invoice ID of each payment that
  // `subscription_payments` holds (creator-analytics#5). The facts, not the sentences, which wait
  // on Nick's approval.
  test("the privacy policy's storage section names a paid channel's reach history at its grain, and the subscription with what it never holds", async ({
    web,
  }) => {
    const section = sectionOf(await privacyMain(web), 'What Stillstats stores')
    const [history = ''] = itemsMatching(section, /reach history/i)
    const [subscription = ''] = itemsMatching(section, /Stripe customer/)

    expect(
      [
        /Stillstats Pro/,
        /impressions/,
        /click-through rate/,
        /each video/,
        /each day/,
        /traffic source type/,
        /which days/,
      ].filter((fact) => !affirms(history, fact)),
    ).toEqual([])
    expect(
      [
        /subscription ID/,
        /\bplan\b/,
        /status/,
        /end of the paid period/,
        /purge date/,
        /invoice ID of each payment/,
      ].filter((fact) => !affirms(subscription, fact)),
    ).toEqual([])
    expect(
      [/\bemail\b/, /\bname\b/, /\bcard\b/, /\bamount\b/].filter(
        (fact) => !denies(subscription, fact),
      ),
    ).toEqual([])
  })

  // creator-analytics#950: Pro stores each video's audience retention curve and when it was read
  // (`retention_curves` and `retention_curve_reads`), and the history purge deletes them with its
  // reach history. The test holds those facts; the sentence rests on Nick's approval on the epic's
  // PR.
  test("the privacy policy's storage section names a paid channel's retention curves, for each video, when each was read, and kept as long as the reach history", async ({
    web,
  }) => {
    const section = sectionOf(await privacyMain(web), 'What Stillstats stores')
    const [curves = ''] = itemsMatching(section, /audience retention curve/)

    expect(
      [
        /Stillstats Pro/,
        /each of its videos/,
        /when Stillstats read/,
        /as long as[^.]*reach history/,
      ].filter((fact) => !affirms(curves, fact)),
    ).toEqual([])
  })

  // creator-analytics#790: the history stays while the subscription is active and until the purge
  // date `purgeDateOf` sets after the subscription ends at its period's end (#787, #789), a return
  // before then keeps it and fills the gap (#789), a video deleted on YouTube loses its history at
  // the next daily check while a private or unlisted one keeps it (#786), and a deletion cancels and
  // refunds the subscription and keeps the Stripe subscription ID only until Stripe accepts (#784).
  // The audience retention curves share each of those windows (#950): the history purge, the
  // deleted video check and the channel cascade delete them with the history.
  test("the privacy policy's retention section names the history's purge window, the deleted video rule and what a deletion does to a subscription", async ({
    web,
  }) => {
    const endedAt = new Date('2026-11-01T00:00:00Z')
    const days = (purgeDateOf(endedAt).getTime() - endedAt.getTime()) / (24 * 60 * 60 * 1000)
    const section = sectionOf(await privacyMain(web), 'How long Stillstats keeps your data')
    const [history = ''] = itemsMatching(section, /reach history/i)
    const [deletedVideo = ''] = itemsMatching(section, /deleted on YouTube/)
    const [deletion = ''] = itemsMatching(section, /subscription ID/)

    expect(
      [
        /subscription is active/,
        /end of (?:its|the) paid period/,
        new RegExp(`\\b${days} days\\b`),
        /purge date[^.]*\bdeletes\b/,
        /subscribe again[^.]*\bkeeps\b/,
        /missing days/,
        /audience retention curves/,
      ].filter((fact) => !affirms(history, fact)),
    ).toEqual([])
    expect(history).toMatch(/not when you (?:press|click) Cancel/)
    expect(
      [
        /deleted on YouTube[^.]*next daily check/,
        /\b(?:private|unlisted)\b[^.]*\bkeeps\b/,
        /audience retention curve/,
      ].filter((fact) => !affirms(deletedVideo, fact)),
    ).toEqual([])
    expect(deletedVideo).toMatch(/private or unlisted/)
    expect(
      [
        /disconnect/,
        /revoke/,
        /delete your account/,
        /cancel/,
        /refund of the unused share of its latest payment/,
        /Stripe subscription ID only until\b[^.]*\baccepted/,
        /audience retention curves/,
      ].filter((fact) => !affirms(deletion, fact)),
    ).toEqual([])
  })

  // creator-analytics#790: a paid channel's daily run downloads its reach reports (#783), and the
  // deleted video check asks YouTube which of the history's videos still exist (#786).
  test("the privacy policy's accesses section says a paid channel's reach reports are downloaded each day, and which of its videos still exist is asked once a day", async ({
    web,
  }) => {
    const section = sectionOf(await privacyMain(web), 'What Stillstats accesses')
    const [item = ''] = itemsMatching(section, /Stillstats Pro/)
    const facts = [/downloads/, /reach reports?/, /each day/, /once a day[^.]*still exist/]

    expect(facts.filter((fact) => !affirms(item, fact))).toEqual([])
    expect(item).not.toMatch(/checks once a day/)
  })

  // creator-analytics#790: a disconnect and an account deletion each delete a channel, which
  // cancels its subscription and refunds the unused share of the latest invoice's amount paid
  // (#784, `subscription-cancellation.ts`), not of the period's price.
  test("the privacy policy's deleting section says Disconnect and Delete your account cancel a paid channel's subscription with a refund of the unused share of its latest payment", async ({
    web,
  }) => {
    const section = sectionOf(await privacyMain(web), 'Deleting your data and revoking access')
    const items = ['Disconnect a channel', 'Delete your account'].map(
      (action) => itemsMatching(section, new RegExp(`^${action}\\.`))[0] ?? '',
    )

    expect(
      items.map((item) =>
        [/cancel/, /refunds the unused share of its latest payment/].filter(
          (fact) => !affirms(item, fact),
        ),
      ),
    ).toEqual([[], []])
  })

  // creator-analytics#790: a Pro channel keeps analytics as history, so the cache item can no
  // longer say analytics are never kept as history without naming the free tier.
  test("the privacy policy's retention section says analytics are never kept as history only of the free tier", async ({
    web,
  }) => {
    const section = sectionOf(await privacyMain(web), 'How long Stillstats keeps your data')
    const [cache = ''] = itemsMatching(section, /cached for 24 hours or less/)

    expect(cache).toMatch(/free tier[^.]*\bnever keeps\b[^.]*\bhistory\b/)
    expect(affirms(cache, /Stillstats Pro[^.]*\bkeeps\b[^.]*\bhistory\b/)).toBe(true)
  })

  test('the privacy policy gives privacy@stillstats.com as the contact address', async ({
    web,
  }) => {
    expect(await privacyMain(web)).toMatch(
      /<a href="mailto:privacy@stillstats\.com"[^>]*>\s*privacy@stillstats\.com\s*<\/a>/,
    )
  })

  test("the terms' Price section carries the tip clause and its 30-day refund window", async ({
    web,
  }) => {
    const text = textOf(sectionOf(elementOf(await pageAt(web, '/terms'), 'main'), 'Price'))
    const facts = [
      /\btip\b/,
      /voluntary/,
      /no entitlement/i,
      /not count toward Stillstats Pro/,
      /30 days/,
      /privacy@stillstats\.com/,
      /nobody is charged without first choosing to pay/,
    ]

    expect(facts.filter((fact) => !fact.test(text))).toEqual([])
  })

  // creator-analytics#790: the terms state Pro's terms before the first paid sale. The
  // facts come from ADR 0022 (the price, the per-channel owner-only subscription, cancellation at
  // the end of the period, the refund on a deletion, Managed Payments, the failed payment, the kept
  // price, no trial), not from the copy, which waits on Nick's approval. The refund on a deletion
  // is the unused share of the latest invoice's amount paid (#784, `subscription-cancellation.ts`),
  // so a payment Stripe credit covered, as a switch between monthly and yearly can leave, refunds
  // less or nothing, and the deletion item says so.
  test("the terms' Price section names Pro's price, period, cancellation, refund rule and merchant of record", async ({
    web,
  }) => {
    const section = sectionOf(elementOf(await pageAt(web, '/terms'), 'main'), 'Price')
    const text = textOf(section)
    const [deletion = ''] = itemsMatching(section, /delete your account/)
    const facts = [
      /\$7 a month/,
      /\$70 a year/,
      /one channel/,
      /owner/,
      /renews/,
      /end of the (?:paid )?period/,
      /disconnect/,
      /revoke/,
      /delete your account/,
      /\bStripe\b[^,.]*\bmerchant of record/,
      /Managed Payments/,
      /\btax\b/,
      /failed payment/,
      /keeps its price[^.]*\bas long as\b[^.]*\bactive\b/,
    ]

    expect(facts.filter((fact) => !affirms(text, fact))).toEqual([])
    expect(text).toMatch(/no trial/)
    expect(text).not.toMatch(/no paid tier now/i)
    expect(
      [
        /cancelled at once/,
        /refund the unused share of your latest payment/,
        /monthly and yearly/,
      ].filter((fact) => !affirms(deletion, fact)),
    ).toEqual([])
    expect(deletion).toMatch(/credit is not refunded/)
    expect(deletion).toMatch(/can be nothing/)
  })

  test('the terms link the YouTube Terms of Service', async ({ web }) => {
    const main = elementOf(await pageAt(web, '/terms'), 'main')

    expect(main).toContain('href="https://www.youtube.com/t/terms"')
  })
})

describe('seam 1: the principles page', () => {
  async function principlesPage(web: WebDatabase): Promise<Response> {
    const { origin } = await startApi(web, { siteRoot })
    return fetch(`${origin}/principles`)
  }

  async function principlesText(web: WebDatabase): Promise<string> {
    return textOf(elementOf(await (await principlesPage(web)).text(), 'main'))
  }

  test('/principles answers 200', async ({ web }) => {
    expect((await principlesPage(web)).status).toBe(200)
  })

  // The footer on every page says "Privacy Policy" and "User Data Policy", so the rule reads
  // `<main>` only.
  test('/principles calls them principles and never a policy', async ({ web }) => {
    expect(await principlesText(web)).not.toMatch(/polic/i)
  })
})

describe('seam 1: the tool page', () => {
  const toolPagePath = '/tools/thumbnail-preview'

  /** The tool page as the API serves it, with the origin it was served from. */
  async function servedToolPage(
    web: WebDatabase,
  ): Promise<{ origin: string; status: number; html: string }> {
    const { origin } = await startApi(web, { siteRoot })
    const response = await fetch(`${origin}${toolPagePath}`)
    return { origin, status: response.status, html: await response.text() }
  }

  test('the API serves the tool page at its clean path, with its canonical URL, its sitemap entry and its link preview tags', async ({
    web,
  }) => {
    const { origin, status, html } = await servedToolPage(web)
    const canonical = `${productOrigin}${toolPagePath}`
    const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text()

    expect(status).toBe(200)
    expect(hrefsOf(html, 'canonical').map(decodedOf)).toEqual([canonical])
    expect(locsOf(sitemap)).toContain(canonical)
    expect(titleOf(html)).toMatch(/\S/)
    expect(metaContentsOf(html, 'description')).toEqual([expect.stringMatching(/\S/)])
    expect({
      url: metaContentsOf(html, 'og:url'),
      title: metaContentsOf(html, 'og:title'),
      description: metaContentsOf(html, 'og:description'),
      card: metaContentsOf(html, 'twitter:card'),
    }).toEqual({
      url: [canonical],
      title: [titleOf(html)],
      description: metaContentsOf(html, 'description'),
      card: ['summary_large_image'],
    })
  })

  test('the tool page holds exactly one JSON-LD block, and it parses', async ({ web }) => {
    const blocks = jsonLdBlocksOf((await servedToolPage(web)).html)

    expect(blocks).toHaveLength(1)
    expect(JSON.parse(blocks[0] ?? '')).toEqual(expect.any(Object))
  })

  // The tool's node is a free SoftwareApplication that runs on the web, published by the
  // Stillstats Organization, which the graph names with the homepage's own @id and values. Its URL
  // and description are the page's canonical URL and meta description, read from the served page.
  test("the tool page's graph names the tool as a free web application at the page's URL, with the page's description, published by the homepage's Stillstats Organization", async ({
    web,
  }) => {
    const { origin, html } = await servedToolPage(web)
    const homepage = await (await fetch(`${origin}/`)).text()
    const graphOf = (page: string): Record<string, unknown>[] =>
      JSON.parse(jsonLdBlocksOf(page)[0] ?? '{}')['@graph'] ?? []
    const organizationOf = (page: string) =>
      graphOf(page).find((node) => node['@type'] === 'Organization')
    const graph = graphOf(html)
    const organization = `${productOrigin}/#organization`

    expect(organizationOf(homepage)?.['@id']).toBe(organization)
    expect(graph).toHaveLength(2)
    expect(organizationOf(html)).toEqual(organizationOf(homepage))
    expect(graph.find((node) => node['@type'] === 'SoftwareApplication')).toEqual({
      '@type': 'SoftwareApplication',
      '@id': expect.any(String),
      name: 'Thumbnail preview',
      url: hrefsOf(html, 'canonical').map(decodedOf)[0],
      description: metaContentsOf(html, 'description')[0],
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@id': organization },
    })
  })

  // creator-analytics#889: the page renders the signed-out link, and main.ts points it at the
  // account once /api/me answers (main.test.ts holds the swap, the walk the layout).
  test('the built tool page\'s main opens with the back link, its arrow then "Home" to /, and the h1 follows it, and no other page holds a back link', async ({
    web,
  }) => {
    const { pages } = await servedSite(web)
    const html = pages.find(({ path }) => path === toolPagePath)?.html ?? ''
    const [, back = '', next = ''] =
      /<main\b[^>]*>\s*(<p class="tool-back">[\s\S]*?<\/p>)\s*(<[^>]+>)/.exec(html) ?? []
    const links = [...back.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
    const [, attrs = '', content = ''] = links[0] ?? []

    expect(links).toHaveLength(1)
    expect({
      href: attributeOf(attrs, 'href'),
      backLink: attrs.includes('data-back-link'),
    }).toEqual({ href: '/', backLink: true })
    expect(content).toMatch(
      /^<svg class="icon" aria-hidden="true"[^>]*>(?:(?!<\/svg>)[\s\S])*d="m12 19-7-7 7-7"[\s\S]*?<\/svg>/,
    )
    expect(textOf(content)).toBe('Home')
    expect(next).toMatch(/^<h1\b/)
    expect(
      pages
        .filter(({ path, html: page }) => path !== toolPagePath && page.includes('data-back-link'))
        .map(({ path }) => path),
    ).toEqual([])
  })

  /** The tool page's prose, the element after the tool's mount point, and everything inside it. */
  function proseOf(html: string): string {
    return /<div\b[^>]*\bclass="tool-prose"[^>]*>[\s\S]*?<\/div>/.exec(html)?.[0] ?? ''
  }

  // Ports nlvogel.com's copy gate legs (g), (g1) and (g3): a stale size in the prose, such as a
  // superseded 194 for the suggested rail's 220, must fail. A number before `%` is a percentage and
  // one beside `:` a ratio, neither a pixel claim. The floor fails a prose that lost its figures,
  // or a selector that found no prose. The allowed numbers are the package's measured sizes, so no
  // figure is restated here.
  test("every bare number in the tool page's prose is one of the tool's measured sizes", async ({
    web,
  }) => {
    const prose = textOf(proseOf((await servedToolPage(web)).html))
    const figures = [...prose.matchAll(/\b(\d+)\b/g)]
      .filter(({ index, 0: number }) => {
        const before = prose[index - 1] ?? ''
        const after = prose[index + number.length] ?? ''
        return after !== '%' && after !== ':' && before !== ':'
      })
      .map(([number]) => Number(number))

    expect(figures.length).toBeGreaterThanOrEqual(5)
    expect(figures.filter((figure) => !ALLOWED_COPY_NUMBERS.has(figure))).toEqual([])
  })

  // The rule is the prose's, as on nlvogel.com: the sign-in band after it carries a statement.
  test("every h2 in the tool page's prose is a question", async ({ web }) => {
    const prose = proseOf((await servedToolPage(web)).html)
    const headings = [...prose.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map(([, heading = '']) =>
      textOf(heading),
    )

    expect(headings.length).toBeGreaterThan(0)
    expect(headings.filter((heading) => !heading.endsWith('?'))).toEqual([])
  })

  test("the prose comes right after the tool's mount point, and opens with a paragraph", async ({
    web,
  }) => {
    const { html } = await servedToolPage(web)
    const [, next = '', firstChild = ''] =
      /<div\b[^>]*\bid="thumbnail-tool"[^>]*>\s*<\/div>\s*(<[^>]+>)\s*(<[^>]+>)/.exec(html) ?? []

    expect(next).toMatch(/^<div\b[^>]*\bclass="tool-prose"/)
    expect(firstChild).toMatch(/^<p\b/)
  })

  test("every URL in the tool page's graph is absolute on the product origin", async ({ web }) => {
    const graph: Record<string, unknown>[] =
      JSON.parse(jsonLdBlocksOf((await servedToolPage(web)).html)[0] ?? '{}')['@graph'] ?? []
    const urls = graph
      .flatMap((node) => [node['@id'], node.url, (node.publisher as { '@id'?: unknown })?.['@id']])
      .filter((url) => url !== undefined)
      .map(String)

    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) {
      expect({ url, origin: new URL(url).origin, encoded: new URL(url).href }).toEqual({
        url,
        origin: productOrigin,
        encoded: url,
      })
    }
  })
})

describe('seam 1: the release pages', () => {
  const { releases } = readReleaseContent(fixtureContentRoot)

  function footerLinksReleases(html: string): boolean {
    return elementOf(html, 'footer').includes('href="/releases/"')
  }

  /** A content root holding each file at its path, relative to the root. */
  async function contentRootWith(files: Record<string, string>): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'release-content-'))
    for (const [path, text] of Object.entries(files)) {
      await mkdir(join(root, path, '..'), { recursive: true })
      await writeFile(join(root, path), text)
    }
    return root
  }

  test('/releases/ and each release page answer 200 at their clean paths, among the pages every page rule reads', async ({
    web,
  }) => {
    const { origin } = await startApi(web, { siteRoot })
    const expected = ['/releases/', ...releases.map(({ path }) => path)]

    expect((await pagesAtCleanPaths()).map(({ path }) => path)).toEqual(
      expect.arrayContaining(expected),
    )
    for (const path of expected) {
      expect({ path, status: (await fetch(`${origin}${path}`)).status }).toEqual({
        path,
        status: 200,
      })
    }
  })

  test('the index links every release page, newest first, app and extension together', async ({
    web,
  }) => {
    const { pages } = await servedSite(web)
    const index = pages.find(({ path }) => path === '/releases/')?.html ?? ''
    const links = [...elementOf(index, 'main').matchAll(/\bhref="(\/releases\/[^"]+)"/g)].map(
      ([, href]) => href,
    )

    expect(new Set(releases.map(({ product }) => product))).toEqual(new Set(['app', 'extension']))
    expect(links).toEqual(releases.map(({ path }) => path))
  })

  test("a release page's description is its note's summary, and its main holds the note", async ({
    web,
  }) => {
    const { pages } = await servedSite(web)

    for (const { path, summary, html } of releases) {
      const page = pages.find((each) => each.path === path)?.html ?? ''

      expect({ path, descriptions: metaContentsOf(page, 'description') }).toEqual({
        path,
        descriptions: [summary],
      })
      expect({ path, holdsNote: elementOf(page, 'main').includes(html) }).toEqual({
        path,
        holdsNote: true,
      })
    }
  })

  test('with a release note, the footer on every site page links /releases/', async ({ web }) => {
    for (const { path, html } of (await servedSite(web)).pages) {
      expect({ path, linksReleases: footerLinksReleases(html) }).toEqual({
        path,
        linksReleases: true,
      })
    }
  })

  test('with no release note, the build emits no release page and no footer link, and /releases/ answers 404', async ({
    web,
  }) => {
    const root = await builtSite(await contentRootWith({}))
    const { origin, pages } = await servedSite(web, root)
    const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text()

    expect(
      (await readdir(root, { recursive: true })).filter((file) => file.startsWith('releases')),
    ).toEqual([])
    expect(sitemap).not.toContain('/releases')
    expect((await fetch(`${origin}/releases/`)).status).toBe(404)
    for (const { path, html } of pages) {
      expect({ path, linksReleases: footerLinksReleases(html) }).toEqual({
        path,
        linksReleases: false,
      })
    }
  })

  testWithoutDatabase(
    'a release note that breaks a rule fails the build, naming the file',
    async () => {
      const root = await contentRootWith({
        'notes/2026.11.09.md':
          '---\nproduct: app\ndate: 2026-11-09\nsummary: A fix.\nhighlights: []\nremoves: false\n---\n',
      })

      await expect(builtSite(root)).rejects.toThrow(/notes\/2026\.11\.09\.md/)
    },
  )
})

describe('the markdown parser', () => {
  // Limits: this reads for markdown-it's own error messages, so it would miss another markdown
  // parser, and a markdown-it release that rewords both messages. A library added to the site
  // still needs Nick's approval on its issue (ADR 0014), which names the parser it brings.
  testWithoutDatabase('no script or page the site build writes carries its code', async () => {
    const files = (await readdir(siteRoot, { recursive: true })).filter((file) =>
      /\.(?:js|html)$/.test(file),
    )
    const texts = await Promise.all(files.map((file) => readFile(join(siteRoot, file), 'utf8')))

    expect(files.some((file) => file.endsWith('.js'))).toBe(true)
    expect(
      files.filter((_, i) => markdownParserMarkers.some((marker) => texts[i]?.includes(marker))),
    ).toEqual([])
  })
})

describe('seam 1: the competitor comparison', () => {
  // Limits: these tests prove each claim names its competitor, links that competitor's own page
  // and shows a checked date. They cannot prove a claim still holds on the live page. Each dated
  // re-check, and Nick's copy approval, sit on issue #32.
  const sources = {
    'Social Blade': 'https://socialblade.com/info/terms',
    vidIQ: 'https://vidiq.com/privacy/',
    ViewStats: 'https://www.viewstats.com/privacy',
    // Morningfame publishes its privacy policy through iubenda, under its own company's name.
    Morningfame: 'https://www.iubenda.com/privacy-policy/51864814/legal',
  }
  const months =
    'January|February|March|April|May|June|July|August|September|October|November|December'
  const checkedDate = new RegExp(`Checked (?:${months}) \\d{1,2}, \\d{4}\\.$`)

  test('the comparison shows, under its own heading', async ({ web }) => {
    const comparison = await homepageSection(web, 'comparison')
    const [opening = ''] = /<section\b[^>]*>/.exec(comparison) ?? []

    expect(opening).not.toMatch(/\bhidden\b/)
    expect(opening).toContain('aria-labelledby="comparison-heading"')
    expect(comparison).toMatch(/<h2 id="comparison-heading">[^<]+<\/h2>/)
  })

  test('each competitor has one claim that links its own page and shows the date it was checked', async ({
    web,
  }) => {
    const claims = [
      ...(await homepageSection(web, 'comparison')).matchAll(
        /<article\b[^>]*>([\s\S]*?)<\/article>/g,
      ),
    ].map(([, claim = '']) => claim)

    expect(claims).toHaveLength(Object.keys(sources).length)
    for (const [competitor, source] of Object.entries(sources)) {
      const named = claims.filter((claim) => textOf(claim).startsWith(competitor))

      expect({ competitor, named: named.length }).toEqual({ competitor, named: 1 })
      const [claim = ''] = named
      expect({
        competitor,
        hrefs: [...claim.matchAll(/\bhref="([^"]+)"/g)].map(([, href]) => href),
      }).toEqual({ competitor, hrefs: [source] })
      expect({ competitor, text: textOf(claim) }).toEqual({
        competitor,
        text: expect.stringMatching(checkedDate),
      })
    }
  })

  test('the comparison makes no growth or ranking claim', async ({ web }) => {
    expect(textOf(await homepageSection(web, 'comparison'))).not.toMatch(
      /\b(?:grow|growth|rank|ranking|best|better|worse|worst|leading|number one|top)\b|#1\b/i,
    )
  })
})
