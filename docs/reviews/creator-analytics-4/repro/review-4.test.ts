// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://studio.youtube.com/channel/UC1/dashboard"}
// Pre-PR review 4 of creator-analytics#4, findings 1 and 2. Each test states the correct behaviour, so it is red until the finding is fixed.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { AskBackground } from '../../../../apps/extension/src/messages.ts'
import { contentList } from '../../../../apps/extension/src/surfaces/content-list.ts'
import { lineClicks } from '../../../../apps/extension/src/surfaces/line-clicks.ts'
import { studioChanges, watchThroughWxt } from '../../../../apps/extension/src/surfaces/testing.ts'
import { giveUpAfterMs, passEveryMs } from '../../../../apps/extension/src/surfaces/watch.ts'

const dashboard = 'https://studio.youtube.com/channel/UC1/dashboard'
const contentListUrl = 'https://studio.youtube.com/channel/UC1/videos'
const comments = 'https://studio.youtube.com/channel/UC1/comments'
const fixtures = join(import.meta.dirname, '../../../../apps/extension/test/fixtures/studio')

let stop = () => {}
beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  stop()
  vi.useRealTimers()
})

async function studioKeepsChangingFor(ms: number): Promise<void> {
  for (let at = 0; at < ms; at += passEveryMs) {
    studioChanges()
    await vi.advanceTimersByTimeAsync(passEveryMs)
  }
}

test('finding 1: two navigates that never commit, inside one give-up, report the card on the unchanged dashboard shown once', async () => {
  history.replaceState(null, '', dashboard)
  const report = vi.fn()
  const wxt = await watchThroughWxt({
    navigationApi: true,
    report,
    surfaces: [
      { name: 'card', isOn: (url) => url === dashboard, place: async () => 'shown' },
      { name: 'content_list', isOn: (url) => url === contentListUrl, place: async () => 'shown' },
    ],
  })
  stop = wxt.stop
  await studioKeepsChangingFor(giveUpAfterMs + 1_000)
  wxt.navigateEvent(contentListUrl)
  await studioKeepsChangingFor(1_000)
  wxt.navigateEvent(comments)
  await studioKeepsChangingFor(giveUpAfterMs + 2_000)

  expect(location.href).toBe(dashboard)
  expect(report.mock.calls).toEqual([[{ name: 'extension_surface_shown', surface: 'card' }]])
})

test('finding 2: a navigate away from the Content list that never commits reads the list no second time', async () => {
  const html = readFileSync(join(fixtures, 'content-list.html'), 'utf8')
  history.replaceState(null, '', /^<!-- (\S+) /.exec(html)?.[1] ?? '')
  const page = new DOMParser().parseFromString(html, 'text/html')
  document.replaceChild(document.importNode(page.documentElement, true), document.documentElement)
  let reads = 0
  const ask = (async (request: { type: string }) => {
    if (request.type === 'read-videos') {
      reads += 1
      return { state: 'failed' }
    }
    return true
  }) as AskBackground
  const wxt = await watchThroughWxt({
    navigationApi: true,
    report: () => {},
    surfaces: [
      contentList({
        ask,
        origin: 'https://stillstats.example',
        locale: 'en-GB',
        lineClicks: lineClicks(ask),
      }),
    ],
  })
  stop = wxt.stop
  await studioKeepsChangingFor(giveUpAfterMs + 1_000)
  expect(reads).toBe(1)

  wxt.navigateEvent(comments)
  await studioKeepsChangingFor(giveUpAfterMs + 2_000)

  expect(reads).toBe(1)
})
