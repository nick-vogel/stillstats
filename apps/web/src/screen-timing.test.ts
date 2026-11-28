// Limits: these tests drive the timing module with a fake clock, fake performance entries and a
// fake document, so they show what it sends for the entries a browser would hand it, not that a
// browser hands them: Chrome's own LCP and INP for a real page are read in OpenPanel after a deploy.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { track } from './analytics.ts'
import { type Route, routeOf } from './route.ts'
import {
  answerShown,
  answerShownEvent,
  budgetScreenOf,
  cacheOf,
  changeOf,
  changeStarted,
  inpOf,
  type ScreenTimingEntry,
  type ScreenTimingEntryType,
  screenShown,
  startScreenTiming,
  webVitalEvent,
} from './screen-timing.ts'

vi.mock('./analytics.ts', () => ({ track: vi.fn() }))

const at = (path: string, search = ''): Route => routeOf(path, search)

describe('the budget screen of a route', () => {
  test('names each budget screen by its template, never its address', () => {
    expect(budgetScreenOf(at('', '?channel=c-9&page=3'))).toBe('/app/')
    expect(budgetScreenOf(at('videos/abc123XYZ', '?channel=c-9'))).toBe('/app/videos/:id')
    expect(budgetScreenOf(at('audience', '?window=last7'))).toBe('/app/audience')
    expect(budgetScreenOf(at('retention', '?curves=abc,def'))).toBe('/app/retention')
  })

  test('is none for any other screen', () => {
    expect(budgetScreenOf(at('settings'))).toBeNull()
    expect(budgetScreenOf(at('videos/abc123XYZ/sponsor-report'))).toBeNull()
    expect(budgetScreenOf(at('whats-new'))).toBeNull()
    expect(budgetScreenOf(at('upgrade'))).toBeNull()
    expect(budgetScreenOf(at('feedback'))).toBeNull()
    expect(budgetScreenOf(at('admin/feedback'))).toBeNull()
    expect(budgetScreenOf(at('admin/grants'))).toBeNull()
  })
})

describe('the change a route move makes', () => {
  const list = at('', '?window=last28')

  test('another screen, another video or another channel is a load', () => {
    expect(changeOf(list, at('audience'))).toEqual({ trigger: 'load' })
    expect(changeOf(at('settings'), list)).toEqual({ trigger: 'load' })
    expect(changeOf(at('videos/one'), at('videos/two'))).toEqual({ trigger: 'load' })
    expect(changeOf(list, at('', '?window=last28&channel=c-2'))).toEqual({ trigger: 'load' })
  })

  test('a window or a custom range is a window change', () => {
    expect(changeOf(list, at('', '?window=last90'))).toEqual({ trigger: 'window' })
    const custom = at('', '?window=custom&from=2026-09-01&to=2026-09-30')
    expect(changeOf(custom, at('', '?window=custom&from=2026-09-01&to=2026-09-29'))).toEqual({
      trigger: 'window',
    })
    expect(changeOf(at('videos/one'), at('videos/one', '?window=lifetime'))).toEqual({
      trigger: 'window',
    })
  })

  test('a sort is a sort change, and a page or a page size a page change', () => {
    expect(changeOf(list, at('', '?sort=-views'))).toEqual({ trigger: 'sort' })
    expect(changeOf(list, at('', '?page=2'))).toEqual({ trigger: 'page' })
    expect(changeOf(list, at('', '?pageSize=50'))).toEqual({ trigger: 'page' })
  })

  test("a format, visibility, traffic source or minimum is a filter change, with the filter's name", () => {
    expect(changeOf(list, at('', '?format=short'))).toEqual({ trigger: 'filter', filter: 'format' })
    expect(changeOf(list, at('', '?visibility=all'))).toEqual({
      trigger: 'filter',
      filter: 'visibility',
    })
    expect(changeOf(list, at('', '?trafficSource=YT_SEARCH'))).toEqual({
      trigger: 'filter',
      filter: 'trafficSource',
    })
    expect(changeOf(list, at('', '?minImpressions=100'))).toEqual({
      trigger: 'filter',
      filter: 'minImpressions',
    })
  })

  test('a control change that also resets the page is the control, not the page', () => {
    const third = at('', '?page=3')
    expect(changeOf(third, at('', '?sort=-views'))).toEqual({ trigger: 'sort' })
    expect(changeOf(third, at('', '?format=video'))).toEqual({
      trigger: 'filter',
      filter: 'format',
    })
    expect(changeOf(at('', '?page=3&sort=-views'), at('', '?window=last90'))).toEqual({
      trigger: 'window',
    })
  })

  test('a chart mode, a chart card, a pick or nothing at all is no change', () => {
    expect(changeOf(list, at('', '?chart=aggregate'))).toBeNull()
    expect(changeOf(list, at('', '?card=watchTime'))).toBeNull()
    expect(changeOf(at('retention'), at('retention', '?curves=abc'))).toBeNull()
    expect(changeOf(list, list)).toBeNull()
  })

  test('a move to a screen with no budget is no change', () => {
    expect(changeOf(list, at('settings'))).toBeNull()
    expect(changeOf(at('videos/one'), at('videos/one/sponsor-report'))).toBeNull()
  })
})

describe('the cache result and INP', () => {
  test('an answer read from the cache is a hit, one read from Google a miss', () => {
    expect(cacheOf(true)).toBe('hit')
    expect(cacheOf(false)).toBe('miss')
  })

  test('INP is the worst interaction, skipping one per 50', () => {
    expect(inpOf([])).toBeNull()
    expect(inpOf([40, 120, 64])).toBe(120)
    const fifty = [...Array.from({ length: 49 }, () => 10), 300]
    expect(inpOf(fifty)).toBe(10)
    expect(inpOf([...fifty.slice(0, 48), 200, 300])).toBe(200)
  })
})

describe('the timing events', () => {
  test('a web vital carries the metric, its whole milliseconds and the screen, and nothing else', () => {
    const event = webVitalEvent({
      metric: 'LCP',
      value: 1234.6,
      screen: '/app/',
      ...{ channel: 'c-1' },
    } as Parameters<typeof webVitalEvent>[0])
    expect(event).toEqual({ name: 'web_vital', metric: 'LCP', value: 1235, screen: '/app/' })
  })

  test('a web vital carries beforeScreen only when it is true', () => {
    expect(
      webVitalEvent({ metric: 'LCP', value: 1800, screen: '/app/', beforeScreen: true }),
    ).toEqual({
      name: 'web_vital',
      metric: 'LCP',
      value: 1800,
      screen: '/app/',
      beforeScreen: true,
    })
    expect(
      webVitalEvent({
        metric: 'INP',
        value: 80,
        screen: '/app/',
        ...{ beforeScreen: false },
      } as unknown as Parameters<typeof webVitalEvent>[0]),
    ).toEqual({ name: 'web_vital', metric: 'INP', value: 80, screen: '/app/' })
  })

  test('an answer shown carries its fixed keys, a filter only with a filter change', () => {
    expect(
      answerShownEvent({
        screen: '/app/audience',
        trigger: 'window',
        window: 'last90',
        cache: 'hit',
        ms: 412.4,
        ...{ video: 'abc', address: '/app/audience?window=last90' },
      } as Parameters<typeof answerShownEvent>[0]),
    ).toEqual({
      name: 'answer_shown',
      screen: '/app/audience',
      trigger: 'window',
      window: 'last90',
      cache: 'hit',
      ms: 412,
    })
    expect(
      answerShownEvent({
        screen: '/app/',
        trigger: 'filter',
        filter: 'format',
        window: 'custom',
        cache: 'miss',
        ms: 80,
      }),
    ).toEqual({
      name: 'answer_shown',
      screen: '/app/',
      trigger: 'filter',
      filter: 'format',
      window: 'custom',
      cache: 'miss',
      ms: 80,
    })
  })
})

/** A clock, a performance observer and a document a test drives, as `main.tsx` hands the real ones. */
function fakeBrowser({ hidden = false } = {}) {
  let time = 0
  const listeners = new Map<ScreenTimingEntryType, (entries: ScreenTimingEntry[]) => void>()
  const document = Object.assign(new EventTarget(), {
    visibilityState: (hidden ? 'hidden' : 'visible') as DocumentVisibilityState,
  })
  return {
    document,
    now: () => time,
    observe(type: ScreenTimingEntryType, onEntries: (entries: ScreenTimingEntry[]) => void) {
      listeners.set(type, onEntries)
      return () => listeners.delete(type)
    },
    at(ms: number) {
      time = ms
    },
    entries(type: ScreenTimingEntryType, entries: ScreenTimingEntry[]) {
      listeners.get(type)?.(entries)
    },
    input() {
      document.dispatchEvent(new Event('pointerdown'))
    },
    hide() {
      document.visibilityState = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))
    },
    show() {
      document.visibilityState = 'visible'
      document.dispatchEvent(new Event('visibilitychange'))
    },
  }
}

const list = at('')
const tracked = () => vi.mocked(track).mock.calls.map(([event]) => event)
let stop: (() => void) | null = null

function started(options?: { hidden?: boolean }) {
  const browser = fakeBrowser(options)
  stop = startScreenTiming(browser)
  return browser
}

beforeEach(() => vi.mocked(track).mockClear())
afterEach(() => {
  stop?.()
  stop = null
})

describe('the timing of an answer', () => {
  test('sends nothing at all before it starts', () => {
    screenShown('/app/')
    changeStarted(list, at('', '?sort=-views'))
    answerShown('/app/', 'last28', 'miss')

    expect(tracked()).toEqual([])
  })

  test("measures the page's first answer from navigation start, once a page", () => {
    const browser = started()
    browser.at(1840)
    screenShown('/app/')
    answerShown('/app/', 'last28', 'miss')
    browser.at(5000)
    answerShown('/app/', 'last28', 'miss')

    expect(tracked()).toEqual([
      {
        name: 'answer_shown',
        screen: '/app/',
        trigger: 'load',
        window: 'last28',
        cache: 'miss',
        ms: 1840,
      },
    ])
  })

  test('measures a change from its input to its answer', () => {
    const browser = started()
    answerShown('/app/', 'last28', 'miss')
    vi.mocked(track).mockClear()
    browser.at(2000)
    changeStarted(list, at('', '?format=short'))
    browser.at(2312.4)
    answerShown('/app/', 'last28', 'hit')

    expect(tracked()).toEqual([
      {
        name: 'answer_shown',
        screen: '/app/',
        trigger: 'filter',
        filter: 'format',
        window: 'last28',
        cache: 'hit',
        ms: 312,
      },
    ])
  })

  test('an open of another screen is that screen’s load, from the input', () => {
    const browser = started()
    browser.at(3000)
    changeStarted(list, at('audience'))
    browser.at(3450)
    answerShown('/app/', 'last28', 'miss')
    answerShown('/app/audience', 'last28', 'hit')

    expect(tracked()).toEqual([
      {
        name: 'answer_shown',
        screen: '/app/audience',
        trigger: 'load',
        window: 'last28',
        cache: 'hit',
        ms: 450,
      },
    ])
  })

  test('a change that starts no wait drops the one before it, and its answer sends nothing', () => {
    const browser = started()
    answerShown('/app/', 'last28', 'miss')
    vi.mocked(track).mockClear()
    changeStarted(list, at('', '?sort=-views'))
    changeStarted(at('', '?sort=-views'), at('', '?sort=-views&chart=aggregate'))
    browser.at(900)
    answerShown('/app/', 'last28', 'miss')

    expect(tracked()).toEqual([])
  })

  test('an answer that measures loads only, or changes only, leaves the other for its own answer', () => {
    const browser = started()
    browser.at(1200)
    answerShown('/app/retention', 'lifetime', 'miss', 'change')
    answerShown('/app/retention', 'lifetime', 'stored', 'load')
    browser.at(2000)
    changeStarted(at('retention'), at('retention', '?sort=averageViewPercentage'))
    browser.at(2100)
    answerShown('/app/retention', 'lifetime', 'stored', 'load')
    answerShown('/app/retention', 'lifetime', 'hit', 'change')

    expect(tracked()).toEqual([
      expect.objectContaining({ trigger: 'load', cache: 'stored', ms: 1200 }),
      expect.objectContaining({ trigger: 'sort', cache: 'hit', ms: 100 }),
    ])
  })
})

describe('the web vitals', () => {
  test('sends the last LCP candidate once, at the first input, for the screen the page loaded on', () => {
    const browser = started()
    browser.entries('largest-contentful-paint', [{ startTime: 640, duration: 0 }])
    screenShown('/app/videos/:id')
    browser.entries('largest-contentful-paint', [{ startTime: 1310.7, duration: 0 }])
    browser.input()
    browser.entries('largest-contentful-paint', [{ startTime: 4000, duration: 0 }])
    browser.input()

    expect(tracked()).toEqual([
      { name: 'web_vital', metric: 'LCP', value: 1311, screen: '/app/videos/:id' },
    ])
  })

  test('sends LCP when the page is hidden before any input', () => {
    const browser = started()
    screenShown('/app/audience')
    browser.entries('largest-contentful-paint', [{ startTime: 900, duration: 0 }])
    browser.hide()

    expect(tracked()).toEqual([
      { name: 'web_vital', metric: 'LCP', value: 900, screen: '/app/audience' },
    ])
  })

  test('sends no LCP for a page that loaded on a screen with no budget', () => {
    const browser = started()
    browser.entries('largest-contentful-paint', [{ startTime: 700, duration: 0 }])
    changeStarted(at('settings'), list)
    screenShown('/app/')
    browser.input()

    expect(tracked()).toEqual([])
  })

  test('sends no LCP for a page loaded in the background', () => {
    const browser = started({ hidden: true })
    screenShown('/app/')
    browser.entries('largest-contentful-paint', [{ startTime: 700, duration: 0 }])
    browser.input()

    expect(tracked()).toEqual([])
  })

  test('an input before the budget screen shows sends its time as the LCP, marked as a floor', () => {
    const browser = started()
    browser.entries('largest-contentful-paint', [{ startTime: 640, duration: 0 }])
    browser.at(1_800)
    browser.input()
    browser.at(2_600)
    browser.entries('largest-contentful-paint', [{ startTime: 2_500, duration: 0 }])
    browser.input()
    screenShown('/app/')
    browser.input()

    expect(tracked()).toEqual([
      { name: 'web_vital', metric: 'LCP', value: 1_800, screen: '/app/', beforeScreen: true },
    ])
  })

  test('a hide before the budget screen shows sends its time as the LCP, marked as a floor', () => {
    const browser = started()
    browser.entries('largest-contentful-paint', [{ startTime: 640, duration: 0 }])
    browser.at(1_200)
    browser.hide()
    browser.at(9_000)
    browser.show()
    screenShown('/app/audience')

    expect(tracked()).toEqual([
      {
        name: 'web_vital',
        metric: 'LCP',
        value: 1_200,
        screen: '/app/audience',
        beforeScreen: true,
      },
    ])
  })

  test('an input before any screen shows sends no LCP when the page loaded on a screen with no budget and then moves, or when no screen ever shows', () => {
    const browser = started()
    browser.entries('largest-contentful-paint', [{ startTime: 640, duration: 0 }])
    browser.at(1_800)
    browser.input()
    browser.hide()

    expect(tracked()).toEqual([])

    changeStarted(at('settings'), list)
    screenShown('/app/')

    expect(tracked()).toEqual([])
  })

  test('an input and then a move before the budget screen shows sends the input time as the LCP, marked as a floor', () => {
    const browser = started()
    browser.entries('largest-contentful-paint', [{ startTime: 640, duration: 0 }])
    browser.at(1_800)
    browser.input()
    changeStarted(list, list)
    screenShown('/app/')

    expect(tracked()).toEqual([
      { name: 'web_vital', metric: 'LCP', value: 1_800, screen: '/app/', beforeScreen: true },
    ])
  })

  test('a move to another budget screen before either shows sends its time as the LCP of the screen the page loaded on, marked as a floor', () => {
    const browser = started()
    browser.at(2_200)
    changeStarted(at('audience'), list)
    screenShown('/app/')

    expect(tracked()).toEqual([
      {
        name: 'web_vital',
        metric: 'LCP',
        value: 2_200,
        screen: '/app/audience',
        beforeScreen: true,
      },
    ])
  })

  test('a second move before the budget screen shows keeps the first move time and the screen the page loaded on', () => {
    const browser = started()
    browser.at(1_000)
    changeStarted(at('audience'), list)
    browser.at(2_000)
    changeStarted(list, at('retention'))
    screenShown('/app/retention')

    expect(tracked()).toEqual([
      {
        name: 'web_vital',
        metric: 'LCP',
        value: 1_000,
        screen: '/app/audience',
        beforeScreen: true,
      },
    ])
  })

  test('a move from a budget screen and then a hide, with no screen ever shown, sends no LCP', () => {
    const browser = started()
    browser.entries('largest-contentful-paint', [{ startTime: 640, duration: 0 }])
    browser.at(1_800)
    changeStarted(list, at('settings'))
    browser.hide()

    expect(tracked()).toEqual([])
  })

  test("sends a screen view's INP, its worst interaction, once the screen has changed twice", () => {
    const browser = started()
    screenShown('/app/')
    browser.input()
    browser.entries('event', [
      { startTime: 2000, duration: 80, interactionId: 7 },
      { startTime: 2000, duration: 128, interactionId: 7 },
      { startTime: 2500, duration: 48, interactionId: 8 },
      // A hover is no interaction.
      { startTime: 2600, duration: 400, interactionId: 0 },
    ])
    browser.entries('first-input', [{ startTime: 1900, duration: 16, interactionId: 6 }])
    changeStarted(list, at('', '?sort=-views'))
    screenShown('/app/')
    changeStarted(at('', '?sort=-views'), at('audience'))
    screenShown('/app/audience')
    expect(tracked()).toEqual([])
    changeStarted(at('audience'), at('retention'))

    expect(tracked()).toEqual([{ name: 'web_vital', metric: 'INP', value: 128, screen: '/app/' }])
  })

  test('counts the input that opens another screen in the screen it left, though its entry comes after', () => {
    const browser = started()
    browser.at(1000)
    screenShown('/app/')
    // The click on a video row: the browser reports its entry once the next screen has painted.
    browser.at(3010)
    changeStarted(list, at('videos/one'))
    screenShown('/app/videos/:id')
    browser.entries('event', [
      { startTime: 3000, duration: 240, interactionId: 5 },
      // An input from before either view, while the page loaded, counts in neither.
      { startTime: 500, duration: 900, interactionId: 3 },
    ])
    browser.at(5000)
    browser.entries('event', [{ startTime: 4900, duration: 56, interactionId: 6 }])
    browser.hide()

    expect(tracked()).toEqual([
      { name: 'web_vital', metric: 'INP', value: 240, screen: '/app/' },
      { name: 'web_vital', metric: 'INP', value: 56, screen: '/app/videos/:id' },
    ])
  })

  test("sends a view's INP once, at the first hide, and nothing for its interactions after a return", () => {
    const browser = started()
    screenShown('/app/')
    browser.hide()
    browser.show()
    browser.entries('event', [{ startTime: 2000, duration: 200, interactionId: 1 }])
    browser.hide()
    browser.show()
    browser.entries('event', [{ startTime: 6000, duration: 480, interactionId: 2 }])
    browser.hide()
    changeStarted(list, at('audience'))
    changeStarted(at('audience'), at('retention'))

    expect(tracked()).toEqual([{ name: 'web_vital', metric: 'INP', value: 200, screen: '/app/' }])
  })

  test("sends the view's INP when the page is hidden, and none for a view with no interaction", () => {
    const browser = started()
    screenShown('/app/retention')
    browser.input()
    browser.entries('event', [{ startTime: 2000, duration: 72, interactionId: 3 }])
    browser.hide()
    changeStarted(at('retention'), at('settings'))

    expect(tracked()).toEqual([
      { name: 'web_vital', metric: 'INP', value: 72, screen: '/app/retention' },
    ])
  })
})
