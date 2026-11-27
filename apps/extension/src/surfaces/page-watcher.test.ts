// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://studio.youtube.com/channel/UC1/dashboard"}
import type { ExtensionEvent } from '@creator-analytics/api-types'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { AskBackground, BackgroundRequest } from '../messages.ts'
import {
  cutFrom,
  giveUpAfterMs,
  type PlaceAnswer,
  passEveryMs,
  redrawnFrom,
  reportThrough,
  type Surface,
  shownFrom,
  watchPage,
} from './page-watcher.ts'
import {
  eventsIn,
  shownOn,
  studioChanges,
  studioKeepsChangingFor,
  watchThroughWxt,
} from './testing.ts'

/**
 * Two surfaces on one page, which no Studio page carries, so a test sees whether the watch goes on
 * past the first surface's report.
 */
const twoSurfacesThatAre = (placement: PlaceAnswer): Surface[] =>
  (['card', 'analytics'] as const).map((name) => ({
    name,
    isOn: () => true,
    place: async () => placement,
  }))

/** Chrome's sendMessage once the extension is updated under an open Studio tab. */
const throwsBeforeItReturns = (): Promise<boolean> => {
  throw new Error('Extension context invalidated.')
}
/** The background restarted, so nothing answers. */
const neverAnswered = (): Promise<boolean> =>
  Promise.reject(new Error('Receiving end does not exist.'))

let stop = () => {}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  stop()
  vi.useRealTimers()
})

/**
 * Runs the watch for `ms` over two surfaces that are `placement`, reporting through an ask that
 * fails every usage event with `fail`. Returns the usage events asked for, and the rejections Studio
 * would see unhandled once a macrotask has passed.
 */
async function watchFor(
  ms: number,
  placement: PlaceAnswer,
  fail: () => Promise<boolean>,
): Promise<{ events: ExtensionEvent[]; unhandled: unknown[] }> {
  const unhandled: unknown[] = []
  const record = (reason: unknown) => unhandled.push(reason)
  process.on('unhandledRejection', record)
  try {
    const asked: BackgroundRequest[] = []
    const ask = ((request: BackgroundRequest) => {
      asked.push(request)
      return request.type === 'usage-event' ? fail() : Promise.resolve(true)
    }) as AskBackground
    const watcher = watchPage({
      document,
      url: () => 'https://studio.youtube.com/channel/UC1/videos',
      surfaces: twoSurfacesThatAre(placement),
      report: reportThrough(ask),
    })
    stop = watcher.stop
    await vi.advanceTimersByTimeAsync(ms)
    vi.useRealTimers()
    await new Promise((resolve) => setTimeout(resolve))
    return { events: eventsIn(asked), unhandled }
  } finally {
    process.off('unhandledRejection', record)
  }
}

const failures = [
  ['throws before it returns a promise', throwsBeforeItReturns],
  ['the background never answers', neverAnswered],
] as const

test.each(failures)(
  'a pass whose report %s goes on to report every shown surface, with no unhandled rejection',
  async (_, fail) => {
    const { events, unhandled } = await watchFor(passEveryMs, shownFrom(false), fail)

    expect(events).toEqual([
      shownOn('card', { fromCache: false }),
      shownOn('analytics', { fromCache: false }),
    ])
    expect(unhandled).toEqual([])
  },
)

test.each(failures)(
  'a give-up whose report %s goes on to report every missing surface, with no unhandled rejection',
  async (_, fail) => {
    const { events, unhandled } = await watchFor(giveUpAfterMs, 'not-found', fail)

    expect(events).toEqual([
      { name: 'extension_surface_missing', surface: 'card' },
      { name: 'extension_surface_missing', surface: 'analytics' },
    ])
    expect(unhandled).toEqual([])
  },
)

test('a give-up judges the page its navigation was for, not one the URL moved to before WXT reports the move', async () => {
  const dashboard = 'https://studio.youtube.com/channel/UC1/dashboard'
  const contentList = 'https://studio.youtube.com/channel/UC1/videos'
  let studioUrl = dashboard
  const report = vi.fn()
  const watcher = watchPage({
    document,
    url: () => studioUrl,
    surfaces: [
      { name: 'card', isOn: (url) => url === dashboard, place: async () => 'not-found' },
      { name: 'content_list', isOn: (url) => url === contentList, place: async () => 'not-found' },
    ],
    report,
  })
  stop = watcher.stop
  await vi.advanceTimersByTimeAsync(giveUpAfterMs - 1)

  studioUrl = contentList
  await vi.advanceTimersByTimeAsync(200)

  expect(report.mock.calls).toEqual([[{ name: 'extension_surface_missing', surface: 'card' }]])
})

test('a surface Studio draws after the URL moves, before WXT reports the move, is reported shown once for that navigation', async () => {
  const dashboard = 'https://studio.youtube.com/channel/UC1/dashboard'
  const contentList = 'https://studio.youtube.com/channel/UC1/videos'
  let studioUrl = dashboard
  const report = vi.fn()
  const watcher = watchPage({
    document,
    url: () => studioUrl,
    surfaces: [
      { name: 'card', isOn: (url) => url === dashboard, place: async () => 'not-found' },
      {
        name: 'content_list',
        isOn: (url) => url === contentList,
        place: async () => shownFrom(false),
      },
    ],
    report,
  })
  stop = watcher.stop
  await vi.advanceTimersByTimeAsync(passEveryMs)

  // The URL moves to the Content list and Studio draws it; WXT reports the move up to 1 s later.
  studioUrl = contentList
  document.body.append(document.createElement('div'))
  await vi.advanceTimersByTimeAsync(passEveryMs)
  watcher.navigated(studioUrl)
  await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)

  expect(report.mock.calls).toEqual([[shownOn('content_list', { fromCache: false })]])
})

test('a navigation WXT reports before the URL commits, as it does under the Navigation API, is reported shown on the page it goes to', async () => {
  const dashboard = 'https://studio.youtube.com/channel/UC1/dashboard'
  const contentList = 'https://studio.youtube.com/channel/UC1/videos'
  let studioUrl = dashboard
  const report = vi.fn()
  const watcher = watchPage({
    document,
    url: () => studioUrl,
    surfaces: [
      { name: 'card', isOn: (url) => url === dashboard, place: async () => shownFrom(false) },
      {
        name: 'content_list',
        isOn: (url) => url === contentList,
        place: async () => shownFrom(false),
      },
    ],
    report,
  })
  stop = watcher.stop
  await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)
  report.mockClear()

  // WXT dispatches from the `navigate` listener, while `location.href` is still the page left.
  watcher.navigated(contentList)
  studioUrl = contentList
  document.body.append(document.createElement('div'))
  await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)

  expect(report.mock.calls).toEqual([[shownOn('content_list', { fromCache: false })]])
})

test("a URL move to another video's analytics before WXT reports it sends one shown event, for the navigation WXT reports next", async () => {
  const videoA = 'https://studio.youtube.com/video/A/analytics/tab-overview/period-default'
  const videoB = 'https://studio.youtube.com/video/B/analytics/tab-overview/period-default'
  let studioUrl = videoA
  const report = vi.fn()
  const watcher = watchPage({
    document,
    url: () => studioUrl,
    surfaces: [
      {
        name: 'analytics',
        isOn: (url) => url === videoA || url === videoB,
        // Studio has not drawn video A's metrics yet when the creator moves on to video B.
        place: async ({ url }) => (url === videoB ? shownFrom(false) : 'not-found'),
      },
    ],
    report,
  })
  stop = watcher.stop
  await vi.advanceTimersByTimeAsync(passEveryMs)

  studioUrl = videoB
  document.body.append(document.createElement('div'))
  await vi.advanceTimersByTimeAsync(passEveryMs)
  watcher.navigated(studioUrl)
  await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)

  expect(report.mock.calls).toEqual([[shownOn('analytics', { fromCache: false })]])
})

test('a sweep that asks for one more pass while a pass holds a read open is swept again within a pass, with no Studio change', async () => {
  let sweeps = 0
  const watcher = watchPage({
    document,
    url: () => 'https://studio.youtube.com/channel/UC1/videos',
    surfaces: [
      {
        name: 'content_list',
        isOn: () => true,
        sweep(_, passAgain) {
          sweeps += 1
          if (sweeps === 1) passAgain()
        },
        // The background never answers, so the pass holds the lock and only the sweep runs.
        place: () => new Promise<PlaceAnswer>(() => {}),
      },
    ],
    report: () => {},
  })
  stop = watcher.stop
  await vi.advanceTimersByTimeAsync(passEveryMs)
  expect(sweeps).toBe(1)

  await vi.advanceTimersByTimeAsync(passEveryMs)
  expect(sweeps).toBe(2)
  await vi.advanceTimersByTimeAsync(2 * passEveryMs)
  expect(sweeps).toBe(2)
})

describe("a surface's elements once the URL leaves its page", () => {
  const dashboard = 'https://studio.youtube.com/channel/UC1/dashboard'
  const contentList = 'https://studio.youtube.com/channel/UC1/videos'
  const cardHosts = () => [...document.querySelectorAll('[data-stillstats-surface="card"]')]

  /**
   * Watches a card on the dashboard whose every pass draws its host, if it is not up, and then
   * answers `read()`. The URL moves with `moveTo`, and WXT reports the move only when the test calls
   * `navigated`.
   */
  function watchCard(read: () => Promise<PlaceAnswer> = async () => shownFrom(false)) {
    let studioUrl = dashboard
    const watcher = watchPage({
      document,
      url: () => studioUrl,
      surfaces: [
        {
          name: 'card',
          isOn: (url) => url === dashboard,
          place: async () => {
            if (cardHosts().length === 0) {
              const host = document.createElement('div')
              host.setAttribute('data-stillstats-surface', 'card')
              document.body.append(host)
            }
            return read()
          },
        },
      ],
      report: () => {},
    })
    stop = watcher.stop
    return {
      watcher,
      moveTo(url: string) {
        studioUrl = url
      },
    }
  }

  test('once WXT reports a move to a page that does not carry the surface, its host comes down', async () => {
    const { watcher, moveTo } = watchCard()
    await vi.advanceTimersByTimeAsync(passEveryMs)
    expect(cardHosts()).toHaveLength(1)

    moveTo(contentList)
    watcher.navigated(contentList)
    await vi.advanceTimersByTimeAsync(passEveryMs)

    expect(cardHosts()).toEqual([])
  })

  test('while the URL has left the page and WXT has not reported the move, the host stays up', async () => {
    const { moveTo } = watchCard()
    await vi.advanceTimersByTimeAsync(passEveryMs)
    expect(cardHosts()).toHaveLength(1)

    // WXT polls the location, so it may report the move up to a second after the URL changes.
    moveTo(contentList)
    await studioKeepsChangingFor(1_000)

    expect(cardHosts()).toHaveLength(1)
  })

  test('while a pass holds a read open, the host comes down within one tick of WXT reporting the move', async () => {
    let reads = 0
    let answer: (placement: PlaceAnswer) => void = () => {}
    const { watcher, moveTo } = watchCard(() => {
      reads += 1
      if (reads === 1) return Promise.resolve(shownFrom(false))
      // A background answering from a slow API, under the extension's 15 s bound.
      return new Promise<PlaceAnswer>((resolve) => {
        answer = resolve
      })
    })
    await vi.advanceTimersByTimeAsync(passEveryMs)
    studioChanges()
    await vi.advanceTimersByTimeAsync(passEveryMs)
    expect(reads).toBe(2)

    moveTo(contentList)
    watcher.navigated(contentList)
    await vi.advanceTimersByTimeAsync(passEveryMs)

    const hostsWhileOut = cardHosts()
    answer(shownFrom(false))
    expect(hostsWhileOut).toEqual([])
  })
})

// Limits: these drive WXT's own location watcher with a fake Navigation API, so they show what the
// watch does with a `navigate` that never commits, not that Studio fires one (the Details editor's
// unsaved-changes prompt, or an `<a download>`): creator-analytics#99 walks real Studio.
describe('a Navigation API navigate that never commits, through WXT 0.21.4', () => {
  const dashboard = 'https://studio.youtube.com/channel/UC1/dashboard'
  const contentList = 'https://studio.youtube.com/channel/UC1/videos'

  /** The card on the dashboard once Studio has drawn it, and the Content list on the list. */
  async function watchDashboard(cardDrawn: () => boolean = () => true) {
    history.replaceState(null, '', dashboard)
    const report = vi.fn()
    const wxt = await watchThroughWxt({
      navigationApi: true,
      surfaces: [
        {
          name: 'card',
          isOn: (url) => url === dashboard,
          place: async () => (cardDrawn() ? shownFrom(false) : 'not-found'),
        },
        {
          name: 'content_list',
          isOn: (url) => url === contentList,
          place: async () => shownFrom(false),
        },
      ],
      report,
    })
    stop = wxt.stop
    return { wxt, report }
  }

  test('a navigate to the Content list after the dashboard settled reports no Content list missing, and nothing again for the card', async () => {
    const { wxt, report } = await watchDashboard()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)
    expect(report.mock.calls).toEqual([[shownOn('card', { fromCache: false })]])
    report.mockClear()

    wxt.navigateEvent(contentList)
    await studioKeepsChangingFor(giveUpAfterMs + 1_000)

    expect(location.href).toBe(dashboard)
    expect(report.mock.calls).toEqual([])
  })

  test('a navigate before the dashboard is drawn reports the card Studio then draws shown once, and no Content list missing', async () => {
    let drawn = false
    const { wxt, report } = await watchDashboard(() => drawn)
    wxt.navigateEvent(contentList)
    await vi.advanceTimersByTimeAsync(1_000)
    drawn = true
    await studioKeepsChangingFor(giveUpAfterMs + 1_000)

    expect(report.mock.calls).toEqual([[shownOn('card', { fromCache: false })]])
  })

  test('a creator who then really opens the Content list, which WXT does not report again, has it reported shown with no missing before it', async () => {
    const { wxt, report } = await watchDashboard()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)
    report.mockClear()
    wxt.navigateEvent(contentList)
    await studioKeepsChangingFor(giveUpAfterMs + 1_000)

    wxt.moveTo(contentList)
    await studioKeepsChangingFor(giveUpAfterMs + 1_000)

    expect(report.mock.calls).toEqual([[shownOn('content_list', { fromCache: false })]])
  })

  test('two navigates that never commit, inside one give-up, report the card on the unchanged dashboard shown once', async () => {
    const { wxt, report } = await watchDashboard()
    await studioKeepsChangingFor(giveUpAfterMs + 1_000)
    wxt.navigateEvent(contentList)
    await studioKeepsChangingFor(1_000)
    wxt.navigateEvent('https://studio.youtube.com/channel/UC1/comments')
    await studioKeepsChangingFor(giveUpAfterMs + 2_000)

    expect(location.href).toBe(dashboard)
    expect(report.mock.calls).toEqual([[shownOn('card', { fromCache: false })]])
  })

  test('a navigate whose URL commits while a read on the outgoing page holds the pass past the give-up has its missing surface judged once that read ends', async () => {
    history.replaceState(null, '', dashboard)
    const report = vi.fn()
    const wxt = await watchThroughWxt({
      navigationApi: true,
      surfaces: [
        {
          name: 'card',
          isOn: (url) => url === dashboard,
          // A slow read, under the extension's 15 s bound, on the pass ahead of the move.
          place: async ({ ahead }) => {
            if (ahead) await new Promise((resolve) => setTimeout(resolve, 5_500))
            return shownFrom(false)
          },
        },
        {
          name: 'content_list',
          isOn: (url) => url === contentList,
          place: async () => 'not-found',
        },
      ],
      report,
    })
    stop = wxt.stop
    await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)
    report.mockClear()

    wxt.navigateEvent(contentList)
    await vi.advanceTimersByTimeAsync(350)
    history.pushState(null, '', contentList)
    await studioKeepsChangingFor(6_000)
    expect(report.mock.calls).toEqual([
      [{ name: 'extension_surface_missing', surface: 'content_list' }],
    ])

    await studioKeepsChangingFor(giveUpAfterMs + 1_000)
    expect(report.mock.calls).toHaveLength(1)
  })

  test('a navigate that never commits before the dashboard settles still judges the card missing once', async () => {
    const { wxt, report } = await watchDashboard(() => false)
    wxt.navigateEvent(contentList)
    await studioKeepsChangingFor(giveUpAfterMs + 1_000)

    expect(report.mock.calls).toEqual([[{ name: 'extension_surface_missing', surface: 'card' }]])
  })

  test('a navigate that never commits after the card was judged missing reports nothing again', async () => {
    const { wxt, report } = await watchDashboard(() => false)
    await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)
    expect(report.mock.calls).toEqual([[{ name: 'extension_surface_missing', surface: 'card' }]])
    report.mockClear()

    wxt.navigateEvent(contentList)
    await studioKeepsChangingFor(giveUpAfterMs + 1_000)

    expect(report.mock.calls).toEqual([])
  })
})

describe('the time from the pass that finds a surface to its figure', () => {
  const dashboard = 'https://studio.youtube.com/channel/UC1/dashboard'

  /** A surface whose place answers `answer` once `ms` of the test's time has passed. */
  const answeringAfter = (name: Surface['name'], ms: number, answer: PlaceAnswer): Surface => ({
    name,
    isOn: () => true,
    place: async () => {
      if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms))
      return answer
    },
  })

  function watchSurfaces(surfaces: Surface[]) {
    const report = vi.fn()
    const watcher = watchPage({ document, url: () => dashboard, surfaces, report })
    stop = watcher.stop
    return report
  }

  test.each([true, false])(
    'a surface whose figure shows 1,200 ms into its pass reports ms 1200 and fromCache %s',
    async (fromCache) => {
      const report = watchSurfaces([answeringAfter('card', 1_200, shownFrom(fromCache))])

      await vi.advanceTimersByTimeAsync(passEveryMs + 1_200)

      expect(report.mock.calls).toEqual([
        [{ name: 'extension_surface_shown', surface: 'card', ms: 1_200, fromCache }],
      ])
    },
  )

  test("a surface placed second in a pass, after the first surface's slow read, reports the time from the pass's start", async () => {
    const report = watchSurfaces([
      answeringAfter('card', 1_500, 'placed'),
      answeringAfter('analytics', 0, shownFrom(false)),
    ])

    await vi.advanceTimersByTimeAsync(passEveryMs + 1_500)

    expect(report.mock.calls).toEqual([
      [{ name: 'extension_surface_shown', surface: 'analytics', ms: 1_500, fromCache: false }],
    ])
  })

  test('a surface that shows a line or is not found reports no shown event, so no time, beside one that shows its figure', async () => {
    const report = watchSurfaces([
      answeringAfter('card', 100, 'placed'),
      answeringAfter('analytics', 100, 'not-found'),
      answeringAfter('content_list', 200, shownFrom(true)),
    ])

    await vi.advanceTimersByTimeAsync(passEveryMs + 400)

    expect(report.mock.calls).toEqual([
      [{ name: 'extension_surface_shown', surface: 'content_list', ms: 400, fromCache: true }],
    ])
  })

  test('a navigation whose pass waits behind the page it left still awaiting a slow read is timed from when its pass was due, not when the lock freed', async () => {
    const contentList = 'https://studio.youtube.com/channel/UC1/videos'
    let studioUrl = dashboard
    const report = vi.fn()
    const watcher = watchPage({
      document,
      url: () => studioUrl,
      surfaces: [
        {
          name: 'card',
          isOn: (url) => url === dashboard,
          place: async () => {
            await new Promise((resolve) => setTimeout(resolve, 2_000))
            return shownFrom(false)
          },
        },
        {
          name: 'content_list',
          isOn: (url) => url === contentList,
          place: async () => shownFrom(false),
        },
      ],
      report,
    })
    stop = watcher.stop
    // The dashboard's pass starts at `passEveryMs` and holds its read open for 2 s. Studio changes
    // the dashboard meanwhile, which asks for a pass the lock holds back.
    await vi.advanceTimersByTimeAsync(passEveryMs + 50)
    document.body.append(document.createElement('div'))
    await vi.advanceTimersByTimeAsync(passEveryMs + 150)

    // The creator opens the Content list 700 ms in; its pass is due `passEveryMs` later.
    studioUrl = contentList
    watcher.navigated(contentList)
    await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)

    // The dashboard's read lands at 2,250 ms, and the Content list shows at once after it.
    expect(report.mock.calls).toEqual([
      [
        {
          name: 'extension_surface_shown',
          surface: 'content_list',
          ms: 2_250 - (700 + passEveryMs),
          fromCache: false,
        },
      ],
    ])
  })

  describe('a surface that says when its element is on the page', () => {
    const contentList = 'https://studio.youtube.com/channel/UC1/videos'
    const rowsUp = () => document.querySelector('#rows') !== null
    /** Studio draws the Content list's rows. */
    const drawRows = () => {
      const rows = document.createElement('div')
      rows.id = 'rows'
      document.body.append(rows)
    }

    /** The Content list, found once its rows are drawn, whose read takes 300 ms. */
    const listOnce = (isOn: (url: string) => boolean): Surface => ({
      name: 'content_list',
      isOn,
      found: rowsUp,
      place: async () => {
        if (!rowsUp()) return 'not-found'
        await new Promise((resolve) => setTimeout(resolve, 300))
        return shownFrom(false)
      },
    })

    afterEach(() => {
      document.querySelector('#rows')?.remove()
    })

    test('a navigation whose element comes while its pass waits behind the page it left still awaiting a slow read is timed from the pass asked for that found it, not from when the held pass was due', async () => {
      let studioUrl = dashboard
      const report = vi.fn()
      const watcher = watchPage({
        document,
        url: () => studioUrl,
        surfaces: [
          { ...answeringAfter('card', 2_000, shownFrom(false)), isOn: (url) => url === dashboard },
          listOnce((url) => url === contentList),
        ],
        report,
      })
      stop = watcher.stop
      // The dashboard's pass starts at `passEveryMs` and holds its read open for 2 s. The creator
      // opens the Content list 700 ms in, and Studio draws its rows 1,100 ms after that.
      await vi.advanceTimersByTimeAsync(700)
      studioUrl = contentList
      watcher.navigated(contentList)
      await vi.advanceTimersByTimeAsync(1_100)
      drawRows()
      await vi.advanceTimersByTimeAsync(giveUpAfterMs)

      // The pass the rows ask for finds them `passEveryMs` after they come; the dashboard's read
      // lands at `passEveryMs + 2_000`, and the list's read of 300 ms follows it.
      const rowsFoundAt = 1_800 + passEveryMs
      const shownAt = passEveryMs + 2_000 + 300
      expect(report.mock.calls).toEqual([
        [
          {
            name: 'extension_surface_shown',
            surface: 'content_list',
            ms: shownAt - rowsFoundAt,
            fromCache: false,
          },
        ],
      ])
    })

    test("a navigation whose element an ask saw after the URL moved, before WXT's report, while its pass waits behind the page it left still awaiting a slow read, is timed from that ask", async () => {
      let studioUrl = dashboard
      const report = vi.fn()
      const watcher = watchPage({
        document,
        url: () => studioUrl,
        surfaces: [
          { ...answeringAfter('card', 2_000, shownFrom(false)), isOn: (url) => url === dashboard },
          listOnce((url) => url === contentList),
        ],
        report,
      })
      stop = watcher.stop
      // The dashboard's pass starts at `passEveryMs` and holds its read open for 2 s. The URL moves
      // to the Content list at 400 ms, Studio draws its rows 100 ms later, and WXT's poll reports
      // the move at 1,400 ms, before the lock frees.
      await vi.advanceTimersByTimeAsync(400)
      studioUrl = contentList
      await vi.advanceTimersByTimeAsync(100)
      drawRows()
      await vi.advanceTimersByTimeAsync(900)
      watcher.navigated(contentList)
      await vi.advanceTimersByTimeAsync(giveUpAfterMs)

      // The pass the rows ask for finds them `passEveryMs` after they come; the dashboard's read
      // lands at `passEveryMs + 2_000`, and the list's read of 300 ms follows it.
      const rowsFoundAt = 500 + passEveryMs
      const shownAt = passEveryMs + 2_000 + 300
      expect(report.mock.calls).toEqual([
        [
          {
            name: 'extension_surface_shown',
            surface: 'content_list',
            ms: shownAt - rowsFoundAt,
            fromCache: false,
          },
        ],
      ])
    })

    test("a surface placed second in a pass, whose element came during the first surface's slow read, is timed from the pass asked for that found it", async () => {
      const report = watchSurfaces([answeringAfter('card', 1_500, 'placed'), listOnce(() => true)])
      // The pass starts at `passEveryMs`; Studio draws the rows 500 ms into the card's read.
      await vi.advanceTimersByTimeAsync(passEveryMs + 500)
      drawRows()
      await vi.advanceTimersByTimeAsync(1_000 + 300)

      const rowsFoundAt = passEveryMs + 500 + passEveryMs
      const shownAt = passEveryMs + 1_500 + 300
      expect(report.mock.calls).toEqual([
        [
          {
            name: 'extension_surface_shown',
            surface: 'content_list',
            ms: shownAt - rowsFoundAt,
            fromCache: false,
          },
        ],
      ])
    })
  })

  describe("a figure read by a pass ahead of WXT's report, as WXT's 1 s poll lets one run where a content script has no Navigation API", () => {
    const contentList = 'https://studio.youtube.com/channel/UC1/videos'

    afterEach(() => {
      document.querySelector('#card')?.remove()
    })

    /**
     * The Content list, whose first place reads for 500 ms and draws its figure only if the page has
     * not navigated meanwhile, as every surface does; every later place reuses that read at once, as
     * a kept figure, an answer read ahead or a shared read does.
     */
    function watchContentListReadAhead() {
      let studioUrl = dashboard
      let places = 0
      const report = vi.fn()
      const watcher = watchPage({
        document,
        url: () => studioUrl,
        surfaces: [
          {
            name: 'content_list',
            isOn: (url) => url === contentList,
            place: async ({ current }) => {
              places += 1
              if (places > 1) return shownFrom(false)
              await new Promise((resolve) => setTimeout(resolve, 500))
              return current() ? shownFrom(false) : cutFrom(false)
            },
          },
        ],
        report,
      })
      stop = watcher.stop
      return {
        report,
        watcher,
        /** The URL moves to the Content list and Studio draws it; WXT has not reported the move. */
        moveToContentList() {
          studioUrl = contentList
          document.body.append(document.createElement('div'))
        },
      }
    }

    test("a figure the ahead pass drew, which the navigation's own pass keeps, reports the ahead pass's time", async () => {
      const { report, watcher, moveToContentList } = watchContentListReadAhead()
      await vi.advanceTimersByTimeAsync(passEveryMs)

      moveToContentList()
      await vi.advanceTimersByTimeAsync(passEveryMs + 500)
      watcher.navigated(contentList)
      await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)

      expect(report.mock.calls).toEqual([
        [{ name: 'extension_surface_shown', surface: 'content_list', ms: 500, fromCache: false }],
      ])
    })

    test("a figure the ahead pass drew, which the page redraws on the navigation's own pass and the next pass draws again, reports the ahead pass's time", async () => {
      let studioUrl = dashboard
      let places = 0
      const report = vi.fn()
      const watcher = watchPage({
        document,
        url: () => studioUrl,
        surfaces: [
          {
            name: 'content_list',
            isOn: (url) => url === contentList,
            place: async () => {
              places += 1
              if (places === 1) {
                await new Promise((resolve) => setTimeout(resolve, 500))
                return shownFrom(false)
              }
              if (places > 2) return shownFrom(true)
              document.body.append(document.createElement('div'))
              return redrawnFrom(true, 'not-found')
            },
          },
        ],
        report,
      })
      stop = watcher.stop
      await vi.advanceTimersByTimeAsync(passEveryMs)

      studioUrl = contentList
      document.body.append(document.createElement('div'))
      await vi.advanceTimersByTimeAsync(passEveryMs + 500)
      watcher.navigated(contentList)
      await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)

      expect(places).toBeGreaterThan(2)
      expect(report.mock.calls).toEqual([
        [{ name: 'extension_surface_shown', surface: 'content_list', ms: 500, fromCache: false }],
      ])
    })

    test("a read the ahead pass started, which WXT's report cut short before it drew, is timed from the ahead pass's start", async () => {
      const { report, watcher, moveToContentList } = watchContentListReadAhead()
      await vi.advanceTimersByTimeAsync(passEveryMs)

      moveToContentList()
      // The ahead pass starts within `passEveryMs` and reads for 500 ms; WXT reports 300 ms in.
      await vi.advanceTimersByTimeAsync(passEveryMs + 300)
      watcher.navigated(contentList)
      await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)

      // The navigation's own pass starts `passEveryMs` after the report and shows at once.
      expect(report.mock.calls).toEqual([
        [
          {
            name: 'extension_surface_shown',
            surface: 'content_list',
            ms: 300 + passEveryMs,
            fromCache: false,
          },
        ],
      ])
    })

    test("a surface after the one whose read WXT's report cut short, its element on the page all along, is timed from the ahead pass's start", async () => {
      let studioUrl = dashboard
      let read: Promise<void> | undefined
      /** Both surfaces draw from one read of 500 ms, as a watch page and its sidebar share one. */
      const placeFromSharedRead: Surface['place'] = async ({ current }) => {
        read ??= new Promise((resolve) => setTimeout(resolve, 500))
        await read
        return current() ? shownFrom(false) : cutFrom(false)
      }
      const report = vi.fn()
      const watcher = watchPage({
        document,
        url: () => studioUrl,
        surfaces: (['content_list', 'card'] as const).map((name) => ({
          name,
          isOn: (url) => url === contentList,
          found: () => true,
          place: placeFromSharedRead,
        })),
        report,
      })
      stop = watcher.stop
      await vi.advanceTimersByTimeAsync(passEveryMs)

      studioUrl = contentList
      document.body.append(document.createElement('div'))
      // The ahead pass starts within `passEveryMs` and reads for 500 ms; WXT reports 300 ms in.
      await vi.advanceTimersByTimeAsync(passEveryMs + 300)
      watcher.navigated(contentList)
      await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)

      // The navigation's own pass starts `passEveryMs` after the report and shows both at once.
      expect(report.mock.calls).toEqual([
        [shownOn('content_list', { ms: 300 + passEveryMs, fromCache: false })],
        [shownOn('card', { ms: 300 + passEveryMs, fromCache: false })],
      ])
    })

    describe("a surface after the one whose read WXT's report cut short", () => {
      const isUp = (id: string) => document.querySelector(`#${id}`) !== null
      /** Studio draws the element `id`. */
      const draw = (id: string) => {
        const element = document.createElement('div')
        element.id = id
        document.body.append(element)
      }

      /**
       * The Content list, then the card, on the Content list's URL, both drawing from one read of
       * 500 ms that the list starts, as a watch page and its sidebar share one. Each is found, and
       * placed, only while its element (`#rows`, `#card`) is on the page. The card shows a line on a
       * pass before the list's read began, and its figure answers `cardFromCache`.
       */
      function watchListAndCardOnOneRead(cardFromCache = false) {
        let studioUrl = dashboard
        let read: Promise<void> | undefined
        const report = vi.fn()
        const watcher = watchPage({
          document,
          url: () => studioUrl,
          surfaces: [
            {
              name: 'content_list',
              isOn: (url) => url === contentList,
              found: () => isUp('rows'),
              place: async ({ current }) => {
                if (!isUp('rows')) return 'not-found'
                read ??= new Promise((resolve) => setTimeout(resolve, 500))
                await read
                return current() ? shownFrom(false) : cutFrom(false)
              },
            },
            {
              name: 'card',
              isOn: (url) => url === contentList,
              found: () => isUp('card'),
              place: async ({ current }) => {
                if (!isUp('card')) return 'not-found'
                if (!read) return 'placed'
                await read
                return current() ? shownFrom(cardFromCache) : cutFrom(cardFromCache)
              },
            },
          ],
          report,
        })
        stop = watcher.stop
        return {
          report,
          watcher,
          /** The URL moves to the Content list; WXT has not reported the move. */
          moveToContentList() {
            studioUrl = contentList
            studioChanges()
          },
        }
      }

      afterEach(() => {
        document.querySelector('#rows')?.remove()
      })

      test('whose element was first seen after the ahead pass began is timed from that sighting', async () => {
        const { report, watcher, moveToContentList } = watchListAndCardOnOneRead()
        await vi.advanceTimersByTimeAsync(passEveryMs)
        draw('rows')
        moveToContentList()
        // The ahead pass starts `passEveryMs` later and reads for 500 ms. Studio draws the card 20 ms
        // in, which asks for a pass that sees it `passEveryMs` later, and WXT reports 300 ms in.
        await vi.advanceTimersByTimeAsync(passEveryMs + 20)
        draw('card')
        await vi.advanceTimersByTimeAsync(280)
        watcher.navigated(contentList)
        await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)

        // The pass the card asked for runs as the navigation's own once the read lands, 500 ms
        // into the ahead pass, and shows both at once.
        expect(report.mock.calls).toEqual([
          [shownOn('content_list', { ms: 500, fromCache: false })],
          [shownOn('card', { ms: 500 - (20 + passEveryMs), fromCache: false })],
        ])
      })

      test('whose element was seen before the ahead pass was due is timed from when it was due', async () => {
        const { report, watcher, moveToContentList } = watchListAndCardOnOneRead()
        await vi.advanceTimersByTimeAsync(passEveryMs)
        draw('card')
        moveToContentList()
        // The first ahead pass, `passEveryMs` later, sees the card but no rows yet, so no read
        // starts. Studio draws the rows 100 ms after it, which asks for a second ahead pass
        // `passEveryMs` later; that one reads for 500 ms, and WXT reports 300 ms into it.
        await vi.advanceTimersByTimeAsync(passEveryMs + 100)
        draw('rows')
        await vi.advanceTimersByTimeAsync(passEveryMs + 300)
        watcher.navigated(contentList)
        await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)

        // The navigation's own pass starts `passEveryMs` after the report and shows both at once.
        expect(report.mock.calls).toEqual([
          [shownOn('content_list', { ms: 300 + passEveryMs, fromCache: false })],
          [shownOn('card', { ms: 300 + passEveryMs, fromCache: false })],
        ])
      })

      test("whose own pass's answer is from the cache reports fromCache true, as the cut read was the first surface's", async () => {
        const { report, watcher, moveToContentList } = watchListAndCardOnOneRead(true)
        await vi.advanceTimersByTimeAsync(passEveryMs)
        draw('rows')
        draw('card')
        moveToContentList()
        await vi.advanceTimersByTimeAsync(passEveryMs + 300)
        watcher.navigated(contentList)
        await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)

        expect(report.mock.calls).toEqual([
          [shownOn('content_list', { ms: 300 + passEveryMs, fromCache: false })],
          [shownOn('card', { ms: 300 + passEveryMs, fromCache: true })],
        ])
      })

      test('whose element is gone when the read is cut short is timed from its own pass', async () => {
        const { report, watcher, moveToContentList } = watchListAndCardOnOneRead()
        await vi.advanceTimersByTimeAsync(passEveryMs)
        draw('rows')
        draw('card')
        moveToContentList()
        // The ahead pass sees the card as it starts and reads for 500 ms; WXT reports 300 ms in.
        // Studio takes the card down 400 ms in and draws it again 520 ms in, after the read landed.
        await vi.advanceTimersByTimeAsync(passEveryMs + 300)
        watcher.navigated(contentList)
        await vi.advanceTimersByTimeAsync(100)
        document.querySelector('#card')?.remove()
        await vi.advanceTimersByTimeAsync(120)
        draw('card')
        await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)

        // The navigation's own pass starts `passEveryMs` after the report and sees the card anew.
        expect(report.mock.calls).toEqual([
          [shownOn('content_list', { ms: 300 + passEveryMs, fromCache: false })],
          [shownOn('card', { ms: 0, fromCache: false })],
        ])
      })
    })

    test("a surface also on the page the URL left, whose element there was seen, is not timed from that sighting once the URL moves ahead of WXT's report", async () => {
      let studioUrl = dashboard
      let read: Promise<void> | undefined
      const cardUp = () => document.querySelector('#card') !== null
      const drawCard = () => {
        const card = document.createElement('div')
        card.id = 'card'
        document.body.append(card)
      }
      const report = vi.fn()
      const watcher = watchPage({
        document,
        url: () => studioUrl,
        surfaces: [
          {
            // The first surface, on the Content list only, holds the read the report cuts short.
            name: 'content_list',
            isOn: (url) => url === contentList,
            found: () => true,
            place: async ({ current }) => {
              read ??= new Promise((resolve) => setTimeout(resolve, 500))
              await read
              return current() ? shownFrom(false) : cutFrom(false)
            },
          },
          {
            // The card is on both pages: drawn at once on the dashboard, and on the Content list
            // from the list's read, once Studio draws it there.
            name: 'card',
            isOn: () => true,
            found: cardUp,
            place: async ({ url, current }) => {
              if (!cardUp()) return 'not-found'
              if (url === dashboard) return shownFrom(true)
              await read
              return current() ? shownFrom(false) : cutFrom(false)
            },
          },
        ],
        report,
      })
      stop = watcher.stop
      drawCard()
      // The dashboard's pass sees the card at `passEveryMs` and shows it at once.
      await vi.advanceTimersByTimeAsync(passEveryMs)

      // The URL moves to the Content list, and Studio takes the dashboard's card down.
      studioUrl = contentList
      document.querySelector('#card')?.remove()
      // The ahead pass starts `passEveryMs` later and reads for 500 ms. Studio draws the card on
      // the Content list 400 ms in, and WXT reports 450 ms in.
      await vi.advanceTimersByTimeAsync(passEveryMs + 400)
      drawCard()
      await vi.advanceTimersByTimeAsync(50)
      watcher.navigated(contentList)
      await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)

      // The own pass, asked for by the card's drawing `passEveryMs` after it, first sees the card
      // on the Content list and shows both at once from the read. The list keeps the ahead pass's
      // start; the card is timed from its own sighting.
      expect(report.mock.calls).toEqual([
        [shownOn('card', { ms: 0, fromCache: true })],
        [shownOn('content_list', { ms: 400 + passEveryMs, fromCache: false })],
        [shownOn('card', { ms: 0, fromCache: false })],
      ])
    })

    test.each([
      ['also carries it', true],
      ['does not carry it', false],
    ])(
      "a surface drawn from the slow read of the one before it in its navigation's own pass is timed from that pass, though the URL moves during the read, ahead of WXT's report, to a page that %s",
      async (_, cardOnTheNextPage) => {
        let studioUrl = dashboard
        let read: Promise<void> | undefined
        const report = vi.fn()
        const watcher = watchPage({
          document,
          url: () => studioUrl,
          surfaces: [
            {
              // The first surface starts the dashboard's read of 500 ms.
              name: 'content_list',
              isOn: () => true,
              found: () => true,
              place: async ({ url, current }) => {
                if (url !== dashboard) return 'placed'
                read ??= new Promise((resolve) => setTimeout(resolve, 500))
                await read
                return current() ? shownFrom(false) : cutFrom(false)
              },
            },
            {
              // The card draws from that read, as a watch page's sidebar does from its uploads read.
              name: 'card',
              isOn: (url) => cardOnTheNextPage || url === dashboard,
              found: () => true,
              place: async ({ url, current }) => {
                if (url !== dashboard) return 'placed'
                await read
                return current() ? shownFrom(false) : cutFrom(false)
              },
            },
          ],
          report,
        })
        stop = watcher.stop
        // The dashboard's own pass starts at `passEveryMs` and reads for 500 ms. The URL moves 150 ms
        // in, and Studio's change then asks for a pass that sees the page `passEveryMs` later, before
        // the read lands. WXT reports at 1,000 ms.
        await vi.advanceTimersByTimeAsync(passEveryMs + 150)
        studioUrl = contentList
        studioChanges()
        await vi.advanceTimersByTimeAsync(1_000 - (passEveryMs + 150))
        watcher.navigated(contentList)
        await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)

        expect(report.mock.calls).toEqual([
          [shownOn('content_list', { ms: 500, fromCache: false })],
          [shownOn('card', { ms: 500, fromCache: false })],
        ])
      },
    )

    describe("a pass asked for on the page the URL left, held behind that page's slow read and run ahead of WXT's report", () => {
      /**
       * The card, on both pages, whose first place reads for 1,000 ms; every later place shows at
       * once, from the background's keep of that read. Studio changes the dashboard 600 ms in,
       * which asks for a pass the lock holds back behind the read, and the URL moves to the Content
       * list 900 ms in, with Studio changing the page then or not. WXT reports at 1,500 ms.
       */
      async function moveDuringTheDashboardsRead(studioChangesThePage: boolean) {
        let studioUrl = dashboard
        let places = 0
        const report = vi.fn()
        const watcher = watchPage({
          document,
          url: () => studioUrl,
          surfaces: [
            {
              name: 'card',
              isOn: () => true,
              place: async ({ current }) => {
                places += 1
                if (places > 1) return shownFrom(true)
                await new Promise((resolve) => setTimeout(resolve, 1_000))
                return current() ? shownFrom(false) : cutFrom(false)
              },
            },
          ],
          report,
        })
        stop = watcher.stop
        await vi.advanceTimersByTimeAsync(600)
        studioChanges()
        await vi.advanceTimersByTimeAsync(300)
        studioUrl = contentList
        if (studioChangesThePage) studioChanges()
        await vi.advanceTimersByTimeAsync(600)
        watcher.navigated(contentList)
        await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)
        return report
      }

      test('with no pass asked for on the page it went to, is timed from when the lock freed', async () => {
        const report = await moveDuringTheDashboardsRead(false)

        // The dashboard's read lands at `passEveryMs + 1_000`, and the held pass shows the card on
        // the Content list at once.
        expect(report.mock.calls).toEqual([
          [shownOn('card', { ms: 1_000, fromCache: false })],
          [shownOn('card', { ms: 0, fromCache: true })],
        ])
      })

      test('with a pass asked for on the page it went to, is timed from that ask', async () => {
        const report = await moveDuringTheDashboardsRead(true)

        // Studio's change at the move asks for a pass `passEveryMs` later, at 1,150 ms; the
        // dashboard's read lands at 1,250 ms.
        expect(report.mock.calls).toEqual([
          [shownOn('card', { ms: 1_000, fromCache: false })],
          [shownOn('card', { ms: passEveryMs + 1_000 - (900 + passEveryMs), fromCache: true })],
        ])
      })
    })

    test("a redraw during the read ahead of WXT's report is timed from that pass, with that read's cache result", async () => {
      let studioUrl = dashboard
      let places = 0
      const report = vi.fn()
      const watcher = watchPage({
        document,
        url: () => studioUrl,
        surfaces: [
          {
            name: 'content_list',
            isOn: (url) => url === contentList,
            found: () => true,
            place: async () => {
              places += 1
              if (places === 1) {
                await new Promise((resolve) => setTimeout(resolve, 1_200))
                return redrawnFrom(false, 'not-found')
              }
              return shownFrom(true)
            },
          },
        ],
        report,
      })
      stop = watcher.stop
      await vi.advanceTimersByTimeAsync(passEveryMs)

      studioUrl = contentList
      document.body.append(document.createElement('div'))
      await vi.advanceTimersByTimeAsync(passEveryMs + 1_200)
      watcher.navigated(contentList)
      await vi.advanceTimersByTimeAsync(passEveryMs + 50)

      expect(places).toBeGreaterThan(1)
      expect(report.mock.calls).toEqual([
        [
          {
            name: 'extension_surface_shown',
            surface: 'content_list',
            ms: 1_200 + passEveryMs,
            fromCache: false,
          },
        ],
      ])
    })

    /**
     * Watches the dashboard, then moves the URL to the Content list with no report from WXT: one
     * ahead pass a node starts answers `answers[0]` after a read of 1,200 ms, a second ahead pass
     * answers `answers[1]` at once, and after WXT's report the navigation's own pass answers
     * `shownFrom(true)`. Returns the watch's reports.
     */
    async function twoAheadPassesThen(answers: [PlaceAnswer, PlaceAnswer]) {
      let studioUrl = dashboard
      let places = 0
      const report = vi.fn()
      const watcher = watchPage({
        document,
        url: () => studioUrl,
        surfaces: [
          {
            name: 'content_list',
            isOn: (url) => url === contentList,
            found: () => true,
            place: async () => {
              places += 1
              if (places === 1) await new Promise((resolve) => setTimeout(resolve, 1_200))
              return answers[places - 1] ?? shownFrom(true)
            },
          },
        ],
        report,
      })
      stop = watcher.stop
      await vi.advanceTimersByTimeAsync(passEveryMs)
      studioUrl = contentList
      document.body.append(document.createElement('div'))
      await vi.advanceTimersByTimeAsync(passEveryMs + 1_200)
      document.body.append(document.createElement('div'))
      await vi.advanceTimersByTimeAsync(passEveryMs)
      expect(places).toBe(2)
      watcher.navigated(contentList)
      await vi.advanceTimersByTimeAsync(passEveryMs + 50)
      expect(places).toBe(3)
      return report.mock.calls
    }

    test('a figure an ahead pass drew keeps its time through a later ahead pass that draws it again', async () => {
      expect(await twoAheadPassesThen([shownFrom(false), shownFrom(true)])).toEqual([
        [{ name: 'extension_surface_shown', surface: 'content_list', ms: 1_200, fromCache: false }],
      ])
    })

    test('a redraw on an ahead pass, then a figure on the next ahead pass, is timed from the first, as a cold read', async () => {
      expect(await twoAheadPassesThen([redrawnFrom(false, 'not-found'), shownFrom(true)])).toEqual([
        [
          {
            name: 'extension_surface_shown',
            surface: 'content_list',
            ms: expect.toSatisfy((ms: number) => ms >= 1_200),
            fromCache: false,
          },
        ],
      ])
    })

    test('two redraws on ahead passes are from the cache only when both reads were', async () => {
      expect(
        await twoAheadPassesThen([redrawnFrom(true, 'not-found'), redrawnFrom(false, 'not-found')]),
      ).toEqual([
        [
          {
            name: 'extension_surface_shown',
            surface: 'content_list',
            ms: expect.toSatisfy((ms: number) => ms >= 1_200),
            fromCache: false,
          },
        ],
      ])
    })

    test("a redraw ahead of WXT's report that a later ahead pass does not find is not the start of the navigation's figure", async () => {
      let studioUrl = dashboard
      let places = 0
      const report = vi.fn()
      const watcher = watchPage({
        document,
        url: () => studioUrl,
        surfaces: [
          {
            name: 'content_list',
            isOn: (url) => url === contentList,
            found: () => true,
            place: async () => {
              places += 1
              if (places === 1) {
                await new Promise((resolve) => setTimeout(resolve, 1_200))
                return redrawnFrom(false, 'not-found')
              }
              if (places === 2) return 'not-found'
              await new Promise((resolve) => setTimeout(resolve, 300))
              return shownFrom(false)
            },
          },
        ],
        report,
      })
      stop = watcher.stop
      await vi.advanceTimersByTimeAsync(passEveryMs)

      studioUrl = contentList
      document.body.append(document.createElement('div'))
      await vi.advanceTimersByTimeAsync(passEveryMs + 1_200)
      document.body.append(document.createElement('div'))
      await vi.advanceTimersByTimeAsync(passEveryMs)
      expect(places).toBe(2)
      watcher.navigated(contentList)
      await vi.advanceTimersByTimeAsync(passEveryMs + 300)

      expect(places).toBe(3)
      expect(report.mock.calls).toEqual([
        [{ name: 'extension_surface_shown', surface: 'content_list', ms: 300, fromCache: false }],
      ])
    })

    describe('a page the URL left before WXT reported it', () => {
      const playlists = 'https://studio.youtube.com/channel/UC1/content/playlists'
      /** A pass ahead of WXT's report answers `first` 1,200 ms in, the URL leaves to `detour` for a minute, then WXT reports a navigation to the page. */
      async function leftAheadFor(detour: string, first: PlaceAnswer, later: number) {
        let studioUrl = dashboard
        let places = 0
        const report = vi.fn()
        const watcher = watchPage({
          document,
          url: () => studioUrl,
          surfaces: [
            {
              name: 'content_list',
              isOn: (url) => url === contentList,
              found: () => true,
              place: async () => {
                places += 1
                if (places === 1) {
                  await new Promise((resolve) => setTimeout(resolve, 1_200))
                  return first
                }
                if (later > 0) await new Promise((resolve) => setTimeout(resolve, later))
                return shownFrom(true)
              },
            },
          ],
          report,
        })
        stop = watcher.stop
        await vi.advanceTimersByTimeAsync(passEveryMs)

        studioUrl = contentList
        document.body.append(document.createElement('div'))
        await vi.advanceTimersByTimeAsync(passEveryMs + 1_200)
        expect(places).toBe(1)

        studioUrl = detour
        document.body.append(document.createElement('div'))
        await vi.advanceTimersByTimeAsync(60_000)

        studioUrl = contentList
        watcher.navigated(contentList)
        await vi.advanceTimersByTimeAsync(passEveryMs + later + 50)
        return report.mock.calls
      }

      for (const [detour, to] of [
        ['the dashboard', dashboard],
        ['a page with no surface', playlists],
      ] as const)
        test(`a redraw ahead of WXT's report, on a page the URL left for ${detour}, does not time a later navigation to that page`, async () => {
          expect(await leftAheadFor(to, redrawnFrom(false, 'not-found'), 0)).toEqual([
            [{ name: 'extension_surface_shown', surface: 'content_list', ms: 0, fromCache: true }],
          ])
        })

      test("a figure shown ahead of WXT's report, on a page the URL left, does not time a later navigation to that page", async () => {
        expect(await leftAheadFor(dashboard, shownFrom(false), 50)).toEqual([
          [{ name: 'extension_surface_shown', surface: 'content_list', ms: 50, fromCache: true }],
        ])
      })
    })
  })

  test("a surface shown on every pass of a navigation reports one shown event, with its first pass's time", async () => {
    let passes = 0
    const report = watchSurfaces([
      {
        name: 'card',
        isOn: () => true,
        place: async () => {
          passes += 1
          // The first pass reads cold; every later one keeps what it placed.
          if (passes === 1) await new Promise((resolve) => setTimeout(resolve, 900))
          return shownFrom(passes > 1)
        },
      },
    ])

    await vi.advanceTimersByTimeAsync(passEveryMs + 900)
    await studioKeepsChangingFor(2_000)

    expect(passes).toBeGreaterThan(2)
    expect(report.mock.calls).toEqual([
      [{ name: 'extension_surface_shown', surface: 'card', ms: 900, fromCache: false }],
    ])
  })

  describe('a figure drawn after the page redrew its element while its read was out', () => {
    /**
     * A card found from the start that answers `answers` in turn, the first after a read of
     * `readMs`, and redraws the page after each answer but the last, which asks for the next pass.
     */
    function cardAnswering(readMs: number, answers: PlaceAnswer[]): Surface {
      let calls = 0
      return {
        name: 'card',
        isOn: () => true,
        found: () => true,
        place: async () => {
          calls += 1
          if (calls === 1) await new Promise((resolve) => setTimeout(resolve, readMs))
          if (calls < answers.length) document.body.append(document.createElement('div'))
          return answers[Math.min(calls, answers.length) - 1] ?? 'not-found'
        },
      }
    }

    test('is timed from the pass that found the element, with the cache result of the read it waited on', async () => {
      const report = watchSurfaces([
        cardAnswering(1_200, [redrawnFrom(false, 'not-found'), shownFrom(true)]),
      ])

      await vi.advanceTimersByTimeAsync(passEveryMs + 1_200 + 3 * passEveryMs)

      expect(report.mock.calls).toEqual([
        [shownOn('card', { ms: 1_200 + passEveryMs, fromCache: false })],
      ])
    })

    test('after two redraws, is from the cache only when both reads were', async () => {
      const report = watchSurfaces([
        cardAnswering(1_200, [
          redrawnFrom(true, 'not-found'),
          redrawnFrom(false, 'not-found'),
          shownFrom(true),
        ]),
      ])

      await vi.advanceTimersByTimeAsync(passEveryMs + 1_200 + 4 * passEveryMs)

      expect(report.mock.calls).toEqual([
        [shownOn('card', { ms: 1_200 + 2 * passEveryMs, fromCache: false })],
      ])
    })

    test('after a pass that found nothing, is timed from its own pass', async () => {
      const report = watchSurfaces([cardAnswering(1_200, ['not-found', shownFrom(true)])])

      await vi.advanceTimersByTimeAsync(passEveryMs + 1_200 + 3 * passEveryMs)

      expect(report.mock.calls).toEqual([[shownOn('card', { ms: 0, fromCache: true })]])
    })

    test('after a redraw, then a pass that found nothing, is timed from its own pass', async () => {
      const report = watchSurfaces([
        cardAnswering(1_200, [redrawnFrom(false, 'not-found'), 'not-found', shownFrom(true)]),
      ])

      await vi.advanceTimersByTimeAsync(passEveryMs + 1_200 + 4 * passEveryMs)

      expect(report.mock.calls).toEqual([[shownOn('card', { ms: 0, fromCache: true })]])
    })

    test('on a navigation the give-up hands back after a dropped one, is timed from its own pass, not from a redraw before the drop', async () => {
      const contentList = 'https://studio.youtube.com/channel/UC1/videos'
      let calls = 0
      const report = vi.fn()
      const watcher = watchPage({
        document,
        url: () => dashboard,
        surfaces: [
          {
            name: 'card',
            isOn: (url) => url === dashboard,
            found: () => true,
            place: async () => {
              calls += 1
              if (calls > 1) return shownFrom(true)
              await new Promise((resolve) => setTimeout(resolve, 1_200))
              return redrawnFrom(false, 'not-found')
            },
          },
        ],
        report,
      })
      stop = watcher.stop
      await vi.advanceTimersByTimeAsync(passEveryMs + 1_200)

      watcher.navigated(contentList)
      await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)

      expect(calls).toBeGreaterThan(1)
      expect(report.mock.calls).toEqual([[shownOn('card', { ms: 0, fromCache: true })]])
    })

    test.each([
      ['not-found', [[{ name: 'extension_surface_missing', surface: 'card' }]]],
      ['placed', []],
    ] as const)(
      'that never comes, counted as %s, is judged as that placement at the give-up',
      async (counts, calls) => {
        const report = watchSurfaces([answeringAfter('card', 0, redrawnFrom(false, counts))])

        await vi.advanceTimersByTimeAsync(giveUpAfterMs + passEveryMs)

        expect(report.mock.calls).toEqual(calls)
      },
    )

    test('after a move away and back that WXT never reports, is timed from the pass back on its page', async () => {
      const contentList = 'https://studio.youtube.com/channel/UC1/videos'
      let studioUrl = dashboard
      let calls = 0
      const report = vi.fn()
      const watcher = watchPage({
        document,
        url: () => studioUrl,
        surfaces: [
          {
            name: 'card',
            isOn: (url) => url === dashboard,
            found: () => true,
            place: async () => {
              calls += 1
              if (calls > 1) return shownFrom(true)
              await new Promise((resolve) => setTimeout(resolve, 1_200))
              return redrawnFrom(false, 'not-found')
            },
          },
        ],
        report,
      })
      stop = watcher.stop
      await vi.advanceTimersByTimeAsync(passEveryMs + 1_200)

      // Within one of WXT's 1 s polls: off to the Content list, a pass there, and back.
      studioUrl = contentList
      document.body.append(document.createElement('div'))
      await vi.advanceTimersByTimeAsync(passEveryMs)
      studioUrl = dashboard
      document.body.append(document.createElement('div'))
      await vi.advanceTimersByTimeAsync(passEveryMs)

      expect(calls).toBe(2)
      expect(report.mock.calls).toEqual([[shownOn('card', { ms: 0, fromCache: true })]])
    })
  })
})
