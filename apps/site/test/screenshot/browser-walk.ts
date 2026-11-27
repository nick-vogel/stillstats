// The browser walk (creator-analytics#361):
//
//   pnpm test:browser
//
// It builds the web app and the site with no OpenPanel or GlitchTip host, serves the builds from the
// stub API with the sample channel on a free port the system picks, so two runs never collide, and
// walks them in headless Chrome: every route, "What's new" with the web app's fixture highlights
// (creator-analytics#577), the site's release index and a release page from the same fixture notes
// (creator-analytics#567), the thumbnail preview tool page under its own policy, signed in and
// signed out in light and dark mode at the desktop width and at 375px (creator-analytics#793), with
// its sign-in band's button or dashboard link and agreement notice in each (creator-analytics#798),
// and its back link above the h1 in each, "Back to your account" to /app signed in and "Home" to /
// signed out, with the h1 at the same top in both, then at 1280px and 375px the tool from 2rem and
// 1rem of the window's edges to its width less that, the header across the window, the wordmark
// on the tool's left edge, the back link 1.5rem under the header and no sideways scroll, and the
// homepage's main column and header 68rem wide and centred at 1280px (creator-analytics#889),
// then its header's navigation signed in: at 1280px "Thumbnail preview" current, the wordmark, the
// links, the Extensions button and the avatar on one vertical centre, the Extensions menu opened
// and closed by a real press and a press outside, and by Enter, Tab onto its first link and Escape
// with focus back on its button, and at 375px the Menu button's panel with the four links, Tab
// onto its first link and closed by Escape with focus back on its button (creator-analytics#888),
// and in each mode a fixture loaded into slot A through the tool's file input, every landscape tile
// drawing it from a blob: URL at the size table's width, no sideways scroll, and the title field
// in the page's ink, which differs between the modes (creator-analytics#794), then in each mode
// "Shorts" pressed on the empty tool and the landscape fixture loaded, every Shorts tile at the
// size table's width and height with its "Cropped" marker, slot A's mismatch notice, and its
// "Switch to Landscape" clearing it (creator-analytics#795), then in each mode with the fixture
// loaded, grayscale on, the three conversions and back to colour, every tile and the chip gray
// through each, and a red-band pixel converted to each conversion's gray (creator-analytics#796),
// then in each mode with the fixture loaded, every duration badge on its tile's corner with and
// without a title, the "New" badge on the 220 tile, hidden and shown, and focus mode opened on the
// resolved surface across the whole window with the page around it, its back link among it,
// hidden and inert, its
// Background switched, and closed by its exit button and by Escape (creator-analytics#797),
// Settings with its Support section and its thanks line after
// Stripe's return to the old /app/profile, which lands on /app/settings (creator-analytics#411,
// #589), then the account menu open, the custom range's Popover in light and dark mode at the
// desktop width and at 375px (creator-analytics#687), its Calendar's months, a disabled day and
// two picked days applied (creator-analytics#690), a
// format set and a toast shown, whose centre against the screen's beside the open and the
// collapsed sidebar (creator-analytics#508), whose place on the screen and whose hold under the
// pointer it checks, then the stacked metric charts under a pointer, the keys and a tap
// (creator-analytics#369), a pen and a finger scroll that starts on a tapped chart
// (creator-analytics#396), and the audience retention pair under a pointer and the keys, each
// pair's cursor apart from the stacked charts' (creator-analytics#370), under a tap beside a point
// (creator-analytics#390) and a finger scroll (creator-analytics#396), then the launch chart under
// a pointer, at its nearest point in both directions, under the keys, a tap (creator-analytics#371)
// and a finger scroll (creator-analytics#396), then the Audience screen's cards in more than one
// column at the desktop width, in more at 2560px, and in one at 375px, at each as many columns as
// 18rem ones fit, no card taller than its content and each card in the column the packing by height
// assigns, in DOM order down each column (creator-analytics#711), its
// placeholder's places as wide as the cards while the DevTools Fetch domain holds its read, each
// card's left edge, top and height held when the numbers land on a second read of the page load at
// the desktop width and at 375px,
// as on the publish day every bar row and the delay note's top (creator-analytics#510), the screen beside the open
// sidebar wider than 76rem at 2560px and as wide at 3000px, and each note's place as tall as its
// note when the numbers land on the Audience screen and a video's, at 768px, 1280px, 1920px and
// 2560px beside the open and the collapsed sidebar (creator-analytics#477), the video's other
// sources note under its numbers table among them, on a saved revenue sources choice
// (creator-analytics#509), each Audience
// heading's place as tall as its heading, at 320px and 1440px too (creator-analytics#463), and
// each one-line section heading's place on a video's page as tall as its heading
// (creator-analytics#468), and its breakdowns' heading places as tall as their headings, wrapped or
// not, at 320px and 1440px too (creator-analytics#512), every Audience card's bar rows and a video's traffic sources rows as
// tall as their places from 320px to 1440px with the longest names YouTube answers
// (creator-analytics#511), and the date range bar inset, with its padding and rounded corners inside the screen's column, on the list's route, a
// video's page and the Audience screen (creator-analytics#350), then the chart cards on a 375px
// screen, each inside its plot at the first and last points (creator-analytics#397), the stacked
// charts' heights, engaged views at 10rem and each chart below it at 6rem with its axis labels and
// card inside its plot, and a chart shown alone at 375px at 10rem (creator-analytics#418), RPM as
// the fourth stacked chart, then the paid channel's impressions and CTR charts stacked after it at
// 6rem, each marking the history start inside its plot (creator-analytics#783), the video list's
// Impressions and CTR columns after Engaged views with its scroll box inside the page at 1280px
// and 375px, and a video's impressions and CTR by traffic source (creator-analytics#785), with its
// own as two cards under them and its "stored up to" line a caption with no tint at both widths
// (creator-analytics#1042), a free channel showing none of those cards, charts, columns or traffic sources and no sample
// (creator-analytics#915), and the upgrade screen with its pricing cards at the configured prices
// (creator-analytics#788, creator-analytics#913), the
// sidebar's "Upgrade" item at 1280px and in the header's Menu at 375px and the homepage's
// "Subscribe", signed in and signed out, each opening /app/upgrade (creator-analytics#907), the
// Menu's "Upgrade" in the on-accent ink on the accent fill on the upgrade screen (creator-analytics#918),
// under the same cursor, and the revenue card's RPM line taking a real press at 375px to show the
// RPM chart alone, whose card reads the sample channel's currency (creator-analytics#356), and the
// RPM line under the stuck date range bar on the list's route and a video's page, at 375px and on a
// desktop window too short to stack the charts, where the bar paints on top (creator-analytics#268), the
// stuck date range bar with nothing of the page showing through its four corners after "Next page"
// and on the channel and Audience screens scrolled by 400px (creator-analytics#461), the
// launch chart's card on a 375px screen, inside its plot's width at the first and last days with a
// long title cut short (creator-analytics#399), the engaged views card as tall as its placeholder,
// with its ratio line on one line at 1280px and wrapped at 800px (creator-analytics#242), then the
// sidebar's support item, its link and its hide button, at the desktop width after the list's
// route and at 375px (creator-analytics#413), and the sidebar's "Thumbnail preview" item, a link to
// the tool page in a new tab, last in the "Channel screens" nav after "What's new", never current,
// its text on one line and its 14px external link icon shown open, found collapsed with its
// tooltip on a real Tab focus and the external link icon gone, and at the column's minimum height
// (creator-analytics#799, #890). After the desktop one the sidebar, with a second
// channel listed, collapses to its icons from its button, its current link filled open and
// collapsed, shows the tooltip of a collapsed link, the support icon, the channel icon and the
// collapse button on a real Tab focus, and expands again; it keeps its place at the window's full
// height as the list scrolls by 2000px, with the collapse button at the window's bottom and the
// avatar as wide as it is tall beside the email; and at 375px the header is one row, the wordmark,
// the "Menu" button and the avatar, with no collapse button, and a real press on "Menu" opens its
// panel under the header with the sidebar's items in order, the support item's button reading
// "Hide", a real press on Audience there opens that screen and closes it, and Enter opens it again
// with Audience current, Tab moves onto its first link and Escape closes it with focus back on the
// button (creator-analytics#417, #476, #891). With the second channel listed, at 1280px the
// sidebar's channel picker shows the channel's handle and name each on one line with no ellipsis,
// and a real press opens its list, each option on the same two lines, none wrapped or cut
// (creator-analytics#531, #537); the account row shows "Settings" over the email, each on one line
// with no ellipsis, and a real press on its avatar, on each line and on its chevron opens the
// account menu (creator-analytics#590, #537); and at the column's minimum height the collapse
// button's bottom sits inside the window, and one pixel shorter the header shows with its Menu,
// whose panel holds the links (creator-analytics#531, #590, #891). While the DevTools Fetch domain
// holds the session read, at 1280px the sidebar shows busy with the wordmark and the avatar's
// place, and both hold still as the session lands, with no header at any point
// (creator-analytics#507). On a video's page, the video player loads with the screen: the fake
// YouTube player the stub serves from 'self', its frame on YouTube's privacy-enhanced host under
// the page's frame-src, the only request to YouTube, which a second DevTools session answers on
// every step so the walk never reaches YouTube, and once ready the frame alone fills its box
// (creator-analytics#645, #684). The box sits beside the audience retention pair at 1280px, the box
// and both plots inside the window together, and above the pair at 375px, at least 200 by 200
// pixels; beside the pair at 1280px and 2560px the box is at most 40rem wide and 1.5rem from the
// pair, and at 375px 1.5rem above its first plot (creator-analytics#685); and at 1280px a real
// click on the audience retention plot moves that fake player to the start of the clicked point's
// slice (creator-analytics#646, #686). At 1280px and 375px a Short's 9:16 box stops at 60% of the
// window's height, centred in its column (creator-analytics#648); a video that does not allow
// embedding shows its text and link in the box and asks YouTube for nothing
// (creator-analytics#649), as the channel and audience screens do (creator-analytics#684); and with
// the fake player playing at half the video's duration, the playhead shows on both audience
// retention plots at half their width (creator-analytics#647). The channel summary's upload marker
// row sits under the charts' axis and inside the window in light and dark mode at 1280px and 375px,
// and a real Right arrow moves focus along it to a marker that shows its tooltip
// (creator-analytics#281). Every plot there draws a faint line at each upload day inside its box,
// and at 1280px a second, aria-hidden row sits under the first plot with as many markers, while at
// 375px there is one row (creator-analytics#763). In the lifetime window at 375px, light and dark,
// markers on nearby days that would overlap join into "N uploads" tiles, no two marker boxes
// overlap, and every marker sits inside the window (creator-analytics#283). Last comes a line
// between every column of the numbers table and the video list in light and dark mode, the video
// list's fixed column keeping its line as the list scrolls sideways at 375px
// (creator-analytics#351), and the theme (creator-analytics#691): with a stored Dark on a light
// system and a stored Light on a dark system, the first frame already draws the chosen tokens while
// the preferences read is held, a real press in Settings applies at once and survives a reload, a
// reset goes back to the system, and the site follows the system whatever the app's copy says; and
// from the account menu (creator-analytics#692), real arrow keys reach its items in order, the
// Theme items among them, and a real press on Dark on a light system changes the page at once, and
// Settings then checks Dark. Then it visits every route again in dark mode, at a 375px phone width,
// and in both, through the DevTools Emulation domain, each visit's step naming its mode
// (creator-analytics#382). Neither support item step hides the item, which would take it off every
// screen after it. It fails on any content security policy violation, and says which route or state
// each came from. The build writes the policy into the page as a meta tag, so the stub, which sends
// no policy header, still serves the page under it.
//
// It catches a violation two ways: a `securitypolicyviolation` listener installed before the page
// loads, which calls a DevTools binding so each violation arrives at once, across navigations, and
// the browser's own `security` log. It also fails on a request the stub had no answer for, and on
// a step that cannot reach its state, so a step that silently did nothing cannot pass. It prints
// the bundle's JS and CSS gzip sizes and the console's errors, and fails on neither.
//
// It finds each control by role and accessible name, never by class, so a change of markup that
// keeps the names and roles keeps the walk. It needs Google Chrome, at CHROME_PATH or in
// /Applications, and adds no dependency: it speaks the Chrome DevTools Protocol over Node's own
// WebSocket. It runs locally before each pull request, never in CI and never in `pnpm test`: the
// file is not a `.test.ts`, so vitest never collects it. Its report and verdict are walk-report.ts.
import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import type { VideoDetailAnswer, VideoListAnswer } from '@creator-analytics/api-types'
import {
  BLUE_FILTER_WEIGHTS,
  type GrayscaleWeights,
  RED_FILTER_WEIGHTS,
} from '@creator-analytics/thumbnail-preview/grayscale-weights'
import {
  DURATION_BADGE,
  DURATION_BADGE_TEXT,
  LANDSCAPE_TILES,
  NEW_BADGE,
  SHORTS_TILES,
} from '@creator-analytics/thumbnail-preview/sizes'
import {
  audienceColumnCountOf,
  audienceGapRem,
  packAudienceCards,
} from '../../../web/src/audience-columns.ts'
import { settingsName } from '../../../web/src/settings-name.ts'
import { sidebarColumnQuery } from '../../../web/src/sidebar-column.ts'
import { themeCopyKey } from '../../../web/src/theme.ts'
import { upgradeText } from '../../../web/src/upgrade.ts'
import { playerSecondsAt } from '../../../web/src/video-player.ts'
import {
  accountBackLinkText,
  avatarLabelOf,
  dashboardLinkText,
  homeBackLinkText,
} from '../../src/signed-in.ts'
import {
  lastProcessedDay,
  sampleChannel,
  sampleSecondChannel,
  sampleSupport,
  sampleUser,
  sampleVideos,
} from './sample-channel.ts'
import { screenLanded } from './screen-ready.ts'
import { imagePayload, scriptPayload, startStubApi } from './stub-api.ts'
import { routeStep, type WalkMode, walkModes } from './walk-modes.ts'
import { type BundleSizes, reportOf, type Violation, type WalkRun } from './walk-report.ts'

const viewport = { width: 1280, height: 800, deviceScaleFactor: 1.5 }
/** A landscape phone's screen, on which the open account menu reaches down over the toast. */
const shortNarrow = { width: 667, height: 320, deviceScaleFactor: 1.5 }
/**
 * A phone's screen, on which the relative retention card is wider than its plot, and the launch
 * card's long titles cut short (creator-analytics#399).
 */
const narrow = { width: 375, height: 812, deviceScaleFactor: 2 }
/** A desktop window `width` wide, at a scale of 1 to keep the screenshots' memory down. */
const wideAt = (width: number) => ({ width, height: 900, deviceScaleFactor: 1 })
const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url))
const webAssets = fileURLToPath(new URL('../../../web/dist/assets/', import.meta.url))
/** The web app's fixture notes and highlights, so "What's new" shows highlights to walk. */
const webContentRoot = fileURLToPath(new URL('../../../web/test/fixtures/', import.meta.url))
const chromePath =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
/** How long a step waits after its screen is ready, so a late violation lands in that step. */
const settleMs = 400
const bindingName = '__browserWalkViolation'

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repositoryRoot, env, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`)),
    )
  })
}

/** Where the stub serves the fake YouTube player script (stub-api.ts). */
const fakeYouTubeIframeApiPath = '/sample/youtube-iframe-api.js'

/**
 * The build's environment, without the hosts that would send the walk's events or errors, with
 * the web app's fixture highlights, as no real one is committed yet (creator-analytics#577), and
 * with the fake YouTube player in place of YouTube's (creator-analytics#645).
 */
function buildEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    RELEASE_CONTENT_ROOT: webContentRoot,
    // The fake YouTube player the stub serves from 'self', in place of YouTube's IFrame API.
    VITE_YOUTUBE_IFRAME_API_URL: fakeYouTubeIframeApiPath,
  }
  delete env.VITE_OPENPANEL_API_URL
  delete env.VITE_GLITCHTIP_DSN
  return env
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function bundleSizes(): Promise<BundleSizes> {
  const totals = { js: 0, jsGzip: 0, css: 0, cssGzip: 0 }
  for (const name of await readdir(webAssets)) {
    const kind = name.endsWith('.js') ? 'js' : name.endsWith('.css') ? 'css' : null
    if (!kind) continue
    const bytes = await readFile(join(webAssets, name))
    totals[kind] += bytes.length
    totals[`${kind}Gzip`] += gzipSync(bytes, { level: 9 }).length
  }
  return totals
}

/** Chrome writes the port it chose, and the browser's path, to DevToolsActivePort. */
async function browserSocketUrl(profile: string): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const [port, path] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')
      if (port && path) return `ws://127.0.0.1:${port}${path}`
    } catch {
      // Not written yet.
    }
    await delay(100)
  }
  throw new Error('Chrome did not open its DevTools port')
}

type Event = { method: string; params: Record<string, unknown>; sessionId?: string }

async function connect(url: string) {
  const socket = new WebSocket(url)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  let nextId = 0
  const pending = new Map<number, { resolve(value: object): void; reject(error: Error): void }>()
  const listeners: ((event: Event) => void)[] = []
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(String(data))
    if (message.id !== undefined) {
      const call = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) call?.reject(new Error(JSON.stringify(message.error)))
      else call?.resolve(message.result)
      return
    }
    for (const listener of listeners) listener(message)
  })
  return {
    send: (method: string, params: object = {}, sessionId?: string) =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        nextId += 1
        pending.set(nextId, { resolve, reject })
        socket.send(JSON.stringify({ id: nextId, method, params, sessionId }))
      }),
    listen: (listener: (event: Event) => void) => listeners.push(listener),
    close: () => socket.close(),
  }
}

// Installed before any of the page's own scripts, in every document the walk loads.
const violationListener = `document.addEventListener('securitypolicyviolation', (event) => {
  const report = globalThis[${JSON.stringify(bindingName)}]
  if (typeof report !== 'function') return
  report(JSON.stringify({
    directive: event.effectiveDirective || event.violatedDirective,
    blockedUri: event.blockedURI,
    sample: event.sample,
    location: event.sourceFile ? event.sourceFile + ':' + event.lineNumber + ':' + event.columnNumber : '',
  }))
})`

const pageReadyCheck = (path: string) => `(async () => {
  if (location.pathname !== ${JSON.stringify(path)} || document.readyState !== 'complete') return false
  await document.fonts.ready
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  return document.fonts.status === 'loaded'
})()`

// Ready when the screen has landed, the fonts have loaded, and two frames have drawn since.
const readyCheck = `(async () => {
  await document.fonts.ready
  if (!(${screenLanded})(document) || document.fonts.status !== 'loaded') return false
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  return true
})()`

/** The directive a `security` log entry's text names, such as `style-src`. */
function directiveOfLogText(text: string): string {
  return /directive:? ["']([\w-]+)/.exec(text)?.[1] ?? 'security'
}

/** What a `security` log entry blocked: the quoted URL its text names, or inline code. */
function blockedOfLogText(text: string): string {
  const url = /'(https?:[^']+|data:[^']*|blob:[^']*)'/.exec(text)?.[1]
  if (url) return url
  if (/inline/i.test(text)) return 'inline'
  if (/eval/i.test(text)) return 'eval'
  return ''
}

const newestVideo = sampleVideos.at(-1)
if (!newestVideo) throw new Error('The sample channel has no video')
// The newest of the videos, not the Shorts, whose traffic sources carry the longest source name
// (creator-analytics#511).
const newestLongVideo = sampleVideos.findLast((video) => video.format === 'video')
if (!newestLongVideo) throw new Error('The sample channel has no video that is not a Short')
// The newest Short, whose player box is 9:16 (creator-analytics#648).
const newestShort = sampleVideos.findLast((video) => video.format === 'short')
if (!newestShort) throw new Error('The sample channel has no Short')
// The video whose detail answers it not embeddable (creator-analytics#649).
const notEmbeddableVideo = sampleVideos.find((video) => video.embeddable === false)
if (!notEmbeddableVideo) throw new Error('The sample channel has no video that is not embeddable')

const result: WalkRun = {
  sizes: { js: 0, jsGzip: 0, css: 0, cssGzip: 0 },
  steps: [],
  violations: [],
  failedSteps: [],
  unanswered: [],
  consoleErrors: [],
}

await run('pnpm', ['--filter', '@creator-analytics/web', 'build'], buildEnvironment())
await run('pnpm', ['--filter', '@creator-analytics/site', 'build'], buildEnvironment())
result.sizes = await bundleSizes()

// A paid channel's summary, so the walk draws the impressions and CTR charts (creator-analytics#783).
const stub = await startStubApi(0, { history: true })
const profile = await mkdtemp(join(tmpdir(), 'browser-walk-'))
const chrome = spawn(
  chromePath,
  [
    '--headless',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ],
  { stdio: 'ignore' },
)
try {
  const browser = await connect(await browserSocketUrl(profile))
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = (await browser.send('Target.attachToTarget', {
    targetId,
    flatten: true,
  })) as { sessionId: string }
  const send = (method: string, params?: object) => browser.send(method, params, sessionId)
  /** Listens to the page's own session, not the YouTube session below. */
  const listen = (listener: (event: Event) => void) =>
    browser.listen((event) => {
      if (event.sessionId === sessionId) listener(event)
    })

  // A video's screen loads YouTube's player as it opens (creator-analytics#684), so from the first
  // step a second session on the same page holds every request to YouTube in its own Fetch domain,
  // apart from the steps' own Fetch holds on the page's session: it answers the player's frame on
  // the privacy-enhanced host with an empty page, refuses any other YouTube request, and records
  // each, so the walk never reaches YouTube. The fake player itself comes from 'self'
  // (fake-youtube-iframe-api.js).
  const youtubeRequests: string[] = []
  const { sessionId: youtubeSession } = (await browser.send('Target.attachToTarget', {
    targetId,
    flatten: true,
  })) as { sessionId: string }
  browser.listen(({ method, params, sessionId: from }) => {
    if (from !== youtubeSession || method !== 'Fetch.requestPaused') return
    const { requestId, request } = params as { requestId: string; request: { url: string } }
    youtubeRequests.push(request.url)
    if (request.url.startsWith('https://www.youtube-nocookie.com/embed/')) {
      void browser.send(
        'Fetch.fulfillRequest',
        {
          requestId,
          responseCode: 200,
          responseHeaders: [{ name: 'content-type', value: 'text/html; charset=utf-8' }],
          body: Buffer.from('<!doctype html><title>Fake player</title>').toString('base64'),
        },
        youtubeSession,
      )
    } else {
      void browser.send(
        'Fetch.failRequest',
        { requestId, errorReason: 'BlockedByClient' },
        youtubeSession,
      )
    }
  })
  await browser.send(
    'Fetch.enable',
    {
      patterns: [
        { urlPattern: '*://*.youtube.com/*' },
        { urlPattern: '*://*.youtube-nocookie.com/*' },
      ],
    },
    youtubeSession,
  )

  let step = 'start'
  listen(({ method, params }) => {
    if (method === 'Runtime.bindingCalled' && params.name === bindingName) {
      const caught = JSON.parse(String(params.payload)) as Omit<Violation, 'step' | 'source'>
      result.violations.push({ step, source: 'listener', ...caught })
    }
    if (method === 'Log.entryAdded') {
      const entry = params.entry as {
        level: string
        text: string
        source: string
        url?: string
        lineNumber?: number
      }
      if (entry.source === 'security') {
        result.violations.push({
          step,
          source: 'log',
          directive: directiveOfLogText(entry.text),
          blockedUri: blockedOfLogText(entry.text),
          sample: entry.text.slice(0, 200),
          location: entry.url ? `${entry.url}:${entry.lineNumber ?? 0}` : '',
        })
      } else if (entry.level === 'error') {
        result.consoleErrors.push({ step, text: `${entry.source}: ${entry.text}`.slice(0, 300) })
      }
    }
    if (method === 'Runtime.exceptionThrown') {
      const details = params.exceptionDetails as {
        text: string
        exception?: { description?: string }
      }
      result.consoleErrors.push({
        step,
        text: (details.exception?.description ?? details.text).slice(0, 300),
      })
    }
    if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
      const args = params.args as { value?: unknown; description?: string }[]
      result.consoleErrors.push({
        step,
        text: args
          .map((arg) => arg.description ?? String(arg.value))
          .join(' ')
          .slice(0, 300),
      })
    }
  })

  const evaluate = async (expression: string): Promise<unknown> => {
    const { result: value, exceptionDetails } = (await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })) as { result: { value: unknown }; exceptionDetails?: { text: string } }
    if (exceptionDetails) throw new Error(exceptionDetails.text)
    return value.value
  }

  async function waitFor(expression: string, what: string, tries = 150): Promise<void> {
    for (let attempt = 0; attempt < tries; attempt++) {
      if ((await evaluate(expression)) === true) return
      await delay(100)
    }
    throw new Error(what)
  }

  const ready = () => waitFor(readyCheck, 'The screen did not finish loading')

  /** The element of the first node with this role and accessible name, by DevTools object id. */
  async function control(role: string, name: string): Promise<string> {
    const { root } = (await send('DOM.getDocument', { depth: 0 })) as { root: { nodeId: number } }
    const { nodes } = (await send('Accessibility.queryAXTree', {
      nodeId: root.nodeId,
      role,
      accessibleName: name,
    })) as { nodes: { backendDOMNodeId?: number }[] }
    const backendNodeId = nodes.find((node) => node.backendDOMNodeId)?.backendDOMNodeId
    if (!backendNodeId) throw new Error(`No ${role} named "${name}" on screen`)
    const { object } = (await send('DOM.resolveNode', { backendNodeId })) as {
      object: { objectId: string }
    }
    return object.objectId
  }

  /** The focused element's role and accessible name on Chrome's accessibility tree, as one line. */
  async function focusedRoleAndName(): Promise<string> {
    const { result: focused } = (await send('Runtime.evaluate', {
      expression: 'document.activeElement',
    })) as { result: { objectId?: string } }
    if (!focused.objectId) return 'nothing focused'
    const { nodes } = (await send('Accessibility.getPartialAXTree', {
      objectId: focused.objectId,
      fetchRelatives: false,
    })) as { nodes: { role?: { value?: unknown }; name?: { value?: unknown } }[] }
    const [node] = nodes
    return `${String(node?.role?.value ?? '')} ${String(node?.name?.value ?? '')}`
  }

  async function on(objectId: string, functionDeclaration: string): Promise<unknown> {
    const { result: value, exceptionDetails } = (await send('Runtime.callFunctionOn', {
      objectId,
      functionDeclaration,
      awaitPromise: true,
      returnByValue: true,
    })) as { result: { value: unknown }; exceptionDetails?: { text: string } }
    if (exceptionDetails) throw new Error(exceptionDetails.text)
    return value.value
  }

  const click = (objectId: string) => on(objectId, 'function () { this.click() }')

  /** Picks an option of a native select, as a pick in its picker does: headless has no picker. */
  const pick = (objectId: string, value: string) =>
    on(
      objectId,
      `function () {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
        setter.call(this, ${JSON.stringify(value)})
        this.dispatchEvent(new Event('change', { bubbles: true }))
      }`,
    )

  async function walk(name: string, act: () => Promise<void>): Promise<void> {
    step = name
    result.steps.push(name)
    try {
      await act()
      await delay(settleMs)
    } catch (error) {
      result.failedSteps.push({ step: name, error: (error as Error).message })
    }
  }

  /**
   * The sidebar's support item, its link to the sample's Payment Link and the button that hides it,
   * the x from 48rem and "Hide" below, found on the accessibility tree. Fails when either is
   * missing, or when either's box runs past the screen's width.
   */
  async function sidebarSupportItem(): Promise<void> {
    const link = await control('link', 'Support Stillstats')
    const href = await on(link, `function () { return this.getAttribute('href') }`)
    if (href !== sampleSupport.link) {
      throw new Error(`The sidebar's "Support Stillstats" links to ${String(href)}`)
    }
    const hide = await control('button', 'Hide Support Stillstats')
    for (const [name, objectId] of [
      ['"Support Stillstats"', link],
      ['"Hide Support Stillstats"', hide],
    ] as const) {
      const { left, right, width } = (await on(
        objectId,
        `function () {
          const box = this.getBoundingClientRect()
          return { left: box.left, right: box.right, width: document.documentElement.clientWidth }
        }`,
      )) as { left: number; right: number; width: number }
      if (left < 0 || right > width) {
        throw new Error(`The sidebar's ${name} runs from ${left}px to ${right}px of ${width}px`)
      }
    }
  }

  /**
   * Every route the first pass visits, in order, and whether it is a site page rather than the web
   * app's, so the walk replays exactly those in each other mode (creator-analytics#382).
   */
  const routesWalked: { path: string; page: boolean }[] = []

  /** Goes to `path` and waits for it as its first visit did: a site page's load or the app's screen. */
  async function goTo({ path, page }: { path: string; page: boolean }): Promise<void> {
    await send('Page.navigate', { url: `${stub.origin}${path}` })
    if (page) await waitFor(pageReadyCheck(path), 'The page did not finish loading')
    else await ready()
  }

  async function visit(path: string): Promise<void> {
    routesWalked.push({ path, page: false })
    await walk(routeStep(path, walkModes[0]), () => goTo({ path, page: false }))
  }

  async function visitPage(path: string): Promise<void> {
    routesWalked.push({ path, page: true })
    await walk(routeStep(path, walkModes[0]), () => goTo({ path, page: true }))
  }

  async function pageHeading(name: string): Promise<void> {
    const heading = await control('heading', name)
    const tag = await on(heading, 'function () { return this.tagName }')
    if (tag !== 'H1')
      throw new Error(`The heading "${name}" is an ${String(tag)}, not the page's h1`)
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Log.enable')
  await send('DOM.enable')
  await send('Accessibility.enable')
  await send('Runtime.addBinding', { name: bindingName })
  await send('Page.addScriptToEvaluateOnNewDocument', { source: violationListener })
  await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'light' }],
  })

  // Every path `routeOf` in apps/web/src/route.ts knows, the list last so the states start on it.
  await visit(`/app/videos/${encodeURIComponent(newestVideo.id)}`)
  await visit('/app/audience')
  // creator-analytics#951: the retention comparison with two stored curves drawn, the paid tier's.
  await visit(
    `/app/retention?window=lifetime&curves=${[newestLongVideo, newestShort]
      .map(({ id }) => encodeURIComponent(id))
      .join(',')}`,
  )
  await walk('state: the retention comparison draws its picked curves', async () => {
    await pageHeading('Compare retention curves')
    await control('list', 'Compared videos')
    await control('slider', 'Retention comparison. Use the arrow keys to read each point.')
    await control('button', 'Clear all picks')
  })
  // creator-analytics#1044: each video in the picker is one checkbox, shadcn's, named by its row.
  // creator-analytics#1049: the backfill note sits under the intro at half the intro's gap under the
  // h1, an unpicked box is white and centred on its row, the picker keeps its place on the page
  // with no pick, 1 pick and 5 picks, and "Clear all picks" with no pick looks disabled.
  await walk('state: the retention picker has one named checkbox per video', async () => {
    await waitFor(
      "document.querySelectorAll('.comparison-videos li').length > 0",
      'The retention picker listed no video',
    )
    const { root } = (await send('DOM.getDocument', { depth: 0 })) as { root: { nodeId: number } }
    const { nodes } = (await send('Accessibility.queryAXTree', {
      nodeId: root.nodeId,
      role: 'checkbox',
    })) as {
      nodes: { ignored?: boolean; backendDOMNodeId?: number; name?: { value?: unknown } }[]
    }
    // Base UI's hidden input beside each checkbox is aria-hidden, which the query still answers,
    // flagged as ignored.
    const exposed = nodes.filter((node) => !node.ignored)
    const named = exposed.filter((node) => node.backendDOMNodeId && String(node.name?.value ?? ''))
    const rows = await evaluate("document.querySelectorAll('.comparison-videos li').length")
    if (rows === 0 || named.length !== rows || exposed.length !== rows) {
      throw new Error(
        `The picker has ${String(rows)} videos, ${exposed.length} checkboxes, ${named.length} named`,
      )
    }
  })
  await walk(
    'state: the backfill note sits under the retention intro at half the screen gap',
    async () => {
      const gaps = (await evaluate(`(() => {
      const box = (selector) => document.querySelector(selector)?.getBoundingClientRect()
      const heading = box('main h1')
      const intro = box('.comparison-intro')
      const note = box('.comparison-note')
      if (!heading || !intro || !note) return null
      return { underHeading: intro.top - heading.bottom, underIntro: note.top - intro.bottom }
    })()`)) as { underHeading: number; underIntro: number } | null
      if (!gaps) throw new Error('No h1, intro and backfill note on the retention comparison')
      if (Math.abs(gaps.underIntro - gaps.underHeading / 2) > 0.5) {
        throw new Error(
          `The backfill note sits ${gaps.underIntro}px under the intro, and the intro ${gaps.underHeading}px under the h1`,
        )
      }
    },
  )
  await walk('state: an unpicked retention pick box is white and centred on its row', async () => {
    const box = (await evaluate(`(() => {
      const row = [...document.querySelectorAll('.comparison-videos li')].find(
        (each) => each.querySelector('[role="checkbox"]')?.getAttribute('aria-checked') === 'false',
      )
      const check = row?.querySelector('[role="checkbox"]')
      if (!row || !check) return null
      const style = getComputedStyle(row)
      const place = row.getBoundingClientRect()
      const top = place.top + parseFloat(style.paddingTop) + parseFloat(style.borderTopWidth)
      const bottom =
        place.bottom - parseFloat(style.paddingBottom) - parseFloat(style.borderBottomWidth)
      const drawn = check.getBoundingClientRect()
      return {
        fill: getComputedStyle(check).backgroundColor,
        offCentre: (drawn.top + drawn.bottom) / 2 - (top + bottom) / 2,
      }
    })()`)) as { fill: string; offCentre: number } | null
    if (!box) throw new Error('No unpicked box in the retention picker')
    if (box.fill !== 'rgb(255, 255, 255)' && box.fill !== 'oklch(1 0 0)') {
      throw new Error(`An unpicked box is filled ${box.fill}, not white`)
    }
    if (Math.abs(box.offCentre) > 0.5) {
      throw new Error(`An unpicked box sits ${box.offCentre}px off its row's centre`)
    }
  })
  await walk('state: the retention picker keeps its place as the picks change', async () => {
    const pickerTop = async () =>
      (await evaluate(
        "document.getElementById('comparison-picker-heading').getBoundingClientRect().top + scrollY",
      )) as number
    const landed = (picks: number) =>
      waitFor(
        `document.querySelectorAll('.comparison-legend li').length === ${picks} &&
        ${picks === 0 ? "!!document.querySelector('.comparison-chart-empty')?.textContent" : "!!document.querySelector('.comparison-chart svg')"} &&
        (getComputedStyle(document.getElementById('comparison-limit')).visibility === 'visible') === ${picks >= 5}`,
        `The retention comparison did not land ${picks} picks`,
      )
    const pickRow = (index: number) =>
      evaluate(
        `document.querySelectorAll('.comparison-videos [role="checkbox"][aria-checked="false"]')[${index}].click()`,
      )
    const clearInk = async () =>
      on(
        await control('button', 'Clear all picks'),
        'function () { return getComputedStyle(this).color }',
      )
    const twoPicks = await pickerTop()
    const tops: Record<string, number> = { 'two picks': twoPicks }
    const enabledInk = await clearInk()
    await click(await control('button', 'Clear all picks'))
    await landed(0)
    tops['no pick'] = await pickerTop()
    if ((await clearInk()) === enabledInk) {
      throw new Error('"Clear all picks" with no pick looks as it does with a pick')
    }
    await pickRow(0)
    await landed(1)
    tops['one pick'] = await pickerTop()
    for (const picks of [2, 3, 4, 5]) {
      await pickRow(0)
      await landed(picks)
    }
    tops['five picks'] = await pickerTop()
    const moved = Object.entries(tops).filter(([, top]) => Math.abs(top - twoPicks) > 0.5)
    if (moved.length > 0) {
      throw new Error(`The picker moves: ${JSON.stringify(tops)}`)
    }
  })
  await visit('/app/settings')
  // The banner's copy, apps/web/src/whats-new.ts's.
  const bannerLabel = 'New in Stillstats'
  const bannerLinkText = "See what's new"
  const bannerCloseLabel = 'Close this notice'
  // creator-analytics#580: the sample account predates the fixture releases and has no marker, so
  // the banner shows on each screen until "What's new" opens, whose open saves the marker in the
  // stub, and is gone after it.
  await walk('state: "What\'s new" banner shows', async () => {
    const banner = await controlOnceShown('region', bannerLabel)
    const inside = await on(
      banner,
      `function () {
        return [...this.querySelectorAll('a, button')].map(
          (each) => each.getAttribute('aria-label') ?? each.textContent,
        )
      }`,
    )
    if (JSON.stringify(inside) !== JSON.stringify([bannerLinkText, bannerCloseLabel])) {
      throw new Error(`The banner holds ${JSON.stringify(inside)}`)
    }
    await control('link', bannerLinkText)
    await control('button', bannerCloseLabel)
  })
  // creator-analytics#577: the fixture highlights' description HTML, under the page's policy.
  await visit('/app/whats-new')
  await walk('state: "What\'s new" lists the highlights', async () => {
    await control('heading', "What's new")
    await control('heading', 'Audience in the sidebar')
    const release = await control('link', 'Stillstats 2026.11.9')
    const href = await on(release, `function () { return this.getAttribute('href') }`)
    if (href !== '/releases/2026.11.9') {
      throw new Error(`The newest highlight's release link goes to ${String(href)}`)
    }
  })
  // creator-analytics#582: the feedback form, its radio group, text box and native fields, under
  // the page's policy. The form's strings, apps/web/src/feedback.ts's. The form shows neither the
  // screen it came from nor the stub's version (creator-analytics#586), which a send carries
  // unseen (creator-analytics#750).
  await visit('/app/feedback?screen=audience')
  await walk('state: the feedback form', async () => {
    await pageHeading('Send feedback')
    await control('radiogroup', 'What is it about?')
    await control('textbox', 'Your message')
    const { version } = (await evaluate(
      `fetch('/api/client-settings').then((response) => response.json())`,
    )) as { version: string | null }
    const formText = await evaluate(`document.querySelector('.feedback-form')?.textContent ?? null`)
    if (typeof formText !== 'string') throw new Error('The feedback form is not on the screen')
    if (version && formText.includes(version)) {
      throw new Error(`The feedback form shows the app version, ${version}`)
    }
    if (formText.includes('Audience')) {
      throw new Error('The feedback form shows the screen it came from, Audience')
    }
  })
  // creator-analytics#583: the admin feedback screen, with a script and an image payload in a
  // message's text and in its reply address, each shown as text under the page's policy. The
  // screen's heading, apps/web/src/admin-feedback.ts's.
  await visit('/app/admin/feedback')
  await walk('state: the admin feedback screen shows the payloads as text', async () => {
    await pageHeading('Feedback')
    await control('StaticText', scriptPayload)
    await control('StaticText', imagePayload)
    const added = await evaluate(
      `document.querySelectorAll('.admin-feedback script, .admin-feedback img').length`,
    )
    if (added !== 0)
      throw new Error(`The admin feedback screen holds ${String(added)} payload elements`)
  })
  await visitPage('/releases/')
  await walk('state: release index lists the releases', async () => {
    await pageHeading('Releases')
    await control('link', 'Stillstats 2026.11.9')
  })
  await visitPage('/releases/2026.11.9')
  await walk('state: release page shows its note', async () => {
    await pageHeading('Stillstats 2026.11.9')
    await control('heading', 'What changed')
  })
  // creator-analytics#793: the thumbnail preview tool page, under the tool page's own policy,
  // which adds blob: to img-src (ADR 0021), with the other pages' header, footer and session check.
  // Its first visit joins the routes the replay at the end walks signed in in every other mode.
  // The heading is the page's h1, approved word for word in creator-analytics#732.
  const toolPagePath = '/tools/thumbnail-preview'
  const toolPageHeading = 'Check your thumbnail at YouTube’s real sizes'
  await visitPage(toolPagePath)

  /**
   * Opens the tool page in `mode` and answers where, for the step's errors. The step puts light
   * mode at 1280px back when it ends.
   */
  async function toolPageIn(mode: (typeof walkModes)[number]): Promise<string> {
    const where = `${mode.colorScheme} mode at ${mode.phone ? '375px' : '1280px'}`
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: mode.colorScheme }],
    })
    await send('Emulation.setDeviceMetricsOverride', {
      ...(mode.phone ? narrow : viewport),
      mobile: false,
    })
    await send('Page.navigate', { url: `${stub.origin}${toolPagePath}` })
    await waitFor(pageReadyCheck(toolPagePath), `In ${where}, the tool page did not load`)
    return where
  }

  const thumbnailFixture = fileURLToPath(new URL('./thumbnail-landscape.png', import.meta.url))

  /**
   * Loads the 1280 x 720 fixture into slot A as a pick in the file dialog does, through the file
   * input in the slot that holds slot A's "Choose a file", the first on the page.
   */
  async function loadIntoSlotA(where: string): Promise<void> {
    const choose = await control('button', 'Choose a file')
    const { result: input } = (await send('Runtime.callFunctionOn', {
      objectId: choose,
      functionDeclaration: `function () {
        return this.closest('[data-slot]')?.querySelector('input[type="file"]') ?? null
      }`,
    })) as { result: { objectId?: string } }
    if (!input.objectId) {
      throw new Error(`In ${where}, the first "Choose a file" has no file input in its slot`)
    }
    const slot = await on(
      input.objectId,
      `function () { return this.closest('[data-slot]').dataset.slot }`,
    )
    if (slot !== 'A')
      throw new Error(`In ${where}, the first "Choose a file" is slot ${String(slot)}'s`)
    await send('DOM.setFileInputFiles', { files: [thumbnailFixture], objectId: input.objectId })
  }

  /** A tile image's rendered width, whether it has decoded, and its source, once it has decoded. */
  async function tileOnceDecoded(
    image: string,
  ): Promise<{ width: number; decoded: boolean; src: string }> {
    const read = async () =>
      (await on(
        image,
        `function () {
          return {
            width: this.getBoundingClientRect().width,
            decoded: this.complete && this.naturalWidth > 0,
            src: this.currentSrc,
          }
        }`,
      )) as { width: number; decoded: boolean; src: string }
    for (let attempt = 0; attempt < 50; attempt++) {
      const tile = await read()
      if (tile.decoded) return tile
      await delay(100)
    }
    return read()
  }

  async function lightAtDesktop(): Promise<void> {
    await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'light' }],
    })
  }

  /**
   * Fails unless the tool page's sign-in band shows the session's answer (creator-analytics#798):
   * signed out, the "Sign in with Google" button and its agreement notice; signed in, the
   * "Open your dashboard" link to /app in the button's place and the notice hidden. Either control
   * stays inside the screen's width, which at 375px is the phone's.
   */
  async function signInBand(where: string, signedIn: boolean): Promise<void> {
    const band = (await evaluate(`(() => {
      const band = document.querySelector('.sign-in-band')
      if (!band) return null
      const button = band.querySelector('[data-sign-in]')
      const links = [...band.querySelectorAll('a.button[href="/app"]')]
      const dashboardLink = links.find(
        (link) => link.textContent.trim() === ${JSON.stringify(dashboardLinkText)},
      )
      const notice = band.querySelector('.notice')
      const box = (button ?? dashboardLink)?.getBoundingClientRect()
      return {
        button: button !== null,
        appLinks: links.length,
        dashboardLink: dashboardLink !== undefined,
        noticeShown: notice ? getComputedStyle(notice).visibility === 'visible' : null,
        left: box?.left ?? null,
        right: box?.right ?? null,
        width: document.documentElement.clientWidth,
      }
    })()`)) as {
      button: boolean
      appLinks: number
      dashboardLink: boolean
      noticeShown: boolean | null
      left: number | null
      right: number | null
      width: number
    } | null
    const state = signedIn ? 'Signed in' : 'Signed out'
    if (!band) throw new Error(`${state} in ${where}, the tool page has no sign-in band`)
    if (band.noticeShown === null) {
      throw new Error(`${state} in ${where}, the sign-in band has no agreement notice`)
    }
    if (signedIn) {
      if (band.button) throw new Error(`Signed in in ${where}, the sign-in band holds its button`)
      if (!band.dashboardLink) {
        throw new Error(`Signed in in ${where}, the sign-in band holds no "${dashboardLinkText}"`)
      }
      if (band.noticeShown) {
        throw new Error(`Signed in in ${where}, the sign-in band still shows its agreement notice`)
      }
    } else {
      if (!band.button) throw new Error(`Signed out in ${where}, the sign-in band has no button`)
      if (band.appLinks !== 0) {
        throw new Error(`Signed out in ${where}, the sign-in band holds a link to /app`)
      }
      if (!band.noticeShown) {
        throw new Error(`Signed out in ${where}, the sign-in band hides its agreement notice`)
      }
    }
    if (band.left === null || band.right === null || band.left < 0 || band.right > band.width) {
      throw new Error(
        `${state} in ${where}, the sign-in band's control runs from ${String(band.left)}px to ${String(band.right)}px of ${band.width}px`,
      )
    }
  }

  /** The h1's top in each mode signed in, which the signed-out step holds its own to. */
  const toolHeadingTopsSignedIn = new Map<string, number>()

  /**
   * Fails unless the tool page's back link shows the session's answer (creator-analytics#889):
   * signed in, "Back to your account" to /app; signed out, "Home" to /. Either way it is the page's
   * back link and it sits above the h1, and the h1's top is answered, so the two states can be held
   * to the same place: the swap moves nothing.
   */
  async function backLinkAboveHeading(where: string, signedIn: boolean): Promise<number> {
    const [name, href] = signedIn ? [accountBackLinkText, '/app'] : [homeBackLinkText, '/']
    const state = signedIn ? 'Signed in' : 'Signed out'
    const link = await control('link', name)
    const read = (await on(
      link,
      `function () {
        const heading = document.querySelector('main h1')
        return {
          backLink: this.matches('main [data-back-link]'),
          href: this.getAttribute('href'),
          bottom: this.getBoundingClientRect().bottom,
          headingTop: heading ? heading.getBoundingClientRect().top + window.scrollY : null,
          scrolled: window.scrollY,
        }
      }`,
    )) as {
      backLink: boolean
      href: string | null
      bottom: number
      headingTop: number | null
      scrolled: number
    }
    if (!read.backLink) throw new Error(`${state} in ${where}, "${name}" is not the back link`)
    if (read.href !== href) {
      throw new Error(`${state} in ${where}, "${name}" goes to ${String(read.href)}, not ${href}`)
    }
    if (read.headingTop === null) throw new Error(`${state} in ${where}, the page has no h1`)
    if (!(read.bottom + read.scrolled <= read.headingTop)) {
      throw new Error(
        `${state} in ${where}, "${name}" ends at ${read.bottom + read.scrolled}px, below the h1's top at ${read.headingTop}px`,
      )
    }
    return read.headingTop
  }

  await walk('state: the tool page signed in', async () => {
    try {
      for (const mode of walkModes) {
        const where = await toolPageIn(mode)
        await pageHeading(toolPageHeading)
        // The avatar, the band's link and the back link land in the same task, so the avatar marks
        // the answer.
        const avatar = await controlOnceShown('link', avatarLabelOf(sampleUser.email))
        const inPlace = await on(
          avatar,
          `function () { return this.parentElement?.matches('header [data-avatar-place]') === true }`,
        )
        if (inPlace !== true) {
          throw new Error(`In ${where}, the tool page's avatar is not in the header's place`)
        }
        await signInBand(where, true)
        toolHeadingTopsSignedIn.set(where, await backLinkAboveHeading(where, true))
      }
    } finally {
      await lightAtDesktop()
    }
  })
  // Signed out, the stub answers GET /api/me with a 401. In each mode the walk waits for the page
  // to ask, then for the fonts and two frames, as the page's session check does before it shows the
  // answer, so an empty place is the answer's, not a page that has not asked yet.
  const answerShown = `(async () => {
    await document.fonts.ready
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return true
  })()`
  await walk('state: the tool page signed out', async () => {
    stub.signedIn(false)
    try {
      for (const mode of walkModes) {
        const readsBefore = stub.sessionReads()
        const where = await toolPageIn(mode)
        for (let attempt = 0; stub.sessionReads() === readsBefore; attempt++) {
          if (attempt >= 50) throw new Error(`In ${where}, the tool page never asked GET /api/me`)
          await delay(100)
        }
        await waitFor(answerShown, `In ${where}, the tool page did not draw its session's answer`)
        await pageHeading(toolPageHeading)
        const avatars = await evaluate(
          `document.querySelectorAll('header [data-avatar-place] > *').length`,
        )
        if (avatars !== 0) {
          throw new Error(`Signed out in ${where}, the tool page's header holds an avatar`)
        }
        await signInBand(where, false)
        const headingTop = await backLinkAboveHeading(where, false)
        const signedInTop = toolHeadingTopsSignedIn.get(where)
        if (signedInTop === undefined) {
          throw new Error(`In ${where}, the signed-in step recorded no h1 top to compare with`)
        }
        if (!(Math.abs(headingTop - signedInTop) <= 0.5)) {
          throw new Error(
            `In ${where}, the h1's top is ${headingTop}px signed out and ${signedInTop}px signed in`,
          )
        }
      }
    } finally {
      stub.signedIn(true)
      await lightAtDesktop()
    }
  })
  // creator-analytics#889: on the tool page the header and the main column drop the 68rem measure
  // and keep 2rem at each side from 48rem up and 1rem below, so at 1280px and at 375px the tool
  // runs from that spacing to the window's width less it, the header spans the window, and the
  // wordmark lines up with the tool's left edge. The back link sits 1.5rem under the header, and the
  // page never scrolls sideways. The homepage keeps its 68rem measure, centred, at 1280px.
  await walk(
    "state: the tool page takes the window's width, and the homepage keeps its measure",
    async () => {
      const near = (value: number, target: number, within: number) =>
        Math.abs(value - target) <= within
      try {
        for (const phone of [false, true]) {
          const where = await toolPageIn({ colorScheme: 'light', phone })
          await pageHeading(toolPageHeading)
          const box = (await evaluate(`(() => {
            const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
            const edges = (selector) => {
              const element = document.querySelector(selector)
              if (!element) return null
              const { left, right, top, bottom } = element.getBoundingClientRect()
              return { left, right, top, bottom }
            }
            return {
              rem,
              width: document.documentElement.clientWidth,
              scrollWidth: document.documentElement.scrollWidth,
              tool: edges('#thumbnail-tool'),
              header: edges('body > header'),
              wordmark: edges('body > header a.wordmark'),
              back: edges('.tool-back'),
            }
          })()`)) as {
            rem: number
            width: number
            scrollWidth: number
            tool: Record<'left' | 'right' | 'top' | 'bottom', number> | null
            header: Record<'left' | 'right' | 'top' | 'bottom', number> | null
            wordmark: Record<'left' | 'right' | 'top' | 'bottom', number> | null
            back: Record<'left' | 'right' | 'top' | 'bottom', number> | null
          }
          const { rem, width, tool, header, wordmark, back } = box
          if (!tool || !header || !wordmark || !back) {
            throw new Error(`In ${where}, the tool page is missing a part: ${JSON.stringify(box)}`)
          }
          const side = width >= 48 * rem ? 2 * rem : rem
          const faults = [
            !near(tool.left, side, 0.5) && `the tool's left is ${tool.left}px, not ${side}px`,
            !near(tool.right, width - side, 0.5) &&
              `the tool's right is ${tool.right}px, not ${width - side}px`,
            !(near(header.left, 0, 0.5) && near(header.right, width, 0.5)) &&
              `the header runs from ${header.left}px to ${header.right}px, not 0 to ${width}px`,
            !near(wordmark.left, side, 0.5) &&
              `the wordmark's left is ${wordmark.left}px, not ${side}px`,
            !near(back.top - header.bottom, 1.5 * rem, 1) &&
              `the back link sits ${back.top - header.bottom}px under the header, not ${1.5 * rem}px`,
            box.scrollWidth > width && `the page scrolls sideways to ${box.scrollWidth}px`,
          ].filter((fault) => fault !== false)
          if (faults.length > 0) throw new Error(`In ${where}, ${faults.join('; ')}`)
        }

        await lightAtDesktop()
        await send('Page.navigate', { url: `${stub.origin}/` })
        await waitFor(pageReadyCheck('/'), 'The homepage did not load')
        const home = (await evaluate(`(() => {
          const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
          const edges = (selector) => {
            const element = document.querySelector(selector)
            if (!element) return null
            const { left, width } = element.getBoundingClientRect()
            return { left, width }
          }
          return {
            rem,
            width: document.documentElement.clientWidth,
            main: edges('body > main'),
            header: edges('body > header'),
          }
        })()`)) as {
          rem: number
          width: number
          main: { left: number; width: number } | null
          header: { left: number; width: number } | null
        }
        const measure = 68 * home.rem
        for (const [name, part] of [
          ['main column', home.main],
          ['header', home.header],
        ] as const) {
          if (
            !part ||
            !near(part.width, measure, 0.5) ||
            !near(part.left, (home.width - measure) / 2, 0.5)
          ) {
            throw new Error(
              `At 1280px, the homepage's ${name} is ${JSON.stringify(part)} in ${home.width}px, not ${measure}px wide and centred`,
            )
          }
        }
      } finally {
        await lightAtDesktop()
      }
    },
  )
  // creator-analytics#888: the header's navigation on the tool page, signed in so the avatar shows.
  // At 1280px the wordmark, the two links, the Extensions button and the avatar share one vertical
  // centre; a real press opens the Extensions menu with both store links and a press outside
  // closes it; Enter on the focused button opens it and Escape closes it with focus back on the
  // button. At 375px the links and the Extensions button are off the accessibility tree and the
  // Menu button opens a panel with the four links, which Escape closes with focus back on the
  // button. It never presses a new-tab link, which would open a page off the stub.
  await walk("state: the header's navigation, its Extensions menu and its Menu panel", async () => {
    const midRollManager = 'Mid-Roll Manager (opens in a new tab)'
    const storeLinks = [
      'Stillstats for Chrome (opens in a new tab)',
      'Stillstats for Firefox (opens in a new tab)',
    ]
    /** Fails when a control with this role and name is on the accessibility tree. */
    const absent = async (role: string, name: string, when: string) => {
      const found = await control(role, name).then(
        () => true,
        () => false,
      )
      if (found) throw new Error(`${when}, the ${role} "${name}" is on the accessibility tree`)
    }
    const expandedOf = async (button: string) =>
      on(button, `function () { return this.getAttribute('aria-expanded') }`)
    const centreYOf = async (objectId: string) =>
      (await on(
        objectId,
        `function () {
          const box = this.getBoundingClientRect()
          return box.top + box.height / 2
        }`,
      )) as number
    try {
      const where = await toolPageIn(walkModes[0])
      await control('navigation', 'Site')
      const avatar = await controlOnceShown('link', avatarLabelOf(sampleUser.email))
      const wordmark = await control('link', 'stillstats')
      const toolLink = await control('link', 'Thumbnail preview')
      const current = await on(toolLink, `function () { return this.getAttribute('aria-current') }`)
      if (current !== 'page') {
        throw new Error(`In ${where}, "Thumbnail preview" carries aria-current ${String(current)}`)
      }
      const inHeader = await on(
        toolLink,
        `function () { return this.closest('nav')?.parentElement?.tagName === 'HEADER' }`,
      )
      if (inHeader !== true)
        throw new Error(`In ${where}, the first "Thumbnail preview" is not the header's`)
      const extensions = await control('button', 'Extensions')
      const items = {
        'the wordmark': wordmark,
        '"Thumbnail preview"': toolLink,
        '"Mid-Roll Manager"': await control('link', midRollManager),
        '"Extensions"': extensions,
        'the avatar': avatar,
      }
      const centres: Record<string, number> = {}
      for (const [name, objectId] of Object.entries(items))
        centres[name] = await centreYOf(objectId)
      const wordmarkCentre = centres['the wordmark'] ?? Number.NaN
      const offCentre = Object.entries(centres).filter(
        ([, centre]) => !(Math.abs(centre - wordmarkCentre) <= 0.5),
      )
      if (offCentre.length > 0) {
        throw new Error(
          `In ${where}, the header's items do not share the wordmark's vertical centre: ${JSON.stringify(centres)}`,
        )
      }
      await absent('button', 'Menu', `In ${where}`)

      // By mouse: a real press on the button opens it, and a press on the page outside closes it.
      const { x, y } = (await on(
        extensions,
        `function () {
          const box = this.getBoundingClientRect()
          return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
        }`,
      )) as { x: number; y: number }
      await pressAt(x, y)
      if ((await expandedOf(extensions)) !== 'true') {
        throw new Error(`In ${where}, a press on "Extensions" did not open its menu`)
      }
      for (const name of storeLinks) await controlOnceShown('link', name)
      await pressAt(8, 600)
      if ((await expandedOf(extensions)) !== 'false') {
        throw new Error(`In ${where}, a press outside did not close the Extensions menu`)
      }
      for (const name of storeLinks) await absent('link', name, `In ${where} with the menu closed`)

      // By keyboard: Enter on the focused button opens it, Tab moves into it, and Escape from its
      // link closes it with focus back on the button.
      await on(extensions, 'function () { this.focus() }')
      await pressKey('Enter', 13, { text: '\r' })
      if ((await expandedOf(extensions)) !== 'true') {
        throw new Error(`In ${where}, Enter on "Extensions" did not open its menu`)
      }
      for (const name of storeLinks) await controlOnceShown('link', name)
      await pressKey('Tab', 9)
      const inExtensions = await focusedRoleAndName()
      if (inExtensions !== `link ${storeLinks[0]}`) {
        throw new Error(
          `In ${where}, Tab from "Extensions" put focus on ${inExtensions}, not its first link`,
        )
      }
      await pressKey('Escape', 27)
      if ((await expandedOf(extensions)) !== 'false') {
        throw new Error(`In ${where}, Escape did not close the Extensions menu`)
      }
      const afterEscape = await focusedRoleAndName()
      if (afterEscape !== 'button Extensions') {
        throw new Error(
          `In ${where}, Escape left focus on ${afterEscape}, not the Extensions button`,
        )
      }

      // At 375px the links fold into the Menu button, whose panel holds the four links.
      await send('Emulation.setDeviceMetricsOverride', { ...narrow, mobile: false })
      const atPhone = 'At 375px'
      await absent('button', 'Extensions', atPhone)
      await absent('link', midRollManager, atPhone)
      const menu = await controlOnceShown('button', 'Menu')
      const panelId = String(
        await on(menu, `function () { return this.getAttribute('aria-controls') }`),
      )
      await on(menu, 'function () { this.focus() }')
      await pressKey('Enter', 13, { text: '\r' })
      if ((await expandedOf(menu)) !== 'true') {
        throw new Error(`${atPhone}, Enter on "Menu" did not open its panel`)
      }
      for (const name of ['Thumbnail preview', midRollManager, ...storeLinks]) {
        const link = await controlOnceShown('link', name)
        const place = (await on(
          link,
          `function () {
            const box = this.getBoundingClientRect()
            const panel = document.getElementById(${JSON.stringify(panelId)})
            return {
              inPanel: panel !== null && panel.contains(this),
              left: box.left,
              right: box.right,
              width: document.documentElement.clientWidth,
            }
          }`,
        )) as { inPanel: boolean; left: number; right: number; width: number }
        if (!place.inPanel || place.left < 0 || place.right > place.width) {
          throw new Error(
            `${atPhone}, the Menu panel's "${name}" sits so: ${JSON.stringify(place)}`,
          )
        }
      }
      await pressKey('Tab', 9)
      const inPanel = await focusedRoleAndName()
      if (inPanel !== 'link Thumbnail preview') {
        throw new Error(`${atPhone}, Tab from "Menu" put focus on ${inPanel}, not its first link`)
      }
      await pressKey('Escape', 27)
      if ((await expandedOf(menu)) !== 'false') {
        throw new Error(`${atPhone}, Escape did not close the Menu panel`)
      }
      const afterMenuEscape = await focusedRoleAndName()
      if (afterMenuEscape !== 'button Menu') {
        throw new Error(`${atPhone}, Escape left focus on ${afterMenuEscape}, not the Menu button`)
      }
    } finally {
      await lightAtDesktop()
    }
  })
  // creator-analytics#794: in each mode the tool loads the fixture into slot A through its file
  // input, and every landscape tile draws it, decoded from a blob: URL, at the size table's width:
  // at 1280px with no page zoom, the width a creator at 100% zoom sees, and at 375px too, since a
  // tile never scales. The page never scrolls sideways, and the title field's text takes the
  // page's ink, which differs between light and dark mode, so the tool's chrome follows the mode.
  await walk('state: the tool page shows a loaded thumbnail at each landscape size', async () => {
    const titleInk: Partial<Record<WalkMode['colorScheme'], string>> = {}
    try {
      for (const mode of walkModes) {
        const where = await toolPageIn(mode)
        const title = await controlOnceShown('textbox', 'Title A')
        await loadIntoSlotA(where)
        for (const { width } of LANDSCAPE_TILES) {
          const name = `Thumbnail A at ${width}px`
          const image = await controlOnceShown('image', name)
          const tile = await tileOnceDecoded(image)
          if (Math.abs(tile.width - width) > 0.5) {
            throw new Error(`In ${where}, "${name}" draws ${tile.width}px wide`)
          }
          if (!tile.decoded || !tile.src.startsWith('blob:')) {
            throw new Error(
              `In ${where}, "${name}" shows ${tile.src || 'nothing'}, not a decoded blob:`,
            )
          }
        }
        const page = (await evaluate(`({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          bodyInk: getComputedStyle(document.body).color,
        })`)) as { scrollWidth: number; clientWidth: number; bodyInk: string }
        if (page.scrollWidth > page.clientWidth) {
          throw new Error(
            `In ${where}, the tool page scrolls sideways: ${page.scrollWidth}px in ${page.clientWidth}px`,
          )
        }
        const ink = (await on(
          title,
          'function () { return getComputedStyle(this).color }',
        )) as string
        if (ink !== page.bodyInk) {
          throw new Error(
            `In ${where}, "Title A" writes ${ink}, not the page's ink ${page.bodyInk}`,
          )
        }
        titleInk[mode.colorScheme] = ink
      }
      if (titleInk.light === titleInk.dark) {
        throw new Error(`"Title A" writes ${String(titleInk.light)} in light and dark mode alike`)
      }
    } finally {
      await lightAtDesktop()
    }
  })

  /** Whether the toolbar's option with this name is pressed, as `aria-pressed` says. */
  async function optionPressed(name: string): Promise<boolean> {
    const option = await control('button', name)
    return (await on(option, `function () { return this.getAttribute('aria-pressed') }`)) === 'true'
  }

  /** The widths a landscape tile has and no Shorts tile has, so a Shorts rail never shows them. */
  const landscapeOnlyWidths = LANDSCAPE_TILES.map(({ width }) => width).filter(
    (width) => !SHORTS_TILES.some((shorts) => shorts.width === width),
  )
  // creator-analytics#795: in each mode the tool takes a press on "Shorts" before any image, then
  // the 1280 x 720 landscape fixture, which the press keeps in Shorts mode. Every Shorts tile
  // draws it, decoded from a blob: URL, at the size table's width and within the 1px the table
  // gives its rounded height, so each tile has its Shorts proportions, and no landscape-only size
  // shows. Slot A's mismatch notice says it is a landscape image with a "Switch to Landscape"
  // button, every Shorts tile's head carries the "Cropped" marker, and the button switches back,
  // which clears the notice.
  await walk(
    'state: the tool page in Shorts mode, with a landscape thumbnail cropped',
    async () => {
      try {
        for (const mode of walkModes) {
          const where = await toolPageIn(mode)
          await controlOnceShown('textbox', 'Title A')
          await click(await control('button', 'Shorts'))
          if (!(await optionPressed('Shorts')) || (await optionPressed('Landscape'))) {
            throw new Error(`In ${where}, a press on "Shorts" on the empty tool left it unpressed`)
          }
          await loadIntoSlotA(where)
          for (const { width, height } of SHORTS_TILES) {
            const name = `Thumbnail A at ${width}px`
            const image = await controlOnceShown('image', name)
            const tile = await tileOnceDecoded(image)
            if (!tile.decoded || !tile.src.startsWith('blob:')) {
              throw new Error(
                `In ${where}, "${name}" shows ${tile.src || 'nothing'}, not a decoded blob:`,
              )
            }
            const drawn = (await on(
              image,
              `function () {
              const box = this.getBoundingClientRect()
              const head = this.closest('.t-tile')?.querySelector('.t-tile__head')
              return { width: box.width, height: box.height, head: head?.textContent ?? '' }
            }`,
            )) as { width: number; height: number; head: string }
            if (Math.abs(drawn.width - width) > 0.5 || Math.abs(drawn.height - height) > 1) {
              throw new Error(
                `In ${where}, "${name}" draws ${drawn.width} x ${drawn.height}, not ${width} x ${height}`,
              )
            }
            if (!drawn.head.includes('Cropped')) {
              throw new Error(`In ${where}, "${name}" has no "Cropped" marker: ${drawn.head}`)
            }
          }
          for (const width of landscapeOnlyWidths) {
            const shown = await evaluate(
              `document.querySelector('img[alt="Thumbnail A at ${width}px"]') !== null`,
            )
            if (shown) throw new Error(`In ${where}, Shorts mode still shows the ${width}px tile`)
          }
          const notice = (await evaluate(`(() => {
          const notice = document.querySelector('[data-mismatch="A"]')
          return notice ? notice.textContent : null
        })()`)) as string | null
          if (notice === null || !notice.includes('A is a landscape image.')) {
            throw new Error(`In ${where}, slot A's mismatch notice reads ${String(notice)}`)
          }
          const switchBack = await control('button', 'Switch to Landscape')
          const inNotice = await on(
            switchBack,
            `function () { return this.closest('[data-mismatch="A"]') !== null }`,
          )
          if (inNotice !== true) {
            throw new Error(`In ${where}, "Switch to Landscape" is not in slot A's mismatch notice`)
          }
          await click(switchBack)
          await waitFor(
            `document.querySelector('[data-mismatch="A"]') === null`,
            `In ${where}, "Switch to Landscape" left slot A's mismatch notice shown`,
            50,
          )
          if (!(await optionPressed('Landscape')) || (await optionPressed('Shorts'))) {
            throw new Error(`In ${where}, "Switch to Landscape" left "Landscape" unpressed`)
          }
        }
      } finally {
        await lightAtDesktop()
      }
    },
  )

  /**
   * Each conversion's weights and the filter an image computes under it. Luminance is CSS
   * `grayscale(1)`, whose matrix the Filter Effects spec gives as Rec. 709's luma weights.
   */
  const conversions = [
    { name: 'Red filter', filter: 'url("#conv-red")', weights: RED_FILTER_WEIGHTS },
    { name: 'Blue filter', filter: 'url("#conv-blue")', weights: BLUE_FILTER_WEIGHTS },
    { name: 'Luminance', filter: 'grayscale(1)', weights: [0.2126, 0.7152, 0.0722] },
  ] as const satisfies readonly { name: string; filter: string; weights: GrayscaleWeights }[]
  /** A pixel of the fixture's red band, outside its centre block: (170, 60, 60). */
  const redBandPixel = { x: 900, y: 360 }

  /**
   * Fails unless every image of slot A's candidate in the tool, each landscape tile, the scaled
   * reference and the chip, computes `filter` as `expected`.
   */
  async function slotAImagesFilter(where: string, expected: string): Promise<void> {
    const images = (await evaluate(`[...document.querySelectorAll('.t-toolroot img')]
      .filter((image) => image.alt.startsWith('Thumbnail A'))
      .map((image) => ({ alt: image.alt, filter: getComputedStyle(image).filter }))`)) as {
      alt: string
      filter: string
    }[]
    const wanted = [
      'Thumbnail A',
      'Thumbnail A at full size',
      ...LANDSCAPE_TILES.map(({ width }) => `Thumbnail A at ${width}px`),
    ]
    const missing = wanted.filter((alt) => !images.some((image) => image.alt === alt))
    if (missing.length > 0) throw new Error(`In ${where}, the tool shows no ${missing.join(', ')}`)
    const off = images.filter((image) => image.filter !== expected)
    if (off.length > 0) {
      throw new Error(
        `In ${where}, ${off.map(({ alt, filter }) => `"${alt}" computes ${filter}`).join('; ')}, not ${expected}`,
      )
    }
  }

  /** Whether the Conversion control and the conversion hint show, read from the DOM. */
  const conversionShown = async () =>
    (await evaluate(`(() => {
      const group = [...document.querySelectorAll('[role="group"]')].some(
        (group) =>
          document.getElementById(group.getAttribute('aria-labelledby'))?.textContent === 'Conversion',
      )
      const hint = [...document.querySelectorAll('.t-hint')].some((hint) =>
        hint.textContent.startsWith('Start with luminance.'),
      )
      return { group, hint }
    })()`)) as { group: boolean; hint: boolean }

  // creator-analytics#796: in each mode, with the fixture in slot A, "Grayscale" grays every tile,
  // the scaled reference and the chip, and shows the Conversion control and its hint. Each
  // conversion's press leaves it the one pressed and gives every image its filter, and a pixel of
  // the fixture's red band, drawn through the first tile's own computed filter, comes out the gray
  // the conversion's weights give it: a filter id that does not resolve, a malformed matrix or a
  // lost `color-interpolation-filters` draws another colour. "Color" takes it all back, and the
  // page never scrolls sideways with the Conversion control wrapped at 375px.
  await walk(
    'state: the tool page grays every tile through each of the three conversions',
    async () => {
      try {
        for (const mode of walkModes) {
          const where = await toolPageIn(mode)
          await controlOnceShown('textbox', 'Title A')
          await loadIntoSlotA(where)
          const first = await controlOnceShown(
            'image',
            `Thumbnail A at ${LANDSCAPE_TILES[0]?.width}px`,
          )
          const tile = await tileOnceDecoded(first)
          if (!tile.decoded) throw new Error(`In ${where}, slot A's first tile never decoded`)

          if (await optionPressed('Grayscale')) {
            throw new Error(`In ${where}, "Grayscale" is pressed on a fresh load`)
          }
          const before = await conversionShown()
          if (before.group || before.hint) {
            throw new Error(`In ${where}, Color shows the Conversion control or its hint`)
          }
          await slotAImagesFilter(where, 'none')

          await click(await control('button', 'Grayscale'))
          if (!(await optionPressed('Grayscale'))) {
            throw new Error(`In ${where}, a press on "Grayscale" left it unpressed`)
          }
          await controlOnceShown('group', 'Conversion')
          if (!(await optionPressed('Luminance'))) {
            throw new Error(`In ${where}, Grayscale opens on a conversion other than "Luminance"`)
          }
          if (!(await conversionShown()).hint) {
            throw new Error(`In ${where}, Grayscale shows no conversion hint`)
          }
          await slotAImagesFilter(where, 'grayscale(1)')
          const page = (await evaluate(`({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          })`)) as { scrollWidth: number; clientWidth: number }
          if (page.scrollWidth > page.clientWidth) {
            throw new Error(
              `In ${where}, the Conversion control scrolls the page sideways: ${page.scrollWidth}px in ${page.clientWidth}px`,
            )
          }

          for (const conversion of conversions) {
            await click(await control('button', conversion.name))
            const pressed = []
            for (const { name } of conversions) if (await optionPressed(name)) pressed.push(name)
            if (pressed.join() !== conversion.name) {
              throw new Error(
                `In ${where}, after "${conversion.name}" the pressed conversions are ${pressed.join(', ') || 'none'}`,
              )
            }
            await slotAImagesFilter(where, conversion.filter)
            const drawn = (await on(
              first,
              `function () {
                const read = (filter) => {
                  const canvas = document.createElement('canvas')
                  canvas.width = this.naturalWidth
                  canvas.height = this.naturalHeight
                  document.body.append(canvas)
                  const context = canvas.getContext('2d')
                  context.filter = filter
                  context.drawImage(this, 0, 0)
                  const pixel = [...context.getImageData(${redBandPixel.x}, ${redBandPixel.y}, 1, 1).data]
                  canvas.remove()
                  return pixel.slice(0, 3)
                }
                return { plain: read('none'), converted: read(getComputedStyle(this).filter) }
              }`,
            )) as { plain: number[]; converted: number[] }
            const [r = 0, g = 0, b = 0] = drawn.plain
            const [wr, wg, wb] = conversion.weights
            const gray = 255 * Math.min(1, Math.max(0, (r * wr + g * wg + b * wb) / 255))
            const spread = Math.max(...drawn.converted) - Math.min(...drawn.converted)
            if (spread > 1 || drawn.converted.some((channel) => Math.abs(channel - gray) > 3)) {
              throw new Error(
                `In ${where}, "${conversion.name}" draws (${drawn.plain.join(', ')}) as (${drawn.converted.join(', ')}), not a gray of ${gray.toFixed(1)}`,
              )
            }
          }

          await click(await control('button', 'Color'))
          await slotAImagesFilter(where, 'none')
          const after = await conversionShown()
          if (after.group || after.hint) {
            throw new Error(`In ${where}, "Color" left the Conversion control or its hint shown`)
          }
        }
      } finally {
        await lightAtDesktop()
      }
    },
  )

  /** The seven parts of the tool page that focus mode hides, each by the selector that finds it. */
  const pageAroundTheTool = [
    'body > header',
    'body > footer',
    '.tool-back',
    '.tool-page > h1',
    '.tool-privacy',
    '.tool-prose',
    '.sign-in-band',
  ]

  /** Each part of the page around the tool, whether it is `inert` and whether it is drawn. */
  const pageAroundTheToolState = async () =>
    (await evaluate(`${JSON.stringify(pageAroundTheTool)}.map((selector) => {
      const element = document.querySelector(selector)
      return {
        selector,
        found: element !== null,
        inert: element?.inert ?? false,
        hidden: element ? getComputedStyle(element).display === 'none' : false,
      }
    })`)) as { selector: string; found: boolean; inert: boolean; hidden: boolean }[]

  /** Scrolls the element into the window and answers its centre there, for a real press. */
  async function centreInView(objectId: string): Promise<{ x: number; y: number }> {
    return (await on(
      objectId,
      `function () {
        this.scrollIntoView({ block: 'center', behavior: 'instant' })
        const box = this.getBoundingClientRect()
        return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
      }`,
    )) as { x: number; y: number }
  }

  /**
   * Presses the option named `name` in the group named `group`, and answers its `aria-pressed`
   * once the tool has drawn the press.
   */
  async function pressInGroup(group: string, name: string): Promise<string | null> {
    const option = `[...this.querySelectorAll('button')].find(
      (button) => button.textContent === ${JSON.stringify(name)},
    )`
    const groupId = await control('group', group)
    const found = await on(
      groupId,
      `function () {
        const option = ${option}
        option?.click()
        return option !== undefined
      }`,
    )
    if (!found) return 'missing'
    await evaluate('new Promise((resolve) => requestAnimationFrame(() => resolve(true)))')
    return (await on(
      groupId,
      `function () { return ${option}?.getAttribute('aria-pressed') ?? null }`,
    )) as string | null
  }

  /**
   * Fails unless each landscape tile of slot A that has a duration badge carries one `.t-badge` on
   * its image's bottom right corner at the size table's offset, with the badge's text, height and
   * Roboto, and the tile without one carries none. The badge is `aria-hidden`, so it is read from
   * the image's card, not the accessibility tree.
   */
  async function durationBadgesOnTheTiles(where: string, titled: string): Promise<void> {
    for (const size of LANDSCAPE_TILES) {
      const name = `Thumbnail A at ${size.width}px`
      const drawn = (await on(
        await control('image', name),
        `function () {
          const image = this.getBoundingClientRect()
          const badges = [...(this.closest('figure')?.querySelectorAll('.t-badge') ?? [])]
          const badge = badges[0]
          const box = badge?.getBoundingClientRect()
          return {
            count: badges.length,
            imageRight: image.right,
            imageBottom: image.bottom,
            text: badge?.textContent ?? null,
            height: box?.height ?? null,
            right: box?.right ?? null,
            bottom: box?.bottom ?? null,
            font: badge ? getComputedStyle(badge).fontFamily : null,
          }
        }`,
      )) as {
        count: number
        imageRight: number
        imageBottom: number
        text: string | null
        height: number | null
        right: number | null
        bottom: number | null
        font: string | null
      }
      const offset = size.durationBadge
      if (!offset) {
        if (drawn.count !== 0) throw new Error(`In ${where}, ${titled}, "${name}" has a badge`)
        continue
      }
      if (drawn.count !== 1) {
        throw new Error(`In ${where}, ${titled}, "${name}" has ${drawn.count} duration badges`)
      }
      const off = (value: number | null, wanted: number) =>
        value === null || Math.abs(value - wanted) > 0.5
      if (drawn.text !== DURATION_BADGE_TEXT || off(drawn.height, DURATION_BADGE.heightPx)) {
        throw new Error(
          `In ${where}, ${titled}, "${name}"'s badge reads ${String(drawn.text)} at ${String(drawn.height)}px tall`,
        )
      }
      if (
        off(drawn.right, drawn.imageRight - offset.rightPx) ||
        off(drawn.bottom, drawn.imageBottom - offset.bottomPx)
      ) {
        throw new Error(
          `In ${where}, ${titled}, "${name}"'s badge ends at ${String(drawn.right)}, ${String(drawn.bottom)}, not ${offset.rightPx}px and ${offset.bottomPx}px inside the image's ${drawn.imageRight}, ${drawn.imageBottom}`,
        )
      }
      if (!drawn.font?.replace(/^["']/, '').startsWith('Roboto')) {
        throw new Error(`In ${where}, ${titled}, "${name}"'s badge is set in ${String(drawn.font)}`)
      }
    }
  }

  /** The tile whose card holds each `.t-newbadge`, and the badge against its image's top left. */
  const newBadgesShown = async () =>
    (await evaluate(`[...document.querySelectorAll('.t-newbadge')].map((badge) => {
      const image = badge.closest('figure')?.querySelector('img')
      const box = badge.getBoundingClientRect()
      const imageBox = image?.getBoundingClientRect()
      return {
        tile: image?.alt ?? null,
        text: badge.textContent,
        left: box.left - (imageBox?.left ?? 0),
        top: box.top - (imageBox?.top ?? 0),
      }
    })`)) as { tile: string | null; text: string; left: number; top: number }[]

  const newBadgeTile = LANDSCAPE_TILES.find((size) => size.newBadge)

  /** Fails unless the one "New" badge on the page sits on the tile the size table gives it. */
  async function newBadgeOnItsTile(where: string): Promise<void> {
    const shown = await newBadgesShown()
    const offset = newBadgeTile?.newBadge
    const [badge] = shown
    if (
      !offset ||
      shown.length !== 1 ||
      !badge ||
      badge.tile !== `Thumbnail A at ${newBadgeTile.width}px` ||
      badge.text !== NEW_BADGE.text ||
      Math.abs(badge.left - offset.leftPx) > 0.5 ||
      Math.abs(badge.top - offset.topPx) > 0.5
    ) {
      throw new Error(`In ${where}, the "New" badges shown are ${JSON.stringify(shown)}`)
    }
  }

  /** The tool root's focus mode classes, its computed background and its box in the window. */
  const toolRootState = async () =>
    (await evaluate(`(() => {
      const root = document.querySelector('.t-toolroot')
      const box = root.getBoundingClientRect()
      return {
        focus: root.classList.contains('t-focus'),
        light: root.classList.contains('t-focus--light'),
        dark: root.classList.contains('t-focus--dark'),
        background: getComputedStyle(root).backgroundColor,
        left: box.left,
        width: box.width,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        scrollY: window.scrollY,
        rootFocused: document.activeElement === root,
      }
    })()`)) as {
      focus: boolean
      light: boolean
      dark: boolean
      background: string
      left: number
      width: number
      clientWidth: number
      scrollWidth: number
      scrollY: number
      rootFocused: boolean
    }

  /** The two `--yt-surface` values of youtube.css, as a computed background reads them. */
  const stageBackground = { light: 'rgb(255, 255, 255)', dark: 'rgb(15, 15, 15)' } as const

  /** The `--yt-raised` and `--yt-fg` values of youtube.css, as a title field on each stage reads them. */
  const stageTitleField = {
    light: { background: 'rgb(255, 255, 255)', ink: 'rgb(15, 15, 15)' },
    dark: { background: 'rgb(33, 33, 33)', ink: 'rgb(241, 241, 241)' },
  } as const

  /** The two `--yt-link` values of youtube.css, as `--accent` reads them on the stage. */
  const stageAccent = { light: '#065fd4', dark: '#3ea6ff' } as const

  async function accentOnTheStage(where: string, surface: 'light' | 'dark'): Promise<void> {
    const accent = (await evaluate(
      `getComputedStyle(document.querySelector('.t-toolroot')).getPropertyValue('--accent').trim()`,
    )) as string
    if (accent !== stageAccent[surface]) {
      throw new Error(
        `In ${where}, on the ${surface} stage the accent is ${accent}, not ${stageAccent[surface]}`,
      )
    }
  }

  async function titleFieldsOnTheStage(where: string, surface: 'light' | 'dark'): Promise<void> {
    const fields = (await evaluate(`[...document.querySelectorAll('.t-toolroot .t-input')].map(
      (field) => ({
        background: getComputedStyle(field).backgroundColor,
        ink: getComputedStyle(field).color,
      }),
    )`)) as { background: string; ink: string }[]
    const wanted = stageTitleField[surface]
    const off = fields.filter(
      ({ background, ink }) => background !== wanted.background || ink !== wanted.ink,
    )
    if (fields.length === 0 || off.length > 0) {
      throw new Error(
        `In ${where}, on the ${surface} stage the title fields draw ${JSON.stringify(fields)}, not ${JSON.stringify(wanted)}`,
      )
    }
  }

  /** Fails unless the tool is out of focus mode, the page around it back and "Focus mode" focused. */
  async function outOfFocusMode(where: string, how: string): Promise<void> {
    await waitFor(
      `document.querySelector('.t-focus') === null`,
      `In ${where}, ${how} left focus mode on`,
      50,
    )
    const around = (await pageAroundTheToolState()).filter(
      ({ found, inert, hidden }) => !found || inert || hidden,
    )
    if (around.length > 0) {
      throw new Error(`In ${where}, after ${how} the page still hides ${JSON.stringify(around)}`)
    }
    const focused = await focusedRoleAndName()
    if (focused !== 'button Focus mode') {
      throw new Error(`In ${where}, after ${how} focus is on ${focused}, not "Focus mode"`)
    }
  }

  // creator-analytics#797: in each mode, with the fixture in slot A, every landscape tile that has
  // a duration badge carries it on its image's bottom right corner at the size table's offset, in
  // Roboto, with no title and again with one, since a beside card widens by its title column; the
  // 220 tile alone carries the "New" badge at its top left, which "Hide" takes away and "Show"
  // brings back. "Focus mode" opens the stage on the surface the system's colour scheme resolves
  // to, at the top of the window and across its whole width, the rest of the page hidden and
  // inert and focus on the stage; its Background control switches the surface, and "Exit focus
  // mode", then Enter and Escape, put the page back with focus on "Focus mode".
  await walk(
    'state: the tool page in focus mode, with the "New" badge and the duration badge',
    async () => {
      try {
        for (const mode of walkModes) {
          const where = await toolPageIn(mode)
          const title = await controlOnceShown('textbox', 'Title A')
          await loadIntoSlotA(where)
          for (const { width } of LANDSCAPE_TILES) {
            const tile = await tileOnceDecoded(
              await controlOnceShown('image', `Thumbnail A at ${width}px`),
            )
            if (!tile.decoded)
              throw new Error(`In ${where}, slot A's ${width}px tile never decoded`)
          }

          await durationBadgesOnTheTiles(where, 'with no title')
          await on(title, 'function () { this.focus() }')
          await send('Input.insertText', { text: 'A title for the beside cards' })
          await waitFor(
            `document.querySelector('.t-card--beside') !== null`,
            `In ${where}, a title in "Title A" put no title beside a tile`,
            50,
          )
          await durationBadgesOnTheTiles(where, 'with a title')

          await newBadgeOnItsTile(where)
          if ((await pressInGroup('"New" badge', 'Hide')) !== 'true') {
            throw new Error(`In ${where}, a press on the "New" badge's "Hide" left it unpressed`)
          }
          const hidden = await newBadgesShown()
          if (hidden.length !== 0) {
            throw new Error(`In ${where}, "Hide" left ${hidden.length} "New" badges on the page`)
          }
          await pressInGroup('"New" badge', 'Show')
          await newBadgeOnItsTile(where)

          const surface = mode.colorScheme
          const other = surface === 'light' ? 'dark' : 'light'
          const enter = await control('button', 'Focus mode')
          const { x, y } = await centreInView(enter)
          await pressAt(x, y)
          await waitFor(
            `document.querySelector('.t-toolroot.t-focus') !== null`,
            `In ${where}, a press on "Focus mode" did not open focus mode`,
            50,
          )
          const stage = await toolRootState()
          if (!stage[surface] || stage[other]) {
            throw new Error(`In ${where}, focus mode opens on the ${other} surface`)
          }
          if (stage.background !== stageBackground[surface]) {
            throw new Error(`In ${where}, the ${surface} stage paints ${stage.background}`)
          }
          await titleFieldsOnTheStage(where, surface)
          await accentOnTheStage(where, surface)
          if (
            stage.scrollY !== 0 ||
            Math.abs(stage.left) > 0.5 ||
            Math.abs(stage.width - stage.clientWidth) > 0.5
          ) {
            throw new Error(
              `In ${where}, the stage opens ${stage.scrollY}px down, from ${stage.left}px and ${stage.width}px wide in ${stage.clientWidth}px`,
            )
          }
          if (stage.scrollWidth > stage.clientWidth) {
            throw new Error(
              `In ${where}, focus mode scrolls sideways: ${stage.scrollWidth}px in ${stage.clientWidth}px`,
            )
          }
          if (!stage.rootFocused) {
            throw new Error(`In ${where}, focus mode leaves focus on ${await focusedRoleAndName()}`)
          }
          const shown = (await pageAroundTheToolState()).filter(
            ({ found, inert, hidden }) => !found || !inert || !hidden,
          )
          if (shown.length > 0) {
            throw new Error(`In ${where}, focus mode leaves ${JSON.stringify(shown)}`)
          }
          const background = await controlOnceShown('group', 'Background')
          const options = (await on(
            background,
            `function () {
              return [...this.querySelectorAll('button')].map(
                (button) => \`\${button.textContent} \${button.getAttribute('aria-pressed')}\`,
              )
            }`,
          )) as string[]
          const wanted =
            surface === 'light' ? ['Light true', 'Dark false'] : ['Light false', 'Dark true']
          if (JSON.stringify(options) !== JSON.stringify(wanted)) {
            throw new Error(`In ${where}, the Background control holds ${JSON.stringify(options)}`)
          }
          const tile = await tileOnceDecoded(
            await control('image', `Thumbnail A at ${newBadgeTile?.width}px`),
          )
          if (Math.abs(tile.width - (newBadgeTile?.width ?? 0)) > 0.5) {
            throw new Error(`In ${where}, focus mode draws the 220px tile ${tile.width}px wide`)
          }

          await pressInGroup('Background', other === 'light' ? 'Light' : 'Dark')
          const switched = await toolRootState()
          if (!switched[other] || switched[surface]) {
            throw new Error(`In ${where}, the Background control did not switch to ${other}`)
          }
          if (switched.background !== stageBackground[other]) {
            throw new Error(`In ${where}, the ${other} stage paints ${switched.background}`)
          }
          await titleFieldsOnTheStage(where, other)
          await accentOnTheStage(where, other)

          const exit = await control('button', 'Exit focus mode')
          const exitAt = await centreInView(exit)
          await pressAt(exitAt.x, exitAt.y)
          await outOfFocusMode(where, 'a press on "Exit focus mode"')

          await on(await control('button', 'Focus mode'), 'function () { this.focus() }')
          await pressKey('Enter', 13, { text: '\r' })
          await waitFor(
            `document.querySelector('.t-toolroot.t-focus') !== null`,
            `In ${where}, Enter on "Focus mode" did not open focus mode`,
            50,
          )
          await pressKey('Escape', 27)
          await outOfFocusMode(where, 'Escape')
        }
      } finally {
        await lightAtDesktop()
      }
    },
  )

  // Stripe's real return address after a Tip, the old profile path, which opens Settings in its
  // place (creator-analytics#589), with its thanks as well as its Support section.
  await visit('/app/profile?support=thanks')
  await walk('state: Settings support section', async () => {
    const path = await evaluate('location.pathname')
    if (path !== '/app/settings')
      throw new Error(`/app/profile?support=thanks landed on ${String(path)}`)
    await control('heading', 'Settings')
    const tip = await control('link', 'Leave a tip')
    const href = await on(tip, `function () { return this.getAttribute('href') }`)
    if (href !== sampleSupport.link) throw new Error(`"Leave a tip" links to ${String(href)}`)
    await control('StaticText', 'Thank you for supporting Stillstats.')
  })
  await visit('/app/')
  await walk('state: "What\'s new" banner gone after "What\'s new" opened', async () => {
    const shown = await evaluate(
      `document.querySelector('section[aria-label=${JSON.stringify(bannerLabel)}]') !== null`,
    )
    if (shown) throw new Error('The banner still shows after "What\'s new" opened')
  })
  await walk('state: sidebar support item', async () => {
    await sidebarSupportItem()
  })
  /** The sidebar's "Thumbnail preview" item's name, open and collapsed (creator-analytics#799). */
  const thumbnailPreviewItem = 'Thumbnail preview (opens in a new tab)'
  // creator-analytics#799, #890: beside the open sidebar at 1280px, the "Thumbnail preview" item
  // opens the tool page in a new tab, named so. It is the last link of the "Channel screens" nav,
  // after "What's new", and never the current page; its text keeps one line, and its external link
  // icon shows after the text, about 14px square. The name is restated from apps/web/src/sidebar.ts
  // (`toolLinkOf`), which the walk's tsconfig does not compile.
  await walk('state: sidebar "Thumbnail preview" item', async () => {
    const link = await control('link', thumbnailPreviewItem)
    const opens = (await on(
      link,
      `function () { return { href: this.getAttribute('href'), target: this.getAttribute('target') } }`,
    )) as { href: string | null; target: string | null }
    if (opens.href !== '/tools/thumbnail-preview' || opens.target !== '_blank') {
      throw new Error(`The sidebar's "Thumbnail preview" opens ${JSON.stringify(opens)}`)
    }
    const place = (await on(
      link,
      `function () {
        const nav = this.closest('nav[aria-label="Channel screens"]')
        const links = nav ? [...nav.querySelectorAll('a')].map((each) => each.textContent) : []
        const text = this.querySelector(':scope > span')
        const icon = this.querySelector('svg.sidebar-external-icon')
        const box = icon ? icon.getBoundingClientRect() : null
        return {
          links,
          current: this.hasAttribute('aria-current'),
          textLines: text ? text.getClientRects().length : 0,
          textHeight: text ? text.getBoundingClientRect().height : 0,
          // A computed "normal" line height reads as about 1.2 times the font size.
          lineHeight: text
            ? parseFloat(getComputedStyle(text).lineHeight) ||
              1.2 * parseFloat(getComputedStyle(text).fontSize)
            : 0,
          iconAfterText: Boolean(
            icon && text && text.compareDocumentPosition(icon) & Node.DOCUMENT_POSITION_FOLLOWING,
          ),
          icon: box && { width: box.width, height: box.height },
          iconVisible: Boolean(icon) && getComputedStyle(icon).visibility === 'visible',
        }
      }`,
    )) as {
      links: string[]
      current: boolean
      textLines: number
      textHeight: number
      lineHeight: number
      iconAfterText: boolean
      icon: { width: number; height: number } | null
      iconVisible: boolean
    }
    const inList =
      JSON.stringify(place.links) ===
      JSON.stringify(['Videos', 'Audience', 'Retention', "What's new", 'Thumbnail preview'])
    const oneLine = place.textLines === 1 && place.textHeight < 1.5 * place.lineHeight
    const iconAbout14 =
      place.icon !== null &&
      Math.abs(place.icon.width - 14) <= 0.5 &&
      Math.abs(place.icon.height - 14) <= 0.5
    if (!inList || place.current || !oneLine || !place.iconAfterText || !iconAbout14) {
      throw new Error(`The sidebar's "Thumbnail preview" sits so: ${JSON.stringify(place)}`)
    }
    if (!place.iconVisible) throw new Error('The external link icon is not visible')
  })

  /** The control with this role and name, once it shows, within about five seconds. */
  async function controlOnceShown(role: string, name: string): Promise<string> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await control(role, name)
      } catch (error) {
        if (attempt >= 50) throw error
        await delay(100)
      }
    }
  }

  /** The width of the sidebar's panel the element sits in. */
  const panelWidthOf = async (objectId: string) =>
    (await on(
      objectId,
      `function () { return this.closest('[data-slot="sidebar"]').getBoundingClientRect().width }`,
    )) as number

  /**
   * Whether a tooltip named `name` shows outside the sidebar, within about five seconds. The
   * control's own text stays on the accessibility tree, hidden from view in the column, so the
   * tooltip's is the one shown outside the sidebar.
   */
  async function tooltipShown(name: string): Promise<boolean> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const { root } = (await send('DOM.getDocument', { depth: 0 })) as {
        root: { nodeId: number }
      }
      const { nodes } = (await send('Accessibility.queryAXTree', {
        nodeId: root.nodeId,
        role: 'StaticText',
        accessibleName: name,
      })) as { nodes: { backendDOMNodeId?: number }[] }
      for (const { backendDOMNodeId } of nodes) {
        if (!backendDOMNodeId) continue
        const { object } = (await send('DOM.resolveNode', {
          backendNodeId: backendDOMNodeId,
        })) as { object: { objectId: string } }
        const outside = await on(
          object.objectId,
          `function () {
            const element = this.parentElement
            const box = element.getBoundingClientRect()
            return !element.closest('[data-slot="sidebar"]') && box.width > 1 && box.height > 1
          }`,
        )
        if (outside === true) return true
      }
      await delay(100)
    }
    return false
  }

  /** Whether the current link's computed background differs from the other link's. */
  const currentLinkFilled = async () =>
    (await on(
      await control('link', 'Videos'),
      `function () {
        const nav = this.closest('nav')
        const current = nav.querySelector('a[aria-current="page"]')
        const other = nav.querySelector('a:not([aria-current])')
        return getComputedStyle(current).backgroundColor !== getComputedStyle(other).backgroundColor
      }`,
    )) === true

  const sampleChannelIcon = 'Channel: Fennmoor Kitchen (@fennmoorkitchen)'
  /**
   * The account menu's button in the open sidebar's column, the avatar, "Settings" over the email
   * and a chevron: "Settings, " and the email (creator-analytics#531, #590). Collapsed, and in the
   * header, it is the avatar alone, "Settings", a button, where the menu's Settings is a menuitem.
   */
  const accountRow = `${settingsName}, ${sampleUser.email}`

  // creator-analytics#417 and #476: the sidebar collapses to its icons from its button; the current
  // link keeps a fill the other has not, open and collapsed; on a real Tab focus, a collapsed link,
  // the support icon, the channel icon and the collapse button each show their tooltip; and the
  // button expands it again, so the steps after this one run beside the open sidebar. The stub
  // lists a second channel for this step alone, so the channel picker and its icon show. The stub
  // keeps the saved state, so the step expands it again even when it fails.
  await walk('state: sidebar collapsed to icons', async () => {
    stub.listSecondChannel(true)
    try {
      await send('Page.navigate', { url: `${stub.origin}/app/` })
      await ready()
      const links = await control('navigation', 'Channel screens')
      const openWidth = await panelWidthOf(links)
      if (!(await currentLinkFilled())) {
        throw new Error("Open, the current link's background is the other link's")
      }
      await click(await control('button', 'Collapse sidebar'))
      await controlOnceShown('button', 'Expand sidebar')
      const collapsedWidth = await panelWidthOf(links)
      const rem = (await evaluate(
        'parseFloat(getComputedStyle(document.documentElement).fontSize)',
      )) as number
      if (!(collapsedWidth < openWidth && collapsedWidth <= 3 * rem)) {
        throw new Error(
          `Collapsed, the sidebar is ${collapsedWidth}px wide, from ${openWidth}px open, not at most 3rem`,
        )
      }
      if (!(await currentLinkFilled())) {
        throw new Error("Collapsed, the current link's background is the other link's")
      }
      // creator-analytics#890: collapsed, the "Thumbnail preview" item stays in the nav and shows
      // its image icon alone; its external link icon has no box.
      const collapsedTool = (await on(
        await control('link', thumbnailPreviewItem),
        `function () {
          const icon = this.querySelector('svg.sidebar-external-icon')
          return {
            inNav: Boolean(this.closest('nav[aria-label="Channel screens"]')),
            iconDisplay: icon ? getComputedStyle(icon).display : null,
            iconBoxes: icon ? icon.getClientRects().length : null,
          }
        }`,
      )) as { inNav: boolean; iconDisplay: string | null; iconBoxes: number | null }
      if (
        !collapsedTool.inNav ||
        collapsedTool.iconDisplay !== 'none' ||
        collapsedTool.iconBoxes !== 0
      ) {
        throw new Error(
          `Collapsed, the sidebar's "Thumbnail preview" shows so: ${JSON.stringify(collapsedTool)}`,
        )
      }
      // Base UI opens a tooltip on a focus that shows its ring only, so a real Tab moves focus
      // from the control before each one to it, as a keyboard does.
      const tabbedTo = [
        { from: ['link', 'Videos'], to: ['link', 'Audience'], tooltip: 'Audience' },
        { from: ['link', 'Audience'], to: ['link', 'Retention'], tooltip: 'Retention' },
        { from: ['link', 'Retention'], to: ['link', "What's new"], tooltip: "What's new" },
        {
          from: ['link', "What's new"],
          to: ['link', thumbnailPreviewItem],
          tooltip: 'Thumbnail preview',
        },
        {
          from: ['link', thumbnailPreviewItem],
          to: ['link', 'Send feedback'],
          tooltip: 'Send feedback',
        },
        {
          from: ['link', 'Send feedback'],
          to: ['link', 'Support Stillstats'],
          tooltip: 'Support Stillstats',
        },
        {
          from: ['link', 'Support Stillstats'],
          to: ['button', sampleChannelIcon],
          tooltip: sampleChannelIcon,
        },
        {
          from: ['button', settingsName],
          to: ['button', 'Expand sidebar'],
          tooltip: 'Expand sidebar',
        },
      ] as const
      for (const { from, to, tooltip } of tabbedTo) {
        await on(await control(from[0], from[1]), 'function () { this.focus() }')
        await pressKey('Tab', 9, { code: 'Tab' })
        if (
          (await on(
            await control(to[0], to[1]),
            'function () { return document.activeElement === this }',
          )) !== true
        ) {
          throw new Error(`Tab from ${from[1]} did not move focus to ${to[1]}`)
        }
        if (!(await tooltipShown(tooltip))) {
          throw new Error(`No tooltip named "${tooltip}" shows on a focus of its icon`)
        }
      }
      await click(await control('button', 'Expand sidebar'))
      await controlOnceShown('button', 'Collapse sidebar')
      const reopenedWidth = await panelWidthOf(await control('navigation', 'Channel screens'))
      if (reopenedWidth !== openWidth) {
        throw new Error(
          `Expanded again, the sidebar is ${reopenedWidth}px wide, not ${openWidth}px`,
        )
      }
    } finally {
      const expand = await control('button', 'Expand sidebar').catch(() => null)
      if (expand) await click(expand)
      stub.listSecondChannel(false)
      await send('Page.navigate', { url: `${stub.origin}/app/` })
      await ready()
    }
  })

  // creator-analytics#476: from 48rem the sidebar runs the window's full height outside the
  // scroll, so it keeps its place as the list scrolls, and its last item, the collapse button,
  // ends at the window's bottom.
  await walk('state: sidebar in place as the list scrolls', async () => {
    const toggle = await control('button', 'Collapse sidebar')
    // The avatar is the row's first child, a picture inside the one button.
    const avatar = (await on(
      await control('button', accountRow),
      `function () {
        const box = this.firstElementChild.getBoundingClientRect()
        return { width: box.width, height: box.height }
      }`,
    )) as { width: number; height: number }
    if (Math.abs(avatar.width - avatar.height) > 0.5) {
      throw new Error(`The avatar beside the email is not round: ${JSON.stringify(avatar)}`)
    }
    const placeOf = async () =>
      (await on(
        toggle,
        `function () {
          const panel = this.closest('[data-slot="sidebar"]').getBoundingClientRect()
          return {
            top: panel.top,
            bottom: panel.bottom,
            toggleBottom: this.getBoundingClientRect().bottom,
            height: document.documentElement.clientHeight,
            scrolled: window.scrollY,
          }
        }`,
      )) as { top: number; bottom: number; toggleBottom: number; height: number; scrolled: number }
    try {
      const before = await placeOf()
      await evaluate('window.scrollBy(0, 2000)')
      await delay(100)
      const after = await placeOf()
      if (after.scrolled - before.scrolled !== 2000) {
        throw new Error(`The list scrolled by ${after.scrolled - before.scrolled}px, not 2000px`)
      }
      for (const [when, place] of [
        ['before the scroll', before],
        ['after it', after],
      ] as const) {
        if (place.top !== 0 || Math.abs(place.bottom - place.height) > 1) {
          throw new Error(
            `The sidebar is not the window's full height ${when}: ${JSON.stringify(place)}`,
          )
        }
        if (Math.abs(place.toggleBottom - place.height) > 1) {
          throw new Error(
            `The collapse button's bottom is not at the window's bottom ${when}: ${JSON.stringify(place)}`,
          )
        }
      }
    } finally {
      await evaluate('window.scrollTo(0, 0)')
    }
  })

  /** A real press of the mouse at a point of the page, as a creator's press is. */
  async function pressAt(x: number, y: number): Promise<void> {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 })
    }
  }

  /**
   * A real press of the key `key`, whose Windows key code is `keyCode`, as a keyboard sends it: its
   * physical `code`, and the `text` it types, which Chrome needs to activate a button on Enter.
   */
  async function pressKey(
    key: string,
    keyCode: number,
    { code = key, text }: { code?: string; text?: string } = {},
  ): Promise<void> {
    for (const type of ['keyDown', 'keyUp']) {
      await send('Input.dispatchKeyEvent', {
        type,
        key,
        code,
        windowsVirtualKeyCode: keyCode,
        ...(type === 'keyDown' && text ? { text } : {}),
      })
    }
  }

  /** The centre of the element, in the viewport. */
  const centreOf = async (objectId: string) =>
    (await on(
      objectId,
      `function () {
        const box = this.getBoundingClientRect()
        return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
      }`,
    )) as { x: number; y: number }

  const menuOpen = `!!document.querySelector('[role="menu"]')`
  const menuClosed = `!document.querySelector('[role="menu"]')`

  /**
   * The text of each line an element shows, from the leaf spans it holds, and whether each sits on
   * one line with its whole text on view: no taller than its line height, and no wider than its
   * box, so no ellipsis cuts it. A function of `this`, so it runs on a picker's button, on each
   * option of its list, and on the account row's lines.
   */
  const linesOfThis = `function () {
    return [...this.querySelectorAll('span')]
      .filter((span) => !span.querySelector('span') && span.textContent.trim() !== '')
      .map((span) => {
        const lineHeight = parseFloat(getComputedStyle(span).lineHeight)
        return {
          text: span.textContent,
          oneLine: span.getBoundingClientRect().height <= lineHeight + 0.5,
          whole: span.scrollWidth <= span.clientWidth,
          ellipsis: getComputedStyle(span).textOverflow === 'ellipsis',
        }
      })
  }`
  type Line = { text: string; oneLine: boolean; whole: boolean; ellipsis: boolean }
  const linesIn = (objectId: string) => on(objectId, linesOfThis) as Promise<Line[]>

  const pickerOpen = (picker: string) =>
    on(picker, `function () { return this.getAttribute('aria-expanded') === 'true' }`)

  // creator-analytics#531, #537: at 1280px, with the second channel listed, the sidebar's channel
  // picker shows the channel's handle over its name, each on one line with no ellipsis, and a real
  // press opens its list, each option on the same two lines, none of them wrapped or cut. The stub
  // lists the second channel for this step alone.
  await walk('state: sidebar channel picker on two lines', async () => {
    stub.listSecondChannel(true)
    try {
      await send('Page.navigate', { url: `${stub.origin}/app/` })
      await ready()
      const picker = await control('combobox', sampleChannelIcon)
      const lines = await linesIn(picker)
      const expected = [sampleChannel.handle, sampleChannel.title]
      if (JSON.stringify(lines.map(({ text }) => text)) !== JSON.stringify(expected)) {
        throw new Error(`The channel picker shows ${JSON.stringify(lines)}, not ${expected}`)
      }
      const cut = lines.filter(({ oneLine, whole }) => !oneLine || !whole)
      if (cut.length > 0) {
        throw new Error(`The channel picker's lines wrap or are cut short: ${JSON.stringify(cut)}`)
      }
      const { x, y } = await centreOf(picker)
      await pressAt(x, y)
      for (let attempt = 0; attempt < 30 && (await pickerOpen(picker)) !== true; attempt++) {
        await delay(100)
      }
      if ((await pickerOpen(picker)) !== true) {
        throw new Error('The channel picker did not open on a press')
      }
      const optionLines = (await evaluate(
        `[...document.querySelectorAll('[role="option"]')].map((option) => (${linesOfThis}).call(option))`,
      )) as Line[][]
      const expectedOptions = [
        [sampleChannel.handle, sampleChannel.title],
        [sampleSecondChannel.handle, sampleSecondChannel.title],
      ]
      const optionTexts = optionLines.map((option) => option.map(({ text }) => text))
      if (JSON.stringify(optionTexts) !== JSON.stringify(expectedOptions)) {
        throw new Error(
          `The channel picker's options show ${JSON.stringify(optionTexts)}, not ${JSON.stringify(expectedOptions)}`,
        )
      }
      const cutOptions = optionLines.flat().filter(({ oneLine, whole }) => !oneLine || !whole)
      if (cutOptions.length > 0) {
        throw new Error(
          `The channel picker's option lines wrap or are cut short: ${JSON.stringify(cutOptions)}`,
        )
      }
      await pressKey('Escape', 27)
      for (let attempt = 0; attempt < 30 && (await pickerOpen(picker)) === true; attempt++) {
        await delay(100)
      }
      if ((await pickerOpen(picker)) === true) {
        throw new Error('The channel picker did not close on Escape')
      }
    } finally {
      stub.listSecondChannel(false)
      await send('Page.navigate', { url: `${stub.origin}/app/` })
      await ready()
    }
  })

  /** The account row's lines, read in its `.account-lines`, as the avatar's letter is a leaf span. */
  const accountLinesOf = async (row: string) =>
    (await on(
      row,
      `function () { return (${linesOfThis}).call(this.querySelector('.account-lines')) }`,
    )) as Line[]

  // creator-analytics#590, #537: at 1280px the account row shows "Settings" over the sample's
  // email, each on one line with no ellipsis, and the row is one button, so a real press anywhere
  // on it, on the avatar, on each line and on the chevron, opens the account menu.
  await walk(
    'state: account row on two lines, and a press anywhere on it opens the menu',
    async () => {
      const row = await control('button', accountRow)
      const lines = await accountLinesOf(row)
      const expected = [settingsName, sampleUser.email]
      if (JSON.stringify(lines.map(({ text }) => text)) !== JSON.stringify(expected)) {
        throw new Error(`The account row shows ${JSON.stringify(lines)}, not ${expected}`)
      }
      const cut = lines.filter(({ oneLine, whole }) => !oneLine || !whole)
      if (cut.length > 0) {
        throw new Error(`The account row's lines wrap or are cut short: ${JSON.stringify(cut)}`)
      }
      const parts = (await on(
        row,
        `function () {
        const parts = [
          ['avatar', this.querySelector(':scope > .avatar')],
          ...[...this.querySelectorAll('.account-lines > span')].map((line) => [line.textContent, line]),
          ['chevron', this.querySelector(':scope > .account-chevron')],
        ]
        return parts.map(([part, element]) => {
          const box = element?.getBoundingClientRect()
          return box && { part, x: box.left + box.width / 2, y: box.top + box.height / 2 }
        })
      }`,
      )) as ({ part: string; x: number; y: number } | undefined)[]
      if (parts.length !== 4 || parts.some((part) => !part)) {
        throw new Error(
          `The account row is not an avatar, two lines and a chevron: ${JSON.stringify(parts)}`,
        )
      }
      for (const part of parts as { part: string; x: number; y: number }[]) {
        await pressAt(part.x, part.y)
        await waitFor(
          menuOpen,
          `The account menu did not open on a press on the row's ${part.part}`,
          30,
        )
        await pressKey('Escape', 27)
        await waitFor(menuClosed, 'The account menu did not close on Escape', 30)
      }
    },
  )

  // creator-analytics#531, #582, #799: with the second channel, "Thumbnail preview", "Send
  // feedback" and the support item listed, at 1280px and the column's minimum height
  // (`sidebarColumnQuery`), the collapse button's bottom sits inside the window; one pixel
  // shorter, the header shows with its Menu and the account menu, the links are off view until
  // the Menu opens, and no collapse button (creator-analytics#891).
  await walk('state: sidebar column at its minimum height', async () => {
    const minimum = /\(min-height:\s*([\d.]+)rem\)/.exec(sidebarColumnQuery)?.[1]
    if (!minimum) throw new Error(`No rem min-height in ${sidebarColumnQuery}`)
    const rem = (await evaluate(
      'parseFloat(getComputedStyle(document.documentElement).fontSize)',
    )) as number
    const height = Math.round(Number(minimum) * rem)
    stub.listSecondChannel(true)
    try {
      await send('Emulation.setDeviceMetricsOverride', { ...viewport, height, mobile: false })
      await send('Page.navigate', { url: `${stub.origin}/app/` })
      await ready()
      await control('combobox', sampleChannelIcon)
      await control('link', thumbnailPreviewItem)
      await control('link', 'Send feedback')
      await control('link', 'Support Stillstats')
      const place = (await on(
        await control('button', 'Collapse sidebar'),
        `function () {
          return { bottom: this.getBoundingClientRect().bottom, height: document.documentElement.clientHeight }
        }`,
      )) as { bottom: number; height: number }
      if (!(place.bottom <= place.height)) {
        throw new Error(
          `At ${height}px tall the collapse button's bottom is past the window: ${JSON.stringify(place)}`,
        )
      }
      await send('Emulation.setDeviceMetricsOverride', {
        ...viewport,
        height: height - 1,
        mobile: false,
      })
      await waitFor(
        `!!document.querySelector('header')`,
        `At ${height - 1}px tall no header shows`,
        30,
      )
      const inHeader = await on(
        await control('button', settingsName),
        `function () { return !!this.closest('header') }`,
      )
      if (inHeader !== true) {
        throw new Error(`At ${height - 1}px tall the account menu is not in the header`)
      }
      const menu = await control('button', 'Menu')
      if ((await on(menu, `function () { return !!this.closest('header') }`)) !== true) {
        throw new Error(`At ${height - 1}px tall the Menu button is not in the header`)
      }
      for (const name of ['Videos', 'Audience', 'Retention', "What's new"]) {
        const link = await control('link', name).catch(() => null)
        if (link)
          throw new Error(`At ${height - 1}px tall "${name}" is on view with the Menu closed`)
      }
      await click(menu)
      await control('link', 'Videos')
      await control('link', 'Audience')
      await control('link', 'Retention')
      await control('link', "What's new")
      for (const name of ['Collapse sidebar', 'Expand sidebar']) {
        const toggle = await control('button', name).catch(() => null)
        if (toggle) throw new Error(`At ${height - 1}px tall the collapse button is on view`)
      }
    } finally {
      stub.listSecondChannel(false)
      await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
      await send('Page.navigate', { url: `${stub.origin}/app/` })
      await ready()
    }
  })

  // creator-analytics#507: at 1280px, while the DevTools Fetch domain holds the session read, the
  // sidebar shows busy from the first paint, with the wordmark and the avatar's place; once the
  // read lands, the wordmark and the avatar sit where they were, and no header showed at any
  // point. The pattern ends at `/api/me`, so the preferences and support reads go through.
  let pausedSessionRead: string | null = null
  listen(({ method, params }) => {
    if (method === 'Fetch.requestPaused') pausedSessionRead = String(params.requestId)
  })
  await walk("state: sidebar's place while the session is read", async () => {
    type Box = { left: number; top: number; width: number; height: number }
    const boxOf = `function () {
      const { left, top, width, height } = this.getBoundingClientRect()
      return { left, top, width, height }
    }`
    const moved = (before: Box, after: Box) =>
      (['left', 'top', 'width', 'height'] as const).some(
        (side) => Math.abs(before[side] - after[side]) > 0.5,
      )
    pausedSessionRead = null
    await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/me' }] })
    try {
      await send('Page.navigate', { url: `${stub.origin}/app/` })
      for (let attempt = 0; attempt < 100 && pausedSessionRead === null; attempt++) {
        await delay(50)
      }
      if (pausedSessionRead === null) throw new Error('The session read was never held')
      await waitFor(
        `!!document.querySelector('[data-slot="sidebar"][aria-busy="true"] [data-slot="sidebar-footer"] [aria-hidden="true"]')`,
        'No busy sidebar with its footer places shows while the session is read',
        100,
      )
      // Records a header from here on, so one that shows and goes between two reads still fails.
      await evaluate(`(() => {
        window.__headerShown = !!document.querySelector('main header')
        new MutationObserver(() => {
          if (document.querySelector('main header')) window.__headerShown = true
        }).observe(document.body, { childList: true, subtree: true })
      })()`)
      const wordmarkBefore = (await on(await control('link', 'stillstats'), boxOf)) as Box
      // The avatar's place is the account place's first child, a still block a screen reader skips.
      const avatarBefore = (await evaluate(`(() => {
        const place = document.querySelector('[data-slot="sidebar"][aria-busy="true"] [data-slot="sidebar-footer"] > :first-child > :first-child')
        if (!place) return null
        const { left, top, width, height } = place.getBoundingClientRect()
        return { left, top, width, height }
      })()`)) as Box | null
      if (!avatarBefore) throw new Error("No avatar's place in the busy sidebar's footer")
      await send('Fetch.continueRequest', { requestId: pausedSessionRead })
      await ready()
      const wordmarkAfter = (await on(await control('link', 'stillstats'), boxOf)) as Box
      // The avatar is the account row's first child, a picture inside the one button.
      const avatarAfter = (await on(
        await control('button', accountRow),
        `function () {
          const { left, top, width, height } = this.firstElementChild.getBoundingClientRect()
          return { left, top, width, height }
        }`,
      )) as Box
      if ((await evaluate('window.__headerShown')) !== false) {
        throw new Error('A header showed while the session was read or as it landed')
      }
      if (moved(wordmarkBefore, wordmarkAfter)) {
        throw new Error(
          `The wordmark moved as the session landed: ${JSON.stringify({ wordmarkBefore, wordmarkAfter })}`,
        )
      }
      if (moved(avatarBefore, avatarAfter)) {
        throw new Error(
          `The avatar moved as the session landed: ${JSON.stringify({ avatarBefore, avatarAfter })}`,
        )
      }
    } finally {
      await send('Fetch.disable')
      // The steps after this one start on the list's route, landed.
      if ((await evaluate(`(${screenLanded})(document)`)) !== true) {
        await send('Page.navigate', { url: `${stub.origin}/app/` })
        await ready()
      }
    }
  })

  // happy-dom cannot show these, so the walk does, in Chrome (the Limits at the top of
  // apps/web/src/app.test.ts): a real press on the account row opens the menu, beside the
  // sidebar's account row, its bottom at the row's (creator-analytics#476, #531); a real arrow key
  // moves focus onto an item; a real Escape, then a real press on nothing, each close it with focus
  // back on the avatar; a real press on the wordmark closes it and reaches the wordmark; and a real
  // Enter, Space or ArrowDown on the focused avatar opens it with focus on Settings.
  await walk('state: account menu open', async () => {
    const avatar = await control('button', accountRow)
    const { x, y } = await centreOf(avatar)
    await pressAt(x, y)
    await waitFor(menuOpen, 'The account menu did not open on a press of the avatar', 30)
    if (
      (await on(avatar, `function () { return this.getAttribute('aria-expanded') }`)) !== 'true'
    ) {
      throw new Error('The avatar does not say its menu is open')
    }
    await control('menuitem', 'Settings')
    const placed = await on(
      avatar,
      `function () {
        const avatar = this.getBoundingClientRect()
        const menu = document.querySelector('[role="menu"]').getBoundingClientRect()
        return menu.left > avatar.right && Math.abs(menu.bottom - avatar.bottom) < 1
      }`,
    )
    if (placed !== true) {
      throw new Error("The account menu is not beside the account row, its bottom at the row's")
    }
    await ready()

    await pressKey('ArrowDown', 40)
    // The item after Settings is the Theme group's Light, a radio item (creator-analytics#692).
    await waitFor(
      `['menuitem', 'menuitemradio'].includes(document.activeElement?.getAttribute('role'))`,
      'An arrow key did not move focus onto an item of the account menu',
      30,
    )

    await pressKey('Escape', 27)
    await waitFor(menuClosed, 'The account menu did not close on Escape', 30)
    if ((await on(avatar, 'function () { return document.activeElement === this }')) !== true) {
      throw new Error('Focus did not go back to the avatar after Escape')
    }

    await pressAt(x, y)
    await waitFor(menuOpen, 'The account menu did not open again', 30)
    // The sidebar's empty middle, under its links, above its footer and left of the menu, holds
    // nothing.
    await pressAt(x, viewport.height / 2)
    await waitFor(menuClosed, 'The account menu did not close on a press outside it', 30)
    if ((await on(avatar, 'function () { return document.activeElement === this }')) !== true) {
      throw new Error('Focus did not go back to the avatar after a press outside')
    }

    // A press on another control outside reaches it, and that control keeps focus: the menu is not
    // modal. The wordmark follows to the list, the screen on view, so the list stays.
    await pressAt(x, y)
    await waitFor(menuOpen, 'The account menu did not open a third time', 30)
    const wordmark = await control('link', 'stillstats')
    const wordmarkAt = await centreOf(wordmark)
    await pressAt(wordmarkAt.x, wordmarkAt.y)
    await waitFor(menuClosed, 'The account menu did not close on a press on the wordmark', 30)
    if ((await on(wordmark, 'function () { return document.activeElement === this }')) !== true) {
      throw new Error('A press on the wordmark with the menu open did not reach the wordmark')
    }
    await ready()

    // A real Enter, Space or ArrowDown on the focused avatar opens the menu with focus on Settings,
    // as a keyboard opens it: Chrome activates the button, and Base UI moves focus into the popup.
    const keys = [
      { name: 'Enter', key: 'Enter', keyCode: 13, text: '\r' },
      { name: 'Space', key: ' ', keyCode: 32, code: 'Space', text: ' ' },
      { name: 'ArrowDown', key: 'ArrowDown', keyCode: 40 },
    ]
    for (const { name, key, keyCode, ...typed } of keys) {
      await on(await control('button', accountRow), 'function () { this.focus() }')
      await pressKey(key, keyCode, typed)
      await waitFor(
        `document.activeElement?.getAttribute('role') === 'menuitem' && document.activeElement.textContent.trim() === 'Settings'`,
        `${name} on the avatar did not open the account menu with focus on Settings`,
        30,
      )
      await pressKey('Escape', 27)
      await waitFor(menuClosed, `The account menu opened on ${name} did not close on Escape`, 30)
    }
  })

  // creator-analytics#687, #690: the custom range opens in a Popover holding the Calendar, in each
  // of the walk's modes. On the list's route, picking "Custom range" opens the dialog with focus on
  // a day of the Calendar, two months at the desktop width and one at 375px, under the select, and
  // leaves the sticky bar's height as it was; at 375px the page still shows outside the dialog. A
  // real Escape closes it, the select shows the window before and has focus again. Reopened, the
  // day after the sample channel's last processed day is disabled, and a real press on it changes
  // no selected day. Real presses on 30 September and 13 October, paging back a month at 375px, and
  // Apply land on the custom route and show the compact button beside the select, found by its
  // accessible name on Chrome's tree; a real press on it opens the dialog on the applied days, and
  // a real Escape gives it focus back. A violation in a mode carries that mode's step name.
  const rangeDialog = `document.querySelector('[role="dialog"][aria-label="Custom range"]')`
  const monthGrids = `(${rangeDialog}?.querySelectorAll('[role="grid"]').length ?? 0)`
  const selectedDays = `[...(${rangeDialog}?.querySelectorAll('[role="gridcell"][aria-selected="true"]:not([data-hidden])') ?? [])].map((cell) => cell.getAttribute('data-day'))`
  const rangeEnd = (end: 'start' | 'end') =>
    `${rangeDialog}?.querySelector('button[data-range-${end}="true"]')?.closest('[role="gridcell"]')?.getAttribute('data-day')`
  /** A day's accessible name as the app gives it, the browser's long date. */
  const dayName = async (day: string) =>
    (await evaluate(
      `new Date(${JSON.stringify(`${day}T00:00:00Z`)}).toLocaleDateString(undefined, { dateStyle: 'long', timeZone: 'UTC' })`,
    )) as string
  async function pressDay(day: string): Promise<void> {
    const at = await centreOf(await control('button', await dayName(day)))
    await pressAt(at.x, at.y)
  }
  const stickyBarHeight = `function () {
    let bar = this.parentElement
    while (bar && getComputedStyle(bar).position !== 'sticky') bar = bar.parentElement
    return bar ? bar.getBoundingClientRect().height : null
  }`
  try {
    for (const mode of walkModes) {
      const suffix = `${mode.colorScheme === 'dark' ? ' in dark mode' : ''}${mode.phone ? ' at a phone width' : ''}`
      await walk(`state: custom range Popover${suffix}`, async () => {
        await send('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-color-scheme', value: mode.colorScheme }],
        })
        await send('Emulation.setDeviceMetricsOverride', {
          ...(mode.phone ? narrow : viewport),
          mobile: false,
        })
        await send('Page.navigate', { url: `${stub.origin}/app/` })
        await ready()
        const where = `${mode.colorScheme} mode at ${mode.phone ? '375px' : '1280px'}`

        const select = await control('combobox', 'Date range')
        const before = await on(select, 'function () { return this.value }')
        const heightBefore = (await on(select, stickyBarHeight)) as number | null
        if (heightBefore === null)
          throw new Error(`In ${where} the date range sits in no sticky bar`)
        await on(select, 'function () { this.focus() }')
        await pick(select, 'custom')
        await waitFor(`!!${rangeDialog}`, `In ${where} "Custom range" opened no dialog`, 30)
        const months = mode.phone ? 1 : 2
        await waitFor(
          `${monthGrids} === ${months}`,
          `In ${where} the Calendar did not show ${months} month${months === 1 ? '' : 's'}`,
          30,
        )
        await waitFor(
          `${rangeDialog}.contains(document.activeElement) && !!document.activeElement.closest('[role="grid"]')`,
          `In ${where} focus did not move onto a day of the Calendar`,
          30,
        )
        // creator-analytics#729: Chrome sends a click to the select after a choice from its native
        // menu, which `pick` does not make. The Popover that choice opened stays open through it.
        await on(
          select,
          `function () { this.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })) }`,
        )
        await delay(200)
        const afterClick = (await on(
          select,
          `function () { return { open: !!${rangeDialog}, value: this.value } }`,
        )) as { open: boolean; value: string }
        if (!afterClick.open || afterClick.value !== 'custom') {
          throw new Error(
            `In ${where} a click on the select, as Chrome sends after a menu choice, closed the custom range and left the select on "${afterClick.value}"`,
          )
        }
        const heightOpen = (await on(select, stickyBarHeight)) as number
        if (Math.abs(heightOpen - heightBefore) > 0.5) {
          throw new Error(
            `In ${where} the bar's height went from ${heightBefore}px to ${heightOpen}px with the custom range open`,
          )
        }
        const placed = (await on(
          select,
          `function () {
            const popup = ${rangeDialog}
            const box = popup.getBoundingClientRect()
            const under = this.getBoundingClientRect().bottom
            const width = document.documentElement.clientWidth
            const height = window.innerHeight
            const x = width / 2
            const y = box.bottom < height - 8 ? (box.bottom + height) / 2 : box.top / 2
            const shown = document.elementFromPoint(x, y)
            return {
              underSelect: box.top >= under - 1 && box.top <= under + 24,
              smaller: box.width <= width && box.height < height,
              outside: !!shown && !popup.contains(shown),
              box: [box.left, box.top, box.right, box.bottom],
            }
          }`,
        )) as { underSelect: boolean; smaller: boolean; outside: boolean; box: number[] }
        if (!placed.underSelect) {
          throw new Error(`In ${where} the dialog does not sit under the select: ${placed.box}`)
        }
        if (mode.phone && !(placed.smaller && placed.outside)) {
          throw new Error(`In ${where} no part of the page shows outside the dialog: ${placed.box}`)
        }

        await pressKey('Escape', 27)
        await waitFor(`!${rangeDialog}`, `In ${where} Escape did not close the dialog`, 30)
        const after = await on(
          select,
          'function () { return { value: this.value, focused: document.activeElement === this } }',
        )
        if (JSON.stringify(after) !== JSON.stringify({ value: before, focused: true })) {
          throw new Error(
            `In ${where} after Escape the select is ${JSON.stringify(after)}, not on ${String(before)} with focus`,
          )
        }

        await pick(select, 'custom')
        await waitFor(
          `${rangeEnd('end')} === ${JSON.stringify(lastProcessedDay)}`,
          `In ${where} the Calendar did not open on the window's days`,
          30,
        )
        const dayAfter = '2026-10-14'
        const pickedBefore = JSON.stringify(await evaluate(selectedDays))
        const afterButton = await control('button', await dayName(dayAfter))
        if ((await on(afterButton, 'function () { return this.disabled }')) !== true) {
          throw new Error(`In ${where} ${dayAfter}, after the last processed day, is not disabled`)
        }
        const afterAt = await centreOf(afterButton)
        await pressAt(afterAt.x, afterAt.y)
        await delay(200)
        if (JSON.stringify(await evaluate(selectedDays)) !== pickedBefore) {
          throw new Error(
            `In ${where} a press on the disabled ${dayAfter} changed the selected days`,
          )
        }

        const days = { from: '2026-09-30', to: lastProcessedDay }
        if (mode.phone) {
          const back = await centreOf(await control('button', 'Previous month'))
          await pressAt(back.x, back.y)
        }
        await pressDay(days.from)
        await waitFor(
          `JSON.stringify(${selectedDays}) === ${JSON.stringify(JSON.stringify([days.from]))}`,
          `In ${where} a press on ${days.from} did not start a new range on it`,
          30,
        )
        if (mode.phone) {
          const next = await centreOf(await control('button', 'Next month'))
          await pressAt(next.x, next.y)
        }
        await pressDay(days.to)
        await waitFor(
          `${rangeEnd('end')} === ${JSON.stringify(days.to)}`,
          `In ${where} a press on ${days.to} did not end the range on it`,
          30,
        )
        await click(await control('button', 'Apply'))
        await waitFor(
          `location.search.includes(${JSON.stringify(`window=custom&from=${days.from}&to=${days.to}`)})`,
          `In ${where} Apply on ${days.from} to ${days.to} did not land on the custom route`,
          30,
        )
        await waitFor(`!${rangeDialog}`, `In ${where} Apply did not close the dialog`, 30)
        await waitFor(
          `!!document.querySelector('.controls-bar button[aria-label^="Custom range, "]')`,
          `In ${where} no compact range button showed after Apply`,
          30,
        )
        const name = (await evaluate(
          `document.querySelector('.controls-bar button[aria-label^="Custom range, "]').getAttribute('aria-label')`,
        )) as string
        if (!name.endsWith(days.to.slice(0, 4))) {
          throw new Error(
            `In ${where} the compact button is named "${name}", with no year at its end`,
          )
        }
        const compact = await control('button', name)
        const at = await centreOf(compact)
        await pressAt(at.x, at.y)
        await waitFor(
          `${rangeEnd('end')} === ${JSON.stringify(days.to)} && ${mode.phone ? 'true' : `${rangeEnd('start')} === ${JSON.stringify(days.from)}`}`,
          `In ${where} the compact button did not reopen the dialog on ${days.from} to ${days.to}`,
          30,
        )
        await pressKey('Escape', 27)
        await waitFor(`!${rangeDialog}`, `In ${where} Escape did not close the reopened dialog`, 30)
        if (
          (await on(compact, 'function () { return document.activeElement === this }')) !== true
        ) {
          throw new Error(`In ${where} focus did not go back to the compact button`)
        }
      })
    }
  } finally {
    await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'light' }],
    })
    await send('Page.navigate', { url: `${stub.origin}/app/` })
    await ready()
  }

  await walk('state: format set', async () => {
    await click(await control('radio', 'Shorts'))
    // The radio is Base UI's `<span role="radio">`, so its choice is `aria-checked`, and the route
    // change renders the group again, so the radio is found anew on each read.
    let checked = false
    for (let attempt = 0; attempt < 30 && !checked; attempt++) {
      const shorts = await control('radio', 'Shorts')
      checked =
        (await on(shorts, `function () { return this.getAttribute('aria-checked') }`)) === 'true'
      if (!checked) await delay(100)
    }
    if (!checked) throw new Error('The Shorts format did not take')
    await ready()
  })

  // happy-dom cannot show these, so the walk does, in Chrome (the Limits at the top of
  // apps/web/src/app.test.ts): the toast's centre is the screen's beside the open sidebar and the
  // collapsed one at 1280px, and beside the open one past the 2560px screen stop
  // (creator-analytics#508); the toast sits fixed at the bottom of the screen, opaque and bordered,
  // and above the account menu's open popup where the two meet on a short, narrow screen; a real
  // pointer on it reaches Base UI's hold, which pauses its wait; and its close button is on the
  // accessibility tree.
  await walk('state: toast shown', async () => {
    await send('Page.navigate', { url: `${stub.origin}/app/settings` })
    await ready()
    let notifications = ''
    /** Picks `currency`, a change, and waits for the toast it shows. */
    const showToast = async (currency: string) => {
      await pick(await control('combobox', 'Currency'), currency)
      notifications = await control('region', 'Notifications')
      for (let attempt = 0; attempt < 50; attempt++) {
        const shown = await on(
          notifications,
          `function () {
            return [...this.querySelectorAll('[role="status"]')].some((status) => status.textContent.trim() !== '')
          }`,
        )
        if (shown === true) return
        if (attempt === 49) throw new Error('No toast showed after the currency changed')
        await delay(100)
      }
    }
    await showToast('EUR')

    // The toast's centre against the screen's, beside the sidebar as it is. The success toast
    // closes after toastSeconds, so a toast gone by the read is shown again, by another currency.
    const currencies = ['GBP', 'JPY', 'CAD']
    const centredBeside = async (sidebar: string) => {
      const offCentre = async () =>
        (await on(
          notifications,
          `function () {
            const toast = this.querySelector('[role="dialog"]')
            if (!toast) return null
            const box = toast.getBoundingClientRect()
            const screen = document.querySelector('.signed-in-screen').getBoundingClientRect()
            return box.left + box.width / 2 - (screen.left + screen.width / 2)
          }`,
        )) as number | null
      let off = await offCentre()
      if (off === null) {
        await showToast(currencies.shift() ?? 'EUR')
        off = await offCentre()
      }
      if (off === null || Math.abs(off) >= 1) {
        throw new Error(`The toast's centre is ${off}px from the screen's, beside the ${sidebar}`)
      }
    }
    try {
      await centredBeside('open sidebar at 1280px')
      await click(await control('button', 'Collapse sidebar'))
      await controlOnceShown('button', 'Expand sidebar')
      await centredBeside('collapsed sidebar at 1280px')
      await click(await control('button', 'Expand sidebar'))
      await controlOnceShown('button', 'Collapse sidebar')
      // Past the screen stop, where the screen's extra width falls to its right.
      await send('Emulation.setDeviceMetricsOverride', { ...wideAt(2880), mobile: false })
      await centredBeside('open sidebar at 2880px')
    } finally {
      await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
      const expand = await control('button', 'Expand sidebar').catch(() => null)
      if (expand) {
        await click(expand)
        await controlOnceShown('button', 'Collapse sidebar')
      }
    }
    // A toast shown anew, so the reads below have its whole wait.
    await showToast('AUD')

    // Fixed 1rem above the bottom of the screen (no safe area in a desktop window), the element at
    // its centre its own, its background colour opaque under the tint, as a canvas reads it.
    const place = (await on(
      notifications,
      `function () {
        const toast = this.querySelector('[role="dialog"]')
        const box = toast.getBoundingClientRect()
        const style = getComputedStyle(toast)
        const x = box.left + box.width / 2
        const y = box.top + box.height / 2
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        const paint = canvas.getContext('2d')
        paint.fillStyle = style.backgroundColor
        paint.fillRect(0, 0, 1, 1)
        return {
          x,
          y,
          fixed: getComputedStyle(this).position === 'fixed',
          atTheBottom: Math.abs(document.documentElement.clientHeight - 16 - box.bottom) < 1,
          topmost: toast.contains(document.elementFromPoint(x, y)),
          opaque: paint.getImageData(0, 0, 1, 1).data[3] === 255,
          bordered: style.borderTopWidth === '1px' && style.borderTopStyle === 'solid',
        }
      }`,
    )) as { x: number; y: number } & Record<
      'fixed' | 'atTheBottom' | 'topmost' | 'opaque' | 'bordered',
      boolean
    >
    if (!place.fixed) throw new Error('The toast is not fixed on the screen')
    if (!place.atTheBottom) throw new Error('The toast is not 1rem above the bottom of the screen')
    if (!place.topmost) throw new Error('The toast is under another layer at its centre')
    if (!place.opaque) throw new Error("The toast's background is see-through")
    if (!place.bordered) throw new Error('The toast has no 1px border')

    // On a short, narrow screen, as a landscape phone's, the account menu's open popup reaches down
    // over the toast, and where the two meet the toast is the one on top.
    await send('Emulation.setDeviceMetricsOverride', { ...shortNarrow, mobile: false })
    const avatarAt = await centreOf(await control('button', settingsName))
    await pressAt(avatarAt.x, avatarAt.y)
    await waitFor(menuOpen, 'The account menu did not open with the toast shown', 30)
    const overlap = await on(
      notifications,
      `function () {
        const toast = this.querySelector('[role="dialog"]')
        const box = toast.getBoundingClientRect()
        const menu = document.querySelector('[role="menu"]').getBoundingClientRect()
        const left = Math.max(box.left, menu.left)
        const right = Math.min(box.right, menu.right)
        const top = Math.max(box.top, menu.top)
        const bottom = Math.min(box.bottom, menu.bottom)
        if (left >= right || top >= bottom) return 'apart ' + JSON.stringify({ box, menu })
        return toast.contains(document.elementFromPoint((left + right) / 2, (top + bottom) / 2))
      }`,
    )
    if (typeof overlap === 'string') {
      throw new Error(`The account menu's popup does not reach the toast: ${overlap}`)
    }
    if (overlap !== true) throw new Error("The account menu's popup is over the toast")
    await pressKey('Escape', 27)
    await waitFor(menuClosed, 'The account menu did not close on Escape over the toast', 30)
    await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })

    await control('button', 'Close')

    // A real pointer on the toast expands Base UI's viewport, the state that pauses the wait.
    const { x, y } = place
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    let held = false
    for (let attempt = 0; attempt < 30 && !held; attempt++) {
      held =
        (await on(notifications, `function () { return this.hasAttribute('data-expanded') }`)) ===
        true
      if (!held) await delay(100)
    }
    if (!held) throw new Error('The pointer on the toast did not hold it')
    // Off the toast again, so no later step starts with the pointer on it.
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 })
  })

  // The stacked metric charts on TanStack Charts (creator-analytics#369). happy-dom lays nothing
  // out, so the library resolves no point there; these steps show, in Chrome, at the walk's wide
  // screen where all four charts stack, RPM's included (creator-analytics#356): a real pointer on one chart shows a card for the same day
  // on every chart; Tab reaches each chart's slider and never the library's svg, the keys move the
  // card and its value text, only the focused chart's own live region speaks, and Escape clears
  // it; and a real tap places the card, which stays after the finger lifts, and a second tap moves
  // it; a pen moves the card as a mouse does, and a finger scroll that starts on a tapped chart
  // keeps its card (creator-analytics#396). The audience retention pair (creator-analytics#370)
  // shares one cursor of its own the same way, on the video position axis, and neither group's
  // cursor moves the other's; a real tap beside one of its points places the card on that point on
  // both, a second tap moves it (creator-analytics#390), and a finger scroll keeps it
  // (creator-analytics#396). Each slider is found by its role and its approved name
  // (`chartLabelOf`). Every sample video has a duration, so its retention pair sits beside the video
  // player and each name ends with the sentence on moving it (creator-analytics#646).
  const labelsOf = (headings: string[], more = '') =>
    headings.map((heading) => `${heading}. Use the arrow keys to read each point.${more}`)
  const stackedLabels = labelsOf([
    'Engaged views and views',
    'Watch hours',
    'Estimated revenue',
    'RPM',
  ])
  const retentionLabels = labelsOf(
    ['Audience retention', 'Relative retention'],
    ' Press Enter to move the video player to that point.',
  )
  const noPoint = 'No point selected'
  // One at a time: each find asks for the document anew, which drops the node ids of the last.
  async function slidersNamed(labels: string[]): Promise<string[]> {
    const sliders: string[] = []
    for (const label of labels) sliders.push(await control('slider', label))
    return sliders
  }
  const stackedSliders = () => slidersNamed(stackedLabels)
  const retentionSliders = () => slidersNamed(retentionLabels)

  /**
   * Each slider's value text, its value, the title of the card its chart shows (null with none),
   * and its own live region's text, read only from regions on the accessibility tree.
   */
  type SliderState = {
    valueText: string | null
    valueNow: string | null
    card: string | null
    spoken: string
  }
  const sliderStates = async (sliders: string[]) =>
    Promise.all(
      sliders.map(
        async (slider) =>
          (await on(
            slider,
            `function () {
              const card = this.querySelector('.ts-chart-tooltip:not([hidden]) .chart-hover-title')
              const regions = [...this.parentElement.querySelectorAll('[aria-live]')].filter(
                (region) => !region.closest('[aria-hidden="true"]'),
              )
              return {
                valueText: this.getAttribute('aria-valuetext'),
                valueNow: this.getAttribute('aria-valuenow'),
                card: card ? card.textContent : null,
                spoken: regions.map((region) => region.textContent).join(''),
              }
            }`,
          )) as SliderState,
      ),
    )

  /**
   * Waits until every chart of a group shows a card for the same point, and returns their states.
   * The same point is the same value: neighbouring retention points of a short video can share a
   * time label, so the value text alone could not tell them apart.
   */
  async function samePointOnEvery(sliders: string[], what: string): Promise<SliderState[]> {
    let states: SliderState[] = []
    for (let attempt = 0; attempt < 30; attempt++) {
      states = await sliderStates(sliders)
      const [first] = states
      if (
        first?.valueNow &&
        states.every(
          ({ valueText, valueNow, card }) =>
            valueText !== noPoint && valueNow === first.valueNow && card === valueText,
        )
      ) {
        return states
      }
      await delay(100)
    }
    throw new Error(`${what}: ${JSON.stringify(states)}`)
  }

  async function noCardOnAny(sliders: string[], what: string): Promise<void> {
    for (let attempt = 0; attempt < 30; attempt++) {
      const states = await sliderStates(sliders)
      if (states.every(({ valueText, card }) => valueText === noPoint && card === null)) return
      await delay(100)
    }
    throw new Error(what)
  }

  /**
   * The point a share of the way across the slider's plot, at its middle, in the viewport, which
   * first scrolls the plot into its middle: the stacked charts reach below the walk's screen.
   */
  const across = async (slider: string, share: number) =>
    (await on(
      slider,
      `function () {
        this.scrollIntoView({ block: 'center' })
        const box = this.getBoundingClientRect()
        return { x: box.left + box.width * ${share}, y: box.top + box.height / 2 }
      }`,
    )) as { x: number; y: number }

  const isFocused = async (objectId: string) =>
    (await on(objectId, 'function () { return document.activeElement === this }')) === true

  /**
   * Each chart's approved name names one slider and nothing else: the library's svg, which carries
   * the same name, stays off the accessibility tree under its aria-hidden wrapper.
   */
  async function eachNamesOneSlider(labels: string[]): Promise<void> {
    for (const label of labels) {
      const { root } = (await send('DOM.getDocument', { depth: 0 })) as {
        root: { nodeId: number }
      }
      const { nodes } = (await send('Accessibility.queryAXTree', {
        nodeId: root.nodeId,
        accessibleName: label,
      })) as { nodes: { role?: { value?: string } }[] }
      const roles = nodes.map(({ role }) => role?.value)
      if (roles.join() !== 'slider') {
        throw new Error(`"${label}" names ${JSON.stringify(roles)}, not one slider`)
      }
    }
  }

  /**
   * A tap focuses the slider, never the library's svg inside it, so each chart of its group still
   * names one slider: the checks `state: stacked charts click` makes for a press, which the stacked
   * and retention tap steps make after each tap. `what` names the tap in the error.
   */
  async function tapLeavesFocusOnSlider(
    slider: string,
    labels: string[],
    what: string,
  ): Promise<void> {
    await eachNamesOneSlider(labels)
    const focus = await on(
      slider,
      `function () {
        const svg = this.querySelector('.cursor-plot-chart')
        return { slider: document.activeElement === this, svg: !!svg?.contains(document.activeElement) }
      }`,
    )
    if (JSON.stringify(focus) !== JSON.stringify({ slider: true, svg: false })) {
      throw new Error(`${what} left focus off the slider: ${JSON.stringify(focus)}`)
    }
  }

  await walk('state: stacked charts pointer', async () => {
    await send('Page.navigate', {
      url: `${stub.origin}/app/videos/${encodeURIComponent(newestVideo.id)}`,
    })
    await ready()
    const sliders = await stackedSliders()
    const [first] = sliders
    if (!first) throw new Error('No stacked chart')
    const at = await across(first, 0.3)
    // A real pointer arrives by moving, so it moves onto the plot from just left of it.
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x - 20, y: at.y })
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y })
    await samePointOnEvery(
      sliders,
      'A pointer on one stacked chart did not show the same day on every one',
    )
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 })
    await noCardOnAny(sliders, 'The pointer leaving the stacked chart did not hide the cards')
  })

  await walk('state: stacked charts keys', async () => {
    const sliders = await stackedSliders()
    const [first, second] = sliders
    if (!first || !second) throw new Error('No two stacked charts')
    // The library's svg is under aria-hidden, so it names no second chart inside the slider.
    await eachNamesOneSlider(stackedLabels)

    await on(first, 'function () { document.activeElement?.blur(); window.scrollTo(0, 0) }')
    for (let tabs = 0; tabs < 80 && !(await isFocused(first)); tabs++) await pressKey('Tab', 9)
    if (!(await isFocused(first))) throw new Error('Tab did not reach the first stacked chart')

    /** Presses a key on the focused chart and checks its value and that only it speaks. */
    async function step(key: string, keyCode: number, valueNow: string): Promise<SliderState[]> {
      await pressKey(key, keyCode)
      const states = await samePointOnEvery(sliders, `${key} did not move the card on every chart`)
      const [focused, ...others] = states
      if (focused?.valueNow !== valueNow) {
        throw new Error(`${key} took the slider to ${focused?.valueNow}, not ${valueNow}`)
      }
      if (!focused.spoken || others.some(({ spoken }) => spoken !== '')) {
        throw new Error(`After ${key}, not only the focused chart spoke: ${JSON.stringify(states)}`)
      }
      return states
    }

    await step('ArrowRight', 39, '1')
    const second2 = await step('ArrowRight', 39, '2')
    const back = await step('ArrowLeft', 37, '1')
    if (back[0]?.valueText === second2[0]?.valueText) {
      throw new Error('ArrowLeft did not name another point')
    }
    await step(
      'End',
      35,
      String(await on(first, `function () { return this.getAttribute('aria-valuemax') }`)),
    )
    const home = await step('Home', 36, '1')
    if (home[0]?.valueText !== back[0]?.valueText)
      throw new Error('Home did not name the first point')

    // The next Tab lands on the second chart's slider, never on the library's svg between them.
    await pressKey('Tab', 9)
    if (!(await isFocused(second)))
      throw new Error('Tab from the first chart did not reach the second')
    await samePointOnEvery(sliders, 'Focus moving to the second chart lost the card')

    await pressKey('Escape', 27)
    await noCardOnAny(sliders, 'Escape did not clear the card')
    const cleared = await sliderStates(sliders)
    if (cleared.some(({ spoken }) => spoken !== '')) {
      throw new Error(`A live region still speaks after Escape: ${JSON.stringify(cleared)}`)
    }
  })

  // The library's pointer moving the card empties the live region a key step filled, so its values
  // never outlive the card that showed them (creator-analytics#343), on another chart too.
  await walk('state: stacked charts pointer after a key', async () => {
    const sliders = await stackedSliders()
    const [first, second] = sliders
    if (!first || !second) throw new Error('No two stacked charts')
    await on(first, 'function () { this.focus() }')
    await pressKey('ArrowRight', 39)
    const keyed = await samePointOnEvery(sliders, 'ArrowRight did not move the card on every chart')
    if (!keyed[0]?.spoken) throw new Error('ArrowRight on the first chart read nothing')

    const { x, y } = await across(second, 0.6)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x - 20, y })
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    let states: SliderState[] = []
    for (let attempt = 0; attempt < 30; attempt++) {
      states = await samePointOnEvery(sliders, 'A pointer after a key step did not move the card')
      if (states[0]?.valueText !== keyed[0].valueText && states.every(({ spoken }) => !spoken)) {
        break
      }
      await delay(100)
    }
    if (states[0]?.valueText === keyed[0].valueText) {
      throw new Error('The pointer on the second chart did not move the card off the key step')
    }
    if (states.some(({ spoken }) => spoken !== '')) {
      throw new Error(`A key step's values outlived the pointer: ${JSON.stringify(states)}`)
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 })
    await on(first, 'function () { this.blur() }')
    await noCardOnAny(sliders, 'Focus and the pointer leaving did not hide the cards')
  })

  /** A real pointer onto a share of the way across the slider's plot, from just left of it. */
  async function pointAcross(slider: string, share: number): Promise<void> {
    const { x, y } = await across(slider, share)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x - 20, y })
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  }

  /** The pointer off every chart, at the page's top left corner. */
  const pointerAway = () => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 })

  // creator-analytics#370: a pointer on either retention chart shows a card on both, at the same
  // point of the video, and moves both from the other; the pointer leaving hides both.
  await walk('state: retention charts pointer', async () => {
    const sliders = await retentionSliders()
    const [watching, relative] = sliders
    if (!watching || !relative) throw new Error('No two retention charts')
    await pointAcross(watching, 0.3)
    const onWatching = await samePointOnEvery(
      sliders,
      'A pointer on the audience retention chart did not show the same point on both',
    )
    await pointAcross(relative, 0.6)
    let onRelative: SliderState[] = []
    for (let attempt = 0; attempt < 30; attempt++) {
      onRelative = await samePointOnEvery(
        sliders,
        'A pointer on the relative retention chart did not show the same point on both',
      )
      if (Number(onRelative[0]?.valueNow) > Number(onWatching[0]?.valueNow)) break
      await delay(100)
    }
    if (Number(onRelative[0]?.valueNow) <= Number(onWatching[0]?.valueNow)) {
      throw new Error(
        `A pointer further along the relative retention chart did not move both cards: ${onWatching[0]?.valueNow} then ${onRelative[0]?.valueNow}`,
      )
    }
    await pointerAway()
    await noCardOnAny(sliders, 'The pointer leaving the retention charts did not hide the cards')
  })

  // creator-analytics#370: the keys on either retention chart move both cards, and only the
  // focused chart's own live region speaks; Escape clears both.
  await walk('state: retention charts keys', async () => {
    const sliders = await retentionSliders()
    const [watching, relative] = sliders
    if (!watching || !relative) throw new Error('No two retention charts')
    // The library's svg is under aria-hidden, so it names no second chart inside the slider.
    await eachNamesOneSlider(retentionLabels)

    /** Presses a key on the focused chart, `focused` of the pair, and checks only it speaks. */
    async function step(
      focused: number,
      key: string,
      keyCode: number,
      valueNow: string,
    ): Promise<SliderState[]> {
      await pressKey(key, keyCode)
      const states = await samePointOnEvery(sliders, `${key} did not move both retention cards`)
      if (states[focused]?.valueNow !== valueNow) {
        throw new Error(`${key} took the slider to ${states[focused]?.valueNow}, not ${valueNow}`)
      }
      if (
        !states[focused]?.spoken ||
        states.some(({ spoken }, index) => index !== focused && spoken !== '')
      ) {
        throw new Error(`After ${key}, not only the focused chart spoke: ${JSON.stringify(states)}`)
      }
      return states
    }

    await on(watching, 'function () { this.focus() }')
    if (!(await isFocused(watching))) throw new Error('The audience retention chart took no focus')
    await step(0, 'ArrowRight', 39, '1')
    await step(0, 'ArrowRight', 39, '2')
    await step(0, 'ArrowLeft', 37, '1')
    await step(
      0,
      'End',
      35,
      String(await on(watching, `function () { return this.getAttribute('aria-valuemax') }`)),
    )
    await step(0, 'Home', 36, '1')

    // Focus moving to the other chart of the pair keeps the card, and its keys move both.
    await on(relative, 'function () { this.focus() }')
    if (!(await isFocused(relative))) throw new Error('The relative retention chart took no focus')
    await samePointOnEvery(sliders, 'Focus moving to the relative retention chart lost the card')
    await step(1, 'ArrowRight', 39, '2')

    await pressKey('Escape', 27)
    await noCardOnAny(sliders, 'Escape did not clear the retention cards')
    const cleared = await sliderStates(sliders)
    if (cleared.some(({ spoken }) => spoken !== '')) {
      throw new Error(`A live region still speaks after Escape: ${JSON.stringify(cleared)}`)
    }
    await on(relative, 'function () { this.blur() }')
  })

  // creator-analytics#370: the retention pair's cursor is its own. A pointer on a retention chart
  // moves no stacked chart's card, and a pointer on a stacked chart moves no retention card.
  await walk('state: retention and stacked charts apart', async () => {
    const retention = await retentionSliders()
    const stacked = await stackedSliders()
    const [watching] = retention
    const [first] = stacked
    if (!watching || !first) throw new Error('No retention chart and stacked chart')

    /** Throws unless every chart of a group reads no point and shows no card. */
    async function noPointOn(sliders: string[], what: string): Promise<void> {
      const states = await sliderStates(sliders)
      if (states.some(({ valueText, card }) => valueText !== noPoint || card !== null)) {
        throw new Error(`${what}: ${JSON.stringify(states)}`)
      }
    }

    await pointAcross(watching, 0.3)
    await samePointOnEvery(retention, 'A pointer on the retention chart showed no card on both')
    await noPointOn(stacked, 'A pointer on the retention chart moved the stacked charts')
    await pointerAway()
    await noCardOnAny(retention, 'The pointer leaving the retention chart did not hide its cards')

    await pointAcross(first, 0.3)
    await samePointOnEvery(stacked, 'A pointer on the stacked chart showed no card on every one')
    await noPointOn(retention, 'A pointer on the stacked chart moved the retention charts')
    await pointerAway()
    await noCardOnAny(stacked, 'The pointer leaving the stacked chart did not hide its cards')
  })

  // creator-analytics#396: a pen moves the card through the library's pointer, and its leaving
  // clears it, as a mouse's does (`state: stacked charts pointer`): the plot stops only a finger's
  // moves. Before the first tap, on a screen no touch has reached yet.
  await walk('state: stacked charts pen', async () => {
    const sliders = await stackedSliders()
    const [, second] = sliders
    if (!second) throw new Error('No second stacked chart')

    /** A pen onto a share of the way across the second plot, from just left of it. */
    async function penAcross(share: number): Promise<SliderState[]> {
      const { x, y } = await across(second as string, share)
      for (const at of [x - 20, x]) {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at, y, pointerType: 'pen' })
      }
      return samePointOnEvery(sliders, `A pen ${share * 100}% across did not show a card`)
    }
    const near = await penAcross(0.15)
    let far: SliderState[] = []
    for (let attempt = 0; attempt < 30; attempt++) {
      far = await penAcross(0.85)
      if (Number(far[1]?.valueNow) > Number(near[1]?.valueNow)) break
      await delay(100)
    }
    if (Number(far[1]?.valueNow) <= Number(near[1]?.valueNow)) {
      throw new Error(
        `A pen further along did not move the card: ${near[1]?.valueNow} then ${far[1]?.valueNow}`,
      )
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1, pointerType: 'pen' })
    await noCardOnAny(sliders, 'The pen leaving the stacked chart did not hide the cards')
  })

  // A tap places the card, and a second tap further along moves it. After each, focus is on the
  // tapped slider and nowhere inside its svg, so each stacked chart names one slider
  // (creator-analytics#398), as `state: retention charts tap` checks.
  await walk('state: stacked charts tap', async () => {
    const sliders = await stackedSliders()
    const [, second] = sliders
    if (!second) throw new Error('No second stacked chart')
    await on(second, 'function () { this.blur() }')
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
    try {
      async function tap(share: number): Promise<SliderState[]> {
        const { x, y } = await across(second as string, share)
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        // The card stays after the finger lifts.
        await delay(settleMs)
        const states = await samePointOnEvery(
          sliders,
          `A tap ${share * 100}% across did not keep a card`,
        )
        await tapLeavesFocusOnSlider(
          second as string,
          stackedLabels,
          `A tap ${share * 100}% across`,
        )
        return states
      }
      const placed = await tap(0.15)
      const moved = await tap(0.85)
      if (Number(moved[1]?.valueNow) <= Number(placed[1]?.valueNow)) {
        throw new Error(
          `A second tap further along did not move the card: ${placed[1]?.valueNow} then ${moved[1]?.valueNow}`,
        )
      }
    } finally {
      await send('Emulation.setTouchEmulationEnabled', { enabled: false })
    }
  })

  /** A finger lifted where it lands, as a tap: the card it places stays after the finger lifts. */
  async function tapAt({ x, y }: { x: number; y: number }): Promise<void> {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await delay(settleMs)
  }

  /**
   * A finger scroll that starts on a plot (creator-analytics#396): the finger lands at `from`, then
   * travels up the page by 150 pixels and across to `toX` in small moves, as a thumb scrolling the
   * page does, and lifts. With no `touch-action` on the plot the browser takes the pan, which ends
   * the finger's pointer with a `pointercancel`; the travel across moves the library's pointer even
   * where the browser never cancels it.
   */
  async function dragFrom(from: { x: number; y: number }, toX: number): Promise<void> {
    const moves = 10
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })
    for (let move = 1; move <= moves; move++) {
      const x = from.x + ((toX - from.x) * move) / moves
      const y = from.y - (150 * move) / moves
      await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
      await delay(16)
    }
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await delay(settleMs)
  }

  /** Throws unless every chart of a group still shows the card at the point `valueNow`. */
  async function cardStaysAt(sliders: string[], valueNow: string, what: string): Promise<void> {
    const states = await samePointOnEvery(sliders, `${what} cleared the card`)
    if (!states.every((state) => state.valueNow === valueNow)) {
      throw new Error(`${what} moved the card off point ${valueNow}: ${JSON.stringify(states)}`)
    }
  }

  // creator-analytics#396: a finger scroll that starts on a stacked chart keeps the card the tap
  // placed, as the hand-written charts did: a finger's moves and the cancel that ends its pan never
  // reach the library's pointer.
  await walk('state: stacked charts touch drag', async () => {
    const sliders = await stackedSliders()
    const [, second] = sliders
    if (!second) throw new Error('No second stacked chart')
    await on(second, 'function () { this.blur() }')
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
    try {
      const from = await across(second, 0.15)
      await tapAt(from)
      const [, tapped] = await samePointOnEvery(sliders, 'A tap 15% across did not keep a card')
      const valueNow = tapped?.valueNow
      if (!valueNow) throw new Error('A tap 15% across read no point')
      const to = await across(second, 0.85)
      await dragFrom(from, to.x)
      await cardStaysAt(sliders, valueNow, 'A finger scroll that starts on a stacked chart')
    } finally {
      await send('Emulation.setTouchEmulationEnabled', { enabled: false })
    }
  })

  // creator-analytics#390: a tap on the audience retention chart places the card on the point
  // nearest it, on both charts of the pair, and a second tap moves it. A retention point's x is its
  // share of the video (`elapsedVideoTimeRatio`) on a domain of the whole video with no margin, so
  // the walk reads the points from the stub over HTTP, as the app does, to know where each sits.
  const retentionRatios = (
    (await (
      await fetch(
        `${stub.origin}/api/channels/${sampleChannel.id}/videos/${encodeURIComponent(newestVideo.id)}`,
      )
    ).json()) as VideoDetailAnswer
  ).audienceRetention.map(({ elapsedVideoTimeRatio }) => elapsedVideoTimeRatio)

  /**
   * A tap's place a quarter of a point's step to one side of the point at `target`, the side on
   * which rounding down (left) or up (right) would pick its neighbour, at the plot's middle, which
   * first scrolls the plot into its middle. It returns the value the slider names there: the
   * nearest point by x, which must be the target, at least 2 pixels nearer than the next nearest.
   * A quarter, not a third, since from 60rem the video player takes a column beside the pair
   * (creator-analytics#648), and at 1280px a third of the narrower plot's step is under that.
   */
  async function retentionTapAt(slider: string, target: number, side: -1 | 1) {
    const box = (await on(
      slider,
      `function () {
        this.scrollIntoView({ block: 'center' })
        const { left, top, width, height } = this.getBoundingClientRect()
        return { left, top, width, height }
      }`,
    )) as { left: number; top: number; width: number; height: number }
    const xs = retentionRatios.map((ratio) => box.left + box.width * ratio)
    const at = xs[target]
    const beside = xs[target + side]
    if (at === undefined || beside === undefined) {
      throw new Error(`No retention point ${target + 1} with a neighbour on its ${side} side`)
    }
    const x = at + (beside - at) / 4
    const [nearest, next] = xs
      .map((pointX, index) => ({ index, away: Math.abs(pointX - x) }))
      .sort((a, b) => a.away - b.away)
    if (nearest?.index !== target || !next || next.away - nearest.away < 2) {
      throw new Error(
        `A tap at ${x} is not clearly nearest retention point ${target + 1}: ${JSON.stringify({ nearest, next })}`,
      )
    }
    return { x, y: box.top + box.height / 2, valueNow: String(target + 1) }
  }

  await walk('state: retention charts tap', async () => {
    const count = retentionRatios.length
    if (count < 2) throw new Error(`The sample's retention has ${count} points, not two or more`)
    const sliders = await retentionSliders()
    const [watching] = sliders
    if (!watching) throw new Error('No audience retention chart')
    await on(watching, 'function () { document.activeElement?.blur() }')
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
    try {
      /** Taps the watching chart beside a point, and waits until both charts show that point. */
      async function tap(target: number, side: -1 | 1): Promise<void> {
        const { x, y, valueNow } = await retentionTapAt(watching as string, target, side)
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        // The card stays after the finger lifts.
        await delay(settleMs)
        let states: SliderState[] = []
        for (let attempt = 0; attempt < 30; attempt++) {
          states = await samePointOnEvery(
            sliders,
            `A tap beside retention point ${valueNow} did not keep a card on both charts`,
          )
          if (states.every((state) => state.valueNow === valueNow)) break
          await delay(100)
        }
        if (!states.every((state) => state.valueNow === valueNow)) {
          throw new Error(
            `A tap beside retention point ${valueNow} did not place the card there on both charts: ${JSON.stringify(states)}`,
          )
        }
        await tapLeavesFocusOnSlider(
          watching as string,
          retentionLabels,
          `A tap beside retention point ${valueNow}`,
        )
      }
      // About a fifth and four fifths of the way along, each a quarter of a step to the side on
      // which rounding the share to a point would pick the neighbour.
      const first = Math.min(count - 1, Math.max(1, Math.round(count * 0.2) - 1))
      const second = Math.min(count - 2, Math.max(0, Math.round(count * 0.8) - 1))
      if (first === second) throw new Error(`${count} retention points leave no two places to tap`)
      await tap(first, -1)
      await tap(second, 1)
    } finally {
      await send('Emulation.setTouchEmulationEnabled', { enabled: false })
    }
  })

  // creator-analytics#396: a finger scroll that starts on the audience retention chart keeps the
  // card the tap placed, on both charts of the pair.
  await walk('state: retention charts touch drag', async () => {
    const count = retentionRatios.length
    const target = Math.min(count - 1, Math.max(1, Math.round(count * 0.2) - 1))
    const sliders = await retentionSliders()
    const [watching] = sliders
    if (!watching) throw new Error('No audience retention chart')
    await on(watching, 'function () { document.activeElement?.blur() }')
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
    try {
      const { x, y, valueNow } = await retentionTapAt(watching, target, -1)
      await tapAt({ x, y })
      await cardStaysAt(sliders, valueNow, `A tap beside retention point ${valueNow}`)
      const to = await across(watching, 0.85)
      await dragFrom({ x, y }, to.x)
      await cardStaysAt(sliders, valueNow, 'A finger scroll that starts on a retention chart')
    } finally {
      await send('Emulation.setTouchEmulationEnabled', { enabled: false })
    }
  })

  // The launch chart on TanStack Charts (creator-analytics#371), on the channel screen in the first
  // 28 days after publish, where the sample's 10 newest videos draw 10 lines, most of them partial.
  // happy-dom lays nothing out, so the library resolves no point there (apps/web/src/app.test.ts);
  // these steps show, in Chrome: a real pointer selects the nearest line and day, marks that
  // video's list row, and its leaving clears both; the nearest is by pixels in both directions, so
  // a point a day to the side beats a nearer day's column, and a partial line's last point stays
  // reachable just past its end; a pointer after a key step empties the live region
  // (creator-analytics#343); Tab reaches the slider and never the library's svg, up and down
  // step between videos, Home and End go to the ends of the selected line, only the chart's own
  // live region speaks, and Escape clears it; and a real tap places the card, which stays after the
  // finger lifts, a second tap moves it, and a finger scroll that starts on it keeps it
  // (creator-analytics#396). The slider is found by its role and its approved name
  // (`launchChartText.label`, hand-copied). The walk reads the page's rows from the stub over HTTP,
  // as the app does, to know where each line's days sit.
  const launchLabel =
    "Engaged views in each video's first days. Use the left and right arrow keys to read each day, and the up and down arrow keys to choose a video."
  const launchDays = 28
  const launchAddress = '/app/?window=first28&format=all&sort=-publishedAt&pageSize=10&chart=daily'
  const launchList = (await (
    await fetch(
      `${stub.origin}/api/channels/${sampleChannel.id}/videos?window=first28&format=all&sort=-publishedAt&page=1&pageSize=10`,
    )
  ).json()) as VideoListAnswer
  // The lines the chart draws, in the page's order: the first 10 rows with a processed day.
  const launchLines = launchList.videos
    .slice(0, 10)
    .flatMap(({ title, engagedViewsByDay }) =>
      engagedViewsByDay && engagedViewsByDay.length > 0 ? [{ title, days: engagedViewsByDay }] : [],
    )
  const launchSlider = () => control('slider', launchLabel)

  /**
   * The slider's value text and value, the heading of the card on view (null with none), the
   * titles of the marked list rows, and the text of each live region of the launch chart's section
   * on the accessibility tree: its own, as the library tooltip's sits under aria-hidden.
   */
  type LaunchState = {
    valueText: string | null
    valueNow: string | null
    card: string | null
    marked: string[]
    spoken: string[]
  }
  const launchStateOf = async (slider: string) =>
    (await on(
      slider,
      `function () {
        const card = this.querySelector('.ts-chart-tooltip:not([hidden]) .chart-hover-title')
        const regions = [...this.closest('section').querySelectorAll('[aria-live]')].filter(
          (region) => !region.closest('[aria-hidden="true"]'),
        )
        return {
          valueText: this.getAttribute('aria-valuetext'),
          valueNow: this.getAttribute('aria-valuenow'),
          card: card ? card.textContent : null,
          marked: [...document.querySelectorAll('tr.video-list-row-marked')].map(
            (row) => row.querySelector('a')?.textContent ?? '',
          ),
          spoken: regions.map((region) => region.textContent),
        }
      }`,
    )) as LaunchState

  /** Waits until the launch chart's state passes `check`, and returns it. */
  async function launchStateWhere(
    slider: string,
    check: (state: LaunchState) => boolean,
    what: string,
  ): Promise<LaunchState> {
    let state = await launchStateOf(slider)
    for (let attempt = 0; attempt < 30 && !check(state); attempt++) {
      await delay(100)
      state = await launchStateOf(slider)
    }
    if (!check(state)) throw new Error(`${what}: ${JSON.stringify(state)}`)
    return state
  }

  /** Whether the card's heading names the day, with or without its partial wording. */
  const cardNames = (card: string | null, day: number) => card?.split(' (')[0] === `Day ${day}`

  /** Whether the chart shows a line's day: the value text, the card, the row mark and the value. */
  const showsLaunch =
    (line: number, day: number) =>
    ({ valueText, valueNow, card, marked }: LaunchState) => {
      const title = launchLines[line]?.title
      return (
        valueText === title &&
        valueNow === String(day) &&
        cardNames(card, day) &&
        marked.length === 1 &&
        marked[0] === title
      )
    }

  /** Whether the chart shows no card, reads no point, and marks no row. */
  const showsNoLaunch = ({ valueText, card, marked }: LaunchState) =>
    valueText === noPoint && card === null && marked.length === 0

  /**
   * The point in the viewport at a day of the window, from its left edge, and a share of the way
   * down the plot, which first scrolls the plot into its middle.
   */
  const launchPointAt = async (slider: string, day: number, down: number) =>
    (await on(
      slider,
      `function () {
        this.scrollIntoView({ block: 'center' })
        const box = this.getBoundingClientRect()
        return {
          x: box.left + (box.width * ${day - 1}) / ${launchDays - 1},
          y: box.top + box.height * ${down},
        }
      }`,
    )) as { x: number; y: number }

  await walk('state: launch chart pointer', async () => {
    await send('Page.navigate', { url: `${stub.origin}${launchAddress}` })
    await ready()
    if (launchLines.length < 2) throw new Error('The sample draws fewer than two launch lines')
    // The highest drawn day sits at the plot's top edge, nearest a pointer there. It must be one
    // video's day and no other's, or the nearest line would be a tie.
    const top = Math.max(...launchLines.flatMap(({ days }) => days))
    const highest = launchLines.flatMap(({ days }, line) =>
      days.flatMap((value, index) => (value === top ? [{ line, day: index + 1 }] : [])),
    )
    const [peak] = highest
    if (!peak || highest.length !== 1) {
      throw new Error(`The highest launch day is not one video's: ${JSON.stringify(highest)}`)
    }
    const slider = await launchSlider()
    const at = await launchPointAt(slider, peak.day, 0.02)
    // A real pointer arrives by moving, so it moves onto the plot from just below the point.
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y + 40 })
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y })
    await launchStateWhere(
      slider,
      showsLaunch(peak.line, peak.day),
      `A pointer at the highest day did not select ${launchLines[peak.line]?.title} on Day ${peak.day}`,
    )
    // With ten rows the card is taller than the plot, so it sits under the plot, off the lines.
    const under = await on(
      slider,
      `function () {
        const card = this.querySelector('.ts-chart-tooltip:not([hidden]) .chart-hover-card')
        return card ? card.getBoundingClientRect().top - this.getBoundingClientRect().bottom : null
      }`,
    )
    if (typeof under !== 'number' || under < 0) {
      throw new Error(`The launch chart's card is not under its plot: ${under}`)
    }
    await pointerAway()
    await launchStateWhere(
      slider,
      showsNoLaunch,
      'The pointer leaving the launch chart left a card',
    )

    // A key step announces in the chart's own live region; a pointer selection empties it.
    await on(slider, 'function () { this.focus() }')
    await pressKey('ArrowDown', 40)
    const keyed = await launchStateWhere(
      slider,
      (state) => showsLaunch(0, 1)(state) && state.spoken.join('') !== '',
      'ArrowDown on the launch chart did not announce the first video',
    )
    if (keyed.spoken.filter((text) => text !== '').length !== 1) {
      throw new Error(`Not only the launch chart's own live region spoke: ${JSON.stringify(keyed)}`)
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y + 40 })
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y })
    await launchStateWhere(
      slider,
      (state) => showsLaunch(peak.line, peak.day)(state) && state.spoken.join('') === '',
      "A pointer after a key step did not empty the launch chart's live region",
    )
    await pointerAway()
    await on(slider, 'function () { this.blur() }')
    await launchStateWhere(slider, showsNoLaunch, 'Focus and the pointer leaving left a card')
  })

  /** A drawn point of the launch chart, by its line and its day, where the plot lays it out. */
  type LaunchPointAt = { line: number; day: number; x: number; y: number }

  /**
   * The launch chart's plot box in the viewport, which first scrolls the plot into its middle, and
   * each drawn point in it: the window's days across it, and zero to the highest drawn day up it.
   */
  async function launchPointsIn(slider: string) {
    const box = (await on(
      slider,
      `function () {
        this.scrollIntoView({ block: 'center' })
        const { left, top, width, height } = this.getBoundingClientRect()
        return { left, top, width, height }
      }`,
    )) as { left: number; top: number; width: number; height: number }
    const top = Math.max(...launchLines.flatMap(({ days }) => days))
    const points = launchLines.flatMap(({ days }, line) =>
      days.map(
        (value, index): LaunchPointAt => ({
          line,
          day: index + 1,
          x: box.left + (box.width * index) / (launchDays - 1),
          y: box.top + box.height * (1 - value / top),
        }),
      ),
    )
    return { box, points }
  }

  /**
   * The drawn point nearest (x, y) by its distance in pixels in both directions, and how much
   * nearer it is than the next nearest, so a pointer is only placed where the answer is clear.
   */
  function nearestLaunchPoint(points: LaunchPointAt[], x: number, y: number) {
    let nearest: LaunchPointAt | undefined
    let first = Number.POSITIVE_INFINITY
    let second = Number.POSITIVE_INFINITY
    for (const point of points) {
      const away = Math.hypot(point.x - x, point.y - y)
      if (away < first) {
        second = first
        first = away
        nearest = point
      } else if (away < second) second = away
    }
    return { nearest, margin: second - first }
  }

  /** Moves a real pointer onto (x, y) and waits until the chart shows that line's day. */
  async function launchPointerSelects(
    slider: string,
    { x, y, line, day }: LaunchPointAt,
    what: string,
  ): Promise<void> {
    await pointerAway()
    await launchStateWhere(slider, showsNoLaunch, `Before ${what}, a card stayed`)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: y + 4 })
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    await launchStateWhere(
      slider,
      showsLaunch(line, day),
      `${what} at ${JSON.stringify({ x, y })} did not select ${launchLines[line]?.title} on Day ${day}`,
    )
  }

  await walk('state: launch chart nearest point', async () => {
    const slider = await launchSlider()
    const { box, points } = await launchPointsIn(slider)
    const step = box.width / (launchDays - 1)

    // A pointer between two days, at least 3 pixels nearer one day's column, whose nearest point in
    // both directions sits on the other day, at least 3 pixels nearer than any other: it selects
    // that point, never one on the nearer column. The clearest such place on the plot is taken,
    // off the bottom edge, where a pointer may fall just outside the plot.
    let between: { pointer: LaunchPointAt; margin: number } | undefined
    for (let x = Math.ceil(box.left + 1); x < box.left + box.width - 1; x++) {
      const column = Math.round((x - box.left) / step)
      const columnAway = Math.abs(box.left + column * step - x)
      for (let y = Math.ceil(box.top + 1); y < box.top + box.height - 2; y++) {
        const { nearest, margin } = nearestLaunchPoint(points, x, y)
        if (!nearest || nearest.day === column + 1 || margin < 3) continue
        if (Math.abs(nearest.x - x) - columnAway < 3) continue
        if (!between || margin > between.margin) between = { pointer: { ...nearest, x, y }, margin }
      }
    }
    if (!between) throw new Error('The sample has no place nearest a point off the nearest day')
    await launchPointerSelects(slider, between.pointer, 'A pointer nearer another day')

    // Just past a partial line's end, at least 2 pixels past its last point, where complete lines
    // run on beside it: a pointer whose nearest point is that last point, at least a pixel nearer
    // than any other, selects it. The place nearest the end within half a day of it is taken.
    let pastEnd: { pointer: LaunchPointAt; away: number } | undefined
    for (const end of points) {
      const days = launchLines[end.line]?.days ?? []
      if (days.length === launchDays || end.day !== days.length) continue
      for (let x = Math.ceil(end.x + 2); x < end.x + step / 2; x++) {
        for (let y = Math.ceil(box.top + 1); y < box.top + box.height - 2; y++) {
          const { nearest, margin } = nearestLaunchPoint(points, x, y)
          if (nearest !== end || margin < 1) continue
          const away = Math.hypot(end.x - x, end.y - y)
          if (!pastEnd || away < pastEnd.away) pastEnd = { pointer: { ...end, x, y }, away }
        }
      }
    }
    if (!pastEnd) throw new Error("The sample has no partial line's end a pointer can reach")
    await launchPointerSelects(slider, pastEnd.pointer, "A pointer just past a partial line's end")

    await pointerAway()
    await launchStateWhere(slider, showsNoLaunch, 'The pointer leaving left a card')
  })

  await walk('state: launch chart keys', async () => {
    const slider = await launchSlider()
    // The library's svg is under aria-hidden, so it names no second chart inside the slider.
    await eachNamesOneSlider([launchLabel])

    await on(slider, 'function () { document.activeElement?.blur(); window.scrollTo(0, 0) }')
    for (let tabs = 0; tabs < 80 && !(await isFocused(slider)); tabs++) await pressKey('Tab', 9)
    if (!(await isFocused(slider))) throw new Error('Tab did not reach the launch chart')

    /** Presses a key and checks the chart shows the line's day and only its own region speaks. */
    async function step(key: string, keyCode: number, line: number, day: number): Promise<void> {
      await pressKey(key, keyCode)
      const state = await launchStateWhere(
        slider,
        (shown) => showsLaunch(line, day)(shown) && shown.spoken.join('') !== '',
        `${key} did not select ${launchLines[line]?.title} on Day ${day}`,
      )
      if (state.spoken.filter((text) => text !== '').length !== 1) {
        throw new Error(
          `After ${key}, not only the chart's own region spoke: ${JSON.stringify(state)}`,
        )
      }
    }

    const firstEnd = launchLines[0]?.days.length ?? 0
    await step('ArrowDown', 40, 0, 1)
    await step('ArrowDown', 40, 1, 1)
    await step('ArrowUp', 38, 0, 1)
    await step('End', 35, 0, firstEnd)
    await step('Home', 36, 0, 1)

    await pressKey('Escape', 27)
    const cleared = await launchStateWhere(slider, showsNoLaunch, 'Escape did not clear the card')
    if (cleared.spoken.some((text) => text !== '')) {
      throw new Error(`A live region still speaks after Escape: ${JSON.stringify(cleared)}`)
    }

    // The next Tab leaves the chart, never landing on the library's svg inside it.
    await pressKey('Tab', 9)
    const inside = await on(
      slider,
      'function () { return this === document.activeElement || this.contains(document.activeElement) }',
    )
    if (inside !== false) throw new Error('Tab from the launch chart stayed inside it')
  })

  await walk('state: launch chart tap', async () => {
    const slider = await launchSlider()
    await on(slider, 'function () { this.blur() }')
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
    try {
      async function tap(day: number): Promise<LaunchState> {
        const { x, y } = await launchPointAt(slider, day, 0.5)
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        // The card stays after the finger lifts.
        await delay(settleMs)
        return launchStateWhere(
          slider,
          ({ valueText, card, marked }) =>
            valueText !== noPoint && card !== null && marked[0] === valueText,
          `A tap on Day ${day} did not keep a card`,
        )
      }
      const placed = await tap(4)
      const moved = await tap(24)
      if (placed.valueText === moved.valueText && placed.valueNow === moved.valueNow) {
        throw new Error(`A second tap did not move the card: ${JSON.stringify({ placed, moved })}`)
      }
    } finally {
      await send('Emulation.setTouchEmulationEnabled', { enabled: false })
    }
  })

  // creator-analytics#396: a finger scroll that starts on the launch chart keeps the card and the
  // marked row the tap placed. The launch chart's touch path is the app's own (its definition turns
  // the library's pointer off), so this pins what the stacked and retention steps fix.
  await walk('state: launch chart touch drag', async () => {
    const slider = await launchSlider()
    await on(slider, 'function () { this.blur() }')
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
    try {
      const from = await launchPointAt(slider, 4, 0.5)
      await tapAt(from)
      const tapped = await launchStateWhere(
        slider,
        ({ valueText, card, marked }) =>
          valueText !== noPoint && card !== null && marked[0] === valueText,
        'A tap on Day 4 did not keep a card',
      )
      const to = await launchPointAt(slider, 24, 0.5)
      await dragFrom(from, to.x)
      const same = ({ valueText, valueNow, card, marked }: LaunchState) =>
        valueText === tapped.valueText &&
        valueNow === tapped.valueNow &&
        card === tapped.card &&
        JSON.stringify(marked) === JSON.stringify(tapped.marked)
      await launchStateWhere(
        slider,
        same,
        'A finger scroll that starts on the launch chart moved or cleared the card',
      )
    } finally {
      await send('Emulation.setTouchEmulationEnabled', { enabled: false })
    }
  })

  // A real mouse click on a plot focuses its slider, never the library's svg inside it: Chrome
  // drops the aria-hidden of a focused element's ancestors and keeps it dropped after focus leaves,
  // which would name the chart a second time and open the library tooltip's live region. Late, so
  // that a failure here leaves no earlier step's accessibility tree changed; the one step after it
  // loads the screen afresh.
  await walk('state: stacked charts click', async () => {
    await send('Page.navigate', {
      url: `${stub.origin}/app/videos/${encodeURIComponent(newestVideo.id)}`,
    })
    await ready()
    const sliders = await stackedSliders()
    const [first] = sliders
    if (!first) throw new Error('No stacked chart')
    await on(first, 'function () { document.activeElement?.blur() }')
    const { x, y } = await across(first, 0.3)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x - 20, y })
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    const press = { x, y, button: 'left', clickCount: 1 }
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...press })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...press })
    await delay(settleMs)
    if (!(await isFocused(first))) {
      throw new Error('A click on the first stacked chart did not focus its slider')
    }
    await eachNamesOneSlider(stackedLabels)
    const { nodes } = (await send('Accessibility.queryAXTree', {
      objectId: first,
      role: 'status',
    })) as { nodes: { ignored?: boolean }[] }
    if (nodes.some(({ ignored }) => !ignored)) {
      throw new Error('A click on the first stacked chart exposed the library tooltip region')
    }

    // The keys still move the card after the click, and only the clicked chart speaks.
    await pressKey('ArrowRight', 39)
    const states = await samePointOnEvery(sliders, 'ArrowRight after a click did not move the card')
    const [clicked, ...others] = states
    if (!clicked?.spoken || others.some(({ spoken }) => spoken !== '')) {
      throw new Error(`After a click and ArrowRight, not only it spoke: ${JSON.stringify(states)}`)
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 })
    await on(first, 'function () { this.blur() }')
  })

  /**
   * Waits until the slider's card shows wholly inside the slider's plot, and throws with both boxes
   * when it does not, or when no card shows. The library places its tooltip in a frame of its own.
   */
  async function cardInsidePlot(slider: string, what: string): Promise<void> {
    let boxes: unknown = null
    for (let attempt = 0; attempt < 30; attempt++) {
      boxes = await on(
        slider,
        `function () {
          const card = this.querySelector('.ts-chart-tooltip:not([hidden]) .chart-hover-card')
          if (!card) return null
          const { left, right, top, bottom } = this.getBoundingClientRect()
          const box = card.getBoundingClientRect()
          const inside =
            box.left >= left - 0.5 &&
            box.right <= right + 0.5 &&
            box.top >= top - 0.5 &&
            box.bottom <= bottom + 0.5
          return {
            inside,
            plot: { left, right, top, bottom },
            card: { left: box.left, right: box.right, top: box.top, bottom: box.bottom },
          }
        }`,
      )
      if ((boxes as { inside?: boolean } | null)?.inside === true) return
      await delay(100)
    }
    if (boxes === null) throw new Error(`${what}: no card shows`)
    throw new Error(`${what}: the card is not inside the plot: ${JSON.stringify(boxes)}`)
  }

  /**
   * Waits until the launch chart's card shows under the slider's plot and inside its width, with
   * every title inside the card and the longest title cut short under an ellipsis, and throws with
   * the plot's box, the card's box and the longest title's widths when it does not, or when no card
   * shows. The launch card sits under the plot, so `cardInsidePlot` cannot check it. Chrome shows
   * no drawn ellipsis to script: a title box narrower than its text under `text-overflow: ellipsis`
   * is the state in which it draws one.
   */
  async function launchCardFits(slider: string, what: string): Promise<void> {
    let boxes: unknown = null
    for (let attempt = 0; attempt < 30; attempt++) {
      boxes = await on(
        slider,
        `function () {
          const card = this.querySelector('.ts-chart-tooltip:not([hidden]) .chart-hover-card')
          if (!card) return null
          const { left, right, bottom } = this.getBoundingClientRect()
          const box = card.getBoundingClientRect()
          const titles = [...card.querySelectorAll('.launch-card-title')]
          const longest = titles.reduce(
            (long, title) => (title.textContent.length > long.textContent.length ? title : long),
            titles[0],
          )
          const style = longest ? getComputedStyle(longest) : null
          const cut = longest
            ? {
                title: longest.textContent,
                scrollWidth: longest.scrollWidth,
                clientWidth: longest.clientWidth,
                textOverflow: style.textOverflow,
                overflow: style.overflowX,
                whiteSpace: style.whiteSpace,
              }
            : null
          const titlesInside = titles.every(
            (title) => title.getBoundingClientRect().right <= box.right + 0.5,
          )
          const fits =
            box.left >= left - 0.5 &&
            box.right <= right + 0.5 &&
            box.top >= bottom - 0.5 &&
            titlesInside &&
            cut !== null &&
            cut.scrollWidth > cut.clientWidth &&
            cut.textOverflow === 'ellipsis' &&
            cut.overflow === 'hidden' &&
            cut.whiteSpace === 'nowrap'
          return {
            fits,
            plot: { left, right, bottom },
            card: { left: box.left, right: box.right, top: box.top },
            titlesInside,
            longest: cut,
          }
        }`,
      )
      if ((boxes as { fits?: boolean } | null)?.fits === true) return
      await delay(100)
    }
    if (boxes === null) throw new Error(`${what}: no card shows`)
    throw new Error(`${what}: the launch card does not fit: ${JSON.stringify(boxes)}`)
  }

  /** Presses End, then Home, on the focused slider of `sliders`, and checks each card both times. */
  async function cardsInsideAtBothEnds(sliders: string[], name: string): Promise<void> {
    for (const [key, keyCode, point] of [
      ['End', 35, 'last'],
      ['Home', 36, 'first'],
    ] as const) {
      await pressKey(key, keyCode)
      await samePointOnEvery(sliders, `${key} on the ${name} showed no card`)
      for (const slider of sliders) {
        await cardInsidePlot(slider, `At the ${point} point of the ${name}`)
      }
    }
  }

  // creator-analytics#350: the Audience screen's eight sections, each in its card, by heading.
  const audienceHeadings = [
    'Countries (engaged views)',
    'US states (engaged views)',
    'Cities (engaged views)',
    'Age (share of signed-in viewers)',
    'Gender (share of signed-in viewers)',
    'Devices (engaged views)',
    'Operating systems (engaged views)',
    'Subscribers and non-subscribers (engaged views)',
  ]

  // The Audience placeholder's cards in the screen's order, each found by its heading's place, since
  // the packing by height places them in another DOM order (creator-analytics#711). An expression
  // for the page, an array with a null for each card not yet rendered.
  const busyAudienceCards = `${JSON.stringify(
    [
      'countries',
      'us-states',
      'cities',
      'age',
      'gender',
      'devices',
      'operating-systems',
      'subscribers',
    ].map((section) => `.audience-grid[aria-busy="true"] .placeholder-${section}-heading`),
  )}.map((place) => document.querySelector(place)?.closest('[data-slot="card"]') ?? null)`

  type Box = { left: number; width: number }
  type CardBox = Box & { top: number; height: number; slack: number; column: number }

  /**
   * The box of each Audience section's card, in the screen's order: the heading's Card, its top on
   * the page, its slack, how far its bottom border edge sits below its content, its last child's
   * bottom and margin, its padding and its border, and its column, the place of its
   * `.audience-column` among the grid's.
   */
  async function audienceCardBoxes(): Promise<CardBox[]> {
    const boxes: CardBox[] = []
    for (const name of audienceHeadings) {
      const box = await on(
        await control('heading', name),
        `function () {
          const card = this.closest('[data-slot="card"]')
          if (!card || !card.lastElementChild) return null
          const { left, top, width, height, bottom } = card.getBoundingClientRect()
          const style = getComputedStyle(card)
          const content =
            card.lastElementChild.getBoundingClientRect().bottom +
            parseFloat(getComputedStyle(card.lastElementChild).marginBottom) +
            parseFloat(style.paddingBottom) +
            parseFloat(style.borderBottomWidth)
          const column = card.parentElement
          const columns = column ? [...column.parentElement.children] : []
          return {
            left,
            top: top + window.scrollY,
            width,
            height,
            slack: bottom - content,
            column: column && column.matches('.audience-column') ? columns.indexOf(column) : -1,
          }
        }`,
      )
      if (box === null) throw new Error(`The "${name}" section is in no card`)
      boxes.push(box as CardBox)
    }
    return boxes
  }

  const columnsOf = (boxes: Box[]) => new Set(boxes.map(({ left }) => Math.round(left))).size

  /** The landed Audience grid's width, the root font size and how many columns it renders. */
  const audienceGridOf = async (selector = '.audience-grid:not([aria-busy])') =>
    (await evaluate(
      `(() => {
        const grid = document.querySelector(${JSON.stringify(selector)})
        return {
          width: grid.getBoundingClientRect().width,
          rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
          columns: grid.querySelectorAll(':scope > .audience-column').length,
        }
      })()`,
    )) as { width: number; rem: number; columns: number }

  const audiencePlaceholderPacked = async (what: string) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const grid = await audienceGridOf('.audience-grid[aria-busy="true"]')
      if (grid.columns === audienceColumnCountOf(grid.width, grid.rem)) return
      await delay(50)
    }
    throw new Error(`${what}: the Audience placeholder never packed into the columns that fit`)
  }

  /**
   * What is wrong with the Audience cards at `width`: a card taller than its content, a column
   * count other than the 18rem columns that fit the grid, a card in a column other than the one
   * the packing by height assigns from the cards' measured heights (creator-analytics#711), or a
   * column whose cards do not read down it in DOM order, which is the reading and the focus order.
   */
  const audienceCardFaults = async (cards: CardBox[], width: number): Promise<string[]> => {
    const faults: string[] = []
    const stretched = cards.flatMap((card, at) =>
      card.slack > 1 ? [{ section: audienceHeadings[at], slack: card.slack }] : [],
    )
    if (stretched.length > 0) {
      faults.push(
        `At ${width}px Audience cards are taller than their content: ${JSON.stringify(stretched)}`,
      )
    }
    const grid = await audienceGridOf()
    const count = audienceColumnCountOf(grid.width, grid.rem)
    if (grid.columns !== count) {
      faults.push(
        `At ${width}px the ${grid.width}px Audience grid renders ${grid.columns} columns, not the ${count} that fit`,
      )
    }
    const assigned = packAudienceCards(
      cards.map(({ height }) => height),
      count,
      audienceGapRem * grid.rem,
    )
    const misplaced = assigned.flatMap((column, at) =>
      column.flatMap((card) =>
        cards[card]?.column === at
          ? []
          : [{ section: audienceHeadings[card], column: cards[card]?.column, assigned: at }],
      ),
    )
    if (misplaced.length > 0) {
      faults.push(
        `At ${width}px Audience cards sit outside the column the packing assigns: ${JSON.stringify(misplaced)}`,
      )
    }
    const outOfOrder = assigned.flatMap((column, at) => {
      const tops = column.map((card) => cards[card]?.top ?? Number.NaN)
      return tops.every((top, place) => place === 0 || top > (tops[place - 1] ?? Number.NaN))
        ? []
        : [{ column: at, sections: column.map((card) => audienceHeadings[card]), tops }]
    })
    if (outOfOrder.length > 0) {
      faults.push(
        `At ${width}px Audience columns do not read down in DOM order: ${JSON.stringify(outOfOrder)}`,
      )
    }
    return faults
  }

  // The cards sit in as many 18rem columns as fit: more than one on a full screen, more again on a
  // 2560px one, where the screen has no 76rem cap (creator-analytics#477), and one on a phone. At
  // each width no card is taller than its content, each card sits in the column the packing by
  // height assigns from the cards' measured heights, and each column reads down in DOM order, so
  // at 375px the cards keep the DOM order (creator-analytics#711).
  await walk('state: audience grid columns', async () => {
    const faults: string[] = []
    await send('Page.navigate', { url: `${stub.origin}/app/audience` })
    await ready()
    const wideCards = await audienceCardBoxes()
    faults.push(...(await audienceCardFaults(wideCards, viewport.width)))
    const wide = columnsOf(wideCards)
    if (wide < 2) faults.push(`The Audience cards sit in ${wide} column at ${viewport.width}px`)
    await send('Emulation.setDeviceMetricsOverride', { ...wideAt(2560), mobile: false })
    try {
      await send('Page.navigate', { url: `${stub.origin}/app/audience` })
      await ready()
      const widestCards = await audienceCardBoxes()
      faults.push(...(await audienceCardFaults(widestCards, 2560)))
      const widest = columnsOf(widestCards)
      if (widest <= wide) {
        faults.push(
          `The Audience cards sit in ${widest} columns at 2560px, against ${wide} at ${viewport.width}px`,
        )
      }
      await send('Emulation.setDeviceMetricsOverride', { ...narrow, mobile: false })
      await send('Page.navigate', { url: `${stub.origin}/app/audience` })
      await ready()
      const phoneCards = await audienceCardBoxes()
      faults.push(...(await audienceCardFaults(phoneCards, narrow.width)))
      const phone = columnsOf(phoneCards)
      if (phone !== 1)
        faults.push(`The Audience cards sit in ${phone} columns at ${narrow.width}px`)
    } finally {
      await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
    }
    if (faults.length > 0) throw new Error(faults.join('; '))
  })

  // The placeholder packs each card's place into the same columns, each place as wide as its card.
  // On a first visit the places hold the most bars a section draws and the sample answers fewer, so
  // a card may change column when the numbers land, the compromise creator-analytics#510 accepted
  // for heights and #689 and #711 for columns: this step holds the width, and the second read's
  // step holds the left edge. The DevTools Fetch domain holds the Audience read, so the placeholder stays on
  // screen to be measured, then lets it go.
  let pausedAudienceRead: string | null = null
  listen(({ method, params }) => {
    if (method === 'Fetch.requestPaused') pausedAudienceRead = String(params.requestId)
  })
  await walk('state: audience placeholder in the columns', async () => {
    pausedAudienceRead = null
    await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/channels/*/audience*' }] })
    try {
      await send('Page.navigate', { url: `${stub.origin}/app/audience` })
      await waitFor(
        `${busyAudienceCards}.every((card) => card)`,
        'The Audience placeholder did not hold eight places',
        100,
      )
      for (let attempt = 0; attempt < 100 && pausedAudienceRead === null; attempt++) {
        await delay(50)
      }
      if (pausedAudienceRead === null) throw new Error('The Audience read was never held')
      await audiencePlaceholderPacked('The first Audience placeholder')
      const places = (await evaluate(
        `${busyAudienceCards}.map((place) => {
          const { left, width } = place.getBoundingClientRect()
          return { left, width }
        })`,
      )) as Box[]
      await send('Fetch.continueRequest', { requestId: pausedAudienceRead })
      await ready()
      const cards = await audienceCardBoxes()
      const moved = cards.flatMap((card, at) => {
        const place = places[at]
        return place && Math.abs(place.width - card.width) < 0.5
          ? []
          : [{ section: audienceHeadings[at], place, card }]
      })
      if (moved.length > 0) {
        throw new Error(
          `The Audience placeholder's places are not the cards': ${JSON.stringify(moved)}`,
        )
      }
    } finally {
      await send('Fetch.disable')
    }
  })

  // creator-analytics#510: each bars section's place holds the bars the same read last answered on
  // this page load, so on a second read of the same address every card keeps its left edge, its top
  // and its height when the numbers land, and the packing by height, which reads the same heights,
  // moves none to another column (creator-analytics#711). The
  // sample answers fewer bars than the most a section draws, so a first read moves up, the cost the
  // issue accepts; the step lands the screen once, goes to Videos from the sidebar, or at 375px
  // from the header's Menu (creator-analytics#891), and back to Audience, which keeps the query, so
  // the read is the same. The DevTools Fetch domain holds that
  // second read, so the places stay on screen to be measured. At the desktop width, in more than
  // one column, and at 375px, in one.
  const heldAudienceReads: string[] = []
  listen(({ method, params }) => {
    if (method === 'Fetch.requestPaused') heldAudienceReads.push(String(params.requestId))
  })
  await walk('state: audience cards stay put when the numbers land on a second read', async () => {
    type Place = { left: number; top: number; height: number }
    const placeOf = `(element) => {
      const { left, top, height } = element.getBoundingClientRect()
      return { left, top: top + window.scrollY, height }
    }`
    const failures: string[] = []
    try {
      for (const metrics of [viewport, narrow]) {
        await send('Emulation.setDeviceMetricsOverride', { ...metrics, mobile: false })
        await send('Page.navigate', { url: `${stub.origin}/app/audience` })
        await ready()
        const openMenu = async () => {
          if (metrics === narrow) await click(await control('button', 'Menu'))
        }
        await openMenu()
        await click(await control('link', 'Videos'))
        await ready()
        heldAudienceReads.length = 0
        await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/channels/*/audience*' }] })
        try {
          await openMenu()
          await click(await control('link', 'Audience'))
          for (let attempt = 0; attempt < 100 && heldAudienceReads.length === 0; attempt++)
            await delay(50)
          if (heldAudienceReads.length === 0)
            throw new Error(`At ${metrics.width}px the second Audience read was never held`)
          await waitFor(
            `${busyAudienceCards}.every((card) => card)`,
            `At ${metrics.width}px the Audience placeholder did not hold eight places`,
            100,
          )
          await audiencePlaceholderPacked(`At ${metrics.width}px the second Audience placeholder`)
          const places = (await evaluate(`${busyAudienceCards}.map(${placeOf})`)) as Place[]
          for (const requestId of heldAudienceReads.splice(0))
            await send('Fetch.continueRequest', { requestId })
          await ready()
          const cards: Place[] = []
          for (const name of audienceHeadings) {
            const card = await on(
              await control('heading', name),
              `function () {
                const card = this.closest('[data-slot="card"]')
                return card ? (${placeOf})(card) : null
              }`,
            )
            if (card === null) throw new Error(`The "${name}" section is in no card`)
            cards.push(card as Place)
          }
          const moved = cards.flatMap((card, at) => {
            const place = places[at]
            return place &&
              Math.abs(place.left - card.left) <= 1 &&
              Math.abs(place.top - card.top) <= 1 &&
              Math.abs(place.height - card.height) <= 1
              ? []
              : [{ section: audienceHeadings[at], place, card }]
          })
          if (moved.length > 0) {
            failures.push(
              `At ${metrics.width}px the Audience cards moved when the numbers landed: ${JSON.stringify(moved)}`,
            )
          }
        } finally {
          await send('Fetch.disable')
        }
      }
    } finally {
      await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
    }
    if (failures.length > 0) throw new Error(failures.join('; '))
  })

  /** The screen's width beside the sidebar, found from its date range control. */
  const screenWidth = async () => {
    const width = await on(
      await control('combobox', 'Date range'),
      `function () {
        const screen = this.closest('[data-slot="sidebar-wrapper"] > :not([data-slot="sidebar"])')
        return screen ? screen.getBoundingClientRect().width : null
      }`,
    )
    if (typeof width !== 'number')
      throw new Error('The date range sits in no screen beside the sidebar')
    return width
  }

  // creator-analytics#477: beside the open sidebar the screen fills the window to its right, past
  // the 76rem the screen kept before, up to a 2560px window, and past that keeps its 2560px width.
  await walk('state: screen as wide at 3000px as at 2560px', async () => {
    try {
      const widths: number[] = []
      for (const width of [2560, 3000]) {
        await send('Emulation.setDeviceMetricsOverride', { ...wideAt(width), mobile: false })
        await send('Page.navigate', { url: `${stub.origin}/app/` })
        await ready()
        await control('button', 'Collapse sidebar')
        widths.push(await screenWidth())
      }
      const [at2560 = 0, at3000 = 0] = widths
      const rem = (await evaluate(
        'parseFloat(getComputedStyle(document.documentElement).fontSize)',
      )) as number
      if (!(at2560 > 76 * rem)) {
        throw new Error(`At 2560px the screen is ${at2560}px wide, no wider than the 76rem cap`)
      }
      if (Math.abs(at3000 - at2560) > 1) {
        throw new Error(`The screen is ${at3000}px wide at 3000px and ${at2560}px at 2560px`)
      }
    } finally {
      await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
      await send('Page.navigate', { url: `${stub.origin}/app/` })
      await ready()
    }
  })

  // creator-analytics#477: once the numbers land, each note's place under them was as tall as the
  // note, so nothing below moves, at four window widths beside the open sidebar and the collapsed
  // one: the Audience screen's notes with a format chosen, so the every format notes show, and a
  // video's running total and delay notes under its charts in Running total mode, and the other
  // sources note under its numbers table, whose place the saved revenue sources choice holds, so
  // the step saves one first, through the stub as the app does (creator-analytics#509). The DevTools
  // Fetch domain holds each screen's read, so the places stay on screen to be measured, then lets
  // it go. The places and the notes have no role or name, so the step finds them by class.
  // creator-analytics#463: on the Audience screen each card's heading's place is as tall as its
  // heading too, two lines where the heading wraps, at the ticket's ends as well, 320px, where the
  // header's Menu holds the sidebar's items and no sidebar renders (creator-analytics#891), and
  // 1440px.
  // creator-analytics#468: on a video's page each section heading's place outside the head and the
  // breakdowns is as tall as a landed section heading that takes one line, within 0.1px, since both
  // go through Chrome's 64th of a px and the drift this catches is about 1.1px. These places and the
  // landed sections do not pair one to one, the stacked charts and the head differ, so every shown
  // place is compared with every one-line heading. creator-analytics#512: the breakdowns' two
  // heading places, traffic sources' and the subscriber split's, pair one to one with the landed
  // breakdowns' headings in column order, and each is as tall as its heading, wrapped or not,
  // within 0.1px: the subscriber split's wraps to two lines in a column narrower than about 373px.
  // The video's headings are checked at the Audience headings' six widths, its notes at their four,
  // since the delay note's place holds the longest month's note, which a shorter month's note can
  // fall a line short of at 320px (app.css). The Publish day bars' check is #469, the step after
  // this one.
  let pausedRead: string | null = null
  listen(({ method, params }) => {
    if (method === 'Fetch.requestPaused') pausedRead = String(params.requestId)
  })
  const heightsOf = (notes: string) =>
    `[...${notes}].map((note) => Math.round(note.getBoundingClientRect().height * 100) / 100)`
  // Each card's heading's place and its notes' places, then its heading and its notes, both in
  // the card's order.
  type HeldScreen = {
    path: string
    read: string
    widths: number[]
    places: string
    notes: () => Promise<number[][]>
    headings?: {
      widths: number[]
      places: string
      landed: string
      pairedPlaces: string
      pairedLanded: string
    }
  }
  const audienceNotes: HeldScreen = {
    path: '/app/audience?format=short',
    read: '*/api/channels/*/audience*',
    widths: [320, 768, 1280, 1440, 1920, 2560],
    places: `${busyAudienceCards}.map((card) => ${heightsOf(`card.querySelectorAll('.placeholder[class*="-heading"], .placeholder[class*="-note"]')`)})`,
    notes: async () => {
      const heights: number[][] = []
      for (const name of audienceHeadings) {
        heights.push(
          (await on(
            await control('heading', name),
            `function () {
              const card = this.closest('[data-slot="card"]')
              return ${heightsOf(`card.querySelectorAll('h2, p.note')`)}
            }`,
          )) as number[],
        )
      }
      return heights
    },
  }
  const videoNotes: HeldScreen = {
    path: `/app/videos/${encodeURIComponent(newestVideo.id)}?chart=aggregate`,
    read: `*/api/channels/*/videos/${encodeURIComponent(newestVideo.id)}*`,
    widths: [768, 1280, 1920, 2560],
    places: `[${heightsOf(`document.querySelector('[aria-busy="true"] .metric-charts').querySelectorAll('.placeholder[class*="-note"]')`)}]`,
    // Every note in the charts' section: the running total and delay notes above the numbers
    // table, and the other sources note under it (creator-analytics#509).
    notes: async () =>
      [
        await evaluate(
          heightsOf(`document.querySelector('section.metric-charts').querySelectorAll('p.note')`),
        ),
      ] as number[][],
    // Each shown section heading's place outside the head and the breakdowns; the stacked-only
    // chart's second one shows no box below the stacking width. Then each shown landed section
    // heading's height and the lines it takes at its line height. Then the breakdowns' heading
    // places and the landed breakdowns' headings, each in column order.
    headings: {
      widths: [320, 768, 1280, 1440, 1920, 2560],
      places: heightsOf(
        `[...document.querySelectorAll('[aria-busy="true"] .placeholder-heading')].filter((place) => !place.closest('.video-detail-head, .video-detail-breakdowns') && place.getClientRects().length > 0)`,
      ),
      pairedPlaces: heightsOf(
        `document.querySelectorAll('[aria-busy="true"] .video-detail-breakdowns .placeholder[class*="-heading"]')`,
      ),
      pairedLanded: heightsOf(`document.querySelectorAll('.video-detail-breakdowns h2')`),
      landed: `[...document.querySelectorAll('.video-detail-section h2')].filter((heading) => heading.getClientRects().length > 0).map((heading) => {
        const height = Math.round(heading.getBoundingClientRect().height * 100) / 100
        return { height, lines: Math.round(height / parseFloat(getComputedStyle(heading).lineHeight)) }
      })`,
    },
  }

  async function placesHoldWhatLands(
    screen: HeldScreen,
    state: 'expanded' | 'collapsed',
    width: number,
  ): Promise<void> {
    pausedRead = null
    await send('Fetch.enable', { patterns: [{ urlPattern: screen.read }] })
    try {
      await send('Page.navigate', { url: `${stub.origin}${screen.path}` })
      for (let attempt = 0; attempt < 100 && pausedRead === null; attempt++) await delay(50)
      if (pausedRead === null) throw new Error(`The read of ${screen.path} was never held`)
      // The sidebar opens until the preferences read lands, so from 48rem the places wait for its
      // state; below it the header's Menu holds its items, and no sidebar renders.
      await waitFor(
        `(${width < 768} || document.querySelector('[data-slot="sidebar"]')?.getAttribute('data-state') === '${state}') && (${screen.places}).flat().length > 0`,
        `${screen.path} at ${width}px, sidebar ${state}: no place shows beside the sidebar`,
        100,
      )
      if (screen === audienceNotes)
        await audiencePlaceholderPacked(`${screen.path} at ${width}px, sidebar ${state}`)
      const places = (await evaluate(screen.places)) as number[][]
      const headings = screen.headings?.widths.includes(width) ? screen.headings : null
      const headingPlaces = headings ? ((await evaluate(headings.places)) as number[]) : []
      const pairedPlaces = headings ? ((await evaluate(headings.pairedPlaces)) as number[]) : []
      await send('Fetch.continueRequest', { requestId: pausedRead })
      await ready()
      const problems: string[] = []
      if (screen.widths.includes(width)) {
        const notes = await screen.notes()
        const moved = places.flatMap((held, at) => {
          const landed = notes[at] ?? []
          return held.length === landed.length &&
            held.every((height, which) => Math.abs(height - (landed[which] ?? 0)) <= 1)
            ? []
            : [{ at, places: held, notes: landed }]
        })
        if (moved.length > 0 || notes.length !== places.length) {
          problems.push(`the places are not their texts' height: ${JSON.stringify(moved)}`)
        }
      }
      if (headings) {
        const landed = (await evaluate(headings.landed)) as {
          height: number
          lines: number
        }[]
        const oneLine = landed.filter((heading) => heading.lines === 1).map(({ height }) => height)
        if (
          headingPlaces.length === 0 ||
          oneLine.length === 0 ||
          headingPlaces.some((place) => oneLine.some((height) => Math.abs(place - height) > 0.1))
        ) {
          problems.push(
            `the section headings' places are not a one-line heading's height: places ${JSON.stringify(headingPlaces)}, headings ${JSON.stringify(landed)}`,
          )
        }
        const pairedLanded = (await evaluate(headings.pairedLanded)) as number[]
        if (
          pairedPlaces.length !== 2 ||
          pairedLanded.length !== pairedPlaces.length ||
          pairedPlaces.some((place, at) => Math.abs(place - (pairedLanded[at] ?? 0)) > 0.1)
        ) {
          problems.push(
            `the breakdowns' heading places are not their headings' height: places ${JSON.stringify(pairedPlaces)}, headings ${JSON.stringify(pairedLanded)}`,
          )
        }
      }
      if (problems.length > 0) {
        throw new Error(`${screen.path} at ${width}px, sidebar ${state}: ${problems.join('; ')}`)
      }
    } finally {
      await send('Fetch.disable')
    }
  }

  await walk(
    "state: notes, the Audience headings and a video page's section headings, wrapped or not, land in their places at 320px to 2560px",
    async () => {
      const failures: string[] = []
      // A saved revenue sources choice, so the charts' placeholder holds the other sources note's
      // place. Hidden, the default, so the numbers table keeps its one heading row and the later
      // steps still find "Show revenue sources"; it stays saved, as the stub forgets no one key.
      await fetch(`${stub.origin}/api/me/preferences`, {
        method: 'PUT',
        body: JSON.stringify({ revenueSources: false }),
      })
      try {
        for (const state of ['expanded', 'collapsed'] as const) {
          await send('Page.navigate', { url: `${stub.origin}/app/` })
          await ready()
          if (state === 'collapsed') {
            await click(await control('button', 'Collapse sidebar'))
            await controlOnceShown('button', 'Expand sidebar')
            // The stub saves the state; the next page reads it.
            await delay(settleMs)
          }
          for (const width of [320, 768, 1280, 1440, 1920, 2560]) {
            // Below 48rem the collapsed sidebar lays the screen out as the open one does.
            if (state === 'collapsed' && width < 768) continue
            await send('Emulation.setDeviceMetricsOverride', { ...wideAt(width), mobile: false })
            for (const screen of [audienceNotes, videoNotes]) {
              if (!screen.widths.includes(width) && !screen.headings?.widths.includes(width))
                continue
              await placesHoldWhatLands(screen, state, width).catch((error: Error) => {
                failures.push(error.message)
              })
            }
          }
        }
      } finally {
        await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
        await send('Page.navigate', { url: `${stub.origin}/app/` })
        await ready()
        const expand = await control('button', 'Expand sidebar').catch(() => null)
        if (expand) {
          await click(expand)
          await controlOnceShown('button', 'Collapse sidebar')
          await delay(settleMs)
        }
      }
      if (failures.length > 0) throw new Error(failures.join('; '))
    },
  )

  // creator-analytics#469: on the publish day, `window=first1`, the summary's place holds a line
  // for each bar's name, before any title is known. A landed title keeps to one line, cut short, so
  // each bar row is as tall as its place and the delay note under the bars stays where the places
  // put it, from a phone's 320px to 1440px. creator-analytics#510: on a first read the place holds
  // the ten rows the top holds at most, and the sample's top lands ten, so the step requires a
  // landed row for every place, compares every row, and holds the delay note's top where its place's
  // top was. The note's own place holds the longest month's note, a line more than a shorter month's
  // below 399px (app.css), so the step compares the note's top, not its height. The DevTools Fetch
  // domain holds the list's read, as in the step above, so the places stay on screen to be measured.
  const heldPublishDayReads: string[] = []
  listen(({ method, params }) => {
    if (method === 'Fetch.requestPaused') heldPublishDayReads.push(String(params.requestId))
  })
  await walk('state: publish day bars land in their places at 320px to 1440px', async () => {
    const heightOf = `(element) => Math.round(element.getBoundingClientRect().height * 100) / 100`
    const topOf = `(element) => element ? Math.round(element.getBoundingClientRect().top * 100) / 100 : null`
    const placesOf = `(() => {
      const place = document.querySelector('[aria-busy="true"]:has(> .placeholder-bar-row)')
      if (!place) return null
      const height = ${heightOf}
      return {
        rows: [...place.querySelectorAll(':scope > .placeholder-bar-row')].map(height),
        noteTop: (${topOf})(place.querySelector(':scope > .placeholder-note')),
      }
    })()`
    // A title wraps, or is cut short, when its text on one line is wider than its column: the
    // link, a grid item, is as wide as its column whichever way the sheet lays the title out.
    const landedOf = `(() => {
      const section = document.querySelector('section.publish-day-top')
      const height = ${heightOf}
      const context = document.createElement('canvas').getContext('2d')
      const items = [...section.querySelectorAll('.bars > li')]
      return {
        rows: items.map(height),
        noteTop: (${topOf})(section.querySelector(':scope > p.note')),
        longTitles: items.filter((item) => {
          const link = item.querySelector(':scope > a')
          context.font = getComputedStyle(link).font
          return context.measureText(link.textContent).width > link.clientWidth
        }).length,
      }
    })()`
    const failures: string[] = []
    try {
      for (const width of [320, 375, 480, 640, 768, 1024, 1280, 1440]) {
        await send('Emulation.setDeviceMetricsOverride', { ...wideAt(width), mobile: false })
        heldPublishDayReads.length = 0
        await send('Fetch.enable', {
          patterns: [{ urlPattern: '*/api/channels/*/videos?*window=first1*' }],
        })
        try {
          await send('Page.navigate', { url: `${stub.origin}/app/?window=first1` })
          for (let attempt = 0; attempt < 100 && heldPublishDayReads.length === 0; attempt++)
            await delay(50)
          if (heldPublishDayReads.length === 0)
            throw new Error(`At ${width}px the publish day read was never held`)
          // The sidebar opens until the preferences read lands, so from 48rem the places wait for
          // its state; below it the header's Menu holds its items, and no sidebar renders.
          await waitFor(
            `(${width < 768} || document.querySelector('[data-slot="sidebar"]')?.getAttribute('data-state') === 'expanded') && (${placesOf}) !== null`,
            `At ${width}px no publish day bar's place shows`,
            100,
          )
          const places = (await evaluate(placesOf)) as { rows: number[]; noteTop: number | null }
          for (const requestId of heldPublishDayReads.splice(0))
            await send('Fetch.continueRequest', { requestId })
          await ready()
          const landed = (await evaluate(landedOf)) as {
            rows: number[]
            noteTop: number | null
            longTitles: number
          }
          if (width === 320 && landed.longTitles === 0) {
            throw new Error('No publish day title is long enough to wrap at 320px')
          }
          if (
            landed.rows.length !== places.rows.length ||
            places.rows.some((height, at) => Math.abs(height - (landed.rows[at] ?? 0)) > 1)
          ) {
            failures.push(
              `At ${width}px the publish day bar rows are not their places: places ${JSON.stringify(places.rows)}, landed ${JSON.stringify(landed.rows)}`,
            )
          }
          if (
            places.noteTop === null ||
            landed.noteTop === null ||
            Math.abs(places.noteTop - landed.noteTop) > 1
          ) {
            failures.push(
              `At ${width}px the publish day delay note moved when the top landed: its place's top ${places.noteTop}, the note's ${landed.noteTop}`,
            )
          }
        } finally {
          await send('Fetch.disable')
        }
      }
    } finally {
      await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
      await send('Page.navigate', { url: `${stub.origin}/app/` })
      await ready()
    }
    if (failures.length > 0) throw new Error(failures.join('; '))
  })

  // creator-analytics#511: every bars section's place holds one line for each bar's name, before
  // any name is known, and the sample answers the longest names YouTube does (stub-api.ts). A
  // landed name keeps to that one line, so each bar row is as tall as its place, from a phone's
  // 320px to 1440px, in every Audience card, in their narrowest column, and in a video's traffic
  // sources. The places are alike, so each landed row is held to its section's place row, and a
  // first read's places hold more rows than land (creator-analytics#510), the cost #510 accepts.
  // A name wraps, or is cut short, when its text on one line is wider than its column, so at 320px
  // the Audience screen with no such name fails, and the repro cannot go stale. Measured before the
  // fix, at 1fr for the name's column, on 2026-11-08: "South Georgia & South Sandwich Islands"
  // took two lines at 320px, 375px, 1024px, 1280px and 1440px, "British Indian Ocean Territory" at
  // 320px and 1280px, the US states' two longest at 320px, and a row of two lines was 60px against
  // its place's 36px; no city and no traffic source name wrapped, "Direct or unknown sources" the
  // longest a video's sources name, so the video's page holds its rows to their places but needs no
  // long name. The DevTools Fetch domain holds each screen's read, as in the steps above, so the
  // places stay on screen to be measured.
  const heldBarsReads: string[] = []
  listen(({ method, params }) => {
    if (method === 'Fetch.requestPaused') heldBarsReads.push(String(params.requestId))
  })
  await walk('state: bar names land in their places at 320px to 1440px', async () => {
    type Bars = { rows: number[]; longNames: number }
    const heightOf = `(element) => Math.round(element.getBoundingClientRect().height * 100) / 100`
    // A section's place rows' heights.
    const placeRowsOf = (section: string) =>
      `[...${section}.querySelectorAll(':scope > .placeholder-bar-row')].map(${heightOf})`
    // A landed section's rows' heights, and how many of its names are wider on one line than
    // their column: the name, a grid item, is as wide as its column whichever way it is laid out.
    const landedBarsOf = `function () {
      const section = this.closest('.video-detail-section')
      const context = document.createElement('canvas').getContext('2d')
      const items = [...section.querySelectorAll('.bars > li')]
      return {
        rows: items.map(${heightOf}),
        longNames: items.filter((item) => {
          const name = item.firstElementChild
          context.font = getComputedStyle(name).font
          return context.measureText(name.textContent).width > name.clientWidth
        }).length,
      }
    }`
    const screens = [
      {
        name: 'Audience',
        path: '/app/audience',
        read: '*/api/channels/*/audience*',
        // Each card's place rows, in the screen's order; the subscribers card holds none.
        places: `${busyAudienceCards}.map((card) => ${placeRowsOf("card.querySelector('.video-detail-section')")})`,
        headings: audienceHeadings.slice(0, 7),
        longNameAt320: true,
      },
      {
        name: 'video',
        path: `/app/videos/${encodeURIComponent(newestLongVideo.id)}`,
        read: `*/api/channels/*/videos/${encodeURIComponent(newestLongVideo.id)}*`,
        places: `[${placeRowsOf(`document.querySelector('[aria-busy="true"] .video-detail-breakdowns > .video-detail-section')`)}]`,
        headings: ['Traffic sources (engaged views)'],
        longNameAt320: false,
      },
    ]
    const failures: string[] = []
    const wrapping: string[] = []
    try {
      for (const width of [320, 375, 480, 640, 768, 1024, 1280, 1440]) {
        await send('Emulation.setDeviceMetricsOverride', { ...wideAt(width), mobile: false })
        for (const screen of screens) {
          heldBarsReads.length = 0
          await send('Fetch.enable', { patterns: [{ urlPattern: screen.read }] })
          try {
            await send('Page.navigate', { url: `${stub.origin}${screen.path}` })
            for (let attempt = 0; attempt < 100 && heldBarsReads.length === 0; attempt++)
              await delay(50)
            if (heldBarsReads.length === 0)
              throw new Error(`At ${width}px the ${screen.name} read was never held`)
            // The sidebar opens until the preferences read lands, so from 48rem the places wait for
            // its state; below it the header's Menu holds its items, and no sidebar renders.
            await waitFor(
              `(${width < 768} || document.querySelector('[data-slot="sidebar"]')?.getAttribute('data-state') === 'expanded') && (${screen.places}).flat().length > 0`,
              `At ${width}px no ${screen.name} bar's place shows`,
              100,
            )
            if (screen.name === 'Audience') await audiencePlaceholderPacked(`At ${width}px`)
            const places = (await evaluate(screen.places)) as number[][]
            for (const requestId of heldBarsReads.splice(0))
              await send('Fetch.continueRequest', { requestId })
            await ready()
            let longNames = 0
            for (const [at, heading] of screen.headings.entries()) {
              const landed = (await on(await control('heading', heading), landedBarsOf)) as Bars
              const place = places[at]?.[0]
              longNames += landed.longNames
              if (landed.longNames > 0) wrapping.push(`${heading} at ${width}px`)
              if (
                place === undefined ||
                landed.rows.length === 0 ||
                landed.rows.some((height) => Math.abs(height - place) > 1)
              ) {
                failures.push(
                  `At ${width}px the "${heading}" bar rows are not their places' height: place ${place}, landed ${JSON.stringify(landed.rows)}`,
                )
              }
            }
            if (screen.longNameAt320 && width === 320 && longNames === 0) {
              failures.push(
                `At 320px no bar name on the ${screen.name} screen is long enough to wrap`,
              )
            }
          } finally {
            await send('Fetch.disable')
          }
        }
      }
    } finally {
      await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
      await send('Page.navigate', { url: `${stub.origin}/app/` })
      await ready()
    }
    if (failures.length > 0) {
      throw new Error(`${failures.join('; ')}; names too long for one line: ${wrapping.join(', ')}`)
    }
  })

  // The date range bar is an inset panel on every screen that shows it: padding on all four
  // sides, rounded corners, and its box inside the screen's column rather than at the viewport's
  // edge. The channel summary and the video list share one bar on /app/.
  await walk('state: date range bar inset', async () => {
    for (const path of [
      '/app/',
      `/app/videos/${encodeURIComponent(newestVideo.id)}`,
      '/app/audience',
    ]) {
      await send('Page.navigate', { url: `${stub.origin}${path}` })
      await ready()
      const bar = (await on(
        await control('combobox', 'Date range'),
        `function () {
          let bar = this.parentElement
          while (bar && getComputedStyle(bar).position !== 'sticky') bar = bar.parentElement
          if (!bar || !bar.parentElement) return null
          const style = getComputedStyle(bar)
          const column = getComputedStyle(bar.parentElement)
          const box = bar.getBoundingClientRect()
          const outer = bar.parentElement.getBoundingClientRect()
          return {
            padding: ['Top', 'Right', 'Bottom', 'Left'].map((side) => parseFloat(style['padding' + side])),
            // The rounded line is the bar's ::before, over its square fill (creator-analytics#461).
            radius: parseFloat(getComputedStyle(bar, '::before').borderTopLeftRadius),
            left: box.left,
            right: box.right,
            columnLeft: outer.left + parseFloat(column.paddingLeft),
            columnRight: outer.right - parseFloat(column.paddingRight),
            width: document.documentElement.clientWidth,
          }
        }`,
      )) as {
        padding: number[]
        radius: number
        left: number
        right: number
        columnLeft: number
        columnRight: number
        width: number
      } | null
      if (bar === null) throw new Error(`On ${path} the date range sits in no sticky bar`)
      const inset =
        bar.padding.every((side) => side > 0) &&
        bar.radius > 0 &&
        bar.left > 0 &&
        bar.right < bar.width &&
        bar.left >= bar.columnLeft - 0.5 &&
        bar.right <= bar.columnRight + 0.5
      if (!inset)
        throw new Error(`On ${path} the date range bar is not inset: ${JSON.stringify(bar)}`)
    }
  })

  // creator-analytics#397: on a 375px screen, each chart's card stays inside its plot at the first
  // and the last points, where the library's placement holds a tooltip at 8px from the plot's edge.
  // The relative retention card is wider than its plot there, so it wraps.
  await walk('state: chart cards inside the plot at 375px', async () => {
    await send('Emulation.setDeviceMetricsOverride', { ...narrow, mobile: false })
    try {
      await send('Page.navigate', {
        url: `${stub.origin}/app/videos/${encodeURIComponent(newestVideo.id)}`,
      })
      await ready()

      const retention = await retentionSliders()
      const [watching, relative] = retention
      if (!watching || !relative) throw new Error('No two retention charts')
      await on(relative, 'function () { this.focus() }')
      if (!(await isFocused(relative))) {
        throw new Error('The relative retention chart took no focus')
      }
      await cardsInsideAtBothEnds([relative, watching], 'retention pair')
      await pressKey('Escape', 27)
      await on(relative, 'function () { this.blur() }')

      // The narrow screen draws one of the stacked charts, the one its card chooses.
      const shown: string[] = []
      for (const label of stackedLabels) {
        try {
          shown.push(await control('slider', label))
        } catch {
          // Not drawn on a narrow screen.
        }
      }
      if (shown.length === 0) throw new Error('No stacked chart shows at 375px')
      for (const slider of shown) {
        await on(slider, 'function () { this.focus() }')
        if (!(await isFocused(slider))) throw new Error('The stacked chart took no focus')
        await cardsInsideAtBothEnds([slider], 'stacked chart')
        await pressKey('Escape', 27)
        await on(slider, 'function () { this.blur() }')
      }
    } finally {
      await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
    }
  })

  /**
   * Waits until the slider's plot is `rems` tall at the root's font size, the library's svg inside
   * it spans the plot's top to its bottom, and each of the chart's two axis labels is centred
   * within the plot, the top one wholly above the bottom one, and throws with every box when it
   * does not. The labels sit centred on the plot's edges by design, so their boxes straddle them.
   */
  async function plotHeightWithLabels(slider: string, rems: number, what: string): Promise<void> {
    let boxes: unknown = null
    for (let attempt = 0; attempt < 30; attempt++) {
      boxes = await on(
        slider,
        `function () {
          const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
          const plot = this.getBoundingClientRect()
          const svg = this.querySelector('.cursor-plot-chart svg')?.getBoundingClientRect()
          const labels = [...this.parentElement.querySelectorAll(':scope > .chart-label')].map(
            (label) => {
              const { top, bottom } = label.getBoundingClientRect()
              return { top, bottom, centre: (top + bottom) / 2 }
            },
          )
          const [upper, lower] = labels
          const fits =
            Math.abs(plot.height - ${rems} * rem) <= 0.5 &&
            svg !== undefined &&
            Math.abs(svg.top - plot.top) <= 0.5 &&
            Math.abs(svg.bottom - plot.bottom) <= 0.5 &&
            labels.length === 2 &&
            labels.every(
              ({ centre }) => centre >= plot.top - 0.5 && centre <= plot.bottom + 0.5,
            ) &&
            upper.bottom <= lower.top
          return {
            fits,
            expected: ${rems} * rem,
            plot: { top: plot.top, bottom: plot.bottom, height: plot.height },
            svg: svg ? { top: svg.top, bottom: svg.bottom, height: svg.height } : null,
            labels,
          }
        }`,
      )
      if ((boxes as { fits?: boolean }).fits === true) return
      await delay(100)
    }
    throw new Error(
      `${what}: the plot is not ${rems}rem with its labels inside: ${JSON.stringify(boxes)}`,
    )
  }

  // creator-analytics#418: where the charts stack, engaged views stays the primary chart at 10rem
  // and each chart below it plots at 6rem, with its axis labels and its card at both ends inside
  // the shorter plot; a chart shown alone on a 375px screen stays 10rem, watch hours included.
  await walk('state: stacked chart heights and axis labels', async () => {
    await send('Page.navigate', {
      url: `${stub.origin}/app/videos/${encodeURIComponent(newestVideo.id)}`,
    })
    await ready()
    const stacked = await stackedSliders()
    const [engaged, ...below] = stacked
    if (!engaged || below.length !== 3) throw new Error('No four stacked charts')
    await plotHeightWithLabels(engaged, 10, 'The stacked engaged views chart')
    for (const [index, slider] of below.entries()) {
      const name = ['watch hours', 'revenue', 'RPM'][index]
      await plotHeightWithLabels(slider, 6, `The stacked ${name} chart`)
      await on(slider, 'function () { this.focus() }')
      if (!(await isFocused(slider))) throw new Error('The stacked chart took no focus')
      await cardsInsideAtBothEnds([slider], `stacked ${name} chart`)
      await pressKey('Escape', 27)
      await on(slider, 'function () { this.blur() }')
    }

    await send('Emulation.setDeviceMetricsOverride', { ...narrow, mobile: false })
    try {
      for (const [card, label] of [
        ['engagedViews', stackedLabels[0]],
        ['watchTime', stackedLabels[1]],
        ['rpm', stackedLabels[3]],
      ] as const) {
        await send('Page.navigate', {
          url: `${stub.origin}/app/videos/${encodeURIComponent(newestVideo.id)}?card=${card}`,
        })
        await ready()
        const alone = await control('slider', label ?? '')
        await plotHeightWithLabels(alone, 10, `The ${card} chart alone at 375px`)
      }
    } finally {
      await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
    }
  })

  // creator-analytics#783: the sample is a paid channel whose history starts inside the last 28
  // days, so where the charts stack its summary draws six charts, impressions and CTR last, each
  // plotting at 6rem with its axis labels inside, and each marks the history start with a line
  // inside its plot, right of its left edge, since the window starts before the history.
  await walk('state: impressions and CTR charts', async () => {
    await send('Page.navigate', { url: `${stub.origin}/app/` })
    await ready()
    const sliders = await slidersNamed(labelsOf(['Impressions', 'Impressions click-through rate']))
    for (const [index, slider] of sliders.entries()) {
      const name = ['impressions', 'CTR'][index]
      await plotHeightWithLabels(slider, 6, `The stacked ${name} chart`)
      const marker = (await on(
        slider,
        `function () {
          const plot = this.getBoundingClientRect()
          const lines = [...this.querySelectorAll('.history-start-line')]
          const line = lines[0]?.getBoundingClientRect()
          return {
            lines: lines.length,
            inside: !!line && line.left > plot.left + 0.5 && line.right <= plot.right + 0.5 &&
              line.top >= plot.top - 0.5 && line.bottom <= plot.bottom + 0.5,
            charts: this.closest('section.metric-charts').querySelectorAll('.metric-chart').length,
          }
        }`,
      )) as { lines: number; inside: boolean; charts: number }
      if (marker.charts !== 6) {
        throw new Error(`The paid channel's summary stacks ${marker.charts} charts, not six`)
      }
      if (marker.lines !== 1 || !marker.inside) {
        throw new Error(
          `The stacked ${name} chart does not mark the history start once inside its plot: ${JSON.stringify(marker)}`,
        )
      }
    }
  })

  // creator-analytics#785: the sample is a paid channel, so the video list shows Impressions and
  // CTR after Engaged views, every row with a number in each, and the wider table still scrolls
  // inside its own box, which stays inside the page at 1280px and at 375px. A video's screen shows
  // each traffic source's impressions and CTR in a table in a row of its own under the traffic
  // sources and subscriber split, as wide as that row (creator-analytics#1048): at 375px the table
  // scrolls inside its box, which stays inside the page, and the page does not scroll sideways.
  // The whole table at 1280px is checked on staging by hand, as the stub's last28 table is
  // narrower than the old column. At both widths the video's own
  // impressions and CTR are the last two of the headline cards, inside the page, with none left
  // under the table (creator-analytics#1048), and the "stored up to" line is a muted caption with
  // no tint, while the screen's delay note keeps its tint (creator-analytics#1042).
  await walk('state: impressions and CTR in the video list and traffic sources', async () => {
    for (const metrics of [viewport, narrow]) {
      await send('Emulation.setDeviceMetricsOverride', { ...metrics, mobile: false })
      try {
        await send('Page.navigate', { url: `${stub.origin}/app/` })
        await ready()
        const list = (await evaluate(`(() => {
          const rows = document.querySelector('.video-list-rows')
          const headings = [...rows.querySelectorAll('thead th')].map((th) => th.textContent)
          const at = headings.indexOf('Impressions')
          const box = rows.querySelector('.video-list-scroll').getBoundingClientRect()
          const cells = [...rows.querySelectorAll('tbody tr')].map((row) => [
            row.children[at]?.textContent ?? '',
            row.children[at + 1]?.textContent ?? '',
          ])
          return {
            headings: headings.slice(at - 1, at + 2),
            cells,
            inside: box.left >= -0.5 && box.right <= document.documentElement.clientWidth + 0.5,
          }
        })()`)) as { headings: string[]; cells: string[][]; inside: boolean }
        const where = `at ${metrics.width}px`
        if (
          JSON.stringify(list.headings) !== JSON.stringify(['Engaged views', 'Impressions', 'CTR'])
        )
          throw new Error(`The list's headings ${where} are ${JSON.stringify(list.headings)}`)
        if (
          list.cells.length === 0 ||
          list.cells.some(([impressions]) => !/^[\d,]+/.test(impressions ?? ''))
        )
          throw new Error(`A list row ${where} has no impressions: ${JSON.stringify(list.cells)}`)
        if (!list.inside) throw new Error(`The list's scroll box ${where} runs past the page`)
      } finally {
        await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
      }
    }
    for (const metrics of [viewport, narrow]) {
      await send('Emulation.setDeviceMetricsOverride', { ...metrics, mobile: false })
      try {
        await send('Page.navigate', {
          url: `${stub.origin}/app/videos/${encodeURIComponent(newestLongVideo.id)}`,
        })
        await ready()
        const reach = (await evaluate(`(() => {
          const table = document.querySelector('.traffic-reach')
          const section = table.closest('.video-detail-section')
          const grid = document.querySelector('.video-detail-breakdowns').getBoundingClientRect()
          const row = section.getBoundingClientRect()
          const box = table.getBoundingClientRect()
          const width = document.documentElement.clientWidth
          const stored = [...section.querySelectorAll(':scope > p')].find((p) =>
            p.textContent.includes('stored up to'),
          )
          const look = (element) => {
            const style = getComputedStyle(element)
            return { background: style.backgroundColor, padding: style.padding, color: style.color }
          }
          return {
            rows: [...table.querySelectorAll('tr')].map((row) =>
              [...row.children].map((cell) => cell.textContent),
            ),
            row: {
              ownRow: section.closest('.video-detail-breakdowns') === null,
              underGrid: row.top >= grid.bottom - 0.5,
              fullWidth: Math.abs(row.left - grid.left) <= 0.5 && Math.abs(row.right - grid.right) <= 0.5,
              inside: box.left >= -0.5 && box.right <= width + 0.5,
              pageScrolls: document.documentElement.scrollWidth > width,
            },
            cardsInRow: section.querySelectorAll('.cards').length,
            cards: [...document.querySelectorAll('.video-detail-sections > .cards > div')].map((card) => {
              const box = card.getBoundingClientRect()
              return {
                label: card.querySelector('dt').textContent,
                inside: box.left >= -0.5 && box.right <= width + 0.5,
              }
            }),
            stored: stored && look(stored),
            delayNote: look(document.querySelector('section.metric-charts p.note')),
            ink: getComputedStyle(document.querySelector('main')).color,
          }
        })()`)) as {
          rows: string[][]
          row: {
            ownRow: boolean
            underGrid: boolean
            fullWidth: boolean
            inside: boolean
            pageScrolls: boolean
          }
          cardsInRow: number
          cards: { label: string; inside: boolean }[]
          stored?: { background: string; padding: string; color: string }
          delayNote: { background: string; padding: string; color: string }
          ink: string
        }
        const where = `at ${metrics.width}px`
        const [head, ...rows] = reach.rows
        if (JSON.stringify(head?.slice(1, 3)) !== JSON.stringify(['Impressions', 'CTR']))
          throw new Error(
            `The traffic sources' table ${where} has the headings ${JSON.stringify(head)}`,
          )
        if (rows.length === 0 || rows.some((row) => !/%$/.test(row[2] ?? '')))
          throw new Error(
            `A traffic source ${where} has no impressions and CTR: ${JSON.stringify(rows)}`,
          )
        if (
          !reach.row.ownRow ||
          !reach.row.underGrid ||
          !reach.row.fullWidth ||
          !reach.row.inside ||
          reach.row.pageScrolls
        )
          throw new Error(`The impressions table's row ${where} is ${JSON.stringify(reach.row)}`)
        if (
          JSON.stringify(reach.cards.slice(-2).map(({ label }) => label)) !==
            JSON.stringify(['Impressions', 'Impressions click-through rate']) ||
          reach.cards.some(({ inside }) => !inside) ||
          reach.cardsInRow !== 0
        )
          throw new Error(
            `The video's own impressions and CTR cards ${where} are ${JSON.stringify(reach.cards)}`,
          )
        const transparent = 'rgba(0, 0, 0, 0)'
        if (
          !reach.stored ||
          reach.stored.background !== transparent ||
          reach.stored.padding !== '0px' ||
          reach.stored.color === reach.ink ||
          reach.delayNote.background === transparent
        )
          throw new Error(
            `The "stored up to" line ${where} is ${JSON.stringify(reach.stored)}, the screen's delay note ${JSON.stringify(reach.delayNote)}, the ink ${reach.ink}`,
          )
      } finally {
        await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
      }
    }
  })

  // The "Upgrade" item's text and its hide button's name, restated from
  // apps/web/src/upgrade-prompt.ts, which reaches modules the walk's tsconfig does not compile.
  const upgradeLinkText = 'Upgrade'
  const hideUpgradeLabel = 'Hide Upgrade'

  /**
   * The sidebar's "Upgrade" item and its hide button, found on the accessibility tree, each inside
   * the screen's width (creator-analytics#907). Fails when either is missing.
   */
  async function sidebarUpgradeItem(where: string): Promise<string> {
    const link = await control('link', upgradeLinkText)
    const hide = await control('button', hideUpgradeLabel)
    for (const [name, objectId] of [
      [`"${upgradeLinkText}"`, link],
      [`"${hideUpgradeLabel}"`, hide],
    ] as const) {
      const { left, right, width } = (await on(
        objectId,
        `function () {
          const box = this.getBoundingClientRect()
          return { left: box.left, right: box.right, width: document.documentElement.clientWidth }
        }`,
      )) as { left: number; right: number; width: number }
      if (left < 0 || right > width) {
        throw new Error(
          `In ${where}, the sidebar's ${name} runs from ${left}px to ${right}px of ${width}px`,
        )
      }
    }
    return link
  }

  /** Clicks `link` and waits for the web app's upgrade screen, its heading on view. */
  async function opensUpgradeScreen(link: string, what: string): Promise<void> {
    await click(link)
    await waitFor(`location.pathname === '/app/upgrade'`, `${what} did not open the upgrade screen`)
    await ready()
    await pageHeading(upgradeText.heading)
  }

  // creator-analytics#788, as creator-analytics#915 left it: the sample channel free, to its owner,
  // on a product that offers Pro, shows only its own numbers. The summary row holds its own three
  // cards, and no card, chart heading, numbers table column or list column is impressions or CTR;
  // a video's traffic sources have no impressions and CTR table; and no "Sample" mark or sample
  // note shows. The sidebar's "Upgrade" item opens the upgrade screen, with its heading and both
  // pricing cards at the configured prices (creator-analytics#913). The walk's policy listener
  // fails the step on any violation. The stub answers as the paid channel again after it, whether
  // it passes or fails.
  await walk(
    'state: a free channel shows only its own numbers, and the upgrade screen',
    async () => {
      stub.setTier('free')
      try {
        await send('Page.navigate', { url: `${stub.origin}/app/` })
        await ready()
        const reach = await evaluate(`(() => {
        const reach = (selector) => [...document.querySelectorAll(selector)]
          .map((each) => each.textContent)
          .filter((text) => text.startsWith('Impressions') || text.startsWith('CTR'))
        return {
          cardCount: document.querySelectorAll('.cards > div').length,
          cards: reach('.cards > div dt'),
          charts: reach('.metric-chart h2'),
          table: reach('.numbers-table thead th'),
          columns: reach('.video-list-rows thead th'),
          sample: /sample/i.test(document.querySelector('main')?.textContent ?? ''),
        }
      })()`)
        const expected = {
          cardCount: 3,
          cards: [],
          charts: [],
          table: [],
          columns: [],
          sample: false,
        }
        if (JSON.stringify(reach) !== JSON.stringify(expected))
          throw new Error(`A free channel's channel screen shows ${JSON.stringify(reach)}`)

        await send('Page.navigate', {
          url: `${stub.origin}/app/videos/${encodeURIComponent(newestLongVideo.id)}`,
        })
        await ready()
        const sources = (await evaluate(`({
        bars: document.querySelectorAll('.bars li').length,
        reach: document.querySelector('.traffic-reach') !== null,
        sample: /sample/i.test(document.querySelector('main')?.textContent ?? ''),
      })`)) as { bars: number; reach: boolean; sample: boolean }
        if (sources.bars === 0 || sources.reach || sources.sample)
          throw new Error(`A free channel's video screen shows ${JSON.stringify(sources)}`)

        await opensUpgradeScreen(
          await sidebarUpgradeItem('the video screen at 1280px'),
          'The sidebar\'s "Upgrade"',
        )
        // creator-analytics#913: the two pricing cards at the stub's configured prices, $7 and $70.
        const plans = await evaluate(
          `JSON.stringify([...document.querySelectorAll('.upgrade-plan')].map((card) => [card.querySelector('.upgrade-badge')?.textContent ?? null, card.querySelector('.upgrade-price')?.textContent ?? null, card.querySelector('button')?.textContent ?? null]))`,
        )
        const expectedPlans = JSON.stringify([
          [null, '$7 a month', 'Subscribe monthly'],
          ['Save $14', '$70 a year', 'Subscribe yearly'],
        ])
        if (plans !== expectedPlans) {
          throw new Error(`The upgrade screen's pricing cards are ${String(plans)}`)
        }
      } finally {
        stub.setTier('paid')
      }
    },
  )

  // creator-analytics#907: the sample channel free, to its owner, on a product that offers Pro.
  // Beside the column at 1280px, and in the header's Menu panel at 375px, the "Upgrade" item
  // and its hide button sit inside the screen, and the item opens the upgrade screen. The walk never
  // presses the hide button, which would take the item off every screen after it. Then the
  // homepage's Pro card's "Subscribe" opens the upgrade screen signed in, and signed out the web
  // app's sign-in screen at the same address, whose sign-in lands back there (the API's sign-in
  // tests follow that through Google). The stub answers as the paid channel, signed in, after it.
  await walk('state: the sidebar\'s "Upgrade" item and the homepage\'s "Subscribe"', async () => {
    stub.setTier('free')
    try {
      await send('Page.navigate', { url: `${stub.origin}/app/` })
      await ready()
      await opensUpgradeScreen(
        await sidebarUpgradeItem('the column at 1280px'),
        'The sidebar\'s "Upgrade"',
      )

      await send('Emulation.setDeviceMetricsOverride', { ...narrow, mobile: false })
      try {
        await send('Page.navigate', { url: `${stub.origin}/app/` })
        await ready()
        await click(await control('button', 'Menu'))
        await opensUpgradeScreen(
          await sidebarUpgradeItem("the header's Menu panel at 375px"),
          'The Menu panel\'s "Upgrade"',
        )
        // creator-analytics#918: on the upgrade screen the panel's "Upgrade" is the current item,
        // filled in the accent token and inked in the on-accent token, as the panel's other
        // current items are, not in the row's soft ink.
        await click(await control('button', 'Menu'))
        const ink = await on(
          await sidebarUpgradeItem("the header's Menu panel on the upgrade screen"),
          `function () {
            const probe = document.createElement('span')
            probe.style.color = 'var(--on-accent)'
            probe.style.backgroundColor = 'var(--accent)'
            this.append(probe)
            const want = getComputedStyle(probe)
            const style = getComputedStyle(this)
            const result = JSON.stringify({
              current: this.getAttribute('aria-current'),
              color: style.color === want.color,
              background: style.backgroundColor === want.backgroundColor,
            })
            probe.remove()
            return result
          }`,
        )
        if (ink !== JSON.stringify({ current: 'page', color: true, background: true })) {
          throw new Error(
            `The Menu panel's current "Upgrade" is not on-accent ink on the accent: ${String(ink)}`,
          )
        }
      } finally {
        await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
      }

      await send('Page.navigate', { url: `${stub.origin}/` })
      await waitFor(pageReadyCheck('/'), 'The homepage did not load')
      await opensUpgradeScreen(await control('link', 'Subscribe'), 'The homepage\'s "Subscribe"')

      stub.signedIn(false)
      await send('Page.navigate', { url: `${stub.origin}/` })
      await waitFor(pageReadyCheck('/'), 'The homepage did not load')
      await click(await control('link', 'Subscribe'))
      await waitFor(
        `location.pathname === '/app/upgrade'`,
        'Signed out, the homepage\'s "Subscribe" did not open /app/upgrade',
      )
      await waitFor(
        `[...document.querySelectorAll('button')].some((button) => button.textContent === 'Sign in with Google')`,
        'Signed out, /app/upgrade shows no "Sign in with Google"',
      )
    } finally {
      stub.signedIn(true)
      stub.setTier('paid')
    }
  })

  /**
   * The revenue card's "RPM: …" line, a button whose accessible name opens "RPM: ", by DevTools
   * object id. Fails, naming `where`, when no such button is on screen.
   */
  async function rpmLine(where: string): Promise<string> {
    const { root } = (await send('DOM.getDocument', { depth: 0 })) as {
      root: { nodeId: number }
    }
    const { nodes } = (await send('Accessibility.queryAXTree', {
      nodeId: root.nodeId,
      role: 'button',
    })) as { nodes: { backendDOMNodeId?: number; name?: { value?: string } }[] }
    const backendNodeId = nodes.find(
      ({ name, backendDOMNodeId }) => backendDOMNodeId && name?.value?.startsWith('RPM: '),
    )?.backendDOMNodeId
    if (!backendNodeId) throw new Error(`No "RPM: …" button on the revenue card ${where}`)
    const { object } = (await send('DOM.resolveNode', { backendNodeId })) as {
      object: { objectId: string }
    }
    return object.objectId
  }

  // creator-analytics#356: on a 375px screen the revenue card's "RPM: …" line is a button of its
  // own, raised above the label's button stretched over the card. A real press at the line's centre
  // shows the RPM chart alone, which only Chrome's hit testing can show: happy-dom lays nothing out.
  // The RPM chart's card then names the slider's point and reads the sample channel's currency.
  await walk('state: RPM line chooses the RPM chart at 375px', async () => {
    await send('Emulation.setDeviceMetricsOverride', { ...narrow, mobile: false })
    try {
      await send('Page.navigate', {
        url: `${stub.origin}/app/videos/${encodeURIComponent(newestVideo.id)}`,
      })
      await ready()
      const line = await rpmLine('at 375px')
      await on(line, "function () { this.scrollIntoView({ block: 'center' }) }")
      const { x, y } = await centreOf(line)
      await pressAt(x, y)

      await waitFor(
        `(() => {
          const sliders = [...document.querySelectorAll('[role="slider"]')].map((slider) =>
            slider.getAttribute('aria-label'),
          )
          return sliders.includes(${JSON.stringify(stackedLabels[3])}) &&
            !sliders.includes(${JSON.stringify(stackedLabels[0])}) &&
            !sliders.includes(${JSON.stringify(stackedLabels[2])})
        })()`,
        'A press on the RPM line did not show the RPM chart alone',
      )
      if ((await on(line, "function () { return this.getAttribute('aria-pressed') }")) !== 'true') {
        throw new Error('The RPM line is not pressed after a press on it')
      }

      const rpm = await control('slider', stackedLabels[3] ?? '')
      await plotHeightWithLabels(rpm, 10, 'The RPM chart alone at 375px')
      await on(rpm, 'function () { this.focus() }')
      if (!(await isFocused(rpm))) throw new Error('The RPM chart took no focus')
      await pressKey('End', 35)
      await samePointOnEvery([rpm], 'End on the RPM chart showed no card for its point')
      const value = await on(
        rpm,
        `function () {
          const card = this.querySelector('.ts-chart-tooltip:not([hidden]) .chart-hover-card')
          return card ? card.querySelector('.chart-hover-value')?.textContent ?? '' : null
        }`,
      )
      if (typeof value !== 'string' || !/^\$\d/.test(value)) {
        throw new Error(`The RPM card at the last day is not in USD: ${JSON.stringify(value)}`)
      }
      await pressKey('Escape', 27)
      await on(rpm, 'function () { this.blur() }')
    } finally {
      await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
    }
  })

  // creator-analytics#268, Nick's phone walk on 2026-11-06: the RPM line's button is raised above
  // the label's stretched ::after, and the sticky date range bar sits at the same z-index, so a line
  // scrolled under the stuck bar painted over it. On the list's route and a video's page, on a
  // phone and on a desktop window too short to stack the charts (so the cards choose them), the
  // page scrolls until the line's centre sits under the stuck bar, and the topmost element there,
  // by Chrome's own hit testing, is inside the bar.
  await walk('state: RPM line under the stuck date range bar', async () => {
    const shortDesktop = { width: 1280, height: 640, deviceScaleFactor: 1 }
    const failures: string[] = []
    try {
      for (const [size, metrics] of [
        ['375px', narrow],
        ['1280px by 640px', shortDesktop],
      ] as const) {
        await send('Emulation.setDeviceMetricsOverride', { ...metrics, mobile: false })
        for (const path of ['/app/', `/app/videos/${encodeURIComponent(newestVideo.id)}`]) {
          await send('Page.navigate', { url: `${stub.origin}${path}` })
          await ready()
          const where = `on ${path} at ${size}`
          const line = await rpmLine(where)
          const bar = await control('combobox', 'Date range')
          const barBox = `function () {
            let bar = this.parentElement
            while (bar && getComputedStyle(bar).position !== 'sticky') bar = bar.parentElement
            if (!bar) return null
            const box = bar.getBoundingClientRect()
            return { top: box.top, bottom: box.bottom, height: box.height }
          }`
          const before = (await on(bar, barBox)) as { height: number } | null
          if (before === null) throw new Error(`${where} the date range sits in no sticky bar`)
          // The stuck bar runs from the window's top, so its middle is half its height down.
          const { y } = await centreOf(line)
          await evaluate(
            `window.scrollTo({ top: window.scrollY + ${y - before.height / 2}, behavior: 'instant' })`,
          )
          await evaluate(
            'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
          )
          const { x, y: under } = await centreOf(line)
          const stuck = (await on(bar, barBox)) as { top: number; bottom: number }
          if (!(stuck.top <= 0.5 && under > stuck.top && under < stuck.bottom)) {
            throw new Error(
              `${where} the RPM line's centre at ${under}px is not under the stuck bar: ${JSON.stringify(stuck)}`,
            )
          }
          const top = await on(
            bar,
            `function () {
              let bar = this.parentElement
              while (bar && getComputedStyle(bar).position !== 'sticky') bar = bar.parentElement
              const top = document.elementFromPoint(${x}, ${under})
              return bar.contains(top)
                ? null
                : (top?.textContent ?? '').trim().slice(0, 60) || String(top?.tagName)
            }`,
          )
          if (top !== null) {
            failures.push(`${where} the RPM line paints over the stuck date range bar: "${top}"`)
          }
        }
      }
      if (failures.length > 0) throw new Error(failures.join('; '))
    } finally {
      await evaluate("window.scrollTo({ top: 0, behavior: 'instant' })")
      await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
    }
  })

  // creator-analytics#461: the stuck date range bar reads as one piece, with nothing of the page
  // showing through its rounded corners. On the list's route after a real press on "Next page",
  // which lands the table under the bar (creator-analytics#236), and on the channel screen and the
  // Audience screen scrolled by 400px, the topmost element one pixel in from each of the stuck
  // bar's four corners, by Chrome's own hit testing, is inside the bar. Chrome hit tests a rounded
  // box by its curve, so a corner cut out of the bar's fill hits whatever scrolls under it.
  await walk('state: stuck date range bar has no gaps at its corners', async () => {
    const failures: string[] = []
    try {
      for (const [where, path, reach] of [
        ['on /app/ after "Next page"', '/app/', 'next page'],
        ['on /app/ scrolled by 400px', '/app/', 400],
        ['on /app/audience scrolled by 400px', '/app/audience', 400],
      ] as const) {
        await send('Page.navigate', { url: `${stub.origin}${path}` })
        await ready()
        if (reach === 'next page') {
          await click(await control('link', 'Next page'))
          await waitFor('window.scrollY > 0', `${where} the page did not scroll to the list`)
          await ready()
        } else {
          await evaluate(`window.scrollTo({ top: ${reach}, behavior: 'instant' })`)
        }
        await evaluate(
          'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
        )
        const corners = (await on(
          await control('combobox', 'Date range'),
          `function () {
            let bar = this.parentElement
            while (bar && getComputedStyle(bar).position !== 'sticky') bar = bar.parentElement
            if (!bar) return null
            const box = bar.getBoundingClientRect()
            const points = {
              'top left': [box.left + 1, box.top + 1],
              'top right': [box.right - 1.5, box.top + 1],
              'bottom left': [box.left + 1, box.bottom - 1.5],
              'bottom right': [box.right - 1.5, box.bottom - 1.5],
            }
            const gaps = []
            for (const [corner, [x, y]] of Object.entries(points)) {
              const top = document.elementFromPoint(x, y)
              if (bar.contains(top)) continue
              const text = (top?.textContent ?? '').trim().slice(0, 40)
              gaps.push(corner + ' shows ' + String(top?.tagName).toLowerCase() + ' "' + text + '"')
            }
            return { top: box.top, gaps }
          }`,
        )) as { top: number; gaps: string[] } | null
        if (corners === null) {
          failures.push(`${where} the date range sits in no sticky bar`)
        } else if (corners.top > 0.5) {
          failures.push(`${where} the date range bar is not stuck: its top is at ${corners.top}px`)
        } else {
          failures.push(...corners.gaps.map((gap) => `${where} the stuck bar's ${gap}`))
        }
      }
      if (failures.length > 0) throw new Error(failures.join('; '))
    } finally {
      await evaluate("window.scrollTo({ top: 0, behavior: 'instant' })")
    }
  })

  // creator-analytics#399: the launch chart's plot carries `cursor-plot` too, so #397's rule bounds
  // its card on a 375px screen, and a long title now cuts short with an ellipsis rather than
  // running past the card. The keys place the card on the first line the sample draws on every day
  // of the window, at its first day and then its last.
  await walk('state: launch chart card at 375px', async () => {
    await send('Emulation.setDeviceMetricsOverride', { ...narrow, mobile: false })
    try {
      await send('Page.navigate', { url: `${stub.origin}${launchAddress}` })
      await ready()
      const full = launchLines.findIndex(({ days }) => days.length === launchDays)
      if (full === -1) throw new Error(`The sample draws no launch line on all ${launchDays} days`)
      const slider = await launchSlider()
      await on(slider, 'function () { this.focus() }')
      if (!(await isFocused(slider))) throw new Error('The launch chart took no focus')

      // The first ArrowDown selects the first line at Day 1, and each one after it the next line.
      for (let press = 0; press <= full; press++) await pressKey('ArrowDown', 40)
      await launchStateWhere(
        slider,
        showsLaunch(full, 1),
        `ArrowDown did not select ${launchLines[full]?.title} on Day 1`,
      )
      await launchCardFits(slider, 'At the first day of the launch chart')

      await pressKey('End', 35)
      await launchStateWhere(
        slider,
        showsLaunch(full, launchDays),
        `End did not select ${launchLines[full]?.title} on Day ${launchDays}`,
      )
      await launchCardFits(slider, 'At the last day of the launch chart')

      await pressKey('Escape', 27)
      await on(slider, 'function () { this.blur() }')
    } finally {
      await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
    }
  })

  /**
   * The engaged views card's height on this screen and its card placeholder's, in CSS pixels, with
   * the number of lines its ratio line takes. The placeholder is planted in a cards row of its own,
   * as `CardsPlaceholder` lays it out, and removed once measured. Throws when no engaged views card
   * shows, or when the ratio line shows where `withRatio` says none, or none shows where it says
   * one, so the check cannot pass on a card that lost its line.
   */
  async function engagedViewsCardHeights(withRatio: boolean): Promise<{
    card: number
    placeholder: number
    ratioLines: number
  }> {
    const heights = (await evaluate(`(() => {
      const card = [...document.querySelectorAll('.cards .card')].find(
        (each) => each.querySelector('dt')?.textContent === 'Engaged views',
      )
      if (!card) return 'no engaged views card'
      const ratio = card.querySelector('.card-detail [aria-hidden="true"]')
      if (${withRatio} && !ratio) return 'no ratio line in the engaged views card'
      if (${!withRatio} && ratio) return 'a ratio line in the engaged views card at zero engaged views'
      const row = document.createElement('div')
      row.className = 'cards'
      const placeholder = document.createElement('div')
      placeholder.className = 'placeholder placeholder-card'
      row.append(placeholder)
      card.parentElement.after(row)
      const placeholderHeight = placeholder.getBoundingClientRect().height
      row.remove()
      return {
        card: card.getBoundingClientRect().height,
        placeholder: placeholderHeight,
        ratioLines: ratio ? ratio.getClientRects().length : 0,
      }
    })()`)) as { card: number; placeholder: number; ratioLines: number } | string
    if (typeof heights === 'string') throw new Error(heights)
    return heights
  }

  // creator-analytics#242: the ratio line under the views line wraps on a card narrower than about
  // 18rem, as three cards to a row are at 800px, and stays on one line at 1280px. Either
  // way the engaged views card is as tall as the card placeholder that holds its place, so the row
  // does not move when the answer lands (creator-analytics issue 119, W24). At zero engaged views it
  // has no ratio line and is as tall: the sample channel has no live video, so its Live summary
  // answers zero engaged views. The paid sample's video screen has five cards to a row since
  // creator-analytics#1048, so its ratio line wraps at 1280px too, and the free sample's video
  // screen, three cards to a row, is the one that keeps it on one line there. The stub answers as
  // the paid channel again after it, whether it passes or fails.
  await walk('state: engaged views card as tall as its placeholder', async () => {
    const mismatches: string[] = []
    const lines = new Set<number>()
    try {
      for (const width of [viewport.width, 800]) {
        await send('Emulation.setDeviceMetricsOverride', { ...viewport, width, mobile: false })
        for (const [path, withRatio, tier] of [
          ['/app/', true, 'paid'],
          [`/app/videos/${encodeURIComponent(newestVideo.id)}`, true, 'paid'],
          [`/app/videos/${encodeURIComponent(newestVideo.id)}`, true, 'free'],
          ['/app/?format=live', false, 'paid'],
        ] as const) {
          stub.setTier(tier)
          await send('Page.navigate', { url: `${stub.origin}${path}` })
          await ready()
          const { card, placeholder, ratioLines } = await engagedViewsCardHeights(withRatio)
          if (withRatio) lines.add(ratioLines)
          if (Math.abs(card - placeholder) > 0.5) {
            mismatches.push(
              `${path}, ${tier}, at ${width}px: the card is ${card}px, its placeholder ${placeholder}px, ` +
                `the ratio line ${ratioLines} lines`,
            )
          }
        }
      }
    } finally {
      stub.setTier('paid')
      await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
    }
    if (mismatches.length > 0) throw new Error(mismatches.join('; '))
    if (!lines.has(1) || !lines.has(2)) {
      throw new Error(
        `The ratio line took ${[...lines].join(' and ')} lines, not one somewhere and two elsewhere`,
      )
    }
  })

  // A row is as tall as its tallest card, so where the cards wrap, two to a row on a 560px screen
  // and one to a row on a 380px screen, each card has to be as tall as a card placeholder for the
  // row to keep the height of as many placeholders (creator-analytics issue 119, W24). The sample
  // is a paid channel, so every format shows five cards, impressions and CTR last
  // (creator-analytics#783).
  await walk('state: wrapped cards row as tall as its placeholders', async () => {
    const mismatches: string[] = []
    try {
      const cardCount = 5
      for (const [width, perRow] of [
        [560, 2],
        [380, 1],
      ] as const) {
        const rows = Math.ceil(cardCount / perRow)
        await send('Emulation.setDeviceMetricsOverride', { ...viewport, width, mobile: false })
        for (const path of ['/app/', '/app/?format=live']) {
          await send('Page.navigate', { url: `${stub.origin}${path}` })
          await ready()
          const heights = (await evaluate(`(() => {
            const row = document.querySelector('dl.cards')
            if (!row) return 'no cards row'
            const cards = [...row.querySelectorAll('.card')]
            if (cards.length !== ${cardCount}) return cards.length + ' cards, not ${cardCount}'
            const rows = new Set(cards.map((card) => Math.round(card.getBoundingClientRect().top))).size
            const holder = document.createElement('div')
            holder.className = 'cards'
            holder.innerHTML = '<div class="placeholder placeholder-card"></div>'.repeat(${cardCount})
            row.after(holder)
            const placeholders = holder.getBoundingClientRect().height
            holder.remove()
            return { row: row.getBoundingClientRect().height, placeholders, rows }
          })()`)) as { row: number; placeholders: number; rows: number } | string
          if (typeof heights === 'string') throw new Error(`${path} at ${width}px: ${heights}`)
          if (heights.rows !== rows) {
            throw new Error(
              `${path} at ${width}px: the cards took ${heights.rows} rows, not ${rows}`,
            )
          }
          if (Math.abs(heights.row - heights.placeholders) > 0.5) {
            mismatches.push(
              `${path} at ${width}px: the cards row is ${heights.row}px, ` +
                `its placeholders ${heights.placeholders}px`,
            )
          }
        }
      }
    } finally {
      await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
    }
    if (mismatches.length > 0) throw new Error(mismatches.join('; '))
  })

  // creator-analytics#891: on a 375px screen, with the second channel listed, the header is one
  // row, the wordmark, the "Menu" button and the avatar, each vertical centre on the wordmark's,
  // and the sidebar's items sit behind the button: a real press opens its panel under the header,
  // inside the screen, with the channel screens, "Thumbnail preview", "Send feedback", the support
  // item with its "Hide" text (creator-analytics#413, #476) and the channel picker, its select
  // inside the screen with the fixture's long channel names (review pass 1 finding 1: in the row,
  // a second channel's picker wrapped it); a real press on Audience opens that screen and closes
  // the panel; Enter on the focused button opens it again, Audience current, Tab moves onto its
  // first link, and Escape closes it with focus back on the button. No collapse button on view. It
  // never presses a new-tab link, which would open a page off the stub.
  await walk("state: the header's Menu at 375px", async () => {
    type Box = { top: number; left: number; right: number; height: number; width: number }
    const boxOf = `function () {
      const box = this.getBoundingClientRect()
      const width = document.documentElement.clientWidth
      return { top: box.top, left: box.left, right: box.right, height: box.height, width }
    }`
    const centreOf = (box: Box) => box.top + box.height / 2
    const menuExpanded = `document.querySelector('.header-menu-button')?.getAttribute('aria-expanded')`
    /** Fails when a control with this role and name is on the accessibility tree. */
    const absent = async (role: string, name: string, when: string) => {
      const found = await control(role, name).then(
        () => true,
        () => false,
      )
      if (found) throw new Error(`${when}, the ${role} "${name}" is on the accessibility tree`)
    }
    stub.listSecondChannel(true)
    await send('Emulation.setDeviceMetricsOverride', { ...narrow, mobile: false })
    try {
      await send('Page.navigate', { url: `${stub.origin}/app/` })
      await ready()
      const menu = await control('button', 'Menu')
      const items = {
        'the wordmark': await control('link', 'stillstats'),
        '"Menu"': menu,
        'the avatar': await control('button', settingsName),
      }
      const boxes: Record<string, Box> = {}
      for (const [name, objectId] of Object.entries(items)) {
        const inHeader = await on(objectId, `function () { return !!this.closest('header') }`)
        if (inHeader !== true) throw new Error(`At 375px ${name} is not in the header`)
        boxes[name] = (await on(objectId, boxOf)) as Box
      }
      const wordmark = boxes['the wordmark']
      if (!wordmark) throw new Error('No box for the wordmark')
      const header = (await on(
        menu,
        `function () { return this.closest('header').getBoundingClientRect().height }`,
      )) as number
      const tallest = Math.max(...Object.values(boxes).map(({ height }) => height))
      if (
        Object.values(boxes).some(
          (box) =>
            Math.abs(centreOf(box) - centreOf(wordmark)) > 0.5 ||
            box.left < 0 ||
            box.right > box.width,
        ) ||
        !(header < tallest * 1.5)
      ) {
        throw new Error(
          `At 375px the header, ${header}px tall, is not one row: ${JSON.stringify(boxes)}`,
        )
      }
      if ((await evaluate(menuExpanded)) !== 'false') {
        throw new Error('At 375px the Menu button does not start closed')
      }
      await absent('link', 'Videos', 'At 375px with the Menu closed')
      await absent('link', 'Audience', 'At 375px with the Menu closed')
      for (const name of ['Collapse sidebar', 'Expand sidebar']) {
        await absent('button', name, 'At 375px')
      }

      const menuBox = (await on(menu, boxOf)) as Box
      await pressAt((menuBox.left + menuBox.right) / 2, centreOf(menuBox))
      await waitFor(`${menuExpanded} === 'true'`, 'A press on "Menu" did not open its panel', 30)
      const names = [
        'Videos',
        'Audience',
        'Retention',
        "What's new",
        thumbnailPreviewItem,
        'Send feedback',
        'Support Stillstats',
      ]
      for (const name of names) await control('link', name)
      const listed = (await evaluate(
        `[...document.querySelectorAll('.header-menu-panel a')].map((link) => link.getAttribute('aria-label') ?? link.textContent)`,
      )) as string[]
      if (JSON.stringify(listed) !== JSON.stringify(names)) {
        throw new Error(`At 375px the Menu panel lists ${JSON.stringify(listed)}`)
      }
      await sidebarSupportItem()
      const hideText = await on(
        await control('button', 'Hide Support Stillstats'),
        'function () { return this.textContent }',
      )
      if (hideText !== 'Hide') {
        throw new Error(`At 375px the support item's button reads "${hideText}"`)
      }
      const picker = (await on(
        await control('combobox', 'Channel'),
        `function () {
          const box = this.getBoundingClientRect()
          const width = document.documentElement.clientWidth
          return { inPanel: !!this.closest('.header-menu-panel'), left: box.left, right: box.right, width }
        }`,
      )) as { inPanel: boolean; left: number; right: number; width: number }
      if (!picker.inPanel || picker.left < 0 || picker.right > picker.width) {
        throw new Error(
          `At 375px the channel picker is not inside the Menu panel and the screen: ${JSON.stringify(picker)}`,
        )
      }
      const panel = (await evaluate(`(() => {
        const box = document.querySelector('.header-menu-panel').getBoundingClientRect()
        const header = document.querySelector('header').getBoundingClientRect()
        const width = document.documentElement.clientWidth
        return { top: box.top, left: box.left, right: box.right, headerBottom: header.bottom, width }
      })()`)) as { top: number; left: number; right: number; headerBottom: number; width: number }
      if (panel.top < panel.headerBottom - 0.5 || panel.left < 0 || panel.right > panel.width) {
        throw new Error(`At 375px the Menu panel is not under the header: ${JSON.stringify(panel)}`)
      }

      // The panel lies over the page, the date range select under it included: with the panel at
      // the controls bar's z-index, the select took this press (creator-analytics#891).
      const audienceLink = await control('link', 'Audience')
      const audience = (await on(audienceLink, boxOf)) as Box
      const [x, y] = [(audience.left + audience.right) / 2, centreOf(audience)]
      const onTop = await on(
        audienceLink,
        `function () { return this.contains(document.elementFromPoint(${x}, ${y})) }`,
      )
      if (onTop !== true) {
        throw new Error("At 375px something on the page sits over the Menu panel's Audience link")
      }
      await pressAt(x, y)
      await waitFor(
        `location.pathname === '/app/audience'`,
        'A press on Audience in the Menu panel did not open the Audience screen',
        30,
      )
      await ready()
      await control('heading', 'Audience')
      if ((await evaluate(menuExpanded)) !== 'false') {
        throw new Error('After a press on Audience the Menu panel is still open')
      }

      await on(menu, 'function () { this.focus() }')
      await pressKey('Enter', 13, { text: '\r' })
      await waitFor(`${menuExpanded} === 'true'`, 'Enter on "Menu" did not open its panel', 30)
      const current = await on(
        await control('link', 'Audience'),
        `function () { return this.getAttribute('aria-current') }`,
      )
      if (current !== 'page') {
        throw new Error(`On the Audience screen its Menu link carries aria-current ${current}`)
      }
      await pressKey('Tab', 9)
      const inPanel = await focusedRoleAndName()
      if (inPanel !== 'link Videos') {
        throw new Error(`Tab from "Menu" moved focus onto ${inPanel}, not the panel's first link`)
      }
      await pressKey('Escape', 27)
      await waitFor(
        `document.querySelector('.header-menu-panel')?.hidden === true`,
        'Escape did not close the Menu panel',
        30,
      )
      const focused = await focusedRoleAndName()
      if (focused !== 'button Menu') {
        throw new Error(`After Escape in the Menu panel, focus is on ${focused}`)
      }
    } finally {
      stub.listSecondChannel(false)
      await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
      await send('Page.navigate', { url: `${stub.origin}/app/` })
      await ready()
    }
  })

  /** The table on screen whose accessible name, its caption, starts with `start`. */
  async function tableNamed(start: string): Promise<string> {
    const { root } = (await send('DOM.getDocument', { depth: 0 })) as { root: { nodeId: number } }
    const { nodes } = (await send('Accessibility.queryAXTree', {
      nodeId: root.nodeId,
      role: 'table',
    })) as { nodes: { name?: { value?: string }; backendDOMNodeId?: number }[] }
    const backendNodeId = nodes.find(
      (node) => node.backendDOMNodeId && String(node.name?.value ?? '').startsWith(start),
    )?.backendDOMNodeId
    if (!backendNodeId) throw new Error(`No table named "${start}..." on screen`)
    const { object } = (await send('DOM.resolveNode', { backendNodeId })) as {
      object: { objectId: string }
    }
    return object.objectId
  }

  /** The colour the line token resolves to in the current mode, as Chrome writes a computed colour. */
  const lineColour = async () =>
    String(
      await evaluate(`(() => {
        const probe = document.createElement('span')
        probe.style.color = 'var(--line)'
        document.body.append(probe)
        const colour = getComputedStyle(probe).color
        probe.remove()
        return colour
      })()`),
    )

  /**
   * Each drawn cell of the table whose line before it is wrong: 1px, solid, in `line` for every
   * cell but the first column's, which has none. The first column is the cells at the table's
   * start, so a cell spanning heading rows or the second heading row's first cell is placed by
   * where Chrome draws it, not by its markup.
   */
  const wrongColumnLines = async (table: string, line: string) =>
    (await on(
      table,
      `function () {
        const start = this.getBoundingClientRect().left
        const wrong = []
        for (const row of this.rows) {
          for (const cell of row.cells) {
            if (cell.getClientRects().length === 0) continue
            const first = Math.abs(cell.getBoundingClientRect().left - start) < 1
            const style = getComputedStyle(cell)
            const drawn = [
              style.borderInlineStartWidth,
              style.borderInlineStartStyle,
              style.borderInlineStartColor,
            ]
            const right = first
              ? drawn[0] === '0px'
              : drawn[0] === '1px' && drawn[1] === 'solid' && drawn[2] === ${JSON.stringify(line)}
            if (!right) {
              wrong.push(
                (first ? 'first column ' : '') + '"' + cell.textContent.trim().slice(0, 30) + '" ' +
                  drawn.join(' '),
              )
            }
          }
        }
        return wrong
      }`,
    )) as string[]

  /**
   * Where the video list's fixed column fails to keep its line with the list scrolled sideways: in
   * the first heading row and the first body row, the fixed cell stays at the scroll box's start,
   * the second column's cell sits under it, and the fixed cell draws its 1px line in `line`.
   */
  const fixedColumnLineLost = async (table: string, line: string) =>
    (await on(
      table,
      `function () {
        const box = this.parentElement
        box.scrollLeft = 120
        if (box.scrollLeft === 0) return ['the list did not scroll sideways']
        const boxStart = box.getBoundingClientRect().left
        const lost = []
        for (const [name, row] of [['heading', this.tHead.rows[0]], ['body', this.tBodies[0].rows[0]]]) {
          const [fixed, next] = row.cells
          const at = fixed.getBoundingClientRect()
          if (Math.abs(at.left - boxStart) >= 1) lost.push(name + ' row: the fixed cell moved')
          if (!(next.getBoundingClientRect().left < at.right)) {
            lost.push(name + ' row: the second column is not under the fixed cell')
          }
          const shadow = getComputedStyle(fixed).boxShadow
          if (shadow !== ${JSON.stringify(`${line} 1px 0px 0px 0px`)}) {
            lost.push(name + ' row: the fixed cell draws ' + shadow)
          }
        }
        box.scrollLeft = 0
        return lost
      }`,
    )) as string[]

  // creator-analytics#645 and #684: on a video's page at 1280px and at 375px, the video player
  // loads with the screen, with no press: the fake player from 'self' (fake-youtube-iframe-api.js),
  // its frame on YouTube's privacy-enhanced host, which the page's frame-src must admit, and the
  // only request to YouTube is that frame's, which the YouTube session answers. Once the fake
  // reports ready the box holds the frame alone, which fills it, and sits above the audience
  // retention pair. The box has no role, so it is found from the frame, by its title, as its
  // nearest 16:9 ancestor. At 1280px a real mouse click on the audience retention plot then moves
  // the fake player to the start of the clicked point's slice, which the fake writes to its frame's
  // `data-time` (creator-analytics#646, #686); its frame stays unstarted after ready, so the player
  // boundary cues it at that time. The step's listener fails it on any content security policy
  // violation.
  /**
   * The page's frame named `title`, by DevTools object id, once the fake player has run in it and
   * reported ready, and the thumbnail has left its box.
   */
  const loadedFrame = async (title: string, what: string): Promise<string> => {
    const expression = `[...document.querySelectorAll('iframe')].find((each) => each.title === ${JSON.stringify(title)})`
    await waitFor(`Boolean(${expression}?.dataset.fakePlayer)`, what, 50)
    await waitFor(
      `!${expression}.closest('.video-player').querySelector('img')`,
      `${what}: the thumbnail stayed over the ready player`,
      50,
    )
    const { result: frame } = (await send('Runtime.evaluate', { expression })) as {
      result: { objectId: string }
    }
    return frame.objectId
  }
  /**
   * A real mouse click a third of the way across the audience retention plot, after the pointer
   * moves there, and the wait until the fake player's frame names the start of the slice of the
   * point the slider then shows, from the sample's own points and the video's duration. The time is
   * the app's own `playerSecondsAt`, whose rule `video-player.test.ts` holds: the walk shows only
   * that a real click in Chrome reaches the player with it.
   */
  const clickMovesPlayer = async (frameTitle: string): Promise<void> => {
    const points = (
      (await (
        await fetch(
          `${stub.origin}/api/channels/${sampleChannel.id}/videos/${encodeURIComponent(newestLongVideo.id)}`,
        )
      ).json()) as VideoDetailAnswer
    ).audienceRetention
    const [watching] = await retentionSliders()
    if (!watching) throw new Error('No audience retention plot beside the loaded player')
    await on(watching, `function () { this.scrollIntoView({ block: 'center' }) }`)
    await delay(100)
    const at = (await on(
      watching,
      `function () {
        const { left, top, width, height } = this.getBoundingClientRect()
        return { x: left + width / 3, y: top + height / 2 }
      }`,
    )) as { x: number; y: number }
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y })
    await pressAt(at.x, at.y)
    const shown = (await on(
      watching,
      `function () { return { now: this.getAttribute('aria-valuenow'), text: this.getAttribute('aria-valuetext') } }`,
    )) as { now: string | null; text: string | null }
    const picked = Number(shown.now) - 1
    if (shown.text === noPoint || points[picked] === undefined) {
      throw new Error(
        `The click on the audience retention plot showed no point: ${JSON.stringify(shown)}`,
      )
    }
    const expected = String(playerSecondsAt(points, picked, newestLongVideo.durationSeconds))
    const frameTime = `[...document.querySelectorAll('iframe')].find((each) => each.title === ${JSON.stringify(frameTitle)})?.dataset.time`
    await waitFor(
      `${frameTime} === ${JSON.stringify(expected)}`,
      `The click on the audience retention plot did not move the fake player to ${expected} seconds: it reads ${String(await evaluate(frameTime))}`,
      50,
    )
  }

  await walk(
    "state: video player beside the retention pair at 1280px and 2560px and above it at 375px, 1.5rem from it, loaded with the screen in its box, and a Short's 9:16 frame",
    async () => {
      type Rect = { left: number; top: number; right: number; bottom: number }
      type Box = Rect & { width: number; height: number }
      // The player's box: the nearest ancestor that is 16:9, or 9:16 for a Short.
      const boxOf = `function () {
      let box = this
      while (box && !['16 / 9', '9 / 16'].includes(getComputedStyle(box).aspectRatio)) {
        box = box.parentElement
      }
      if (!box) return null
      const { left, top, right, width, height, bottom } = box.getBoundingClientRect()
      return { left, top, right, width, height, bottom }
    }`
      const rectOf =
        'function () { const { left, top, right, bottom } = this.getBoundingClientRect(); return { left, top, right, bottom } }'
      const moved = (before: Box, after: Box) =>
        (['left', 'top', 'width', 'height'] as const).some(
          (side) => Math.abs(before[side] - after[side]) > 0.5,
        )
      const scrollToRetention = (objectId: string) =>
        on(objectId, `function () { this.closest('section').scrollIntoView({ block: 'start' }) }`)
      const windowSize = async () =>
        (await evaluate('({ width: innerWidth, height: innerHeight })')) as {
          width: number
          height: number
        }
      const inside = (rect: Rect, { width, height }: { width: number; height: number }) =>
        rect.left >= -0.5 &&
        rect.top >= -0.5 &&
        rect.right <= width + 0.5 &&
        rect.bottom <= height + 0.5
      const frameTitle = `Video player: ${newestLongVideo.title}`
      try {
        for (const [width, metrics] of [
          ['1280px', viewport],
          ['2560px', wideAt(2560)],
          ['375px', narrow],
        ] as const) {
          youtubeRequests.length = 0
          await send('Emulation.setDeviceMetricsOverride', { ...metrics, mobile: false })
          await send('Page.navigate', {
            url: `${stub.origin}/app/videos/${encodeURIComponent(newestLongVideo.id)}`,
          })
          await ready()
          const frame = await loadedFrame(
            frameTitle,
            `At ${width} the screen loaded no player named "${frameTitle}"`,
          )
          await scrollToRetention(frame)
          await delay(100)
          const before = (await on(frame, boxOf)) as Box | null
          if (!before) throw new Error(`At ${width} the player has no 16:9 box`)
          const sliders = await retentionSliders()
          const [firstRetention] = sliders
          if (!firstRetention || sliders.length !== 2) {
            throw new Error(`At ${width} the audience retention pair does not show`)
          }
          const slider = (await on(firstRetention, rectOf)) as Rect
          // The pair's own box, since the plot's labels stand inside it, left of the plot.
          const pair = (await on(
            firstRetention,
            `function () { return (${rectOf}).call(this.closest('.retention-pair')) }`,
          )) as Rect
          if (metrics !== narrow) {
            const view = await windowSize()
            const plots = await Promise.all(
              sliders.map(async (each) => (await on(each, rectOf)) as Rect),
            )
            if (
              before.right > slider.left + 0.5 ||
              before.bottom < slider.top ||
              before.top > slider.bottom
            ) {
              throw new Error(
                `At ${width} the player's box is not beside the retention pair: ${JSON.stringify({ box: before, slider })}`,
              )
            }
            if (before.width > 640.5 || Math.abs(pair.left - before.right - 24) > 0.5) {
              throw new Error(
                `At ${width} the player's box is not at most 40rem wide and 1.5rem from the retention pair: ${JSON.stringify({ box: before, pair })}`,
              )
            }
            const outside = [before, ...plots].filter((rect) => !inside(rect, view))
            if (outside.length > 0) {
              throw new Error(
                `At ${width} the player and both retention plots are not inside the ${view.width} by ${view.height} window together: ${JSON.stringify(outside)}`,
              )
            }
          } else {
            if (Math.abs(pair.top - before.bottom - 24) > 0.5) {
              throw new Error(
                `At ${width} the player's box ends at ${before.bottom}px, not 1.5rem above the retention pair's first plot at ${pair.top}px`,
              )
            }
            if (before.width < 200 || before.height < 200) {
              throw new Error(
                `At ${width} the player's box is ${before.width} by ${before.height}, under Google's 200 by 200 minimum`,
              )
            }
          }
          const shown = (await on(
            frame,
            `function () {
            const box = this.closest('.video-player')
            const { left, top, width, height, right, bottom } = this.getBoundingClientRect()
            return {
              origin: new URL(this.src).origin,
              rect: { left, top, width, height, right, bottom },
              others: [...box.querySelectorAll('*')].filter(
                (each) => each !== this && !each.contains(this),
              ).length,
            }
          }`,
          )) as { origin: string; rect: Box; others: number }
          if (shown.origin !== 'https://www.youtube-nocookie.com') {
            throw new Error(`At ${width} the player frames from ${shown.origin}`)
          }
          if (moved(before, shown.rect) || shown.others > 0) {
            throw new Error(
              `At ${width} the ready player's frame does not fill its box alone: ${JSON.stringify({ box: before, ...shown })}`,
            )
          }
          const unexpected = youtubeRequests.filter(
            (url) => !url.startsWith('https://www.youtube-nocookie.com/embed/'),
          )
          if (unexpected.length > 0 || youtubeRequests.length === 0) {
            throw new Error(
              `At ${width} the screen asked YouTube for ${JSON.stringify(youtubeRequests)}, not the player's frame alone`,
            )
          }
          if (width === '1280px') await clickMovesPlayer(frameTitle)
        }

        // A Short's box: 9:16, its height at most 60% of the window's and its sides at least
        // Google's 200 pixels, centred in the first column of the section's body.
        for (const [width, metrics] of [
          ['1280px', viewport],
          ['375px', narrow],
        ] as const) {
          await send('Emulation.setDeviceMetricsOverride', { ...metrics, mobile: false })
          await send('Page.navigate', {
            url: `${stub.origin}/app/videos/${encodeURIComponent(newestShort.id)}`,
          })
          await ready()
          const shortTitle = `Video player: ${newestShort.title}`
          const frame = await loadedFrame(
            shortTitle,
            `At ${width} the Short's screen loaded no player named "${shortTitle}"`,
          )
          await scrollToRetention(frame)
          await delay(100)
          const short = (await on(
            frame,
            `function () {
            const box = this.closest('.video-player')
            const column = box.parentElement
            const { left, right, width, height } = box.getBoundingClientRect()
            const [track] = getComputedStyle(column).gridTemplateColumns.split(' ')
            const columnLeft = column.getBoundingClientRect().left
            return {
              aspectRatio: getComputedStyle(box).aspectRatio,
              width,
              height,
              leftGap: left - columnLeft,
              rightGap: columnLeft + parseFloat(track) - right,
            }
          }`,
          )) as {
            aspectRatio: string
            width: number
            height: number
            leftGap: number
            rightGap: number
          }
          const view = await windowSize()
          if (
            short.aspectRatio !== '9 / 16' ||
            short.height > 0.6 * view.height + 0.5 ||
            short.height < 200 ||
            short.width < 200 ||
            Math.abs(short.leftGap - short.rightGap) > 1
          ) {
            throw new Error(
              `At ${width} the Short's player box is not 9:16, at most 60% of the window's ${view.height}px height and at least 200 by 200, centred in its column: ${JSON.stringify(short)}`,
            )
          }
        }
      } finally {
        await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
      }
    },
  )

  // creator-analytics#649: a video that does not allow embedding shows, in the player box, the
  // not-embeddable text and the Watch on YouTube link, at 1280px and at 375px, and asks YouTube
  // for nothing. The walk's listener fails it on any content security policy
  // violation.
  await walk('state: a video that does not allow embedding, at 1280px and at 375px', async () => {
    try {
      for (const [width, metrics] of [
        ['1280px', viewport],
        ['375px', narrow],
      ] as const) {
        youtubeRequests.length = 0
        await send('Emulation.setDeviceMetricsOverride', { ...metrics, mobile: false })
        await send('Page.navigate', {
          url: `${stub.origin}/app/videos/${encodeURIComponent(notEmbeddableVideo.id)}`,
        })
        await ready()
        await waitFor(
          `Boolean(document.querySelector('.video-player'))`,
          `At ${width} the video that does not allow embedding shows no player box`,
          50,
        )
        const shown = (await evaluate(`(() => {
          const box = document.querySelector('.video-player')
          box.scrollIntoView({ block: 'center' })
          const line = box.querySelector('.video-player-cannot-play p')
          const link = box.querySelector('.video-player-cannot-play a')
          const inBox = (element) => {
            if (!element) return false
            const rect = element.getBoundingClientRect()
            const outer = box.getBoundingClientRect()
            return rect.width > 0 && rect.height > 0 && rect.left >= outer.left - 0.5 &&
              rect.right <= outer.right + 0.5 && rect.right <= innerWidth + 0.5
          }
          return {
            line: line?.textContent ?? null,
            link: link?.textContent ?? null,
            href: link?.getAttribute('href') ?? null,
            inBox: inBox(line) && inBox(link),
            frame: Boolean(box.querySelector('iframe')),
          }
        })()`)) as {
          line: string | null
          link: string | null
          href: string | null
          inBox: boolean
          frame: boolean
        }
        const watchUrl = `https://www.youtube.com/watch?${new URLSearchParams({ v: notEmbeddableVideo.id })}`
        if (
          shown.line !== 'This video does not allow embedding.' ||
          shown.link !== 'Watch on YouTube' ||
          shown.href !== watchUrl ||
          !shown.inBox ||
          shown.frame
        ) {
          throw new Error(
            `At ${width} the player box of a video that does not allow embedding does not show the text and the link alone, inside it: ${JSON.stringify(shown)}`,
          )
        }
        if (youtubeRequests.length > 0) {
          throw new Error(
            `At ${width} a video that does not allow embedding asked YouTube for ${youtubeRequests.join(', ')}`,
          )
        }
      }
    } finally {
      await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
    }
  })

  // creator-analytics#684: only a video's screen loads YouTube's player (ADR 0020), so the channel
  // screen, with its video list, and the audience screen ask YouTube for nothing. The sample
  // channel has no video whose screen holds no player, so a video with no duration, no curve or
  // awaiting processing is video-player.test.ts's alone.
  await walk('state: the channel and audience screens ask YouTube for nothing', async () => {
    for (const path of ['/app/', '/app/audience']) {
      youtubeRequests.length = 0
      await send('Page.navigate', { url: `${stub.origin}${path}` })
      await ready()
      if (youtubeRequests.length > 0) {
        throw new Error(`${path} asked YouTube for ${youtubeRequests.join(', ')}`)
      }
    }
  })

  // creator-analytics#647: at 1280px, with the fake player loaded and playing at half the video's
  // duration, the playhead shows on both audience retention plots, its centre at half the plot's
  // width. The fake reports playing through its frame's handle (fake-youtube-iframe-api.js), as
  // YouTube's player does once its own play button is pressed. Each plot is found by its role and
  // name; the line inside it, which is aria-hidden and has neither, by its class.
  await walk('state: the playhead on both retention plots while the player plays', async () => {
    const frameTitle = `Video player: ${newestLongVideo.title}`
    const frameExpression = `[...document.querySelectorAll('iframe')].find((each) => each.title === ${JSON.stringify(frameTitle)})`
    await send('Page.navigate', {
      url: `${stub.origin}/app/videos/${encodeURIComponent(newestLongVideo.id)}`,
    })
    await ready()
    await loadedFrame(frameTitle, `The screen loaded no fake player named "${frameTitle}"`)
    const sliders = await retentionSliders()
    const placed = async () => {
      const places: ({ centre: number; half: number } | null)[] = []
      for (const slider of sliders) {
        places.push(
          (await on(
            slider,
            `function () {
            const line = this.querySelector('.retention-playhead')
            if (!line) return null
            const plot = this.getBoundingClientRect()
            const { left, width } = line.getBoundingClientRect()
            return { centre: left + width / 2, half: plot.left + plot.width / 2 }
          }`,
          )) as { centre: number; half: number } | null,
        )
      }
      return places
    }
    const before = await placed()
    if (before.some((place) => place !== null)) {
      throw new Error(`A playhead shows before the player plays: ${JSON.stringify(before)}`)
    }
    await evaluate(
      `${frameExpression}.stillstatsFakePlayer.play(${newestLongVideo.durationSeconds / 2})`,
    )
    let places = await placed()
    for (
      let attempt = 0;
      attempt < 30 &&
      !places.every((place) => place !== null && Math.abs(place.centre - place.half) <= 1);
      attempt++
    ) {
      await delay(100)
      places = await placed()
    }
    if (
      sliders.length !== 2 ||
      !places.every((place) => place !== null && Math.abs(place.centre - place.half) <= 1)
    ) {
      throw new Error(
        `Playing at half the video, the playheads are not at half of both plots: ${JSON.stringify(places)}`,
      )
    }
  })

  // creator-analytics#351: a line between every pair of columns of the numbers table and the video
  // list, in the line token, in light and dark mode, with the revenue sources hidden and shown, and
  // the video list's fixed column keeping its line as the list scrolls sideways on a 375px screen.
  // web.test.ts reads the rules as written; here Chrome resolves which rule wins each cell.
  await walk('state: a line between every column in light and dark mode', async () => {
    try {
      await send('Page.navigate', { url: `${stub.origin}/app/` })
      await ready()
      const colours: string[] = []
      for (const mode of ['light', 'dark']) {
        await send('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-color-scheme', value: mode }],
        })
        const line = await lineColour()
        colours.push(line)
        const tables = {
          'numbers table': await tableNamed('Numbers by day'),
          'video list': await tableNamed('Videos, page '),
        }
        const headingRows = async (rows: number) => {
          for (const table of Object.values(tables)) {
            if ((await on(table, 'function () { return this.tHead.rows.length }')) !== rows) {
              return false
            }
          }
          return true
        }
        for (const sources of ['hidden', 'shown']) {
          if (sources === 'shown') {
            await click(await control('button', 'Show revenue sources'))
            for (let attempt = 0; attempt < 30 && !(await headingRows(2)); attempt++) {
              await delay(100)
            }
            if (!(await headingRows(2))) {
              throw new Error(`In ${mode} mode the revenue sources did not show in both tables`)
            }
          }
          for (const [name, table] of Object.entries(tables)) {
            const wrong = await wrongColumnLines(table, line)
            if (wrong.length > 0) {
              const more = wrong.length > 5 ? ` and ${wrong.length - 5} more cells` : ''
              throw new Error(
                `In ${mode} mode, sources ${sources}, the ${name}'s column lines are wrong at: ${wrong.slice(0, 5).join('; ')}${more}`,
              )
            }
          }
        }
        await click(await control('button', 'Hide revenue sources'))
        for (let attempt = 0; attempt < 30 && !(await headingRows(1)); attempt++) {
          await delay(100)
        }
        if (!(await headingRows(1))) {
          throw new Error(`In ${mode} mode the revenue sources did not hide`)
        }

        await send('Emulation.setDeviceMetricsOverride', { ...narrow, mobile: false })
        await ready()
        const lost = await fixedColumnLineLost(await tableNamed('Videos, page '), line)
        await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
        if (lost.length > 0) {
          throw new Error(`In ${mode} mode at 375px, scrolled sideways: ${lost.join('; ')}`)
        }
      }
      if (colours[0] === colours[1]) {
        throw new Error(`The line token is ${colours[0]} in both modes, so dark mode did not take`)
      }
    } finally {
      await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
      await send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: 'light' }],
      })
    }
  })

  // creator-analytics#691: the theme. With the browser's copy of Dark on a light system, and of
  // Light on a dark system, the server holding the same theme, the first frame already draws the
  // chosen tokens: a probe installed before the page's scripts reads the root's `--bg` and
  // `data-theme` in the first animation frame, while the Fetch domain holds the preferences read, so
  // only the head script can have set them. On Settings, a real press on Dark, then on Light, in the
  // "Theme" group changes the root's `--bg` at once, and a reload keeps it; "Reset preferences",
  // its confirmation accepted, leaves no attribute, and the tokens follow the system again; and
  // with the copy Dark on a light system, the site's `/` still draws its light `--bg`. It ends with
  // no copy, the system light, and the stub's preferences as they were before it, so later steps
  // draw System.
  let pausedPreferencesRead: string | null = null
  let acceptDialogs = false
  listen(({ method, params }) => {
    if (method === 'Fetch.requestPaused') pausedPreferencesRead = String(params.requestId)
    if (method === 'Page.javascriptDialogOpening' && acceptDialogs) {
      void send('Page.handleJavaScriptDialog', { accept: true })
    }
  })
  // The theme steps' helpers (creator-analytics#691, #692): the root's attribute and `--bg`, the
  // system's emulated scheme, the stub's preferences, and the browser's copy.
  const rootTheme = `(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
  }))()`
  type RootTheme = { theme: string | null; bg: string }
  const systemIs = (mode: 'light' | 'dark') =>
    send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: mode }],
    })
  const preferencesCall = (method: string, body?: object) =>
    evaluate(`fetch('/api/me/preferences', {
      method: ${JSON.stringify(method)},
      headers: { 'content-type': 'application/json' },
      ${body ? `body: ${JSON.stringify(JSON.stringify(body))},` : ''}
    }).then((response) => response.json())`)
  const setCopy = (theme: string | null) =>
    evaluate(
      theme === null
        ? `localStorage.removeItem(${JSON.stringify(themeCopyKey)})`
        : `localStorage.setItem(${JSON.stringify(themeCopyKey)}, ${JSON.stringify(theme)})`,
    )
  /** The root's theme once it reads `bg`, within about three seconds, or the last one read. */
  async function rootThemeOnceDrawn(bg: string): Promise<RootTheme> {
    let drawn = (await evaluate(rootTheme)) as RootTheme
    for (let attempt = 0; attempt < 30 && drawn.bg !== bg; attempt++) {
      await delay(100)
      drawn = (await evaluate(rootTheme)) as RootTheme
    }
    return drawn
  }
  /**
   * The `--bg` each system draws with no attribute, the light and the dark one, read with no copy
   * and System saved, on the page as reloaded. It leaves the system dark.
   */
  async function bgOfEachSystem(): Promise<{ light: string; dark: string }> {
    await setCopy(null)
    await preferencesCall('PUT', { theme: 'system' })
    await send('Page.reload')
    await ready()
    await systemIs('light')
    const lightBg = ((await evaluate(rootTheme)) as RootTheme).bg
    await systemIs('dark')
    const darkBg = ((await evaluate(rootTheme)) as RootTheme).bg
    if (lightBg === '' || lightBg === darkBg) {
      throw new Error(`The light system draws --bg ${lightBg} and the dark ${darkBg}`)
    }
    return { light: lightBg, dark: darkBg }
  }
  /** Puts the system light, the copy empty and the stub's preferences back to `saved`. */
  async function themeBackTo(saved: object): Promise<void> {
    await systemIs('light')
    await send('Page.navigate', { url: `${stub.origin}/app/` })
    await ready()
    await setCopy(null)
    await preferencesCall('DELETE')
    if (Object.keys(saved).length > 0) await preferencesCall('PUT', saved)
    await send('Page.reload')
    await ready()
  }

  await walk('state: the theme from the first frame, in Settings and after a reset', async () => {
    await send('Page.navigate', { url: `${stub.origin}/app/` })
    await ready()
    const saved = (await preferencesCall('GET')) as object
    let probe: string | null = null
    try {
      const bgOf = await bgOfEachSystem()

      ;({ identifier: probe } = (await send('Page.addScriptToEvaluateOnNewDocument', {
        source: `requestAnimationFrame(() => { window.__firstFrame = ${rootTheme} })`,
      })) as { identifier: string })
      for (const [system, chosen] of [
        ['light', 'dark'],
        ['dark', 'light'],
      ] as const) {
        await setCopy(chosen)
        await preferencesCall('PUT', { theme: chosen })
        await systemIs(system)
        pausedPreferencesRead = null
        await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/me/preferences' }] })
        try {
          await send('Page.navigate', { url: `${stub.origin}/app/` })
          for (let attempt = 0; attempt < 100 && pausedPreferencesRead === null; attempt++) {
            await delay(50)
          }
          if (pausedPreferencesRead === null) throw new Error('The preferences read was never held')
          await waitFor('window.__firstFrame !== undefined', 'No first frame drew', 50)
          const first = (await evaluate('window.__firstFrame')) as RootTheme
          if (first.theme !== chosen || first.bg !== bgOf[chosen]) {
            throw new Error(
              `With ${chosen} stored on a ${system} system the first frame drew ${JSON.stringify(first)}, not data-theme ${chosen} and --bg ${bgOf[chosen]}`,
            )
          }
          await send('Fetch.continueRequest', { requestId: pausedPreferencesRead })
        } finally {
          await send('Fetch.disable')
        }
        await ready()
        const landed = (await evaluate(rootTheme)) as RootTheme
        if (landed.theme !== chosen || landed.bg !== bgOf[chosen]) {
          throw new Error(
            `With ${chosen} saved, the read landing left ${JSON.stringify(landed)} on a ${system} system`,
          )
        }
      }
      await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: probe })
      probe = null

      // A real press in Settings applies at once, and a reload keeps it.
      await systemIs('light')
      await send('Page.navigate', { url: `${stub.origin}/app/settings` })
      await ready()
      for (const chosen of ['dark', 'light'] as const) {
        const name = chosen === 'dark' ? 'Dark' : 'Light'
        const { x, y } = await centreOf(await control('radio', name))
        await pressAt(x, y)
        const pressed = await rootThemeOnceDrawn(bgOf[chosen])
        if (pressed.theme !== chosen || pressed.bg !== bgOf[chosen]) {
          throw new Error(`A press on ${name} drew ${JSON.stringify(pressed)}`)
        }
        await send('Page.reload')
        await ready()
        const reloaded = (await evaluate(rootTheme)) as RootTheme
        if (reloaded.theme !== chosen || reloaded.bg !== bgOf[chosen]) {
          throw new Error(`After a press on ${name} a reload drew ${JSON.stringify(reloaded)}`)
        }
      }

      // A reset goes back to the system: no attribute, and the tokens follow it.
      await systemIs('dark')
      acceptDialogs = true
      try {
        // Below the fold at 800px tall, so it is scrolled to before the press.
        const reset = await control('button', 'Reset preferences')
        await on(reset, `function () { this.scrollIntoView({ block: 'center' }) }`)
        const { x, y } = await centreOf(reset)
        await pressAt(x, y)
        await waitFor(
          `document.documentElement.getAttribute('data-theme') === null`,
          'The theme attribute stayed after "Reset preferences"',
          30,
        )
      } finally {
        acceptDialogs = false
      }
      for (const system of ['dark', 'light'] as const) {
        await systemIs(system)
        const after = (await evaluate(rootTheme)) as RootTheme
        if (after.theme !== null || after.bg !== bgOf[system]) {
          throw new Error(`After a reset, a ${system} system draws ${JSON.stringify(after)}`)
        }
      }
      if ((await evaluate(`localStorage.getItem(${JSON.stringify(themeCopyKey)})`)) !== null) {
        throw new Error('The copy stayed after "Reset preferences"')
      }

      // The site follows the system, whatever the app's copy says.
      await setCopy('dark')
      await systemIs('light')
      await send('Page.navigate', { url: `${stub.origin}/` })
      await waitFor(pageReadyCheck('/'), 'The site did not finish loading')
      const site = (await evaluate(rootTheme)) as RootTheme
      if (site.theme !== null || site.bg !== bgOf.light) {
        throw new Error(
          `With the copy Dark on a light system the site draws ${JSON.stringify(site)}`,
        )
      }
    } finally {
      if (probe !== null)
        await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: probe })
      await themeBackTo(saved)
    }
  })

  // creator-analytics#692: the theme from the account menu, at 1280px with the sidebar's column,
  // with no copy, System saved and a light system. With focus on Settings, from a real ArrowDown
  // on the focused account row, real ArrowDowns reach the menu's items in order on Chrome's
  // accessibility tree, the Theme items among them, past the group labels and the separators. A
  // real press on the account row opens the menu, and a real press on its "Dark" radio item sets
  // `data-theme="dark"` and the dark `--bg` at once, and checks it; a real press on the menu's
  // Settings item then opens Settings, whose "Theme" radio "Dark" is checked. It ends as the step
  // above does, so later steps draw System.
  await walk('state: the theme from the account menu', async () => {
    await send('Page.navigate', { url: `${stub.origin}/app/` })
    await ready()
    const saved = (await preferencesCall('GET')) as object
    try {
      const bgOf = await bgOfEachSystem()
      await systemIs('light')
      const before = (await evaluate(rootTheme)) as RootTheme
      if (before.theme !== null || before.bg !== bgOf.light) {
        throw new Error(
          `With System saved on a light system the page drew ${JSON.stringify(before)}`,
        )
      }

      // The arrow keys, in order. Base UI's own focus moves; this reads where Chrome says it is.
      // The menu's words, restated from apps/web/src/settings.ts (`themeOptions`) and
      // account-menu.ts: both pull in the app's modules, which the walk's tsconfig does not
      // compile. The version is the stub's.
      const { version } = (await evaluate(
        `fetch('/api/client-settings').then((response) => response.json())`,
      )) as { version: string | null }
      const expected = [
        `menuitem ${settingsName}`,
        ...['Light', 'Dark', 'System'].map((label) => `menuitemradio ${label}`),
        'menuitem Mid-Roll Manager (opens in a new tab)',
        'menuitem Sign out',
        ...(version ? [`menuitem Version ${version}`] : []),
      ]
      await on(await control('button', accountRow), 'function () { this.focus() }')
      await pressKey('ArrowDown', 40)
      await waitFor(
        `document.activeElement?.getAttribute('role') === 'menuitem' && document.activeElement.textContent.trim() === ${JSON.stringify(settingsName)}`,
        'ArrowDown on the account row did not open the account menu with focus on Settings',
        30,
      )
      const reached = [await focusedRoleAndName()]
      for (let step = 1; step < expected.length; step++) {
        await pressKey('ArrowDown', 40)
        // Base UI moves focus after the key; the item reached is the first that differs.
        let next = await focusedRoleAndName()
        for (let attempt = 0; attempt < 30 && next === reached.at(-1); attempt++) {
          await delay(100)
          next = await focusedRoleAndName()
        }
        reached.push(next)
      }
      if (reached.join(' | ') !== expected.join(' | ')) {
        throw new Error(
          `The arrow keys reached ${reached.join(', ')}, not ${expected.join(', ')}, in the account menu`,
        )
      }
      await pressKey('Escape', 27)
      await waitFor(menuClosed, 'The account menu did not close on Escape', 30)

      // A real press on Dark changes the page at once, behind the menu, which stays open.
      const row = await control('button', accountRow)
      const rowAt = await centreOf(row)
      await pressAt(rowAt.x, rowAt.y)
      await waitFor(menuOpen, 'The account menu did not open on a press of the account row', 30)
      await control('group', 'Theme')
      const dark = await control('menuitemradio', 'Dark')
      const darkAt = await centreOf(dark)
      await pressAt(darkAt.x, darkAt.y)
      const pressed = await rootThemeOnceDrawn(bgOf.dark)
      if (pressed.theme !== 'dark' || pressed.bg !== bgOf.dark) {
        throw new Error(`A press on Dark in the account menu drew ${JSON.stringify(pressed)}`)
      }
      await waitFor(
        `document.querySelector('[role="menu"] [role="menuitemradio"][aria-checked="true"]')?.textContent.trim() === 'Dark'`,
        'Dark is not the checked item in the account menu after a press on it',
        30,
      )

      // Settings, opened from the menu, shows the same choice.
      const settings = await control('menuitem', settingsName)
      const settingsAt = await centreOf(settings)
      await pressAt(settingsAt.x, settingsAt.y)
      await waitFor(
        `location.pathname === '/app/settings'`,
        "The menu's Settings item did not open Settings",
        30,
      )
      await ready()
      const checked = await on(
        await control('radio', 'Dark'),
        `function () { return this.getAttribute('aria-checked') }`,
      )
      if (checked !== 'true') {
        throw new Error('Settings does not check Dark after Dark was chosen in the account menu')
      }
    } finally {
      await themeBackTo(saved)
    }
  })

  // creator-analytics#281: the channel summary's upload marker row in each mode, light and dark, at
  // 1280px and 375px. On the list's route it finds the row by its role and name on Chrome's tree,
  // right under the charts' axis (the element before it), with the sample uploads of the last 28
  // days as its links, the row and each marker inside the window once scrolled to its middle. A
  // real Right arrow from the first marker moves focus to the second, which shows its tooltip with
  // its text alternative. A violation in a mode carries that mode's step name. Every sample upload
  // publishes on a day of its own, so the second marker is a single upload with its tooltip; should
  // a sample day ever yield a tile there, which has no tooltip of its own (its card opens on hover,
  // creator-analytics#763), the tooltip check fails. app.test.ts opens a tile's card. Every plot
  // draws its upload day lines inside its box; at 1280px, where the charts stack, the aria-hidden
  // row under the first plot sits between it and the second chart's heading with as many markers,
  // and the second chart keeps its 6rem plot; at 375px there is one row. Every marker in both rows
  // frames itself in the axis's ink (creator-analytics#763).
  const uploadMarkersIn = `[...this.querySelectorAll('a, button')]`
  try {
    for (const mode of walkModes) {
      const suffix = `${mode.colorScheme === 'dark' ? ' in dark mode' : ''}${mode.phone ? ' at a phone width' : ''}`
      await walk(`state: upload markers${suffix}`, async () => {
        await send('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-color-scheme', value: mode.colorScheme }],
        })
        await send('Emulation.setDeviceMetricsOverride', {
          ...(mode.phone ? narrow : viewport),
          mobile: false,
        })
        await send('Page.navigate', { url: `${stub.origin}/app/` })
        await ready()
        const where = `${mode.colorScheme} mode at ${mode.phone ? '375px' : '1280px'}`
        const row = await controlOnceShown('group', 'Uploads')
        const placed = (await on(
          row,
          `function () {
            this.scrollIntoView({ block: 'center' })
            const axis = this.previousElementSibling
            const box = this.getBoundingClientRect()
            const inside = (each) =>
              each.width > 0 && each.height > 0 && each.left >= 0 && each.right <= innerWidth &&
              each.top >= 0 && each.bottom <= innerHeight
            const markers = ${uploadMarkersIn}
            return {
              count: markers.length,
              underAxis: !!axis && axis.getAttribute('aria-hidden') === 'true' &&
                box.top >= axis.getBoundingClientRect().bottom - 0.5,
              rowInside: inside(box),
              outside: markers
                .filter((marker) => !inside(marker.getBoundingClientRect()))
                .map((marker) => marker.getAttribute('aria-label')),
            }
          }`,
        )) as { count: number; underAxis: boolean; rowInside: boolean; outside: string[] }
        if (placed.count < 2) {
          throw new Error(`In ${where} the upload marker row holds ${placed.count} markers`)
        }
        if (!placed.underAxis) {
          throw new Error(`In ${where} the upload marker row is not right under the charts' axis`)
        }
        if (!placed.rowInside) {
          throw new Error(`In ${where} the upload marker row is not inside the window`)
        }
        if (placed.outside.length > 0) {
          throw new Error(
            `In ${where} these upload markers sit outside the window: ${placed.outside.join(', ')}`,
          )
        }
        // creator-analytics#763: every marker's frame in the axis's ink, in both rows; each plot's
        // upload day lines, inside its box; and with the charts stacked the pointer-only row under
        // the first plot, holding as many markers as the row under the axis, above the second chart,
        // which keeps its stacked 6rem plot.
        const drawn = (await on(
          row,
          `function () {
            const section = this.closest('section.metric-charts')
            const plots = [...section.querySelectorAll('.chart-plot')]
            const charts = [...section.querySelectorAll('.metric-chart')]
            const rows = [...section.querySelectorAll('.upload-markers')]
            const mirror = section.querySelector('.upload-markers-mirror')
            const within = (inner, outer) =>
              inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5 &&
              inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5
            const firstChart = charts[0]?.querySelector('.chart')?.getBoundingClientRect()
            const secondChart = charts[1]
            const secondHeading = secondChart?.querySelector('h2')?.getBoundingClientRect()
            const mirrorBox = mirror?.getBoundingClientRect()
            const ink = getComputedStyle(section.querySelector('.metric-charts-axis')).color
            return {
              offInk: [...section.querySelectorAll('.upload-marker')]
                .filter((marker) => !marker.matches(':hover') && getComputedStyle(marker).borderTopColor !== ink)
                .map((marker) => marker.getAttribute('aria-label')),
              plots: plots.length,
              unlined: plots
                .map((plot, index) => ({ plot, index }))
                .filter(({ plot }) => plot.querySelectorAll('.upload-day-line').length === 0)
                .map(({ index }) => index),
              linesOutside: plots.flatMap((plot, index) =>
                [...plot.querySelectorAll('.upload-day-line')]
                  .filter((line) => !within(line.getBoundingClientRect(), plot.getBoundingClientRect()))
                  .map(() => index),
              ),
              rows: rows.length,
              mirror: mirror
                ? {
                    hidden: mirror.getAttribute('aria-hidden') === 'true',
                    markers: mirror.querySelectorAll('.upload-marker').length,
                    shown: mirrorBox.width > 0 && mirrorBox.height > 0,
                    underFirstPlot: !!firstChart && mirrorBox.top >= firstChart.bottom - 0.5,
                    aboveSecondHeading: !!secondHeading && mirrorBox.bottom <= secondHeading.top + 0.5,
                  }
                : null,
              secondPlotHeight: secondChart?.querySelector('.cursor-plot')?.getBoundingClientRect().height ?? null,
              rem: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
            }
          }`,
        )) as {
          offInk: (string | null)[]
          plots: number
          unlined: number[]
          linesOutside: number[]
          rows: number
          mirror: {
            hidden: boolean
            markers: number
            shown: boolean
            underFirstPlot: boolean
            aboveSecondHeading: boolean
          } | null
          secondPlotHeight: number | null
          rem: number
        }
        if (drawn.offInk.length > 0) {
          throw new Error(
            `In ${where} these upload markers draw their frame in another ink than the axis's: ${drawn.offInk.join(', ')}`,
          )
        }
        if (drawn.plots === 0 || drawn.unlined.length > 0) {
          throw new Error(
            `In ${where} these of the ${drawn.plots} plots draw no upload day line: ${drawn.unlined.join(', ')}`,
          )
        }
        if (drawn.linesOutside.length > 0) {
          throw new Error(
            `In ${where} an upload day line sits outside its plot, on plots ${drawn.linesOutside.join(', ')}`,
          )
        }
        if (mode.phone) {
          if (drawn.rows !== 1 || drawn.mirror !== null) {
            throw new Error(`In ${where} the charts show ${drawn.rows} upload marker rows, not one`)
          }
        } else {
          const { mirror } = drawn
          if (drawn.rows !== 2 || !mirror) {
            throw new Error(`In ${where} the charts show ${drawn.rows} upload marker rows, not two`)
          }
          if (!mirror.hidden || !mirror.shown) {
            throw new Error(`In ${where} the row under the first plot is not shown and aria-hidden`)
          }
          if (mirror.markers !== placed.count) {
            throw new Error(
              `In ${where} the row under the first plot holds ${mirror.markers} markers, the row under the axis ${placed.count}`,
            )
          }
          if (!mirror.underFirstPlot || !mirror.aboveSecondHeading) {
            throw new Error(
              `In ${where} the row under the first plot is not between it and the second chart's heading`,
            )
          }
          if (
            drawn.secondPlotHeight === null ||
            Math.abs(drawn.secondPlotHeight - 6 * drawn.rem) > 0.5
          ) {
            throw new Error(
              `In ${where} the second stacked plot is ${drawn.secondPlotHeight}px tall, not 6rem`,
            )
          }
        }
        await on(row, `function () { ${uploadMarkersIn}[0].focus() }`)
        await pressKey('ArrowRight', 39)
        const second = (await on(
          row,
          `function () {
            const second = ${uploadMarkersIn}[1]
            return second === document.activeElement ? second.getAttribute('aria-label') : null
          }`,
        )) as string | null
        if (second === null) {
          throw new Error(`In ${where} the Right arrow did not move focus to the second marker`)
        }
        if (!(await tooltipShown(second))) {
          throw new Error(
            `In ${where} the focused upload marker shows no tooltip reading "${second}"`,
          )
        }
      })
    }
  } finally {
    await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'light' }],
    })
  }

  // creator-analytics#283: the upload marker row in the lifetime window at 375px, light and dark.
  // The sample channel's lifetime runs over two years with an upload every few days, so at a phone
  // width markers on nearby days would overlap and join into tiles. Every sample upload publishes
  // on a day of its own, so any tile here is a join of nearby days. Once the row is scrolled to its
  // middle, at least one marker is a tile named "N uploads", no two markers' boxes overlap, and
  // every marker sits inside the window. app.test.ts opens a joined tile's card.
  try {
    for (const mode of walkModes.filter(({ phone }) => phone)) {
      const suffix = `${mode.colorScheme === 'dark' ? ' in dark mode' : ''} at a phone width`
      await walk(`state: joined upload markers in a long window${suffix}`, async () => {
        await send('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-color-scheme', value: mode.colorScheme }],
        })
        await send('Emulation.setDeviceMetricsOverride', { ...narrow, mobile: false })
        await send('Page.navigate', { url: `${stub.origin}/app/?window=lifetime` })
        await ready()
        const where = `${mode.colorScheme} mode at 375px in the lifetime window`
        const row = await controlOnceShown('group', 'Uploads')
        const placed = (await on(
          row,
          `function () {
            this.scrollIntoView({ block: 'center' })
            const inside = (each) =>
              each.width > 0 && each.height > 0 && each.left >= 0 && each.right <= innerWidth &&
              each.top >= 0 && each.bottom <= innerHeight
            const markers = ${uploadMarkersIn}
            const boxes = markers
              .map((marker) => ({ name: marker.getAttribute('aria-label'), box: marker.getBoundingClientRect() }))
              .toSorted((a, b) => a.box.left - b.box.left)
            return {
              count: markers.length,
              tiles: boxes
                .map(({ name }) => name)
                .filter((name) => /^\\d+ uploads$/.test(name ?? '')),
              overlapping: boxes
                .slice(1)
                .map((next, index) => ({ before: boxes[index], next }))
                .filter(({ before, next }) => next.box.left < before.box.right - 0.5)
                .map(({ before, next }) => \`\${before.name} and \${next.name}\`),
              outside: boxes.filter(({ box }) => !inside(box)).map(({ name }) => name),
            }
          }`,
        )) as { count: number; tiles: string[]; overlapping: string[]; outside: string[] }
        if (placed.tiles.length === 0) {
          throw new Error(
            `In ${where} none of the ${placed.count} upload markers is a tile of joined markers`,
          )
        }
        if (placed.overlapping.length > 0) {
          throw new Error(
            `In ${where} these upload markers overlap: ${placed.overlapping.join('; ')}`,
          )
        }
        if (placed.outside.length > 0) {
          throw new Error(
            `In ${where} these upload markers sit outside the window: ${placed.outside.join(', ')}`,
          )
        }
      })
    }
  } finally {
    await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'light' }],
    })
  }

  // creator-analytics#382: every route the first pass visited, again in each other mode, so a style
  // injected only under `prefers-color-scheme: dark` or a narrow `max-width` query raises its
  // violation under a step that names the mode. Last, so no step before it leaves its light 1280px.
  try {
    for (const mode of walkModes.slice(1)) {
      await send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: mode.colorScheme }],
      })
      await send('Emulation.setDeviceMetricsOverride', {
        ...(mode.phone ? narrow : viewport),
        mobile: false,
      })
      for (const route of routesWalked) {
        await walk(routeStep(route.path, mode), () => goTo(route))
      }
    }
  } finally {
    await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'light' }],
    })
  }

  browser.close()
} finally {
  chrome.kill()
  result.unanswered = [...stub.unanswered]
  await stub.close()
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}

const { passed, text } = reportOf(result)
console.log(text)
if (!passed) process.exitCode = 1
