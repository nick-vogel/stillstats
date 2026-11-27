import { describe, expect, test } from 'vitest'
import {
  addressOf,
  defaultRoute,
  historyMoveOf,
  isRouteOnView,
  listRouteOf,
  type Route,
  routeAfterFailedSave,
  routeOf,
  routeToAudience,
  routeToFeedback,
  routeToList,
  routeToRetention,
  routeToSettings,
  routeToSponsorReport,
  routeToUpgrade,
  routeToVideo,
  routeToWhatsNew,
  routeWithChartCard,
  routeWithChartMode,
  routeWithColumnOff,
  routeWithControl,
  routeWithCurves,
  routeWithDetailWindow,
  routeWithFallbackWindow,
  routeWithin,
  routeWithoutPreferences,
  searchOf,
} from './route.ts'

describe('the video list route read from the query string', () => {
  test('with no parameter, is the first page of the last 28 days, newest first, every format, with no chart mode', () => {
    expect(listRouteOf('')).toStrictEqual({
      page: 1,
      window: 'last28',
      sort: '-publishedAt',
      format: 'all',
    })
  })

  test('reads the page', () => {
    expect(listRouteOf('?page=2').page).toBe(2)
  })

  test.each(['?page=0', '?page=-3', '?page=1.5', '?page=two', '?page=', '?page=2e1'])(
    'reads %s as the first page',
    (search) => {
      expect(listRouteOf(search).page).toBe(1)
    },
  )

  test('ignores a parameter it does not know', () => {
    expect(listRouteOf('?connected&page=3')).toEqual({ ...defaultRoute, page: 3 })
  })

  test.each(['first1', 'first28', 'first90', 'first365'])('reads the window %s', (window) => {
    expect(listRouteOf(`?window=${window}`).window).toBe(window)
  })

  test.each(['?window=last30', '?window=', '?window=Lifetime'])(
    'reads %s as the last 28 days',
    (search) => {
      expect(listRouteOf(search).window).toBe('last28')
    },
  )

  test('reads the window lifetime', () => {
    expect(listRouteOf('?window=lifetime').window).toBe('lifetime')
  })

  test.each(['views', '-views', 'publishedAt', '-subscribersGained'])(
    'reads the sort %s',
    (sort) => {
      expect(listRouteOf(`?sort=${sort}`).sort).toBe(sort)
    },
  )

  test.each(['?sort=title', '?sort=--views', '?sort=', '?sort=+views'])(
    'reads %s as newest first',
    (search) => {
      expect(listRouteOf(search).sort).toBe('-publishedAt')
    },
  )

  test.each([
    ['first7', 'averageViewPercentage'],
    ['first7', '-averageViewPercentage'],
    ['first1', '-averageViewPercentage'],
    ['first365', '-averageViewPercentage'],
  ])(
    'reads in %s the sort %s as newest first, since a window after publish has no average viewed',
    (window, sort) => {
      expect(listRouteOf(`?window=${window}&sort=${sort}`).sort).toBe('-publishedAt')
    },
  )

  test('reads a sort by average viewed in a calendar window', () => {
    expect(listRouteOf('?window=last90&sort=-averageViewPercentage').sort).toBe(
      '-averageViewPercentage',
    )
  })

  test('reads the format', () => {
    expect(listRouteOf('?format=short').format).toBe('short')
  })

  test.each(['?format=shorts', '?format=', '?format=Video'])(
    'reads %s as every format',
    (search) => {
      expect(listRouteOf(search).format).toBe('all')
    },
  )

  test('reads the chart mode', () => {
    expect(listRouteOf('?chart=aggregate').chart).toBe('aggregate')
  })

  // No mode in the address leaves the mode to the saved preference, then the default.
  test.each(['?chart=running', '?chart=', '?chart=Aggregate', '?page=2'])(
    'reads %s as no chart mode',
    (search) => {
      expect(listRouteOf(search)).not.toHaveProperty('chart')
    },
  )

  test.each(['engagedViews', 'watchTime', 'revenue', 'rpm'] as const)(
    'reads the chart card %s',
    (card) => {
      expect(listRouteOf(`?card=${card}`).chartCard).toBe(card)
    },
  )

  // No card in the address leaves the card to the saved preference, then the default.
  test.each(['?card=views', '?card=', '?card=Revenue', '?chart=daily'])(
    'reads %s as no chart card, where it reads ?card=watchTime as watch hours',
    (search) => {
      expect(listRouteOf('?card=watchTime').chartCard).toBe('watchTime')
      expect(listRouteOf(search)).not.toHaveProperty('chartCard')
    },
  )

  test.each([10, 25, 50] as const)('reads the page size %i', (pageSize) => {
    expect(listRouteOf(`?pageSize=${pageSize}`).pageSize).toBe(pageSize)
  })

  test.each(['?pageSize=20', '?pageSize=', '?pageSize=025'])(
    'reads %s as no page size',
    (search) => {
      expect(listRouteOf(search)).not.toHaveProperty('pageSize')
    },
  )

  test.each(['public', 'all'] as const)('reads the visibility %s', (visibility) => {
    expect(listRouteOf(`?visibility=${visibility}`).visibility).toBe(visibility)
  })

  test.each(['?visibility=unlisted', '?visibility=', '?visibility=All'])(
    'reads %s as no visibility',
    (search) => {
      expect(listRouteOf(search)).not.toHaveProperty('visibility')
    },
  )

  test('reads the channel', () => {
    expect(listRouteOf('?channel=c-2&page=3')).toStrictEqual({
      ...defaultRoute,
      page: 3,
      channel: 'c-2',
    })
  })

  test('with an empty channel, names no channel', () => {
    expect(listRouteOf('?channel=')).toStrictEqual(defaultRoute)
  })
})

describe('the query string written for a video list route', () => {
  test('is empty for the default route, so /app/ stays the address of the list', () => {
    expect(searchOf(defaultRoute)).toBe('')
  })

  test('carries any other page', () => {
    expect(searchOf({ ...defaultRoute, page: 2 })).toBe('?page=2')
  })

  test('carries each control that is not its default, and leaves out the defaults', () => {
    expect(searchOf({ ...defaultRoute, window: 'last7' })).toBe('?window=last7')
    expect(searchOf({ ...defaultRoute, window: 'lifetime' })).toBe('?window=lifetime')
    expect(searchOf({ ...defaultRoute, window: 'last28' })).toBe('')
    expect(searchOf({ ...defaultRoute, sort: 'views' })).toBe('?sort=views')
    expect(searchOf({ ...defaultRoute, format: 'live' })).toBe('?format=live')
  })

  // An address's mode wins over a saved one, so a daily mode in the address is kept, not dropped.
  test.each(['aggregate', 'daily'] as const)('carries the chart mode %s', (chart) => {
    expect(searchOf({ ...defaultRoute, chart })).toBe(`?chart=${chart}`)
  })

  // An address's card wins over a saved one, so the default card is kept, not dropped.
  test.each(['engagedViews', 'watchTime', 'revenue', 'rpm'] as const)(
    'carries the chart card %s',
    (chartCard) => {
      expect(searchOf({ ...defaultRoute, chartCard })).toBe(`?card=${chartCard}`)
    },
  )

  test('carries the page size, the default, 10, included', () => {
    expect(searchOf({ ...defaultRoute, pageSize: 25 })).toBe('?pageSize=25')
    expect(searchOf({ ...defaultRoute, pageSize: 10 })).toBe('?pageSize=10')
  })

  // An address's visibility wins over a saved one, so a public visibility is kept, not dropped.
  test.each(['all', 'public'] as const)('carries the visibility %s', (visibility) => {
    expect(searchOf({ ...defaultRoute, visibility })).toBe(`?visibility=${visibility}`)
  })

  test('carries the channel, on the default route too', () => {
    expect(searchOf({ ...defaultRoute, channel: 'c-2' })).toBe('?channel=c-2')
  })

  test('reads back a channel with its controls and page as written', () => {
    const route = {
      page: 4,
      window: 'last7',
      sort: 'views',
      format: 'short',
      chart: 'aggregate',
      chartCard: 'watchTime',
      pageSize: 50,
      visibility: 'all',
      channel: 'c-2',
    } as const
    expect(listRouteOf(searchOf(route))).toStrictEqual(route)
  })

  test.each([
    defaultRoute,
    { page: 3, window: 'first7', sort: '-engagedViews', format: 'video', chart: 'daily' },
    { ...defaultRoute, page: 17 },
    { page: 2, window: 'last365', sort: 'averageViewPercentage', format: 'short' },
    { page: 1, window: 'first28', sort: '-subscribersGained', format: 'all' },
  ] as const)('reads back %o as written', (route) => {
    expect(listRouteOf(searchOf(route))).toStrictEqual(route)
  })
})

describe('the query string written back for one the list reads in part', () => {
  test('a sort the window cannot sort by is left out, so the address names the view on screen', () => {
    expect(searchOf(listRouteOf('?window=first7&sort=-averageViewPercentage'))).toBe(
      '?window=first7',
    )
  })

  test('a daily chart mode is kept, so it still wins over a saved mode', () => {
    expect(searchOf(listRouteOf('?chart=daily'))).toBe('?chart=daily')
  })

  test('an unknown value is left out, and the known ones stay', () => {
    const written = new URLSearchParams(searchOf(listRouteOf('?window=last30&format=short&page=2')))
    expect(Object.fromEntries(written)).toEqual({ format: 'short', page: '2' })
  })
})

describe("the address's traffic source and minimum impressions", () => {
  test('round-trip with a sort and a window', () => {
    const search = '?window=first7&sort=-ctr&trafficSource=YT_SEARCH&minImpressions=500'

    expect(listRouteOf(search)).toStrictEqual({
      page: 1,
      window: 'first7',
      sort: '-ctr',
      format: 'all',
      trafficSource: 'YT_SEARCH',
      minImpressions: 500,
    })
    expect(searchOf(listRouteOf(search))).toBe(search)
  })

  test.each([
    '?trafficSource=NEW_SOURCE',
    '?trafficSource=',
    '?minImpressions=0',
    '?minImpressions=-3',
    '?minImpressions=2.5',
    '?minImpressions=abc',
    '?minImpressions=',
  ])('%s reads as no filter, and is left out of the address', (search) => {
    expect(listRouteOf(search)).toStrictEqual(defaultRoute)
    expect(searchOf(listRouteOf(search))).toBe('')
  })

  test.each([{ trafficSource: 'RELATED_VIDEO' }, { minImpressions: 250 }] as const)(
    'a change to %o returns to the first page and keeps the other controls',
    (change) => {
      const route = { ...defaultRoute, page: 3, sort: 'ctr', trafficSource: 'YT_SEARCH' } as const

      expect(routeWithControl(route, change)).toStrictEqual({ ...route, ...change, page: 1 })
    },
  )

  test('All sources and a cleared minimum drop their keys from the route and the address', () => {
    const route = {
      ...defaultRoute,
      page: 2,
      trafficSource: 'YT_SEARCH',
      minImpressions: 500,
    } as const

    const cleared = routeWithControl(routeWithControl(route, { trafficSource: undefined }), {
      minImpressions: undefined,
    })

    expect(cleared).toStrictEqual(defaultRoute)
    expect(searchOf(cleared)).toBe('')
  })

  test("a window change and the detail screen's window change keep both", () => {
    const route = { ...defaultRoute, trafficSource: 'YT_SEARCH', minImpressions: 500 } as const

    expect(routeWithControl(route, { window: 'last7' })).toMatchObject({
      trafficSource: 'YT_SEARCH',
      minImpressions: 500,
    })
    expect(routeWithDetailWindow(route, { window: 'first7' })).toMatchObject({
      trafficSource: 'YT_SEARCH',
      minImpressions: 500,
    })
  })
})

describe('the route on the pages of a list', () => {
  const route = { ...defaultRoute, window: 'last90', format: 'short' } as const

  test('a page past the last page moves to the last page, and keeps the controls', () => {
    expect(routeWithin({ ...route, page: 9 }, 2)).toEqual({ ...route, page: 2 })
  })

  test('a page past the last page keeps the channel', () => {
    expect(routeWithin({ ...route, page: 9, channel: 'c-2' }, 2)).toStrictEqual({
      ...route,
      page: 2,
      channel: 'c-2',
    })
  })

  test('a page on the list stays', () => {
    expect(routeWithin({ ...route, page: 2 }, 2)).toEqual({ ...route, page: 2 })
  })

  test('a list with no pages stays on its page, so it shows it has no uploads', () => {
    expect(routeWithin({ ...route, page: 3 }, 0)).toEqual({ ...route, page: 3 })
  })
})

describe('the route after a control changes', () => {
  const route = {
    page: 4,
    window: 'last90',
    sort: 'views',
    format: 'short',
  } as const

  test.each([{ window: 'last7' }, { sort: '-engagedViews' }, { format: 'live' }] as const)(
    'a change to %o returns to the first page and keeps the other controls',
    (change) => {
      expect(routeWithControl(route, change)).toEqual({ ...route, ...change, page: 1 })
    },
  )

  test('a change keeps the channel', () => {
    expect(routeWithControl({ ...route, channel: 'c-2' }, { window: 'last7' }).channel).toBe('c-2')
  })

  test.each([10, 25] as const)(
    'a page size change keeps the chosen size %i in the route, the default included',
    (pageSize) => {
      expect(routeWithControl({ ...route, pageSize: 50 }, { pageSize })).toStrictEqual({
        page: 1,
        window: 'last90',
        sort: 'views',
        format: 'short',
        pageSize,
      })
    },
  )

  test('a window change from a custom range keeps the page size and the visibility, and drops the range', () => {
    const range = { from: '2026-09-01', to: '2026-09-30' }
    const custom: Route = { ...route, pageSize: 25, visibility: 'all', window: 'custom', range }

    expect(routeWithControl(custom, { window: 'last7' })).toStrictEqual({
      page: 1,
      window: 'last7',
      sort: 'views',
      format: 'short',
      pageSize: 25,
      visibility: 'all',
    })
  })

  test.each(['averageViewPercentage', '-averageViewPercentage'] as const)(
    'a move to a window after publish from the sort %s sorts newest first',
    (sort) => {
      expect(routeWithControl({ ...route, sort }, { window: 'first7' })).toEqual({
        ...route,
        page: 1,
        window: 'first7',
        sort: '-publishedAt',
      })
    },
  )
})

describe("the route after the detail screen's window changes", () => {
  const route = {
    page: 4,
    window: 'last90',
    sort: 'views',
    format: 'short',
    channel: 'c-2',
  } as const

  test('keeps the page, sort, format and channel, so the link back returns to the same page', () => {
    expect(routeWithDetailWindow(route, { window: 'last7' })).toStrictEqual({
      ...route,
      window: 'last7',
    })
  })

  test.each(['averageViewPercentage', '-averageViewPercentage'] as const)(
    'a move to a window after publish from the sort %s sorts newest first, on the same page',
    (sort) => {
      expect(routeWithDetailWindow({ ...route, sort }, { window: 'first7' })).toStrictEqual({
        ...route,
        window: 'first7',
        sort: '-publishedAt',
      })
    },
  )

  test('keeps the video', () => {
    expect(
      routeWithDetailWindow({ ...route, video: 'dQw4w9WgXcQ' }, { window: 'lifetime' }).video,
    ).toBe('dQw4w9WgXcQ')
  })
})

describe('the route after the chart mode changes', () => {
  const route = { ...defaultRoute, page: 4, window: 'last90', channel: 'c-2' } as const

  test('keeps the page and every control, on the list', () => {
    expect(routeWithChartMode(route, 'aggregate')).toStrictEqual({ ...route, chart: 'aggregate' })
  })

  test('keeps the video, on its detail screen', () => {
    expect(routeWithChartMode({ ...route, video: 'dQw4w9WgXcQ' }, 'aggregate').video).toBe(
      'dQw4w9WgXcQ',
    )
  })
})

describe('the route after a card chooses the chart', () => {
  const route = {
    ...defaultRoute,
    page: 4,
    window: 'last90',
    channel: 'c-2',
    chart: 'aggregate',
  } as const

  test('keeps the page, the chart mode and every control, on the list', () => {
    expect(routeWithChartCard(route, 'revenue')).toStrictEqual({ ...route, chartCard: 'revenue' })
  })

  test('keeps the video, on its detail screen', () => {
    expect(routeWithChartCard({ ...route, video: 'dQw4w9WgXcQ' }, 'watchTime').video).toBe(
      'dQw4w9WgXcQ',
    )
  })
})

describe('the route after a column is switched off', () => {
  const route = {
    ...defaultRoute,
    page: 3,
    window: 'last90',
    format: 'short',
    pageSize: 25,
    visibility: 'all',
    channel: 'c-2',
  } as const

  test.each(['-views', 'views'] as const)(
    'switching off views while the list is sorted by %s sorts newest first from page 1, and keeps the rest',
    (sort) => {
      expect(routeWithColumnOff({ ...route, sort }, 'views')).toStrictEqual({
        ...route,
        sort: '-publishedAt',
        page: 1,
      })
    },
  )

  test.each(['-estimatedMinutesWatched', 'estimatedMinutesWatched'] as const)(
    'switching off watch hours while the list is sorted by %s sorts newest first from page 1',
    (sort) => {
      expect(routeWithColumnOff({ ...route, sort }, 'estimatedMinutesWatched')).toStrictEqual({
        ...route,
        sort: '-publishedAt',
        page: 1,
      })
    },
  )

  test.each(['views', 'estimatedMinutesWatched'] as const)(
    'switching off %s while the list is sorted by another column leaves the route as it was',
    (key) => {
      const sorted = { ...route, sort: '-engagedViews' } as const
      expect(routeWithColumnOff(sorted, key)).toBe(sorted)
    },
  )
})

describe('the route after a reset of the preferences', () => {
  test('drops the chart mode, chart card, page size and visibility, so each shows its default, and keeps the rest', () => {
    const route = routeOf(
      'settings',
      '?channel=c-2&window=last90&page=3&chart=aggregate&card=revenue&pageSize=25&visibility=all',
    )

    expect(route.chartCard).toBe('revenue')
    expect(routeWithoutPreferences(route)).toStrictEqual({
      ...defaultRoute,
      channel: 'c-2',
      window: 'last90',
      page: 3,
      settings: true,
    })
  })
})

describe('the detail route read from the path', () => {
  test('a video path opens the video, with the list route of its query string', () => {
    expect(routeOf('videos/dQw4w9WgXcQ', '?window=last90&page=2')).toEqual({
      ...defaultRoute,
      window: 'last90',
      page: 2,
      video: 'dQw4w9WgXcQ',
    })
  })

  test.each(['', 'videos', 'videos/', 'videos/a/b', 'videos/%E0%A4%A', 'channels/c-1'])(
    'the path %o opens the list',
    (path) => {
      expect(routeOf(path, '')).toEqual(defaultRoute)
    },
  )
})

describe('the address written for a route', () => {
  test("a video's address is its path, then the list route's query string", () => {
    expect(addressOf({ ...defaultRoute, window: 'first7', video: 'dQw4w9WgXcQ' })).toBe(
      'videos/dQw4w9WgXcQ?window=first7',
    )
  })

  test.each([
    ['a video', { video: 'dQw4w9WgXcQ' }],
    ['Settings', { settings: true }],
    ['the Audience screen', { audience: true }],
    ['the "What\'s new" screen', { whatsNew: true }],
    ['the upgrade screen', { upgrade: true }],
  ] as const)('reads back a route to %s as written', (_screen, screen) => {
    const route = {
      page: 3,
      window: 'last90',
      sort: 'views',
      format: 'short',
      chart: 'aggregate',
      channel: 'c-2',
      ...screen,
    } as const
    const [path = '', search = ''] = addressOf(route).split(/(?=\?)/)

    expect(routeOf(path, search)).toEqual(route)
  })
})

describe("the detail screen's link back to the list", () => {
  test('keeps the channel, window, sort, format, page, chart mode and chart card, and opens no video', () => {
    const detail = routeOf(
      'videos/dQw4w9WgXcQ',
      '?channel=c-2&window=last90&sort=views&format=short&page=3&chart=aggregate&card=revenue',
    )

    expect(addressOf(routeToList(detail))).toBe(
      '?channel=c-2&window=last90&sort=views&format=short&page=3&chart=aggregate&card=revenue',
    )
  })
})

describe('the Settings route read from the path', () => {
  test('the settings path opens Settings, with the list route of its query string', () => {
    expect(routeOf('settings', '?channel=c-2&window=last90&page=2')).toEqual({
      ...defaultRoute,
      channel: 'c-2',
      window: 'last90',
      page: 2,
      settings: true,
    })
  })

  // creator-analytics#589: the screen was the profile at /app/profile, and Stripe's Payment Link
  // still returns there. The old path opens Settings, and the address read from it is rewritten.
  test.each(['', '?channel=c-2&window=last90&page=2', '?support=thanks'])(
    'the old profile path, with the query %o, opens Settings as the settings path does',
    (search) => {
      expect(routeOf('profile', search)).toStrictEqual(routeOf('settings', search))
    },
  )

  test.each([
    ['settings', { ...defaultRoute, settings: true }],
    ['profile', { ...defaultRoute, settings: true }],
    ['settings/', defaultRoute],
    ['settings/x', defaultRoute],
    ['profile/', defaultRoute],
    ['profiles', defaultRoute],
    ['Settings', defaultRoute],
    ['Profile', defaultRoute],
    ['videos/settings', { ...defaultRoute, video: 'settings' }],
  ])(
    'the path %o opens Settings only if it is the settings or profile path exactly',
    (path, route) => {
      expect(routeOf(path, '')).toStrictEqual(route)
    },
  )
})

describe('the address written for the Settings route', () => {
  test("is the settings path, then the list route's query string", () => {
    expect(addressOf({ ...defaultRoute, sort: 'views', settings: true })).toBe(
      'settings?sort=views',
    )
  })

  test('read from the old profile path, is the settings path with the same query', () => {
    expect(addressOf(routeOf('profile', '?channel=c-2&window=last90'))).toBe(
      'settings?channel=c-2&window=last90',
    )
  })
})

describe('the route to Settings', () => {
  test("from a video's detail screen, opens Settings and no video, and keeps the list route", () => {
    const detail = routeOf('videos/dQw4w9WgXcQ', '?channel=c-2&window=last90&sort=views&page=3')

    expect(routeToSettings(detail)).toStrictEqual({
      ...defaultRoute,
      channel: 'c-2',
      window: 'last90',
      sort: 'views',
      page: 3,
      settings: true,
    })
  })
})

describe("the wordmark's link back to the list from Settings", () => {
  test('keeps the channel, window, sort, format, page and chart mode, and opens no Settings', () => {
    const list = {
      page: 3,
      window: 'last90',
      sort: 'views',
      format: 'short',
      chart: 'aggregate',
      channel: 'c-2',
    } as const

    expect(routeToList({ ...list, settings: true })).toStrictEqual(list)
  })
})

describe("the account menu's link to Settings", () => {
  test('from Settings, leads to the route on view', () => {
    const settings = routeOf('settings', '?channel=c-2&window=last90&page=3')

    expect(isRouteOnView(routeToSettings(settings), settings)).toBe(true)
  })

  test.each([
    ['', '?channel=c-2'],
    ['videos/dQw4w9WgXcQ', '?channel=c-2'],
  ])('from the path %o, leads to another route', (path, search) => {
    const current = routeOf(path, search)

    expect(isRouteOnView(routeToSettings(current), current)).toBe(false)
  })
})

describe('the Audience route read from the path', () => {
  test('the audience path opens the Audience screen, with the list route of its query string', () => {
    expect(routeOf('audience', '?channel=c-2&window=last90&format=short&page=2')).toStrictEqual({
      ...defaultRoute,
      channel: 'c-2',
      window: 'last90',
      format: 'short',
      page: 2,
      audience: true,
    })
  })

  test.each(['audience/', 'audience/x', 'audiences', 'Audience', 'settings/audience'])(
    'the path %o opens the list',
    (path) => {
      expect(routeOf(path, '')).toStrictEqual(defaultRoute)
    },
  )

  test('a window after publish in its query reads as the last 28 days, so the address is written back without it', () => {
    const route = routeOf('audience', '?window=first7&sort=-averageViewPercentage&page=3')

    expect(route).toStrictEqual({ ...defaultRoute, audience: true })
    expect(addressOf(route)).toBe('audience')
  })

  test('lifetime in its query reads as the last 28 days on the first page, so the address is written back without it', () => {
    const route = routeOf('audience', '?window=lifetime&page=3')

    expect(route).toStrictEqual({ ...defaultRoute, audience: true })
    expect(addressOf(route)).toBe('audience')
  })
})

describe('the route to the Audience screen', () => {
  test('keeps the channel, window, format, sort, page and chart choices, and opens no video', () => {
    const detail = routeOf(
      'videos/dQw4w9WgXcQ',
      '?channel=c-2&window=last90&format=short&sort=views&page=2&chart=aggregate',
    )

    expect(addressOf(routeToAudience(detail))).toBe(
      'audience?channel=c-2&window=last90&sort=views&format=short&page=2&chart=aggregate',
    )
  })

  test.each(['first7', 'lifetime'] as const)(
    "from the window %o, takes the last 28 days on the first page, and keeps the list's window",
    (window) => {
      const list = routeOf('', `?channel=c-2&window=${window}&format=short&sort=views&page=2`)

      expect(routeToAudience(list)).toStrictEqual({
        ...defaultRoute,
        channel: 'c-2',
        format: 'short',
        sort: 'views',
        audience: true,
        listWindow: { window },
      })
    },
  )

  test('the link back to the list leaves the Audience screen and keeps its query', () => {
    const audience = routeOf('audience', '?channel=c-2&window=last90&sort=views&page=2')

    expect(addressOf(routeToList(audience))).toBe('?channel=c-2&window=last90&sort=views&page=2')
  })
})

describe("the list's window after the retention comparison and the Audience screen (creator-analytics#1049)", () => {
  const listSearches = [
    '?channel=c-2&window=last90&format=short',
    '?channel=c-2&window=first7&sort=views',
    '?channel=c-2&window=lifetime',
    '?channel=c-2',
    '?channel=c-2&window=custom&from=2026-09-01&to=2026-09-30',
  ]

  test.each(listSearches)(
    'the "Videos" link from the retention comparison returns to the list of %o',
    (search) => {
      const retention = routeWithCurves(routeToRetention(routeOf('', search)), ['a'])

      expect(addressOf(routeToList(retention))).toBe(search)
    },
  )

  test.each(listSearches)(
    'the "Videos" link from the Audience screen returns to the list of %o',
    (search) => {
      expect(addressOf(routeToList(routeToAudience(routeOf('', search))))).toBe(search)
    },
  )

  test.each(listSearches)(
    "the address of either screen opened from the list of %o holds the list's window",
    (search) => {
      for (const screen of [routeToRetention, routeToAudience]) {
        const [path = '', query = ''] = addressOf(screen(routeOf('', search))).split('?')
        const reloaded = routeOf(path, query ? `?${query}` : '')

        expect(addressOf(routeToList(reloaded))).toBe(search)
      }
    },
  )

  test('a window chosen on the Audience screen stays there, and the list keeps its own', () => {
    const audience = routeToAudience(routeOf('', '?channel=c-2&window=last90'))
    const changed = routeWithControl(routeWithControl(audience, { window: 'last7' }), {
      window: 'custom',
      range: { from: '2026-09-01', to: '2026-09-30' },
    })

    expect(addressOf(changed)).toBe(
      'audience?channel=c-2&window=custom&from=2026-09-01&to=2026-09-30&listWindow=last90',
    )
    expect(addressOf(routeToList(changed))).toBe('?channel=c-2&window=last90')
    expect(addressOf(routeToSettings(changed))).toBe('settings?channel=c-2&window=last90')
    expect(addressOf(routeWithControl(changed, { window: 'last90' }))).toBe(
      'audience?channel=c-2&window=last90',
    )
  })

  test("a sort the list's window cannot sort by, chosen on the retention comparison, is newest first back on the list", () => {
    const retention = routeToRetention(routeOf('', '?channel=c-2&window=first7'))
    const sorted = routeWithControl(retention, { sort: '-averageViewPercentage' })

    expect(addressOf(routeToList(sorted))).toBe('?channel=c-2&window=first7')
  })

  test('a custom range the API refused on the Audience screen falls back on the list too, when the list shares it', () => {
    const range = { from: '2026-01-01', to: '2026-01-31' }
    const audience = routeToAudience(
      routeOf('', `?window=custom&from=${range.from}&to=${range.to}`),
    )
    const chosen = routeWithControl(routeToAudience(routeOf('', '?window=last90')), {
      window: 'custom',
      range,
    })

    expect(addressOf(routeToList(routeWithFallbackWindow(audience)))).toBe('')
    expect(addressOf(routeToList(routeWithFallbackWindow(chosen)))).toBe('?window=last90')
  })

  test("an address's list window that is malformed is the default window", () => {
    expect(
      addressOf(routeToList(routeOf('retention', '?window=lifetime&listWindow=custom&listFrom=x'))),
    ).toBe('')
    expect(addressOf(routeToList(routeOf('audience', '?window=last7&listWindow=nonsense')))).toBe(
      '',
    )
  })
})

describe('the retention comparison route (creator-analytics#951)', () => {
  test('reads its path, and its picks in order from the curves key, comma-separated', () => {
    const route = routeOf('retention', '?window=lifetime&curves=b,a')

    expect(route).toMatchObject({ retention: true, curves: ['b', 'a'] })
    expect(addressOf(route)).toBe('retention?window=lifetime&curves=b,a')
  })

  test('drops a malformed id, a repeat, and any pick past the fifth', () => {
    expect(routeOf('retention', '?window=lifetime&curves=a,b%3Bc,,a,c,d,e,f,g').curves).toEqual([
      'a',
      'c',
      'd',
      'e',
      'f',
    ])
    expect(routeOf('retention', '?window=lifetime&curves=').curves).toBeUndefined()
  })

  test('reads curves on the retention comparison alone, and writes them nowhere else', () => {
    expect(routeOf('', '?curves=a,b').curves).toBeUndefined()
    expect(routeOf('audience', '?curves=a,b').curves).toBeUndefined()
    expect(searchOf({ ...defaultRoute, curves: ['a'] })).toBe('')
    expect(searchOf({ ...defaultRoute, retention: true, curves: ['a'] })).toBe('?curves=a')
  })

  test('holds the lifetime window the stored curves cover: another moves there from the first page, the range dropped, the rest kept', () => {
    expect(
      addressOf(
        routeOf('retention', '?window=custom&from=2026-09-01&to=2026-09-30&page=3&format=short'),
      ),
    ).toBe('retention?window=lifetime&format=short')
    expect(addressOf(routeOf('retention', '?window=lifetime&page=3'))).toBe(
      'retention?window=lifetime&page=3',
    )
  })

  test("from the list, keeps the list's channel, window, sort and format with no pick, and the list's links drop the screen and its picks", () => {
    const list = routeOf('', '?channel=c-2&window=last90&sort=-averageViewPercentage&format=video')
    const retention = routeWithCurves(routeToRetention(list), ['a', 'b'])

    expect(addressOf(retention)).toBe(
      'retention?channel=c-2&window=lifetime&sort=-averageViewPercentage&format=video&listWindow=last90&curves=a,b',
    )
    expect(addressOf(routeToRetention(retention))).toBe(
      'retention?channel=c-2&window=lifetime&sort=-averageViewPercentage&format=video&listWindow=last90',
    )
    expect(addressOf(routeToList(retention))).toBe(
      '?channel=c-2&window=last90&sort=-averageViewPercentage&format=video',
    )
    expect(addressOf(routeToSettings(retention))).toBe(
      'settings?channel=c-2&window=last90&sort=-averageViewPercentage&format=video',
    )
  })

  test('a control change keeps the picks, from the first page; clearing every pick drops the key', () => {
    const retention = routeOf('retention', '?window=lifetime&page=2&curves=a,b')

    expect(addressOf(routeWithControl(retention, { format: 'short' }))).toBe(
      'retention?window=lifetime&format=short&curves=a,b',
    )
    expect(addressOf(routeWithCurves(retention, []))).toBe('retention?window=lifetime&page=2')
  })

  test('the feedback form opened from it names the video list, the default screen', () => {
    const retention = routeOf('retention', '?window=lifetime')

    expect(retention.retention).toBe(true)
    expect(routeToFeedback(retention).feedback).toBe('video_list')
  })
})

describe('the history move for a navigation', () => {
  const list = routeOf('', '?channel=c-2&page=3')

  test("to the route on view takes the current entry's place, so Back leaves the screen", () => {
    expect(historyMoveOf(list, routeToList(list))).toBe('replace')
  })

  test('to another route adds an entry', () => {
    expect(historyMoveOf(list, routeToSettings(list))).toBe('push')
  })

  test("asked to replace, takes the current entry's place", () => {
    expect(historyMoveOf(list, routeToSettings(list), { replace: true })).toBe('replace')
  })
})

describe('a custom range in the address', () => {
  const range = { from: '2026-09-01', to: '2026-09-30' }
  const custom: Route = { ...defaultRoute, window: 'custom', range }
  const customSearch = '?window=custom&from=2026-09-01&to=2026-09-30'

  test('is read with its days', () => {
    expect(listRouteOf('?window=custom&from=2026-09-01&to=2026-09-30')).toStrictEqual(custom)
  })

  test('of one day is read', () => {
    expect(listRouteOf('?window=custom&from=2026-09-01&to=2026-09-01').range).toEqual({
      from: '2026-09-01',
      to: '2026-09-01',
    })
  })

  test('is written with its days after the window, and read back the same', () => {
    const written = searchOf({ ...custom, sort: 'views', page: 2 })
    expect(written).toBe('?window=custom&from=2026-09-01&to=2026-09-30&sort=views&page=2')
    expect(listRouteOf(written)).toStrictEqual({ ...custom, sort: 'views', page: 2 })
  })

  // Each bad range beside the good one it is one change from, so the pair holds only where the
  // address reads a custom range at all, and not where every custom window is the default.
  test.each([
    ['?window=custom', customSearch],
    ['?window=custom&from=2026-09-01', customSearch],
    ['?window=custom&to=2026-09-30', customSearch],
    [
      '?window=custom&from=2026-02-30&to=2026-03-02',
      '?window=custom&from=2026-02-28&to=2026-03-02',
    ],
    ['?window=custom&from=yesterday&to=2026-09-30', customSearch],
    [
      '?window=custom&from=2026-09-30&to=2026-09-29',
      '?window=custom&from=2026-09-29&to=2026-09-30',
    ],
  ])(
    'that is bad, %s, falls back to the last 28 days with no range, where %s is read',
    (bad, good) => {
      expect([listRouteOf(bad), searchOf(listRouteOf(good))]).toStrictEqual([defaultRoute, good])
    },
  )

  test('a start and an end are kept with a custom window and dropped with any other', () => {
    expect(searchOf(listRouteOf(customSearch))).toBe(customSearch)
    const route = listRouteOf('?window=last90&from=2026-09-01&to=2026-09-30')
    expect(route).toStrictEqual({ ...defaultRoute, window: 'last90' })
    expect(searchOf(route)).toBe('?window=last90')
  })

  test.each(['averageViewPercentage', '-views', 'estimatedRevenue'])(
    'allows the sort %s, as every calendar window does',
    (sort) => {
      expect(
        listRouteOf(`?window=custom&from=2026-09-01&to=2026-09-30&sort=${sort}`),
      ).toStrictEqual({ ...custom, sort })
    },
  )

  test("is kept in the address when a video opens, and on the detail screen's link back", () => {
    const detail = routeToVideo(custom, 'dQw4w9WgXcQ')
    expect(addressOf(detail)).toBe(`videos/dQw4w9WgXcQ${customSearch}`)
    expect(addressOf(routeToList(detail))).toBe(customSearch)
  })

  test('is kept in the address by a reset of the preferences and a failed save, as it is never a preference', () => {
    expect(searchOf(routeWithoutPreferences({ ...custom, chart: 'daily' }))).toBe(customSearch)
    expect(searchOf(routeAfterFailedSave({ ...custom, pageSize: 25 }, { pageSize: 25 }))).toBe(
      customSearch,
    )
  })
})

describe('the route after a custom range is applied or left', () => {
  const range = { from: '2026-09-01', to: '2026-09-30' }
  const list: Route = { ...defaultRoute, page: 3, window: 'last90', sort: 'views' }

  test('on the list, moves the address to the range on the first page', () => {
    expect(searchOf(routeWithControl(list, { window: 'custom', range }))).toBe(
      '?window=custom&from=2026-09-01&to=2026-09-30&sort=views',
    )
  })

  test('on the detail screen, moves to the range and keeps the page', () => {
    const detail = { ...list, video: 'v-1' }
    expect(routeWithDetailWindow(detail, { window: 'custom', range })).toStrictEqual({
      ...detail,
      window: 'custom',
      range,
    })
  })

  test('a move to any other window drops the range, on the list and the detail screen', () => {
    const custom: Route = { ...list, window: 'custom', range }
    expect(routeWithControl(custom, { window: 'last7' })).toStrictEqual({
      ...list,
      window: 'last7',
      page: 1,
    })
    expect(routeWithDetailWindow({ ...custom, video: 'v-1' }, { window: 'first7' })).toStrictEqual({
      ...list,
      window: 'first7',
      sort: 'views',
      video: 'v-1',
    })
  })

  test('a fallback moves the list to the last 28 days with no range, on the first page', () => {
    expect(routeWithFallbackWindow({ ...list, window: 'custom', range })).toStrictEqual({
      ...list,
      window: 'last28',
      page: 1,
    })
  })

  test('a fallback on the detail screen keeps its page', () => {
    expect(
      routeWithFallbackWindow({ ...list, window: 'custom', range, video: 'v-1' }),
    ).toStrictEqual({ ...list, window: 'last28', video: 'v-1' })
  })
})

describe('the "What\'s new" route (creator-analytics#577)', () => {
  test('the whats-new path opens the screen with the list route of its query string, and the address reads back to itself', () => {
    const route = routeOf('whats-new', '?channel=c-2&window=last90&page=2')

    expect(route).toStrictEqual({
      ...defaultRoute,
      channel: 'c-2',
      window: 'last90',
      page: 2,
      whatsNew: true,
    })
    expect(addressOf(route)).toBe('whats-new?channel=c-2&window=last90&page=2')
  })

  test.each([
    ['whats-new', { ...defaultRoute, whatsNew: true }],
    ['whats-new/', defaultRoute],
    ['whats-new/x', defaultRoute],
    ['whatsnew', defaultRoute],
    ["what's-new", defaultRoute],
    ['settings/whats-new', defaultRoute],
  ])('the path %o opens the screen only if it is the whats-new path exactly', (path, route) => {
    expect(routeOf(path, '')).toStrictEqual(route)
  })

  test("from a video's detail screen, the Audience screen and Settings, keeps the list route and opens no other screen", () => {
    for (const path of ['videos/dQw4w9WgXcQ', 'audience', 'settings']) {
      expect(addressOf(routeToWhatsNew(routeOf(path, '?channel=c-2&window=last90&page=3')))).toBe(
        'whats-new?channel=c-2&window=last90&page=3',
      )
    }
  })

  test('the list, Settings and the Audience screen from it drop the screen and keep the query', () => {
    const whatsNew = routeOf('whats-new', '?channel=c-2&window=last90&page=3')

    expect(addressOf(routeToList(whatsNew))).toBe('?channel=c-2&window=last90&page=3')
    expect(addressOf(routeToSettings(whatsNew))).toBe('settings?channel=c-2&window=last90&page=3')
    expect(addressOf(routeToAudience(whatsNew))).toBe('audience?channel=c-2&window=last90&page=3')
  })

  test('from the screen, its own link leads to the route on view', () => {
    const whatsNew = routeOf('whats-new', '?window=last90')

    expect(isRouteOnView(routeToWhatsNew(whatsNew), whatsNew)).toBe(true)
  })
})

describe('the upgrade route (creator-analytics#788)', () => {
  test('the upgrade path opens the screen keeping the list route of its query string, and the list from it drops only the screen', () => {
    const upgrade = routeToUpgrade(
      routeOf('videos/dQw4w9WgXcQ', '?channel=c-2&window=first7&page=3'),
    )

    expect(addressOf(upgrade)).toBe('upgrade?channel=c-2&window=first7&page=3')
    expect(routeOf('upgrade', '?channel=c-2&window=first7&page=3')).toStrictEqual(upgrade)
    expect(addressOf(routeToList(upgrade))).toBe('?channel=c-2&window=first7&page=3')
  })
})

describe('the feedback route', () => {
  test.each([
    ['the video list', '', '', 'video_list'],
    ["a video's detail", 'videos/dQw4w9WgXcQ', '', 'video_detail'],
    ['the Audience screen', 'audience', '', 'audience'],
    ['Settings', 'settings', '', 'settings'],
    ['the "What\'s new" screen', 'whats-new', '', 'whats_new'],
    ['the form itself, opened from Audience', 'feedback', '?screen=audience', 'audience'],
    ['the extension popup', 'feedback', '?screen=extension', 'extension'],
  ] as const)('opened from %s, names that screen', (_, path, search, screen) => {
    expect(routeToFeedback(routeOf(path, search)).feedback).toBe(screen)
  })

  test("opened from the extension popup's link, writes its address back as the popup opened it", () => {
    expect(addressOf(routeOf('feedback', '?screen=extension'))).toBe('feedback?screen=extension')
  })

  test("keeps the list's route, so the link back returns to the same view of the list", () => {
    const detail = routeOf('videos/dQw4w9WgXcQ', '?channel=c-2&window=last90&sort=views&page=3')

    const feedback = routeToFeedback(detail)

    expect(addressOf(feedback)).toBe(
      'feedback?channel=c-2&window=last90&sort=views&page=3&screen=video_detail',
    )
    expect(addressOf(routeToList(feedback))).toBe('?channel=c-2&window=last90&sort=views&page=3')
  })

  test('is read back as written, a custom range included', () => {
    const route: Route = {
      ...defaultRoute,
      window: 'custom',
      range: { from: '2026-09-01', to: '2026-09-30' },
      feedback: 'settings',
    }
    const [path = '', search = ''] = addressOf(route).split(/(?=\?)/)

    expect(routeOf(path, search)).toStrictEqual(route)
  })

  test.each(['', '?screen=/app/videos/abc', '?screen=VIDEO_LIST'])(
    'with the query %o, names the video list, and writes no screen back',
    (search) => {
      const route = routeOf('feedback', search)

      expect(route.feedback).toBe('video_list')
      expect(addressOf(route)).toBe('feedback')
    },
  )
})

describe('the admin feedback route (creator-analytics#583)', () => {
  test("the admin/feedback path opens the admin screen, with the list's route of its query", () => {
    const route = routeOf('admin/feedback', '?channel=c-2&window=last90&page=3')

    expect(route).toStrictEqual({
      ...defaultRoute,
      window: 'last90',
      page: 3,
      channel: 'c-2',
      adminFeedback: true,
    })
    expect(addressOf(route)).toBe('admin/feedback?channel=c-2&window=last90&page=3')
  })

  test('is read back as written', () => {
    const route: Route = { ...defaultRoute, window: 'last7', adminFeedback: true }
    const [path = '', search = ''] = addressOf(route).split(/(?=\?)/)

    expect(path).toBe('admin/feedback')
    expect(routeOf(path, search)).toStrictEqual(route)
  })

  test.each(['admin', 'admin/', 'admin/feedback/', 'admin/users'])(
    'the path %o is no admin screen',
    (path) => {
      expect(routeOf(path, '').adminFeedback).toBeUndefined()
    },
  )

  test("the link back to the list keeps the list's route and leaves the admin screen", () => {
    const route = routeOf('admin/feedback', '?window=last90&sort=views')

    expect(addressOf(routeToList(route))).toBe('?window=last90&sort=views')
  })

  test('the feedback form opened from it names the video list', () => {
    expect(addressOf(routeToFeedback(routeOf('admin/feedback', '?window=last90')))).toBe(
      'feedback?window=last90',
    )
  })
})

describe('the sponsor report route (creator-analytics#956)', () => {
  test("a video's sponsor report path opens the report of that video, keeping the list route of its query string", () => {
    expect(
      routeOf('videos/dQw4w9WgXcQ/sponsor-report', '?channel=c-2&window=last90&page=2'),
    ).toEqual({
      ...defaultRoute,
      channel: 'c-2',
      window: 'last90',
      page: 2,
      video: 'dQw4w9WgXcQ',
      sponsorReport: true,
    })
  })

  test('the route to it from the detail screen writes its path, then the list route, and is read back as written', () => {
    const detail = routeOf('videos/dQw4w9WgXcQ', '?channel=c-2&window=first7&sort=views&page=3')

    const report = routeToSponsorReport(detail, 'dQw4w9WgXcQ')

    expect(addressOf(report)).toBe(
      'videos/dQw4w9WgXcQ/sponsor-report?channel=c-2&window=first7&sort=views&page=3',
    )
    const [path = '', search = ''] = addressOf(report).split(/(?=\?)/)
    expect(routeOf(path, search)).toStrictEqual(report)
  })

  test('"Back to video" returns to the same detail screen, and the list from the report drops the video too', () => {
    const report = routeOf(
      'videos/dQw4w9WgXcQ/sponsor-report',
      '?channel=c-2&window=first7&sort=views&page=3',
    )

    expect(addressOf(routeToVideo(report, 'dQw4w9WgXcQ'))).toBe(
      'videos/dQw4w9WgXcQ?channel=c-2&window=first7&sort=views&page=3',
    )
    expect(addressOf(routeToList(report))).toBe('?channel=c-2&window=first7&sort=views&page=3')
  })

  test.each([
    'videos/dQw4w9WgXcQ/sponsor-report/x',
    'videos//sponsor-report',
    'videos/%E0%A4%A/sponsor-report',
  ])('the path %o opens the list', (path) => {
    expect(routeOf(path, '')).toEqual(defaultRoute)
  })

  test('feedback sent from the report names the detail screen', () => {
    expect(routeToFeedback(routeOf('videos/dQw4w9WgXcQ/sponsor-report', '')).feedback).toBe(
      'video_detail',
    )
  })
})
