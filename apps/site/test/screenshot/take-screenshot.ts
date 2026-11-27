// Retakes the homepage screenshot, apps/site/public/app-screenshot.webp (creator-analytics#39):
//
//   pnpm --filter @creator-analytics/site screenshot
//
// It builds the web app with no OpenPanel or GlitchTip host, serves it from the stub API with the
// sample channel, opens /app in headless Chrome and saves the screen once nothing is loading. It
// needs Google Chrome, at CHROME_PATH or in /Applications, and adds no dependency: it speaks the
// Chrome DevTools Protocol over Node's own WebSocket.
//
// The viewport is 1280 by 1232 CSS pixels at a device scale of 1.5, so the image is 1920 by 1848.
// It is tall enough for the channel screen to stack its charts (stackedChartsQuery, 60rem by 45rem)
// and to show all four of them, engaged views, watch hours, estimated revenue and RPM, down to the
// date labels under the last one, and it stops before the numbers table below them
// (creator-analytics#455). The homepage shows the image at up to about 1008 CSS pixels wide, where
// 1920 pixels stay sharp on a 2x screen.
//
// Chrome encodes the WebP itself. The protocol's definition calls `quality` "jpeg only", but
// Chromium's page_handler.cc passes it to its WebP encoder too, with 80 as the default.
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startStubApi } from './stub-api.ts'

const viewport = { width: 1280, height: 1232, deviceScaleFactor: 1.5 }
const webpQuality = 90
const output = fileURLToPath(new URL('../../public/app-screenshot.webp', import.meta.url))
const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url))
const chromePath =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repositoryRoot, env, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`)),
    )
  })
}

/** The build's environment, without the hosts that would send the capture's events or errors. */
function buildEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.VITE_OPENPANEL_API_URL
  delete env.VITE_GLITCHTIP_DSN
  return env
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

interface Protocol {
  send(method: string, params?: object, sessionId?: string): Promise<Record<string, unknown>>
  next(method: string, sessionId: string): Promise<void>
  close(): void
}

async function connect(url: string): Promise<Protocol> {
  const socket = new WebSocket(url)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  let nextId = 0
  const pending = new Map<number, { resolve(value: object): void; reject(error: Error): void }>()
  const waiting: { method: string; sessionId: string; resolve(): void }[] = []
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(String(data))
    if (message.id !== undefined) {
      const call = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) call?.reject(new Error(JSON.stringify(message.error)))
      else call?.resolve(message.result)
      return
    }
    for (const waiter of [...waiting]) {
      if (waiter.method === message.method && waiter.sessionId === message.sessionId) {
        waiting.splice(waiting.indexOf(waiter), 1)
        waiter.resolve()
      }
    }
  })
  return {
    send: (method, params = {}, sessionId) =>
      new Promise((resolve, reject) => {
        nextId += 1
        pending.set(nextId, { resolve, reject })
        socket.send(JSON.stringify({ id: nextId, method, params, sessionId }))
      }),
    next: (method, sessionId) =>
      new Promise((resolve) => waiting.push({ method, sessionId, resolve })),
    close: () => socket.close(),
  }
}

// Ready when the fonts have loaded, no region is busy, no placeholder is left, every image in the
// viewport has loaded (the list's thumbnails load lazily, so those below it never do), and two
// frames have drawn since.
const readyCheck = `(async () => {
  await document.fonts.ready
  const busy = document.querySelector('[aria-busy="true"], [class*="placeholder"]')
  const images = [...document.images]
    .filter((image) => image.getBoundingClientRect().top < innerHeight)
    .every((image) => image.complete && image.naturalWidth > 0)
  const charts = document.querySelectorAll('svg path').length > 0
  if (busy || !images || !charts || document.fonts.status !== 'loaded') return false
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  return true
})()`

async function capture(origin: string): Promise<Buffer> {
  const profile = await mkdtemp(join(tmpdir(), 'stillstats-screenshot-'))
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
    await send('Page.enable')
    await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
    await send('Emulation.setScrollbarsHidden', { hidden: true })
    await send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-color-scheme', value: 'light' },
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ],
    })
    const loaded = browser.next('Page.loadEventFired', sessionId)
    await send('Page.navigate', { url: `${origin}/app` })
    await loaded
    for (let attempt = 0; ; attempt++) {
      const { result } = (await send('Runtime.evaluate', {
        expression: readyCheck,
        awaitPromise: true,
        returnByValue: true,
      })) as { result: { value: unknown } }
      if (result.value === true) break
      if (attempt === 100) throw new Error('The channel screen did not finish loading')
      await delay(100)
    }
    const { data } = (await send('Page.captureScreenshot', {
      format: 'webp',
      quality: webpQuality,
    })) as { data: string }
    browser.close()
    return Buffer.from(data, 'base64')
  } finally {
    chrome.kill()
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
}

await run('pnpm', ['--filter', '@creator-analytics/web', 'build'], buildEnvironment())
const stub = await startStubApi()
try {
  const image = await capture(stub.origin)
  if (stub.unanswered.length > 0) {
    throw new Error(`The stub had no answer for:\n${stub.unanswered.join('\n')}`)
  }
  await writeFile(output, image)
  console.log(`Wrote ${output}`)
} finally {
  await stub.close()
}
