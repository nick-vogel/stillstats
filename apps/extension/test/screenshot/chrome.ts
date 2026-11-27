// Headless Chrome for the store screenshots (creator-analytics#100), over the Chrome DevTools
// Protocol with no dependency. It speaks the protocol over a pipe, not the WebSocket the homepage's
// capture uses (apps/site/test/screenshot/take-screenshot.ts): `Extensions.loadUnpacked`, which
// installs the built extension, answers only a client on `--remote-debugging-pipe`, with
// `--enable-unsafe-extension-debugging` set. Google Chrome dropped `--load-extension` in Chrome 137.
// Chrome reads the client's messages on file descriptor 3 and writes its own on 4, each a JSON
// object ended by a NUL byte.
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Readable, Writable } from 'node:stream'

export const chromePath =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

/** A protocol event, such as `Fetch.requestPaused`, with the session it came from. */
export interface ProtocolEvent {
  method: string
  params: Record<string, unknown>
  sessionId?: string
}

export interface Chrome {
  send(method: string, params?: object, sessionId?: string): Promise<Record<string, unknown>>
  /** Calls `listener` with every event Chrome sends, from any session. */
  onEvent(listener: (event: ProtocolEvent) => void): void
  close(): Promise<void>
}

export async function launchChrome(): Promise<Chrome> {
  const profile = await mkdtemp(join(tmpdir(), 'stillstats-store-screenshots-'))
  const chrome = spawn(
    chromePath,
    [
      '--headless',
      '--remote-debugging-pipe',
      '--enable-unsafe-extension-debugging',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-component-update',
      // Studio's pages are in US English, so the extension's dates, which follow the browser's
      // locale, are too.
      '--lang=en-US',
      '--accept-lang=en-US',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] },
  )
  const toChrome = chrome.stdio[3] as Writable
  const fromChrome = chrome.stdio[4] as Readable
  let nextId = 0
  let unread = ''
  const pending = new Map<number, { resolve(value: object): void; reject(error: Error): void }>()
  const listeners: ((event: ProtocolEvent) => void)[] = []
  fromChrome.on('data', (chunk: Buffer) => {
    unread += chunk.toString('utf8')
    for (let end = unread.indexOf('\0'); end >= 0; end = unread.indexOf('\0')) {
      const message = JSON.parse(unread.slice(0, end))
      unread = unread.slice(end + 1)
      if (message.id !== undefined) {
        const call = pending.get(message.id)
        pending.delete(message.id)
        if (message.error) call?.reject(new Error(JSON.stringify(message.error)))
        else call?.resolve(message.result)
      } else {
        for (const listener of listeners) listener(message)
      }
    }
  })
  const exited = new Promise((resolve) => chrome.on('exit', resolve))
  return {
    send: (method, params = {}, sessionId) =>
      new Promise((resolve, reject) => {
        nextId += 1
        pending.set(nextId, { resolve, reject })
        toChrome.write(`${JSON.stringify({ id: nextId, method, params, sessionId })}\0`)
      }),
    onEvent: (listener) => listeners.push(listener),
    async close() {
      chrome.kill()
      await exited
      await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    },
  }
}

export interface InterceptedRequest {
  url: string
  method: string
  postData?: string
  resourceType: string
}

/** A made-up answer, the network's own (`network`), or a failed request (`fail`). */
export type Answer = { status: number; type: string; body: string | Buffer } | 'network' | 'fail'

/**
 * Pauses every http and https request in the browser, the extension's background included, and
 * answers it with `answerOf`. The extension's own pages, on chrome-extension://, are not paused.
 */
export async function interceptRequests(
  chrome: Chrome,
  answerOf: (request: InterceptedRequest) => Answer | Promise<Answer>,
): Promise<void> {
  chrome.onEvent(async ({ method, params }) => {
    if (method !== 'Fetch.requestPaused') return
    const requestId = params.requestId as string
    const request = params.request as { url: string; method: string; postData?: string }
    let answer: Answer
    try {
      answer = await answerOf({
        url: request.url,
        method: request.method,
        ...(request.postData === undefined ? {} : { postData: request.postData }),
        resourceType: params.resourceType as string,
      })
    } catch (error) {
      console.error(`No answer for ${request.url}:`, error)
      answer = 'fail'
    }
    if (answer === 'network') return void chrome.send('Fetch.continueRequest', { requestId })
    if (answer === 'fail') {
      return void chrome.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' })
    }
    void chrome.send('Fetch.fulfillRequest', {
      requestId,
      responseCode: answer.status,
      responseHeaders: [
        { name: 'content-type', value: answer.type },
        { name: 'cache-control', value: 'no-store' },
      ],
      body: Buffer.from(answer.body).toString('base64'),
    })
  })
  await chrome.send('Fetch.enable', {
    patterns: [{ urlPattern: 'https://*' }, { urlPattern: 'http://*' }],
  })
}

/** YouTube's own fonts and Studio's icons and images, which every Studio page loads. */
export function isYouTubeStatic(url: string): boolean {
  return /^https:\/\/(fonts|www|ssl)\.gstatic\.com\//.test(url)
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface Tab {
  send(method: string, params?: object): Promise<Record<string, unknown>>
  /** The value of `expression`, awaited when it is a promise. */
  evaluate<T>(expression: string): Promise<T>
  /** Evaluates `expression` every 100 ms until it is true, and fails after `timeoutMs`. */
  waitFor(expression: string, what: string, timeoutMs?: number): Promise<void>
}

/** A new tab at `url`, with a viewport of `width` by `height` CSS pixels. */
export async function openTab(
  chrome: Chrome,
  url: string,
  viewport: { width: number; height: number; deviceScaleFactor: number },
): Promise<Tab> {
  const { targetId } = await chrome.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = (await chrome.send('Target.attachToTarget', {
    targetId,
    flatten: true,
  })) as { sessionId: string }
  const send = (method: string, params?: object) => chrome.send(method, params, sessionId)
  await send('Page.enable')
  // A tab in the background draws no frames, and the extension's first-run page opens in one.
  await send('Page.bringToFront')
  await send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false })
  await send('Emulation.setScrollbarsHidden', { hidden: true })
  await send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-color-scheme', value: 'light' },
      { name: 'prefers-reduced-motion', value: 'reduce' },
    ],
  })
  const loaded = new Promise<void>((resolve) =>
    chrome.onEvent((event) => {
      if (event.method === 'Page.loadEventFired' && event.sessionId === sessionId) resolve()
    }),
  )
  await send('Page.navigate', { url })
  await Promise.race([
    loaded,
    delay(30_000).then(() => {
      throw new Error(`${url} did not load`)
    }),
  ])
  async function evaluate<T>(expression: string): Promise<T> {
    const { result, exceptionDetails } = (await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })) as { result: { value: T }; exceptionDetails?: unknown }
    if (exceptionDetails) throw new Error(`${expression}\n${JSON.stringify(exceptionDetails)}`)
    return result.value
  }
  return {
    send,
    evaluate,
    async waitFor(expression, what, timeoutMs = 20_000) {
      for (let waited = 0; ; waited += 100) {
        if ((await evaluate<boolean>(expression)) === true) return
        if (waited >= timeoutMs) throw new Error(`Timed out waiting for ${what}`)
        await delay(100)
      }
    },
  }
}
