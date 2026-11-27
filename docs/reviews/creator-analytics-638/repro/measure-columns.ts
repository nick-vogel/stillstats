// Pre-PR review 1, finding 1 (creator-analytics#638): how many of the Audience screen's column
// boxes its cards fill, and the blank space at the container's right, at 1280, 1920, 2560, 3000
// and 3840px. It imports the browser walk's stub and readiness check by relative path, so it runs
// only from apps/site/test/screenshot/ of a scratch checkout, never of the live worktree:
//
//   git worktree add --detach <scratch> HEAD && cd <scratch> && pnpm install --frozen-lockfile
//   cp docs/reviews/creator-analytics-638/repro/measure-columns.ts apps/site/test/screenshot/
//   env -u TEST_DATABASE_ADMIN_URL LABEL=head OUT_DIR=<dir> node apps/site/test/screenshot/measure-columns.ts
//
// SKIP_BUILD=1 reuses apps/web/dist and apps/site/dist, WIDTHS=1280,2560 picks the widths, and
// PLACEHOLDER=0 skips the placeholder held at 1280px. It prints each width's column count, used
// columns and emptyRight, and writes <dir>/<LABEL>.json and a screenshot per width. At 9cbd27c it
// printed used 6 of 7 columns and emptyRight 324.58 at 2560px and wider.
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { screenLanded } from './screen-ready.ts'
import { startStubApi } from './stub-api.ts'

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url))
const webContentRoot = fileURLToPath(new URL('../../../web/test/fixtures/', import.meta.url))
const chromePath =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const label = process.env.LABEL ?? 'run'
const outDir = process.env.OUT_DIR ?? join(tmpdir(), 'measure-689')
const widths = (process.env.WIDTHS ?? '1280,1920,2560,3000,3840').split(',').map(Number)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repositoryRoot, env, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`)),
    )
  })
}
function buildEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    RELEASE_CONTENT_ROOT: webContentRoot,
    VITE_YOUTUBE_IFRAME_API_URL: '/sample/youtube-iframe-api.js',
  }
  delete env.VITE_OPENPANEL_API_URL
  delete env.VITE_GLITCHTIP_DSN
  return env
}
async function browserSocketUrl(profile: string): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const [port, path] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')
      if (port && path) return `ws://127.0.0.1:${port}${path}`
    } catch {}
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
const readyCheck = `(async () => {
  await document.fonts.ready
  if (!(${screenLanded})(document) || document.fonts.status !== 'loaded') return false
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  return true
})()`

// Measures the container and each child, in page coordinates.
const measure = (selector: string) => `(() => {
  const grid = document.querySelector(${JSON.stringify(selector)})
  if (!grid) return null
  const s = getComputedStyle(grid)
  const r = grid.getBoundingClientRect()
  const px = (v) => parseFloat(v) || 0
  const contentLeft = r.left + px(s.borderLeftWidth) + px(s.paddingLeft)
  const contentWidth = grid.clientWidth - px(s.paddingLeft) - px(s.paddingRight)
  const contentRight = contentLeft + contentWidth
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
  const gap = s.columnGap === 'normal' ? rem : px(s.columnGap)
  const items = [...grid.children].map((el) => {
    const b = el.getBoundingClientRect()
    const heading = el.querySelector('h1,h2,h3,h4,[data-slot="card-title"]')
    return {
      name: heading ? heading.textContent.trim() : '(place)',
      left: +b.left.toFixed(2), top: +(b.top + scrollY).toFixed(2), width: +b.width.toFixed(2),
      height: +b.height.toFixed(2), right: +b.right.toFixed(2), bottom: +(b.bottom + scrollY).toFixed(2),
      marginBlockEnd: getComputedStyle(el).marginBlockEnd,
    }
  })
  const lefts = [...new Set(items.map((i) => Math.round(i.left)))].sort((a, b) => a - b)
  const maxRight = Math.max(...items.map((i) => i.right))
  const maxBottom = Math.max(...items.map((i) => i.bottom))
  const gridBottom = r.bottom + scrollY - px(s.paddingBottom) - px(s.borderBottomWidth)
  const cardWidth = items[0]?.width ?? 0
  return {
    viewport: innerWidth,
    sidebarOpen: document.querySelector('[data-slot="sidebar"]')?.getAttribute('data-state') ?? null,
    display: s.display, columns: s.columns, columnCount: s.columnCount, columnWidth: s.columnWidth,
    columnGap: s.columnGap, gridTemplateColumns: s.gridTemplateColumns, rem,
    containerLeft: +contentLeft.toFixed(2), containerContentWidth: +contentWidth.toFixed(2),
    containerRight: +contentRight.toFixed(2), containerHeight: +r.height.toFixed(2),
    formulaColumns: Math.max(1, Math.floor((contentWidth + gap) / (18 * rem + gap))),
    columnsFromCardWidth: cardWidth ? +((contentWidth + gap) / (cardWidth + gap)).toFixed(3) : null,
    distinctLefts: lefts, usedColumns: lefts.length,
    emptyRight: +(contentRight - maxRight).toFixed(2),
    lastBottomToContainerBottom: +(gridBottom - maxBottom).toFixed(2),
    items,
  }
})()`

const results: Record<string, unknown> = {}
if (process.env.SKIP_BUILD !== '1') {
  await run('pnpm', ['--filter', '@creator-analytics/web', 'build'], buildEnvironment())
  await run('pnpm', ['--filter', '@creator-analytics/site', 'build'], buildEnvironment())
}
await mkdir(outDir, { recursive: true })
const stub = await startStubApi(0)
const profile = await mkdtemp(join(tmpdir(), 'measure-689-'))
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
  })) as {
    sessionId: string
  }
  const send = (method: string, params?: object) => browser.send(method, params, sessionId)
  const evaluate = async (expression: string): Promise<unknown> => {
    const { result: value, exceptionDetails } = (await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })) as { result: { value: unknown }; exceptionDetails?: { text: string } }
    if (exceptionDetails) throw new Error(exceptionDetails.text)
    return value.value
  }
  const waitFor = async (expression: string, what: string, tries = 150) => {
    for (let attempt = 0; attempt < tries; attempt++) {
      if ((await evaluate(expression)) === true) return
      await delay(100)
    }
    throw new Error(what)
  }
  const shot = async (name: string, selector: string) => {
    const r = (await evaluate(
      `(() => { const b = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, width: b.width, height: b.height } })()`,
    )) as { x: number; y: number; width: number; height: number }
    const { data } = (await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: {
        x: 0,
        y: Math.max(0, r.y - 8),
        width: r.x + r.width + 40,
        height: r.height + 16,
        scale: 0.4,
      },
    })) as { data: string }
    await writeFile(join(outDir, `${label}-${name}.png`), Buffer.from(data, 'base64'))
  }
  await send('Page.enable')
  await send('Runtime.enable')
  await send('DOM.enable')
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'light' }],
  })

  for (const width of widths) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await send('Page.navigate', { url: `${stub.origin}/app/audience` })
    await waitFor(readyCheck, `At ${width}px the screen did not land`)
    await waitFor(
      `!document.querySelector('.audience-grid[aria-busy="true"]') && !!document.querySelector('.audience-grid')`,
      `At ${width}px no landed grid`,
    )
    await delay(300)
    results[`cards@${width}`] = await evaluate(measure('.audience-grid'))
    await shot(`cards-${width}`, '.audience-grid')
  }

  if (process.env.PLACEHOLDER !== '0') {
    const held: string[] = []
    browser.listen(({ method, params }) => {
      if (method === 'Fetch.requestPaused') held.push(String(params.requestId))
    })
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await send('Page.navigate', { url: 'about:blank' })
    await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/channels/*/audience*' }] })
    try {
      await send('Page.navigate', { url: `${stub.origin}/app/audience` })
      await waitFor(
        `document.querySelector('.audience-grid[aria-busy="true"]')?.children.length === 8`,
        'No placeholder with eight places',
      )
      for (let attempt = 0; attempt < 100 && held.length === 0; attempt++) await delay(50)
      if (held.length === 0) throw new Error('The Audience read was never held')
      await evaluate(
        `document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))`,
      )
      results['placeholder@1280'] = await evaluate(measure('.audience-grid[aria-busy="true"]'))
      await shot('placeholder-1280', '.audience-grid[aria-busy="true"]')
      for (const id of held.splice(0)) await send('Fetch.continueRequest', { requestId: id })
    } finally {
      await send('Fetch.disable')
    }
  }
  browser.close()
} finally {
  chrome.kill()
  await stub.close()
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
await writeFile(join(outDir, `${label}.json`), JSON.stringify(results, null, 2))
for (const [key, value] of Object.entries(results)) {
  const m = value as (Record<string, unknown> & { items: Record<string, unknown>[] }) | null
  if (!m) {
    console.log(key, 'NOT FOUND')
    continue
  }
  console.log(
    `\n== ${label} ${key}: display=${m.display} columns=${m.columns} column-count=${m.columnCount} gap=${m.columnGap} gtc=${m.gridTemplateColumns}`,
  )
  console.log(
    `   content width=${m.containerContentWidth} left=${m.containerLeft} right=${m.containerRight} height=${m.containerHeight} sidebar=${m.sidebarOpen}`,
  )
  console.log(
    `   formula columns=${m.formulaColumns} columnsFromCardWidth=${m.columnsFromCardWidth} used(distinct lefts)=${m.usedColumns} ${JSON.stringify(m.distinctLefts)}`,
  )
  console.log(
    `   emptyRight=${m.emptyRight} lastBottomToContainerBottom=${m.lastBottomToContainerBottom}`,
  )
  for (const i of m.items)
    console.log(
      `   ${String(i.name).padEnd(50)} left=${i.left} top=${i.top} w=${i.width} h=${i.height} mbe=${i.marginBlockEnd}`,
    )
}
