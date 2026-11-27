// Pre-PR review 6, findings 1 and 2. Loads the built web app beside the walk's stub API in
// headless Chrome, with two channels listed and the support item on, and measures the sidebar's
// footer from 48rem: at a landscape phone's window (915x340 and 844x340) where each control ends
// against the window's bottom (finding 1), and at 1280x800 the avatar's width against its height
// (finding 2).
// Red: finding 1, the collapse button's bottom is below the window's bottom, out of reach;
// finding 2, the avatar is narrower than it is tall, so its round fill reads as an oval.
// Green: at each window the column either ends within it or gives way to the row of links, and
// the avatar is as wide as it is tall. A window 384px (24rem) tall or more must show the column.
// Run from the repo root:
// pnpm --filter @creator-analytics/web build && node docs/reviews/creator-analytics-268/repro/sidebar-column-footer.ts
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { startStubApi } from '../../../../apps/site/test/screenshot/stub-api.ts'

const chromePath =
  process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const windows = [
  { width: 915, height: 340 },
  { width: 844, height: 340 },
  { width: 1280, height: 800 },
]

const stub = await startStubApi(0)
stub.listSecondChannel(true)
const profile = await mkdtemp(join(tmpdir(), 'short-window-'))
const chrome = spawn(
  chromePath,
  ['--headless', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
  { stdio: 'ignore' },
)
let failed = false
try {
  let socketUrl = ''
  for (let attempt = 0; attempt < 100 && socketUrl === ''; attempt++) {
    await delay(100)
    const port = await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '')
    const [number, path] = port.split('\n')
    if (number && path) socketUrl = `ws://127.0.0.1:${number}${path}`
  }
  const socket = new WebSocket(socketUrl)
  await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
  let id = 0
  const pending = new Map<number, (result: Record<string, unknown>) => void>()
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(String(data))
    pending.get(message.id)?.(message.result ?? message.error)
    pending.delete(message.id)
  })
  const send = (method: string, params: object = {}, sessionId?: string) =>
    new Promise<Record<string, unknown>>((resolve) => {
      id += 1
      pending.set(id, resolve)
      socket.send(JSON.stringify({ id, method, params, sessionId }))
    })
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const page = (method: string, params: object = {}) => send(method, params, String(sessionId))
  const evaluate = async (expression: string) =>
    (
      (await page('Runtime.evaluate', { expression, returnByValue: true })).result as {
        value: unknown
      }
    ).value
  for (const { width, height } of windows) {
    await page('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await page('Page.navigate', { url: `${stub.origin}/app/` })
    for (let attempt = 0; attempt < 100; attempt++) {
      await delay(100)
      const picker = `document.querySelector('[data-slot="sidebar-footer"] select, header select')`
      if (await evaluate(`!!${picker}`)) break
    }
    const measured = (await evaluate(`(() => {
      const footer = document.querySelector('[data-slot="sidebar-footer"]')
      if (!footer) return null
      const avatar = footer.querySelector('.avatar').getBoundingClientRect()
      return {
        window: innerHeight,
        picker: footer.querySelector('select')?.getBoundingClientRect().bottom ?? null,
        avatar: avatar.bottom,
        collapse: footer.lastElementChild.getBoundingClientRect().bottom,
        avatarWidth: avatar.width,
        avatarHeight: avatar.height,
      }
    })()`)) as Record<string, number | null> | null
    const problems: string[] = []
    if (measured === null) {
      if (height >= 384) problems.push('no sidebar column at a window it fits')
    } else {
      for (const control of ['picker', 'avatar', 'collapse']) {
        const bottom = measured[control]
        if (bottom === null || bottom === undefined || bottom > height + 0.5) {
          problems.push(`${control} ends below the window`)
        }
      }
      if (Math.abs((measured.avatarWidth ?? 0) - (measured.avatarHeight ?? 0)) > 0.5) {
        problems.push('the avatar is not round')
      }
    }
    if (problems.length > 0) failed = true
    console.log(
      `${width}x${height}: ${measured === null ? 'no column, the row of links' : JSON.stringify(measured)}${problems.length > 0 ? ` RED: ${problems.join(', ')}` : ' green'}`,
    )
  }
  socket.close()
} finally {
  chrome.kill()
  await stub.close()
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
process.exit(failed ? 1 : 0)
