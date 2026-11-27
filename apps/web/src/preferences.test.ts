// Limits: these tests cover which value wins, as pure functions. No test here renders the chart or
// talks to the API, so none shows that a change saves the preference, or that a saved mode comes
// back in a new session on another device. Nick checks both at /app in a real browser. App's
// wiring of these rules, a failed save's revert and its notice, is `app.test.ts`'s.
import type { Preferences } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import {
  chartCardOf,
  chartModeOf,
  columnPreferenceOf,
  type FailedSave,
  failedSaveAfterFailureOf,
  failedSaveAfterSuccessOf,
  failedSaveOn,
  listColumnsOf,
  pageSizeOf,
  preferencesAfterFailedSave,
  preferencesAfterRead,
  revenueSourcesOf,
  rpmAdsAndPremiumOnlyOf,
  saveTracker,
  settingOf,
  settledOf,
  sidebarOpenOf,
  themeOnViewOf,
  visibilityOf,
  writeQueue,
} from './preferences.ts'
import {
  addressOf,
  defaultRoute,
  listRouteOf,
  type Route,
  revertAddressAfterFailedSave,
  routeAfterFailedSave,
} from './route.ts'

describe('the value a setting takes', () => {
  test("the address's value wins over the saved preference and the default", () => {
    expect(settingOf('aggregate', 'daily', 'daily')).toBe('aggregate')
  })

  test('the saved preference wins over the default', () => {
    expect(settingOf(undefined, 'aggregate', 'daily')).toBe('aggregate')
  })

  test('with neither, the default', () => {
    expect(settingOf(undefined, undefined, 'daily')).toBe('daily')
  })
})

describe("the charts' mode", () => {
  test('is the saved mode when the address carries none', () => {
    expect(chartModeOf(defaultRoute, { chartMode: 'aggregate' })).toBe('aggregate')
  })

  test('is the default, daily, with no address value and no saved mode', () => {
    expect(chartModeOf(defaultRoute, {})).toBe('daily')
  })

  test("is the address's mode, even when that is the default and another mode is saved", () => {
    expect(chartModeOf(listRouteOf('?chart=daily'), { chartMode: 'aggregate' })).toBe('daily')
  })
})

describe('the chart card, which chooses the chart a small screen shows', () => {
  test("is the address's card over a saved one", () => {
    expect(chartCardOf(listRouteOf('?card=watchTime'), { chartCard: 'revenue' })).toBe('watchTime')
  })

  test("is the address's card, even when that is the default and another card is saved", () => {
    expect(chartCardOf(listRouteOf('?card=engagedViews'), { chartCard: 'revenue' })).toBe(
      'engagedViews',
    )
  })

  test('is the saved card when the address carries none', () => {
    expect(chartCardOf(defaultRoute, { chartCard: 'revenue' })).toBe('revenue')
  })

  test('is the default, engaged views, with no address value and no saved card', () => {
    expect(chartCardOf(defaultRoute, {})).toBe('engagedViews')
  })
})

describe("the video list's page size", () => {
  test('is the saved size when the address carries none', () => {
    expect(pageSizeOf(defaultRoute, { pageSize: 50 })).toBe(50)
  })

  test('is the default, 10, with no address value and no saved size', () => {
    expect(pageSizeOf(defaultRoute, {})).toBe(10)
  })

  test("is the address's size over a saved one", () => {
    expect(pageSizeOf(listRouteOf('?pageSize=25'), { pageSize: 50 })).toBe(25)
  })

  test("is the address's default size, 10, over a saved one", () => {
    expect(pageSizeOf(listRouteOf('?pageSize=10'), { pageSize: 25 })).toBe(10)
  })
})

describe("the video list's optional columns", () => {
  test('are the saved switches', () => {
    expect(
      listColumnsOf({ viewsColumn: true, watchTimeColumn: false, revenueColumn: false }, true),
    ).toEqual({
      views: true,
      watchTime: false,
      revenue: false,
    })
    expect(
      listColumnsOf({ viewsColumn: false, watchTimeColumn: true, revenueColumn: true }, true),
    ).toEqual({ views: false, watchTime: true, revenue: true })
  })

  test('with nothing saved, are off but revenue, which is on with revenue consent', () => {
    expect(listColumnsOf({}, true)).toEqual({ views: false, watchTime: false, revenue: true })
    expect(listColumnsOf({}, false)).toEqual({ views: false, watchTime: false, revenue: false })
  })

  test('with revenue consent, a saved revenue choice wins over its default', () => {
    expect(listColumnsOf({ revenueColumn: false }, true).revenue).toBe(false)
  })

  test('without revenue consent, revenue is off whatever is saved, and the rest are the saved switches', () => {
    expect(
      listColumnsOf({ viewsColumn: true, watchTimeColumn: true, revenueColumn: true }, false),
    ).toEqual({ views: true, watchTime: true, revenue: false })
  })

  test.each([
    ['views', true, { viewsColumn: true }],
    ['views', false, { viewsColumn: false }],
    ['watchTime', true, { watchTimeColumn: true }],
    ['watchTime', false, { watchTimeColumn: false }],
    ['revenue', true, { revenueColumn: true }],
    ['revenue', false, { revenueColumn: false }],
  ] as const)('switching %s to %s saves only its own preference', (column, on, saved) => {
    expect(columnPreferenceOf(column, on)).toEqual(saved)
  })
})

describe('the revenue source columns', () => {
  test('are hidden with nothing saved', () => {
    expect(revenueSourcesOf({})).toBe(false)
  })

  test('are the saved choice', () => {
    expect(revenueSourcesOf({ revenueSources: true })).toBe(true)
    expect(revenueSourcesOf({ revenueSources: false })).toBe(false)
  })
})

describe('the RPM switch (creator-analytics#357)', () => {
  test('is off with nothing saved', () => {
    expect(rpmAdsAndPremiumOnlyOf({})).toBe(false)
  })

  test('is the saved choice', () => {
    expect(rpmAdsAndPremiumOnlyOf({ rpmAdsAndPremiumOnly: true })).toBe(true)
    expect(rpmAdsAndPremiumOnlyOf({ rpmAdsAndPremiumOnly: false })).toBe(false)
  })
})

describe('the sidebar', () => {
  test('is open with nothing saved', () => {
    expect(sidebarOpenOf({})).toBe(true)
  })

  test('is the saved choice', () => {
    expect(sidebarOpenOf({ sidebarOpen: false })).toBe(false)
    expect(sidebarOpenOf({ sidebarOpen: true })).toBe(true)
  })
})

// The theme (creator-analytics#691). The head script draws the browser's copy before the first
// paint; the server's value wins once the read lands.
describe('the theme on view', () => {
  test('is the copy before the read lands, with nothing changed', () => {
    expect(themeOnViewOf(null, false, 'dark')).toBe('dark')
  })

  test("is the server's once the read lands, over the copy", () => {
    expect(themeOnViewOf(preferencesAfterRead({ theme: 'light' }, null), true, 'dark')).toBe(
      'light',
    )
  })

  test('is System once the read lands with no theme saved, whatever the copy says', () => {
    expect(themeOnViewOf(preferencesAfterRead({ pageSize: 25 }, null), true, 'dark')).toBe('system')
  })

  test('is a change made before the read landed, which is newer than the read', () => {
    expect(themeOnViewOf({ theme: 'light' }, false, 'dark')).toBe('light')
    expect(
      themeOnViewOf(preferencesAfterRead({ theme: 'dark' }, { theme: 'light' }), true, 'dark'),
    ).toBe('light')
  })

  test('is the copy after a failed read, which leaves the server value unknown', () => {
    expect(themeOnViewOf({}, false, 'light')).toBe('light')
  })

  test('is System after a reset', () => {
    expect(themeOnViewOf(preferencesAfterRead({ theme: 'dark' }, {}, true), true, 'dark')).toBe(
      'system',
    )
  })

  test("goes back to the server's after a failed save", () => {
    const confirmed = { theme: 'light' } as const
    const after = preferencesAfterFailedSave({ theme: 'dark' }, { theme: 'dark' }, confirmed)

    expect(themeOnViewOf(after, true, 'light')).toBe('light')
  })

  test('goes back to System after a failed save, when the server held no theme', () => {
    const after = preferencesAfterFailedSave({ theme: 'dark' }, { theme: 'dark' }, {})

    expect(themeOnViewOf(after, true, 'dark')).toBe('system')
  })

  test("goes back to the page's copy after a failed save, when the read failed too", () => {
    const after = preferencesAfterFailedSave({ theme: 'light' }, { theme: 'light' }, {})

    expect(themeOnViewOf(after, false, 'dark')).toBe('dark')
  })
})

describe('the preferences after a save that failed', () => {
  test('put each changed value back to the one the server last confirmed', () => {
    expect(
      preferencesAfterFailedSave(
        { currency: 'EUR', pageSize: 25 },
        { currency: 'EUR' },
        { currency: 'USD', pageSize: 25 },
      ),
    ).toEqual({ currency: 'USD', pageSize: 25 })
  })

  test('drop a changed value the server never held, so it shows its default again', () => {
    expect(
      preferencesAfterFailedSave({ revenueColumn: false }, { revenueColumn: false }, {}),
    ).toEqual({})
  })

  test('keep a value changed again since, which a later save carries', () => {
    expect(
      preferencesAfterFailedSave({ currency: 'JPY' }, { currency: 'EUR' }, { currency: 'USD' }),
    ).toEqual({ currency: 'JPY' })
  })

  test('put the theme back, and leave it when the failed save did not carry it', () => {
    expect(
      preferencesAfterFailedSave({ theme: 'dark' }, { theme: 'dark' }, { theme: 'light' }),
    ).toEqual({ theme: 'light' })
    expect(
      preferencesAfterFailedSave(
        { currency: 'EUR', theme: 'dark' },
        { currency: 'EUR' },
        { currency: 'USD', theme: 'dark' },
      ),
    ).toEqual({ currency: 'USD', theme: 'dark' })
  })
})

describe('the preferences once the first read lands', () => {
  test('are the read, when nothing changed before it', () => {
    expect(preferencesAfterRead({ currency: 'EUR', pageSize: 25 }, null)).toEqual({
      currency: 'EUR',
      pageSize: 25,
    })
  })

  test('keep a value changed before the read landed, which is newer than the read', () => {
    expect(
      preferencesAfterRead({ watchTimeColumn: false, pageSize: 25 }, { watchTimeColumn: true }),
    ).toEqual({ watchTimeColumn: true, pageSize: 25 })
  })

  test('are the values on screen, when a reset was made before it landed', () => {
    expect(
      preferencesAfterRead({ currency: 'EUR', pageSize: 25 }, { viewsColumn: true }, true),
    ).toEqual({ viewsColumn: true })
  })

  test('are none, when a reset was made before it landed and nothing changed since', () => {
    expect(preferencesAfterRead({ currency: 'EUR' }, {}, true)).toEqual({})
  })
})

describe("a failed save's notice once a later save succeeds", () => {
  const failed: FailedSave = { id: 1, address: '', lost: { viewsColumn: true, pageSize: 25 } }

  test('goes when that save carries every key the failed save lost, as a retry does', () => {
    expect(failedSaveAfterSuccessOf(failed, { viewsColumn: true, pageSize: 25 })).toBeNull()
  })

  test('stays when that save carries none of them', () => {
    expect(failedSaveAfterSuccessOf(failed, { currency: 'EUR' })).toBe(failed)
  })

  test('stays, for the rest, when that save carries only some of them', () => {
    expect(failedSaveAfterSuccessOf(failed, { pageSize: 25 })).toEqual({
      id: 1,
      address: '',
      lost: { viewsColumn: true },
    })
  })
})

describe("a failed save's notice once a later save fails too", () => {
  const next: FailedSave = { id: 2, address: '?page=2', lost: { watchTimeColumn: true } }

  test("keeps the earlier notice's lost values beside the later one's, on the later one's number and address", () => {
    const earlier: FailedSave = { id: 1, address: '', lost: { viewsColumn: true, pageSize: 25 } }

    expect(failedSaveAfterFailureOf(earlier, next)).toEqual({
      id: 2,
      address: '?page=2',
      lost: { viewsColumn: true, pageSize: 25, watchTimeColumn: true },
    })
  })

  test("takes the later one's value of a key both lost", () => {
    const earlier: FailedSave = { id: 1, address: '', lost: { watchTimeColumn: false } }

    expect(failedSaveAfterFailureOf(earlier, next).lost).toEqual({ watchTimeColumn: true })
  })

  test('is the later one alone with no earlier notice held', () => {
    expect(failedSaveAfterFailureOf(null, next)).toBe(next)
  })
})

describe('the part of a failed save no later save changed again', () => {
  test('is none when a later save carries the same key, even with the value the failed save had', () => {
    const saves = saveTracker()
    const first = saves.started({ viewsColumn: true })
    saves.started({ viewsColumn: false })
    const third = saves.started({ viewsColumn: true })

    expect(saves.lostOf(first, { viewsColumn: true })).toEqual({})
    expect(saves.lostOf(third, { viewsColumn: true })).toEqual({ viewsColumn: true })
  })

  test('keeps the keys no later save carries', () => {
    const saves = saveTracker()
    const first = saves.started({ viewsColumn: true, pageSize: 25 })
    saves.started({ pageSize: 50 })

    expect(saves.lostOf(first, { viewsColumn: true, pageSize: 25 })).toEqual({ viewsColumn: true })
  })
})

describe('the preferences a save started after a reset carries', () => {
  test('are none when no save started after it', () => {
    const saves = saveTracker()
    saves.started({ currency: 'EUR' })
    const mark = saves.count()

    expect(saves.changedSince(mark, { currency: 'EUR', pageSize: 50 })).toEqual({})
  })

  test("are the keys a later save carries, with the screen's values", () => {
    const saves = saveTracker()
    const mark = saves.count()
    saves.started({ currency: 'EUR' })
    saves.started({ currency: 'JPY' })

    expect(saves.changedSince(mark, { currency: 'JPY', pageSize: 50 })).toEqual({
      currency: 'JPY',
    })
  })

  test('leave out a key saved only before the reset', () => {
    const saves = saveTracker()
    saves.started({ pageSize: 50 })
    const mark = saves.count()
    saves.started({ viewsColumn: true })

    expect(saves.changedSince(mark, { pageSize: 50, viewsColumn: true })).toEqual({
      viewsColumn: true,
    })
  })

  test('keep a key saved before the reset and again after it', () => {
    const saves = saveTracker()
    saves.started({ pageSize: 50 })
    const mark = saves.count()
    saves.started({ pageSize: 25 })

    expect(saves.changedSince(mark, { pageSize: 25 })).toEqual({ pageSize: 25 })
  })
})

describe('the screen after a save of a value the address carries failed', () => {
  // These pin the address's revert; the list's own settling is `routeAfterLostSwitches`'s.
  const readsTheRevertAsIs = (route: Route) => route

  test.each([
    {
      change: { visibility: 'all' },
      route: { ...defaultRoute, visibility: 'all' },
      confirmed: { visibility: 'public' },
      shown: (route: Route, saved: Preferences) => visibilityOf(route, saved),
      expected: 'public',
    },
    {
      change: { chartCard: 'watchTime' },
      route: { ...defaultRoute, chartCard: 'watchTime' },
      confirmed: {},
      shown: (route: Route, saved: Preferences) => chartCardOf(route, saved),
      expected: 'engagedViews',
    },
    {
      change: { chartMode: 'aggregate' },
      route: { ...defaultRoute, chart: 'aggregate' },
      confirmed: { chartMode: 'daily' },
      shown: (route: Route, saved: Preferences) => chartModeOf(route, saved),
      expected: 'daily',
    },
    {
      change: { pageSize: 25 },
      route: { ...defaultRoute, pageSize: 25 },
      confirmed: { pageSize: 50 },
      shown: (route: Route, saved: Preferences) => pageSizeOf(route, saved),
      expected: 50,
    },
  ] as const)(
    'shows the saved $expected again after a failed $change',
    ({ change, route, confirmed, shown, expected }) => {
      const saved = preferencesAfterFailedSave({ ...confirmed, ...change }, change, confirmed)
      expect(shown(routeAfterFailedSave(route, change), saved)).toBe(expected)
    },
  )

  test('keeps an address value changed again since, which a later save carries', () => {
    const route: Route = { ...defaultRoute, visibility: 'public' }
    expect(routeAfterFailedSave(route, { visibility: 'all' })).toBe(route)
  })

  test('replaces the address on view with the reverted one, so Back skips it, and answers the reverted address for the notice', () => {
    const route: Route = { ...defaultRoute, window: 'last7', visibility: 'all' }
    const navigated: [Route, { replace?: boolean } | undefined][] = []

    const failed = revertAddressAfterFailedSave(
      route,
      { visibility: 'all' },
      (next, options) => {
        navigated.push([next, options])
      },
      readsTheRevertAsIs,
    )

    expect(navigated).toEqual([
      [{ page: 1, window: 'last7', sort: '-publishedAt', format: 'all' }, { replace: true }],
    ])
    expect(failed).toBe('?window=last7')
  })

  test('leaves the address alone when the failed change is not in it, and the notice shows on it', () => {
    const navigated: Route[] = []

    const route: Route = { ...defaultRoute, window: 'last7' }

    const failed = revertAddressAfterFailedSave(
      route,
      { currency: 'EUR' },
      (next) => {
        navigated.push(next)
      },
      readsTheRevertAsIs,
    )

    expect(navigated).toEqual([])
    expect(failed).toBe('?window=last7')
  })

  test('the notice shows on the bare list address a failed save reverts to', () => {
    const route: Route = { ...defaultRoute, visibility: 'all' }
    const failed: FailedSave = {
      id: 1,
      address: revertAddressAfterFailedSave(
        route,
        { visibility: 'all' },
        () => {},
        readsTheRevertAsIs,
      ),
      lost: { visibility: 'all' },
    }

    expect(failed.address).toBe('')
    expect(failedSaveOn(failed, '')).toBe(failed)
  })

  test('the notice goes once the address changes from the one it shows on', () => {
    const failed: FailedSave = { id: 1, address: addressOf(defaultRoute), lost: { pageSize: 25 } }
    expect(failedSaveOn(failed, '?page=2')).toBeNull()
  })
})

describe("the video list's visibility", () => {
  test('is the saved visibility when the address carries none', () => {
    expect(visibilityOf(defaultRoute, { visibility: 'all' })).toBe('all')
  })

  test('is the default, public, with no address value and no saved visibility', () => {
    expect(visibilityOf(defaultRoute, {})).toBe('public')
  })

  test("is the address's visibility, even when that is the default and another is saved", () => {
    expect(visibilityOf(listRouteOf('?visibility=public'), { visibility: 'all' })).toBe('public')
  })
})

describe('the queue of preference writes', () => {
  test('starts a write only once the one before it has settled', async () => {
    const queue = writeQueue()
    const started: string[] = []
    const first = Promise.withResolvers<void>()
    queue(() => {
      started.push('aggregate')
      return first.promise
    })
    const second = queue(async () => {
      started.push('daily')
    })
    await new Promise((resolve) => setTimeout(resolve))

    expect(started).toEqual(['aggregate'])
    first.resolve()
    await second
    expect(started).toEqual(['aggregate', 'daily'])
  })

  test('starts the next write after one that failed, and the failed one still rejects', async () => {
    const queue = writeQueue()
    const failed = queue(() => Promise.reject(new Error('The API answered 500')))
    const next = queue(async () => 'daily')

    await expect(failed).rejects.toThrow('The API answered 500')
    await expect(next).resolves.toBe('daily')
  })

  test('settles only once every write queued before it has settled', async () => {
    const queue = writeQueue()
    const write = Promise.withResolvers<void>()
    queue(() => write.promise)
    let settled = false
    const waiting = settledOf(queue)().then(() => {
      settled = true
    })
    await new Promise((resolve) => setTimeout(resolve))

    expect(settled).toBe(false)
    write.resolve()
    await waiting
    expect(settled).toBe(true)
  })

  test('settles after a write that failed', async () => {
    const queue = writeQueue()
    queue(() => Promise.reject(new Error('The API answered 500'))).catch(() => undefined)

    await expect(settledOf(queue)()).resolves.toBeUndefined()
  })
})
