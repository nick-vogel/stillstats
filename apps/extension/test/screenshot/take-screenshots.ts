// Retakes the store screenshots in apps/extension/store-assets (creator-analytics#100):
//
//   pnpm --filter @creator-analytics/extension screenshots
//
// or, to retake only some of the images and leave the others as they are, name them
// (creator-analytics#487):
//
//   pnpm --filter @creator-analytics/extension screenshots 4-popup.png
//
// It builds the extension as it ships, installs the build in headless Google Chrome (at CHROME_PATH
// or in /Applications), and opens the saved Studio pages in test/fixtures/studio at their Studio
// addresses, drawn with Studio's own stylesheet (studio.css) and with the creator's data swapped
// for the homepage screenshot's sample channel (studio-swaps.ts). The extension's real content
// script, background script and popup then run on them unchanged. The only thing made up is the
// network: Chrome hands every request to this script, which answers the saved pages, the sample's
// images, and the background's reads of stillstats.com (stub-product-api.ts), lets YouTube's own
// fonts and icons through, and fails the rest. Each screenshot waits for the extension's figures,
// then checks that nothing the saved page held, no video id, title or channel name, is left where
// the screenshot shows it, and that every image it shows is the sample's or YouTube's own.
//
// Each Studio page is drawn in a window of 1280 by 960 CSS pixels and shot zoomed in on its
// surface, the popup is shot at twice its size on the page background of stillstats.com, and the
// first-run page, which opens on install, is shot whole in a window of 1792 by 1120: every image is
// 1280 by 800 pixels, the size both stores ask for. With FULL_WINDOW set, each Studio page is shot
// whole instead, to see where its regions lie. The images carry no "Sample data" label (Nick,
// 2026-10-16). It also draws the Chrome Web Store's small promo tile, 440 by 280: the S of
// apps/site/public/favicon.svg on the visual system's accent colour, with no text.
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { productOrigin, type VideoListAnswer } from '@creator-analytics/api-types'
import { sampleChannel } from '../../../site/test/screenshot/sample-channel.ts'
import { popupText } from '../../src/popup.ts'
import { comparisonOf, daysProcessedOf, windowCovering } from '../../src/surfaces/comparison.ts'
import { pageViewOf } from '../../src/surfaces/states.ts'
import { surfaceText } from '../../src/surfaces/text.ts'
import { chosenImagesOf } from './chosen-images.ts'
import {
  type Answer,
  type Chrome,
  interceptRequests,
  isYouTubeStatic,
  launchChrome,
  openTab,
  type Tab,
} from './chrome.ts'
import { avatarSvg, thumbnailSvgOf } from './sample-images.ts'
import {
  analyticsVideo,
  contentListDataOf,
  dashboardDataOf,
  lastProcessedDayAtCapture,
  type PageData,
  sampleAvatarUrl,
  videoAnalyticsDataOf,
} from './sample-studio.ts'
import { publishedVideos, stubProductApi } from './stub-product-api.ts'
import { readFixture, readStudioStyles, withStyles } from './studio-fixtures.ts'
import { swapScriptOf } from './studio-swaps.ts'

const extensionRoot = fileURLToPath(new URL('../../', import.meta.url))
const builtExtension = fileURLToPath(new URL('../../.output/chrome-mv3/', import.meta.url))
const outputDirectory = fileURLToPath(new URL('../../store-assets/', import.meta.url))
const markSource = fileURLToPath(new URL('../../../site/public/favicon.svg', import.meta.url))
const brandTokens = fileURLToPath(
  new URL('../../../../packages/visual-system/src/styles.css', import.meta.url),
)
const studio = 'https://studio.youtube.com'
/** The page the popup's screenshot and the promo tile are drawn on, which this script answers. */
const framePage = 'https://store-screenshots.invalid/frame'
/** The size of every screenshot. */
const viewport = { width: 1280, height: 800 }
// The border the popup is drawn with in its frame, in image pixels on each side.
const popupBorder = 2
/** The size of the Chrome Web Store's small promo tile. */
const promoTile = { width: 440, height: 280 }
/** The window Studio's pages are drawn in, tall enough for the latest video card's rows. */
const studioWindow = { width: 1280, height: 960 }

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: extensionRoot, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`)),
    )
  })
}

/** A region of the page, in CSS pixels. */
interface Region {
  x: number
  y: number
  width: number
  height: number
}

interface StudioShot {
  file: string
  url: string
  data: PageData
  /** True once the extension's surface is up with its figures. */
  ready: string
  /** An expression for the region to shoot, 16 by 10, which the image fills. */
  region: string
}

/** The text of every surface host the extension added to the page. */
const hostTextsOf = (surface: string) =>
  `[...document.querySelectorAll('[data-stillstats-surface="${surface}"]')].map((host) => host.shadowRoot?.textContent ?? '')`

/** What a surface shows in place of a figure, which no screenshot should show. */
const lineStates = [
  surfaceText.signIn,
  surfaceText.channelNotInStillstats,
  surfaceText.reconnect,
  surfaceText.allowAccess,
  surfaceText.tryAgain,
  surfaceText.notProcessed,
]

/** The stub's answer to a video list query of the sample channel's. */
function answerOf(stub: ReturnType<typeof stubProductApi>, query: string): VideoListAnswer {
  const url = `${productOrigin}/api/channels/${sampleChannel.id}/videos?${query}`
  return stub.answer({ method: 'GET', url }).body as VideoListAnswer
}

/**
 * The words the extension shows for the sample, by its own functions and approved copy: the day the
 * figures run through, and the latest video card's comparison row.
 */
function expectedTextOf(stub: ReturnType<typeof stubProductApi>, cardVideoId: string) {
  const lifetime = answerOf(stub, `ids=${cardVideoId}&window=lifetime`)
  const read = { state: 'read', channelId: sampleChannel.id, answer: lifetime } as const
  const view = pageViewOf({ read, origin: productOrigin, locale: 'en-US' })
  const card = lifetime.videos[0]
  if (view.kind !== 'through' || !view.day || !card) throw new Error('The stub answers no figures')
  const window = windowCovering(daysProcessedOf(card.publishedAt, lastProcessedDayAtCapture))
  const format = answerOf(
    stub,
    `window=${window}&format=video&pageSize=10&visibility=public&sort=-publishedAt`,
  )
  const comparison = comparisonOf(card, { ...read, answer: format })
  if (!comparison) throw new Error('The stub answers no comparison row')
  return {
    through: surfaceText.through(view.day),
    dataFrom: surfaceText.dataFrom(view.day),
    place: comparison.place,
  }
}

async function studioShots(
  stub: ReturnType<typeof stubProductApi>,
): Promise<{ shots: StudioShot[]; pages: Map<string, string> }> {
  const css = await readStudioStyles()
  const dashboard = await readFixture('dashboard')
  const contentList = await readFixture('content-list')
  const analytics = await readFixture('video-analytics')
  const savedChannelId = /\/channel\/(UC[\w-]{22})/.exec(dashboard.url)?.[1]
  const savedVideoId = /\/video\/([\w-]{11})\//.exec(analytics.url)?.[1]
  if (!savedChannelId || !savedVideoId) throw new Error('The fixtures carry no channel or video id')
  const channelId = sampleChannel.youtubeChannelId
  const rowCount = contentList.html.match(/<ytcp-video-row\b/g)?.length ?? 0
  const dashboardData = dashboardDataOf(savedChannelId, publishedVideos)
  const expected = expectedTextOf(stub, dashboardData.card.id)
  const shows = (text: string) => JSON.stringify(text)
  const shots: StudioShot[] = [
    {
      file: '1-latest-video-card.png',
      url: `${studio}/channel/${channelId}`,
      data: dashboardData,
      ready: `(() => {
        const text = ${hostTextsOf('card')}.join(' ')
        return text.includes(${shows(expected.through)}) && text.includes(${shows(expected.place)})
      })()`,
      // The card from its title down to Studio's average view duration, which the extension's rows
      // sit among.
      region: `(() => {
        const card = document.querySelector('ytcd-entity-snapshot-item').getBoundingClientRect()
        const title = document.querySelector('ytcd-entity-snapshot-item #title').getBoundingClientRect()
        const width = card.width + 40
        return { x: card.left - 20, y: title.top - 24, width, height: width / 1.6 }
      })()`,
    },
    {
      file: '2-content-list.png',
      url: contentList.url.replace(savedChannelId, channelId),
      data: contentListDataOf(savedChannelId, publishedVideos, rowCount),
      ready: `(() => {
        const rows = document.querySelectorAll('ytcp-video-row').length
        const hosts = ${hostTextsOf('content_list')}
        return hosts.length >= rows + 2 && hosts.join(' ').includes(${shows(expected.dataFrom)})
      })()`,
      // From Studio's page title to the Views column, which the extension's figures stand in.
      region: `(() => {
        const title = document.querySelector('ytcp-content-section#video-list > ytcp-entity-page-header').getBoundingClientRect()
        const views = document.querySelector('[role="columnheader"].tablecell-views').getBoundingClientRect()
        const x = title.left - 16
        const width = views.right + 24 - x
        return { x, y: title.top - 8, width, height: width / 1.6 }
      })()`,
    },
    {
      file: '3-video-analytics.png',
      url: `${studio}/video/${analyticsVideo.id}/analytics/tab-overview/period-quarter`,
      data: videoAnalyticsDataOf(savedChannelId, savedVideoId, analyticsVideo),
      ready: `(() => {
        const text = ${hostTextsOf('analytics')}.join(' ')
        return text.includes(${shows(expected.dataFrom)}) && document.querySelector('#EXTERNAL_VIEWS-tab [data-stillstats-surface="analytics"]') !== null
      })()`,
      // Studio's headline over the period, the extension's line, and Studio's key metric card with
      // its tiles and chart.
      region: `(() => {
        const card = document.querySelector('yta-key-metric-card').getBoundingClientRect()
        const x = card.left - 20
        const width = card.width + 40
        const bottom = card.bottom + 16
        const height = width / 1.6
        return { x, y: bottom - height, width, height }
      })()`,
    },
  ]
  const pages = new Map<string, string>()
  const fixtureOf = { dashboard, 'content-list': contentList, 'video-analytics': analytics }
  for (const shot of shots) {
    const { html } = fixtureOf[shot.data.page]
    const body = html.lastIndexOf('</body>')
    pages.set(
      shot.url,
      withStyles(`${html.slice(0, body)}${swapScriptOf(shot.data)}${html.slice(body)}`, css),
    )
  }
  return { shots, pages }
}

/**
 * What the screenshot of `region` shows that the saved page held: its video ids, titles and
 * channel name, in any text drawn there, the extension's included; and every image drawn there
 * that is not the sample's or YouTube's own, or did not load.
 */
const leftoversIn = (region: Region) => `(() => {
  const region = ${JSON.stringify(region)}
  const saved = window.__savedStudioData
  const shows = (rect) => rect.width > 0 && rect.height > 0 && rect.right > region.x && rect.left < region.x + region.width && rect.bottom > region.y && rect.top < region.y + region.height
  const texts = []
  function walk(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
    for (let node = walker.currentNode; node; node = walker.nextNode()) {
      if (node.shadowRoot) walk(node.shadowRoot)
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue
      const parent = node.parentElement
      if (!parent || !parent.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      if ([...range.getClientRects()].some(shows)) texts.push(node.textContent.trim())
    }
  }
  walk(document.body)
  const shown = texts.join('\\n')
  const found = [...saved.titles, ...saved.ids].filter((each) => shown.includes(each))
  const images = [...document.querySelectorAll('img')]
    .filter((image) => image.checkVisibility() && shows(image.getBoundingClientRect()))
    .filter((image) => !(image.complete && image.naturalWidth > 0) || !/^https:\\/\\/(i\\.ytimg\\.com\\/vi\\/fk\\d{9}\\/|yt3\\.ggpht\\.com\\/sample-|(www|ssl|fonts)\\.gstatic\\.com\\/)/.test(image.src))
    .map((image) => image.src)
  return { found, images, shown }
})()`

/**
 * Fonts loaded, every image in the window loaded, every animation that ends ended (Studio fades
 * its page in), and two frames drawn since.
 */
const settled = `(async () => {
  await document.fonts.ready
  const images = [...document.images]
    .filter((image) => image.checkVisibility() && image.getBoundingClientRect().top < innerHeight)
    .every((image) => image.complete)
  const animating = document
    .getAnimations()
    .some((animation) => animation.playState === 'running' && Number.isFinite(animation.effect?.getComputedTiming().endTime))
  if (!images || animating || document.fonts.status !== 'loaded') return false
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  return true
})()`

/**
 * The clip that `region` is shot through, to fill 1280 by 800. Chrome takes a clip in whole CSS
 * pixels, so the region is widened about its middle to a multiple of 8 pixels, where 16 by 10 is
 * whole pixels.
 */
function clipOf(region: Region): Region & { scale: number } {
  const width = Math.ceil(region.width / 8) * 8
  const height = (width * viewport.height) / viewport.width
  return {
    x: Math.round(region.x - (width - region.width) / 2),
    y: Math.round(region.y - (height - region.height) / 2),
    width,
    height,
    scale: viewport.width / width,
  }
}

async function screenshotOf(tab: Tab, clip: Region & { scale: number }): Promise<Buffer> {
  const { data } = (await tab.send('Page.captureScreenshot', {
    format: 'png',
    clip,
    captureBeyondViewport: false,
  })) as { data: string }
  return Buffer.from(data, 'base64')
}

async function shootStudio(chrome: Chrome, shot: StudioShot): Promise<Buffer> {
  console.log(`Shooting ${shot.file}`)
  const tab = await openTab(chrome, shot.url, { ...studioWindow, deviceScaleFactor: 1 })
  await tab.waitFor(shot.ready, `the extension on ${shot.file}`)
  const states = await tab.evaluate<string>(
    `[...document.querySelectorAll('[data-stillstats-surface]')].map((host) => host.shadowRoot?.textContent ?? '').join(' ')`,
  )
  const state = lineStates.find((line) => states.includes(line))
  if (state) throw new Error(`${shot.file} shows "${state}"`)
  await tab.waitFor(settled, `${shot.file} to settle`)
  const clip = process.env.FULL_WINDOW
    ? { x: 0, y: 0, ...studioWindow, scale: 1 }
    : clipOf(await tab.evaluate<Region>(shot.region))
  const leftovers = await tab.evaluate<{ found: string[]; images: string[]; shown: string }>(
    leftoversIn(clip),
  )
  if (process.env.SHOWN_TEXT) console.log(`--- ${shot.file}\n${leftovers.shown}`)
  if (leftovers.found.length > 0 || leftovers.images.length > 0) {
    throw new Error(
      `${shot.file} still shows the saved page's ${[...leftovers.found, ...leftovers.images].join(', ')}`,
    )
  }
  return screenshotOf(tab, clip)
}

/**
 * The popup at its own size, at twice its size. Chrome sizes a toolbar popup to its page's content,
 * up to 800 by 600: the width the page takes without wrapping a line, and no less than the page's
 * own minimum, and the height of the page at that width.
 */
async function shootPopup(
  chrome: Chrome,
  extensionId: string,
): Promise<{ image: Buffer; width: number }> {
  const tab = await openTab(chrome, `chrome-extension://${extensionId}/popup.html`, {
    width: 800,
    height: 600,
    deviceScaleFactor: 2,
  })
  await tab.waitFor(
    `document.body.innerText.includes(${JSON.stringify(sampleChannel.title)})`,
    'the popup',
  )
  await tab.waitFor(
    `document.body.innerText.includes(${JSON.stringify(popupText.youtubeToggle)})`,
    'the YouTube access toggle in the popup',
  )
  await tab.waitFor(settled, 'the popup to settle')
  // Measured on a copy of the page's root, so the page itself is left as it is.
  const width = await tab.evaluate<number>(`(() => {
    const copy = document.body.cloneNode(true)
    copy.style.width = 'max-content'
    copy.style.position = 'absolute'
    document.documentElement.append(copy)
    const width = Math.ceil(copy.getBoundingClientRect().width)
    copy.remove()
    return Math.min(800, width)
  })()`)
  await tab.send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 600,
    deviceScaleFactor: 2,
    mobile: false,
  })
  // The page's body is at least the window's height (the visual system's `min-height: 100dvh`),
  // which a popup's window takes from its content, so the content's own height is the popup's.
  const height = await tab.evaluate<number>(
    'Math.min(600, Math.ceil(document.querySelector("main").getBoundingClientRect().bottom))',
  )
  // Drawn at twice its size with its border, the popup has to fit the frame, or the frame cuts it.
  const framed = { width: width * 2 + popupBorder * 2, height: height * 2 + popupBorder * 2 }
  if (framed.width > viewport.width || framed.height > viewport.height)
    throw new Error(
      `The popup no longer fits its frame: at twice its size it is ${framed.width} by ${framed.height} of ${viewport.width} by ${viewport.height}`,
    )
  await tab.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2,
    mobile: false,
  })
  await tab.waitFor(settled, 'the popup to settle')
  const { data } = (await tab.send('Page.captureScreenshot', { format: 'png' })) as { data: string }
  return { image: Buffer.from(data, 'base64'), width }
}

/**
 * The first-run page, which opens in a tab on install, whole in a window of 1792 by 1120, which its
 * button fits in, scaled to 1280 by 800.
 */
async function shootFirstRun(chrome: Chrome, extensionId: string): Promise<Buffer> {
  const window = { width: 1792, height: 1120 }
  const tab = await openTab(chrome, `chrome-extension://${extensionId}/first-run.html`, {
    ...window,
    deviceScaleFactor: 1,
  })
  await tab.waitFor(`document.body.innerText.includes('Got it')`, 'the first-run page')
  await tab.waitFor(settled, 'the first-run page to settle')
  const bottom = await tab.evaluate<number>(
    'document.querySelector("main").getBoundingClientRect().bottom',
  )
  if (bottom > window.height)
    throw new Error(
      `The first-run page no longer fits its window: it ends at ${bottom} of ${window.height}`,
    )
  return screenshotOf(tab, clipOf({ x: 0, y: 0, ...window }))
}

/**
 * A page of 1280 by 800 that draws `image`, the popup `width` CSS pixels wide shot at twice its
 * size, at its full size in the
 * middle of stillstats.com's light page background, with a toolbar popup's border and shadow.
 */
function framedPopupPage(image: Buffer, width: number): string {
  return `<!doctype html><html><head><style>
html, body { margin: 0; width: ${viewport.width}px; height: ${viewport.height}px; }
body {
  display: grid; place-items: center;
  background: radial-gradient(70% 38% at 50% 0%, oklch(0.84 0.06 292 / 0.5), transparent 75%), linear-gradient(oklch(0.96 0.02 292) 25%, oklch(1 0 0));
}
img { width: ${width * 2}px; height: auto; border-radius: 16px; border: ${popupBorder}px solid oklch(0.9 0.022 292); box-shadow: 0 8px 40px oklch(0.27 0.03 288 / 0.18); }
</style></head><body><img alt="" src="data:image/png;base64,${image.toString('base64')}"></body></html>`
}

/**
 * The Chrome Web Store's small promo tile, 440 by 280: the S of the site's favicon, the extension's
 * own mark, in the visual system's light `--on-accent`, on its `--accent`, and no text, as the
 * store's guidance asks. Both are read from their sources, so the tile follows them.
 */
async function promoTilePage(): Promise<string> {
  const favicon = await readFile(markSource, 'utf8')
  const viewBox = /viewBox="([^"]+)"/.exec(favicon)?.[1]
  const path = /<path\b[^>]*\/>/.exec(favicon)?.[0]
  const tokens = await readFile(brandTokens, 'utf8')
  const token = (name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(tokens)?.[1]
  const [accent, onAccent] = [token('accent'), token('on-accent')]
  if (!viewBox || !path || !accent || !onAccent) throw new Error('No mark or brand colour to draw')
  return `<!doctype html><html><head><style>
html, body { margin: 0; width: ${promoTile.width}px; height: ${promoTile.height}px; }
body { display: grid; place-items: center; background: ${accent}; }
svg { height: 160px; fill: ${onAccent}; }
</style></head><body><svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true">${path}</svg></body></html>`
}

async function shootPage(
  chrome: Chrome,
  html: string,
  setPage: (html: string) => void,
  size: { width: number; height: number } = viewport,
) {
  setPage(html)
  const tab = await openTab(chrome, framePage, { ...size, deviceScaleFactor: 1 })
  await tab.waitFor(settled, 'the frame to settle')
  const { data } = (await tab.send('Page.captureScreenshot', { format: 'png' })) as { data: string }
  return Buffer.from(data, 'base64')
}

/**
 * Closes the first-run page, which the extension opens on install: it would hold the foreground,
 * and a tab behind it draws no frames.
 */
async function closeFirstRun(chrome: Chrome, extensionId: string): Promise<void> {
  const firstRun = `chrome-extension://${extensionId}/first-run.html`
  for (let waited = 0; waited < 10_000; waited += 100) {
    const { targetInfos } = (await chrome.send('Target.getTargets')) as {
      targetInfos: { targetId: string; url: string }[]
    }
    const page = targetInfos.find(({ url }) => url === firstRun)
    if (page) return void (await chrome.send('Target.closeTarget', { targetId: page.targetId }))
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('The extension opened no first-run page on install')
}

await run('pnpm', ['run', 'build'])
// The capture's own reads of the stub, for the words to wait for, are kept out of its record.
const { shots, pages } = await studioShots(stubProductApi())
const stub = stubProductApi()
const failed: string[] = []
let frame = ''
const chrome = await launchChrome()
try {
  await interceptRequests(chrome, ({ url, method, postData }): Answer => {
    const page = pages.get(url)
    if (page) return { status: 200, type: 'text/html; charset=utf-8', body: page }
    if (url.startsWith('https://stillstats.com/')) {
      const { status, body } = stub.answer({
        method,
        url,
        ...(postData === undefined ? {} : { postData }),
      })
      return { status, type: 'application/json', body: body === null ? '' : JSON.stringify(body) }
    }
    const thumbnail = /^https:\/\/i\.ytimg\.com\/vi\/(fk\d{9})\/(mqdefault|sddefault)\.jpg$/.exec(
      url,
    )
    if (thumbnail?.[1] && (thumbnail[2] === 'mqdefault' || thumbnail[2] === 'sddefault')) {
      return {
        status: 200,
        type: 'image/svg+xml',
        body: thumbnailSvgOf(thumbnail[1], thumbnail[2]),
      }
    }
    if (url === sampleAvatarUrl) return { status: 200, type: 'image/svg+xml', body: avatarSvg }
    if (url === framePage) return { status: 200, type: 'text/html; charset=utf-8', body: frame }
    if (isYouTubeStatic(url)) return 'network'
    failed.push(url)
    return 'fail'
  })
  const { id: extensionId } = (await chrome.send('Extensions.loadUnpacked', {
    path: builtExtension,
  })) as { id: string }
  await closeFirstRun(chrome, extensionId)
  await mkdir(outputDirectory, { recursive: true })
  const images = new Map<string, Buffer>()
  for (const shot of shots) images.set(shot.file, await shootStudio(chrome, shot))
  const popup = await shootPopup(chrome, extensionId)
  images.set(
    '4-popup.png',
    await shootPage(chrome, framedPopupPage(popup.image, popup.width), (html) => (frame = html)),
  )
  images.set('5-first-run.png', await shootFirstRun(chrome, extensionId))
  images.set(
    'small-promo-tile.png',
    await shootPage(chrome, await promoTilePage(), (html) => (frame = html), promoTile),
  )
  if (stub.unanswered.length > 0) {
    throw new Error(`The stub had no answer for:\n${stub.unanswered.join('\n')}`)
  }
  for (const file of chosenImagesOf(process.argv.slice(2), [...images.keys()])) {
    const image = images.get(file)
    if (!image) throw new Error(`No image was shot for ${file}`)
    await writeFile(`${outputDirectory}${file}`, image)
    console.log(`Wrote ${outputDirectory}${file}`)
  }
  console.log(
    `${failed.length} requests failed on purpose, for parts of the saved pages no screenshot shows`,
  )
  console.log(`The extension sent: ${[...new Set(stub.events)].join(', ')}`)
} finally {
  await chrome.close()
}
