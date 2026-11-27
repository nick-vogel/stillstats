// Limits: these tests cover the choices the video list makes, as pure functions. No test here
// renders the screen, so none shows the table, the thumbnails, the empty box that keeps a row's
// place when a video has no thumbnail or its thumbnail fails to load, the controls, what a screen
// reader announces for a sorted heading, the muted "No data" in the Format cell of a video with no
// format, the layout at 375 pixels wide, that a click on a row opens its video while the title
// stays the row's one link and tab stop, that a real double or triple click selects a row's text
// rather than opening it, that the column switches show and hide their columns, or that a narrow
// screen shows views with its switch off. While a page is read, they show how many placeholder
// rows the list holds and whether it holds the delay note's place, not their height, so not that
// the page keeps its height; nor the region's aria-busy, nor what a screen reader announces for the
// wait. Nor does any test run the wiring between the list and the launch chart, which App connects
// and only effects and pointer events drive: the list reporting what it shows (`onShown`), a row's
// pointer entering and leaving (`onRowHover`), and a line selected on the chart (`onMark`). They
// hold the pure parts, which list a mark marks (`markedVideoOf`) and the marked row's class
// (`listRowClassOf`), not that hovering a row accents its line, that selecting a line marks its row,
// or that a row click and Back leaves no mark. Nick checks those at /app in a real browser.
import type {
  ListedChannel,
  PageSize,
  VideoListAnswer,
  VideoRow,
} from '@creator-analytics/api-types'
import { describe, expect, onTestFinished, test, vi } from 'vitest'
import {
  addressOf,
  defaultRoute,
  listRouteOf,
  type Route,
  revertAddressAfterFailedSave,
  routeToAudience,
  routeToSettings,
  routeToVideo,
  routeToWhatsNew,
} from './route.ts'
import {
  averageViewedNoteOf,
  columns,
  columnToggledEvent,
  controlChangedEvent,
  detailColumns,
  emptyListTextOf,
  formatLabelOf,
  hideSourcesOn,
  historyFiltersShownOf,
  type LandedListView,
  type ListMark,
  listCaptionOf,
  listColumnsShownOf,
  listCurrencyNoteOf,
  listHeadingSortOf,
  listReadOf,
  listRevenueCurrencyOf,
  listRouteFor,
  listRowClassOf,
  listRowClicks,
  listRowsExpectedFor,
  markedVideoOf,
  metricCellsOf,
  minImpressionsChangeOf,
  optionalColumnsOf,
  pageSizeOptions,
  privacyMarkerOf,
  publishDayTopRowsExpectedFor,
  readsAnotherPageOf,
  rememberListHistoryOf,
  rememberListRowsOf,
  rememberPublishDayTopRowsOf,
  repackagingViewTracker,
  revenueNoteOf,
  routeAfterListAnswerOf,
  routeAfterLostSwitches,
  routeWithSourcesOff,
  rowClickOpener,
  rowClickOpensVideo,
  type SummaryPlaceList,
  sortKeysOfColumn,
  sortLabelOf,
  sourceColumnsShownOf,
  sourcesButtonShownOf,
  summaryPlaceListOf,
  videoListQueryOf,
  videoListShownOf,
  videoListStateOf,
  videoListViewOf,
} from './video-list.ts'

const row: VideoRow = {
  id: 'video-1',
  title: 'A video',
  thumbnailUrl: 'https://i.ytimg.com/vi/video-1/mqdefault.jpg',
  thumbnails: [{ url: 'https://i.ytimg.com/vi/video-1/mqdefault.jpg', width: 320 }],
  durationSeconds: 754,
  publishedAt: '2026-10-01T16:00:00.000Z',
  scheduled: false,
  privacy: 'public',
  format: 'video',
  engagedViews: 0,
  views: 0,
  averageViewPercentage: 0,
  subscribersGained: 0,
  estimatedMinutesWatched: 0,
  awaitingProcessing: false,
}

const answer: VideoListAnswer = {
  videos: [row],
  window: 'lifetime',
  page: 1,
  pageSize: 50,
  pageCount: 1,
  revenue: { refusal: 'consent_missing' },
  lastProcessedDay: '2026-10-04',
  creationDay: '2019-02-28',
  fetchedAt: '2026-10-07T09:00:00.000Z',
  fromCache: false,
}

/** A list whose revenue answered, for a channel Google answered no revenue row for. */
const unreported = { ...answer, revenue: { currency: 'USD', reported: false } } as const

/** A list whose revenue answered, for a channel Google answered a revenue row for. */
const reported = { ...answer, revenue: { currency: 'USD', reported: true } } as const

describe('the columns the list shows for its switches', () => {
  const shown = (views: boolean, watchTime: boolean, revenue = false) =>
    listColumnsShownOf({ views, watchTime, revenue }).map(({ column, narrowOnly }) => [
      column.label,
      narrowOnly,
    ])

  test('with both switches off, views shows only on a narrow screen and watch hours not at all', () => {
    expect(shown(false, false)).toEqual([
      ['Format', false],
      ['Published', false],
      ['Engaged views', false],
      ['Views', true],
      ['Average viewed', false],
      ['Subscribers gained', false],
    ])
  })

  test('with both switches on, views and watch hours show at every width', () => {
    expect(shown(true, true)).toEqual([
      ['Format', false],
      ['Published', false],
      ['Engaged views', false],
      ['Views', false],
      ['Watch hours', false],
      ['Average viewed', false],
      ['Subscribers gained', false],
    ])
  })

  test('with views alone on, views shows at every width and watch hours not at all', () => {
    expect(shown(true, false)).toEqual([
      ['Format', false],
      ['Published', false],
      ['Engaged views', false],
      ['Views', false],
      ['Average viewed', false],
      ['Subscribers gained', false],
    ])
  })

  test('with watch hours alone on, watch hours shows at every width and views only on a narrow screen', () => {
    expect(shown(false, true)).toEqual([
      ['Format', false],
      ['Published', false],
      ['Engaged views', false],
      ['Views', true],
      ['Watch hours', false],
      ['Average viewed', false],
      ['Subscribers gained', false],
    ])
  })

  test('in a window after publish, leaves out Average viewed, which YouTube does not give there', () => {
    expect(
      listColumnsShownOf(
        { views: true, watchTime: true, revenue: false },
        { window: 'first7' },
      ).map(({ column }) => column.label),
    ).toEqual([
      'Format',
      'Published',
      'Engaged views',
      'Views',
      'Watch hours',
      'Subscribers gained',
    ])
  })

  test('with revenue on and the sources shown, Ads, YouTube Premium and Other sources follow Revenue', () => {
    expect(
      listColumnsShownOf(
        { views: false, watchTime: false, revenue: true },
        { window: 'last28', sources: true },
      ).map(({ column }) => column.label),
    ).toEqual([
      'Format',
      'Published',
      'Engaged views',
      'Views',
      'Revenue',
      'Ads',
      'YouTube Premium',
      'Other sources',
      'RPM',
      'Average viewed',
      'Subscribers gained',
    ])
  })

  test('with revenue off, the sources stay hidden even when shown', () => {
    expect(
      listColumnsShownOf(
        { views: false, watchTime: false, revenue: false },
        { window: 'last28', sources: true },
      ).map(({ column }) => column.label),
    ).not.toContain('Ads')
  })

  test('with revenue off, RPM is gone with Revenue, in every window and with the sources shown', () => {
    for (const window of ['lifetime', 'last28', 'first7'] as const) {
      const labels = listColumnsShownOf(
        { views: true, watchTime: true, revenue: false },
        { window, sources: true },
      ).map(({ column }) => column.label)
      expect(labels).not.toContain('Revenue')
      expect(labels).not.toContain('RPM')
    }
  })

  test('with revenue on, Revenue and then RPM show at every width after watch hours and before average viewed', () => {
    expect(shown(true, true, true)).toEqual([
      ['Format', false],
      ['Published', false],
      ['Engaged views', false],
      ['Views', false],
      ['Watch hours', false],
      ['Revenue', false],
      ['RPM', false],
      ['Average viewed', false],
      ['Subscribers gained', false],
    ])
  })
})

describe('whether a row shows its numbers or the not-processed text', () => {
  const bothOff = { views: false, watchTime: false, revenue: false }
  const bothOn = { views: true, watchTime: true, revenue: false }

  test('a video awaiting processing shows the not-processed text across the columns a wide screen shows, and its own narrow-only views cell', () => {
    expect(metricCellsOf({ ...row, awaitingProcessing: true }, bothOff)).toEqual({
      kind: 'not-processed',
      text: 'YouTube has not processed this video yet. Its numbers usually appear two to three days after it goes live.',
      colSpan: 3,
      narrowOnlyCell: true,
    })
  })

  test('with both switches on, the not-processed text spans all five metric columns and no cell is narrow only', () => {
    expect(metricCellsOf({ ...row, awaitingProcessing: true }, bothOn)).toMatchObject({
      kind: 'not-processed',
      colSpan: 5,
      narrowOnlyCell: false,
    })
  })

  test('with watch hours alone on, the not-processed text spans four columns beside the narrow-only views cell', () => {
    expect(
      metricCellsOf(
        { ...row, awaitingProcessing: true },
        { views: false, watchTime: true, revenue: false },
      ),
    ).toMatchObject({ kind: 'not-processed', colSpan: 4, narrowOnlyCell: true })
  })

  const video = {
    ...row,
    engagedViews: 1234,
    views: 2345,
    averageViewPercentage: 41.25,
    subscribersGained: 12,
    estimatedMinutesWatched: 744,
  }

  test('with both switches on, a processed video shows its five numbers, each under its heading', () => {
    expect(metricCellsOf(video, bothOn, { locale: 'en-US' })).toEqual({
      kind: 'numbers',
      cells: [
        { label: 'Engaged views', text: '1,234', narrowOnly: false },
        { label: 'Views', text: '2,345', narrowOnly: false },
        { label: 'Watch hours', text: '12.4', narrowOnly: false },
        { label: 'Average viewed', text: '41.3%', narrowOnly: false },
        { label: 'Subscribers gained', text: '12', narrowOnly: false },
      ],
    })
  })

  test("with revenue on, a processed video shows its revenue in the list's currency after watch hours", () => {
    const earning = { ...video, estimatedRevenue: 1234.5 }
    expect(
      metricCellsOf(earning, { ...bothOn, revenue: true }, { locale: 'en-US', currency: 'USD' }),
    ).toEqual({
      kind: 'numbers',
      cells: [
        { label: 'Engaged views', text: '1,234', narrowOnly: false },
        { label: 'Views', text: '2,345', narrowOnly: false },
        { label: 'Watch hours', text: '12.4', narrowOnly: false },
        { label: 'Revenue', text: '$1,234.50', narrowOnly: false },
        { label: 'RPM', text: '$1,000.41', narrowOnly: false },
        { label: 'Average viewed', text: '41.3%', narrowOnly: false },
        { label: 'Subscribers gained', text: '12', narrowOnly: false },
      ],
    })
    expect(
      metricCellsOf(earning, { ...bothOff, revenue: true }, { locale: 'de-DE', currency: 'EUR' }),
    ).toMatchObject({
      cells: expect.arrayContaining([
        { label: 'Revenue', text: '1.234,50\u00a0€', narrowOnly: false },
      ]),
    })
  })

  test('with revenue on, a row that carries no revenue, or a list that names no currency, shows an empty revenue cell', () => {
    const cellOf = (cells: ReturnType<typeof metricCellsOf>) =>
      cells.kind === 'numbers' ? cells.cells.find(({ label }) => label === 'Revenue') : undefined
    expect(
      cellOf(
        metricCellsOf(video, { ...bothOff, revenue: true }, { locale: 'en-US', currency: 'USD' }),
      ),
    ).toEqual({
      label: 'Revenue',
      text: '',
      narrowOnly: false,
    })
    expect(
      cellOf(metricCellsOf({ ...video, estimatedRevenue: 5 }, { ...bothOff, revenue: true })),
    ).toMatchObject({ text: '' })
  })

  test("with revenue on, a row shows its RPM, its revenue per 1,000 engaged views, in the list's currency and the locale's way", () => {
    const earning = { ...video, engagedViews: 2500, estimatedRevenue: 12.5 }
    const rpmCellOf = (currency: 'USD' | 'EUR', locale: string) => {
      const cells = metricCellsOf(earning, { ...bothOff, revenue: true }, { locale, currency })
      return cells.kind === 'numbers' ? cells.cells.find(({ label }) => label === 'RPM') : undefined
    }

    expect(rpmCellOf('USD', 'en-US')).toEqual({ label: 'RPM', text: '$5.00', narrowOnly: false })
    expect(rpmCellOf('EUR', 'en-US')).toMatchObject({ text: '€5.00' })
    expect(rpmCellOf('USD', 'de-DE')).toMatchObject({ text: '5,00\u00a0$' })
    expect(rpmCellOf('EUR', 'de-DE')).toMatchObject({ text: '5,00\u00a0€' })
  })

  // creator-analytics#357: $12.50 in all, $6.00 from ads and $1.50 from YouTube Premium, over
  // 2,500 engaged views.
  test('with the RPM switch on, a row shows its ads and YouTube Premium RPM, and with it off its whole RPM', () => {
    const earning = {
      ...video,
      engagedViews: 2500,
      estimatedRevenue: 12.5,
      estimatedAdRevenue: 6,
      estimatedRedPartnerRevenue: 1.5,
    }
    const rpmTextOf = (row: VideoRow, adsAndPremiumOnly: boolean) => {
      const cells = metricCellsOf(
        row,
        { ...bothOff, revenue: true },
        { locale: 'en-US', currency: 'USD', adsAndPremiumOnly },
      )
      return cells.kind === 'numbers'
        ? cells.cells.find(({ label }) => label === 'RPM')?.text
        : undefined
    }

    expect(rpmTextOf(earning, true)).toBe('$3.00')
    expect(rpmTextOf(earning, false)).toBe('$5.00')
    expect(rpmTextOf({ ...earning, engagedViews: 0 }, true)).toBe('')
    expect(rpmTextOf(video, true)).toBe('')
  })

  test('with revenue on, a row with zero engaged views, a row that carries no revenue, or a list that names no currency, shows an empty RPM cell', () => {
    const rpmTextOf = (earning: VideoRow, currency?: 'USD') => {
      const cells = metricCellsOf(
        earning,
        { ...bothOff, revenue: true },
        { locale: 'en-US', currency },
      )
      return cells.kind === 'numbers'
        ? cells.cells.find(({ label }) => label === 'RPM')?.text
        : undefined
    }

    expect(rpmTextOf({ ...video, engagedViews: 0, estimatedRevenue: 5 }, 'USD')).toBe('')
    expect(rpmTextOf(video, 'USD')).toBe('')
    expect(rpmTextOf({ ...video, estimatedRevenue: 5 })).toBe('')
    expect(rpmTextOf({ ...video, estimatedRevenue: 0 }, 'USD')).toBe('$0.00')
  })

  test('in a window after publish, a row shows no Average viewed cell', () => {
    const { averageViewPercentage: _, ...afterPublish } = video

    expect(metricCellsOf(afterPublish, bothOn, { locale: 'en-US', window: 'first28' })).toEqual({
      kind: 'numbers',
      cells: [
        { label: 'Engaged views', text: '1,234', narrowOnly: false },
        { label: 'Views', text: '2,345', narrowOnly: false },
        { label: 'Watch hours', text: '12.4', narrowOnly: false },
        { label: 'Subscribers gained', text: '12', narrowOnly: false },
      ],
    })
  })

  test("with the sources shown, a row shows its ads, YouTube Premium and the rest as other sources, in the list's currency", () => {
    const earning = {
      ...video,
      estimatedRevenue: 10,
      estimatedAdRevenue: 7.5,
      estimatedRedPartnerRevenue: 1.25,
    }

    expect(
      metricCellsOf(
        earning,
        { ...bothOff, revenue: true },
        { locale: 'en-US', currency: 'USD', sources: true },
      ),
    ).toMatchObject({
      cells: [
        {},
        {},
        { label: 'Revenue', text: '$10.00' },
        { label: 'Ads', text: '$7.50' },
        { label: 'YouTube Premium', text: '$1.25' },
        { label: 'Other sources', text: '$1.25' },
        { label: 'RPM', text: '$8.10' },
        {},
        {},
      ],
    })
  })

  test('with revenue on, the not-processed text spans the revenue and RPM columns too', () => {
    expect(
      metricCellsOf({ ...row, awaitingProcessing: true }, { ...bothOn, revenue: true }),
    ).toMatchObject({ kind: 'not-processed', colSpan: 7, narrowOnlyCell: false })
  })

  test('with both switches off, a processed video shows views for a narrow screen only and no watch hours', () => {
    expect(metricCellsOf(video, bothOff, { locale: 'en-US' })).toEqual({
      kind: 'numbers',
      cells: [
        { label: 'Engaged views', text: '1,234', narrowOnly: false },
        { label: 'Views', text: '2,345', narrowOnly: true },
        { label: 'Average viewed', text: '41.3%', narrowOnly: false },
        { label: 'Subscribers gained', text: '12', narrowOnly: false },
      ],
    })
  })
})

describe('the video list view of an answer', () => {
  test('a list answer is the list', () => {
    expect(videoListViewOf(answer)).toEqual({ kind: 'list', answer })
  })

  test('a refusal shows its text and no number', () => {
    expect(videoListViewOf({ refusal: 'quota_reserved' })).toEqual({
      kind: 'refused',
      message: 'The product has used its YouTube quota for today. Try again tomorrow.',
    })
  })

  test('a custom range the API refuses for its bounds is a view of its own, so the screen falls back', () => {
    expect(videoListViewOf({ error: 'invalid_range' })).toEqual({ kind: 'invalid-range' })
  })

  test('a CTR or impressions sort refused for a channel whose history is not readable says what the sort needs, and is marked as a sort the list leaves (creator-analytics#943)', () => {
    expect(videoListViewOf({ error: 'sort_without_history' })).toEqual({
      kind: 'refused',
      message: 'Sorting by impressions or CTR needs Stillstats Pro.',
      historySort: true,
    })
  })

  test('a filter refused for a channel whose history is not readable says what the filter needs, and is marked (creator-analytics#944, creator-analytics#1044)', () => {
    expect(videoListViewOf({ error: 'filter_without_history' })).toEqual({
      kind: 'refused',
      message: 'Filtering by traffic source or impressions needs Stillstats Pro.',
      historyFilter: true,
    })
  })

  test('an error names the videos and its code', () => {
    expect(videoListViewOf({ error: 'internal' })).toEqual({
      kind: 'refused',
      message: 'Reading the videos failed: internal',
    })
  })
})

describe('the format label', () => {
  test.each([
    ['video', 'Video'],
    ['short', 'Short'],
    ['live', 'Live'],
    [null, 'No data'],
  ] as const)('%s reads as "%s"', (format, label) => {
    expect(formatLabelOf(format)).toBe(label)
  })

  test('the Format cell has no data only for a video with no format', () => {
    const formatColumn = detailColumns.find(({ label }) => label === 'Format')
    expect(formatColumn?.hasNoData?.({ ...row, format: null })).toBe(true)
    expect(formatColumn?.hasNoData?.(row)).toBe(false)
  })
})

describe('the text that announces a new sort', () => {
  test.each([
    ['-publishedAt', 'Published, newest first'],
    ['publishedAt', 'Published, oldest first'],
    ['-engagedViews', 'Engaged views, highest first'],
    ['engagedViews', 'Engaged views, lowest first'],
    ['-views', 'Views, highest first'],
    ['views', 'Views, lowest first'],
    ['-averageViewPercentage', 'Average viewed, highest first'],
    ['averageViewPercentage', 'Average viewed, lowest first'],
    ['-subscribersGained', 'Subscribers gained, highest first'],
    ['subscribersGained', 'Subscribers gained, lowest first'],
    ['-estimatedMinutesWatched', 'Watch hours, highest first'],
    ['estimatedMinutesWatched', 'Watch hours, lowest first'],
    ['-estimatedRevenue', 'Revenue, highest first'],
    ['estimatedRevenue', 'Revenue, lowest first'],
    ['-estimatedAdRevenue', 'Ads, highest first'],
    ['estimatedRedPartnerRevenue', 'YouTube Premium, lowest first'],
    ['-otherSources', 'Other sources, highest first'],
    ['-rpm', 'RPM, highest first'],
    ['rpm', 'RPM, lowest first'],
  ] as const)('in a calendar window, the sort %s is announced as "%s"', (sort, label) => {
    expect(sortLabelOf('lifetime', sort)).toBe(label)
  })

  test.each(['first1', 'first7', 'first28', 'first90', 'first365'] as const)(
    'in %s, a revenue sort and an RPM sort are announced as in a calendar window',
    (window) => {
      expect(sortLabelOf(window, '-estimatedRevenue')).toBe('Revenue, highest first')
      expect(sortLabelOf(window, 'rpm')).toBe('RPM, lowest first')
    },
  )

  test.each(['first1', 'first7', 'first28', 'first90', 'first365'] as const)(
    'in %s, a sort by average viewed has no text, since the window cannot sort by it',
    (window) => {
      expect(sortLabelOf(window, '-averageViewPercentage')).toBeNull()
    },
  )
})

describe('the options of the list controls', () => {
  test('the page size offers 10, 25 and 50', () => {
    expect(pageSizeOptions).toEqual([
      { value: '10', label: '10' },
      { value: '25', label: '25' },
      { value: '50', label: '50' },
    ])
  })
})

describe("the table's caption, which only a screen reader reads", () => {
  test('names the page among the pages', () => {
    expect(listCaptionOf(2, 5)).toBe('Videos, page 2 of 5')
  })

  test('names the one page of a single-page list too', () => {
    expect(listCaptionOf(1, 1)).toBe('Videos, page 1 of 1')
  })
})

describe("the marker of a row's privacy", () => {
  test.each([
    ['unlisted', 'Unlisted'],
    ['private', 'Private'],
  ] as const)('a %s video is marked "%s"', (privacy, marker) => {
    expect(privacyMarkerOf(privacy)).toBe(marker)
  })

  test('a public video has no marker', () => {
    expect(privacyMarkerOf('public')).toBeNull()
  })
})

describe('whether a click on a row opens its video', () => {
  const plainClick = { button: 0, modifierKey: false, insideLink: false, selectedText: '' }

  test('a primary click outside the title link, with no text selected, opens the video', () => {
    expect(rowClickOpensVideo(plainClick)).toBe(true)
  })

  test('a click on the title link is left to the link', () => {
    expect(rowClickOpensVideo({ ...plainClick, insideLink: true })).toBe(false)
  })

  test('a click that ends a text selection leaves the creator on the list', () => {
    expect(rowClickOpensVideo({ ...plainClick, selectedText: 'A video' })).toBe(false)
  })

  test('a click with Ctrl, Meta, Shift or Alt held does nothing', () => {
    expect(rowClickOpensVideo({ ...plainClick, modifierKey: true })).toBe(false)
  })

  test('a click with any button but the primary one does nothing', () => {
    expect(rowClickOpensVideo({ ...plainClick, button: 1 })).toBe(false)
  })
})

describe('a double or triple click on a row', () => {
  const plainClick = { button: 0, modifierKey: false, insideLink: false, selectedText: '' }

  // The browser selects a word on the second press of a double click, after the first click has
  // ended with nothing selected, so each click here sees the selection the press before it made.
  function clicksOn(clicks: number, selectionAfter = '') {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    let selected = ''
    let opened = 0
    const opener = rowClickOpener(
      () => selected,
      () => '/app/',
    )
    for (let click = 0; click < clicks; click += 1) {
      opener.click({ ...plainClick, selectedText: selected }, () => {
        opened += 1
      })
      selected = selectionAfter
    }
    return {
      opener,
      opened: () => {
        vi.runAllTimers()
        return opened
      },
    }
  }

  test('a single plain click opens the video', () => {
    expect(clicksOn(1).opened()).toBe(1)
  })

  test.each([2, 3])('%i clicks that select text leave the creator on the list', (clicks) => {
    expect(clicksOn(clicks, 'A video').opened()).toBe(0)
  })

  test('a second press that selects text before its click arrives leaves the creator on the list', () => {
    expect(clicksOn(1, 'A video').opened()).toBe(0)
  })

  test("with the list's one opener, a click on a second row in the wait cancels the first, and the second row opens", () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', {
      getSelection: () => ({ toString: () => '' }),
      location: { pathname: '/app/', search: '' },
    })
    onTestFinished(() => {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    })
    const opened: string[] = []
    listRowClicks.click(plainClick, () => opened.push('first row'))
    vi.advanceTimersByTime(100)
    listRowClicks.click(plainClick, () => opened.push('second row'))
    vi.runAllTimers()

    expect(opened).toEqual(['second row'])
  })

  test.each([
    ['the route', '/app/?page=2'],
    ['the chart mode', '/app/?chart=aggregate'],
  ])(
    "with the list's one opener, a click still waiting when %s changes opens nothing",
    (_change, nextAddress) => {
      vi.useFakeTimers()
      const location = { pathname: '/app/', search: '' }
      vi.stubGlobal('window', { getSelection: () => ({ toString: () => '' }), location })
      onTestFinished(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
      })
      const opened: string[] = []
      listRowClicks.click(plainClick, () => opened.push('row'))
      vi.advanceTimersByTime(100)
      const next = new URL(nextAddress, 'https://stillstats.invalid')
      location.pathname = next.pathname
      location.search = next.search
      vi.runAllTimers()

      expect(opened).toEqual([])
    },
  )

  test('a click still waiting when the address changes for one address check and changes back in the wait opens nothing', () => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    let address = '/app/'
    const opened: string[] = []
    const opener = rowClickOpener(
      () => '',
      () => address,
    )
    opener.click(plainClick, () => opened.push('row'))
    // The checks run every 50 ms, so only the one at 150 ms sees the address changed.
    vi.advanceTimersByTime(120)
    address = '/app/?chart=aggregate'
    vi.advanceTimersByTime(50)
    address = '/app/'
    vi.runAllTimers()

    expect(opened).toEqual([])
  })

  test('a click still waiting when the list leaves the screen opens nothing', () => {
    const { opener, opened } = clicksOn(1)
    opener.cancel()
    expect(opened()).toBe(0)
  })
})

describe('the sort of a column heading', () => {
  const column = (label: string) => {
    const found = columns.find((each) => each.label === label)
    if (!found) throw new Error(`No column ${label}`)
    return found
  }

  test('the heading of the sorted column shows its direction, and a click reverses it', () => {
    expect(listHeadingSortOf(column('Views'), 'lifetime', '-views')).toEqual({
      direction: 'descending',
      next: 'views',
    })
    expect(listHeadingSortOf(column('Views'), 'lifetime', 'views')).toEqual({
      direction: 'ascending',
      next: '-views',
    })
  })

  test('a click on another heading sorts by it, highest first', () => {
    expect(listHeadingSortOf(column('Subscribers gained'), 'last28', '-views')).toEqual({
      direction: 'none',
      next: '-subscribersGained',
    })
  })

  test('a click on the Published heading sorts newest first', () => {
    expect(listHeadingSortOf(column('Published'), 'last28', '-views')).toEqual({
      direction: 'none',
      next: '-publishedAt',
    })
  })

  test('the Average viewed heading sorts in a calendar window', () => {
    expect(listHeadingSortOf(column('Average viewed'), 'last7', '-publishedAt')).not.toBeNull()
  })

  test.each(['first1', 'first7', 'first28', 'first90', 'first365'] as const)(
    'the Average viewed heading does not sort in %s, where the API refuses that sort',
    (window) => {
      expect(listHeadingSortOf(column('Average viewed'), window, '-publishedAt')).toBeNull()
    },
  )

  test.each([
    'lifetime',
    'last7',
    'last28',
    'last90',
    'last365',
    'first1',
    'first7',
    'first28',
    'first90',
    'first365',
  ] as const)('the Watch hours heading sorts by watch time in %s', (window) => {
    expect(listHeadingSortOf(column('Watch hours'), window, '-estimatedMinutesWatched')).toEqual({
      direction: 'descending',
      next: 'estimatedMinutesWatched',
    })
    expect(listHeadingSortOf(column('Watch hours'), window, '-publishedAt')).toEqual({
      direction: 'none',
      next: '-estimatedMinutesWatched',
    })
  })

  test.each([
    'lifetime',
    'last7',
    'last28',
    'last90',
    'last365',
    'first1',
    'first7',
    'first28',
    'first90',
    'first365',
  ] as const)('the Revenue heading sorts by estimated revenue in %s', (window) => {
    expect(listHeadingSortOf(column('Revenue'), window, '-estimatedRevenue')).toEqual({
      direction: 'descending',
      next: 'estimatedRevenue',
    })
    expect(listHeadingSortOf(column('Revenue'), window, '-publishedAt')).toEqual({
      direction: 'none',
      next: '-estimatedRevenue',
    })
  })

  test.each([
    ['Ads', 'estimatedAdRevenue'],
    ['YouTube Premium', 'estimatedRedPartnerRevenue'],
    ['Other sources', 'otherSources'],
  ] as const)(
    'the %s heading sorts by %s, highest first, in a window after publish too',
    (label, key) => {
      expect(listHeadingSortOf(column(label), 'first7', '-publishedAt')).toEqual({
        direction: 'none',
        next: `-${key}`,
      })
    },
  )

  test('the Format heading has no key, so it does not sort', () => {
    expect(listHeadingSortOf(column('Format'), 'lifetime', '-publishedAt')).toBeNull()
  })
})

describe('the average viewed note', () => {
  test.each(['first1', 'first7', 'first28', 'first90', 'first365'] as const)(
    '%s shows it',
    (window) => {
      expect(averageViewedNoteOf(window)).toBe(
        'YouTube doesn\'t support average viewed for "after publish" date ranges. Open a video or change the date range to see it.',
      )
    },
  )

  test.each(['lifetime', 'last7', 'last28', 'last90', 'last365'] as const)(
    '%s has none, since its average viewed shows',
    (window) => {
      expect(averageViewedNoteOf(window)).toBeNull()
    },
  )
})

describe('the repackaging view event (creator-analytics#943)', () => {
  test('the first CTR or impressions sort of the session sends repackaging_view_opened with the sort and nothing else', () => {
    const event = repackagingViewTracker()({ sort: '-ctr' })

    expect(event).toEqual({ name: 'repackaging_view_opened', sort: '-ctr' })
    expect(Object.keys(event ?? {}).sort()).toEqual(['name', 'sort'])
  })

  test('a second CTR or impressions sort in the session sends none', () => {
    const tracker = repackagingViewTracker()
    tracker({ sort: 'impressions' })

    expect(tracker({ sort: '-ctr' })).toBeNull()
    expect(tracker({ sort: 'ctr' })).toBeNull()
    expect(tracker({ sort: '-impressions' })).toBeNull()
  })

  test('another sort or control sends none, and leaves the session its event', () => {
    const tracker = repackagingViewTracker()

    expect(tracker({ sort: '-views' })).toBeNull()
    expect(tracker({ window: 'first7' })).toBeNull()
    expect(tracker({ format: 'short' })).toBeNull()
    expect(tracker({ sort: 'impressions' })).toEqual({
      name: 'repackaging_view_opened',
      sort: 'impressions',
    })
  })
})

describe('the repackaging view event for a traffic source (creator-analytics#944)', () => {
  test('the first traffic source of the session sends repackaging_view_opened with the source and nothing else', () => {
    const event = repackagingViewTracker()({ trafficSource: 'YT_SEARCH' })

    expect(event).toEqual({ name: 'repackaging_view_opened', source: 'YT_SEARCH' })
    expect(Object.keys(event ?? {}).sort()).toEqual(['name', 'source'])
  })

  test('a traffic source after a CTR sort, and a CTR sort after a traffic source, send none', () => {
    const sortFirst = repackagingViewTracker()
    sortFirst({ sort: '-ctr' })
    const sourceFirst = repackagingViewTracker()
    sourceFirst({ trafficSource: 'RELATED_VIDEO' })

    expect(sortFirst({ trafficSource: 'YT_SEARCH' })).toBeNull()
    expect(sourceFirst({ sort: '-ctr' })).toBeNull()
    expect(sourceFirst({ trafficSource: 'YT_SEARCH' })).toBeNull()
  })

  test('All sources and a minimum send none, and leave the session its event', () => {
    const tracker = repackagingViewTracker()

    expect(tracker({ trafficSource: undefined })).toBeNull()
    expect(tracker({ minImpressions: 500 })).toBeNull()
    expect(tracker({ minImpressions: undefined })).toBeNull()
    expect(tracker({ trafficSource: 'SUBSCRIBER' })).toEqual({
      name: 'repackaging_view_opened',
      source: 'SUBSCRIBER',
    })
  })
})

describe('the minimum impressions field (creator-analytics#944)', () => {
  test('a whole number from 1 sets the minimum, and an empty field clears it', () => {
    expect(minImpressionsChangeOf('500')).toEqual({ minImpressions: 500 })
    expect(minImpressionsChangeOf('')).toEqual({ minImpressions: undefined })
  })

  test.each(['0', '-3', '2.5', 'abc'])('%s changes nothing', (text) => {
    expect(minImpressionsChangeOf(text)).toBeNull()
  })
})

describe('the event a control change sends', () => {
  test('a traffic source or a minimum sends no change event of its own (creator-analytics#944)', () => {
    expect(controlChangedEvent({ trafficSource: 'YT_SEARCH' })).toBeNull()
    expect(controlChangedEvent({ trafficSource: undefined })).toBeNull()
    expect(controlChangedEvent({ minImpressions: 500 })).toBeNull()
  })

  test('a window change sends the window only', () => {
    expect(controlChangedEvent({ window: 'first365' })).toEqual({
      name: 'video_window_changed',
      window: 'first365',
    })
  })

  test('a custom range sends its length in days and no date', () => {
    const event = controlChangedEvent({
      window: 'custom',
      range: { from: '2026-09-01', to: '2026-10-01' },
    })
    expect(event).toEqual({ name: 'video_window_changed', window: 'custom', days: 31 })
    expect(Object.keys(event ?? {}).sort()).toEqual(['days', 'name', 'window'])
  })

  test('a sort change sends the sort only, with its direction', () => {
    expect(controlChangedEvent({ sort: '-engagedViews' })).toEqual({
      name: 'video_sort_changed',
      sort: '-engagedViews',
    })
  })

  test('a format change sends the format only', () => {
    expect(controlChangedEvent({ format: 'short' })).toEqual({
      name: 'video_format_changed',
      format: 'short',
    })
  })

  test('a page size change sends page_size_changed with the size only', () => {
    expect(controlChangedEvent({ pageSize: 25 })).toEqual({ name: 'page_size_changed', size: 25 })
  })

  test('a switch of the visibility sends visibility_changed with the visibility only', () => {
    expect(controlChangedEvent({ visibility: 'all' })).toEqual({
      name: 'visibility_changed',
      visibility: 'all',
    })
  })
})

describe('the text of a list with no videos', () => {
  test('with every format and every visibility, says the channel has no uploads', () => {
    expect(emptyListTextOf('all', 'all')).toBe('This channel has no uploads yet.')
  })

  test.each(['video', 'short', 'live'] as const)(
    'with the format %s and every visibility, says the channel has no uploads in it',
    (format) => {
      expect(emptyListTextOf(format, 'all')).toBe('This channel has no uploads in this format.')
    },
  )

  test('with every format and public videos only, says the channel has no public uploads', () => {
    expect(emptyListTextOf('all', 'public')).toBe('This channel has no public uploads.')
  })

  test.each(['video', 'short', 'live'] as const)(
    'with the format %s and public videos only, says the channel has no public uploads in it',
    (format) => {
      expect(emptyListTextOf(format, 'public')).toBe(
        'This channel has no public uploads in this format.',
      )
    },
  )

  test("with a minimum, says no video in the list reaches it, the number in the browser's locale", () => {
    expect(emptyListTextOf('short', 'public', 1500, 'en-US')).toBe(
      'No video in this list has 1,500 impressions or more.',
    )
  })
})

describe('the query a list read sends', () => {
  const request = { ...defaultRoute, pageSize: 50, visibility: 'public' } as const

  test('names the page, window, sort and format of the route, and the page size and visibility', () => {
    expect(Object.fromEntries(new URLSearchParams(videoListQueryOf(request)))).toEqual({
      page: '1',
      window: 'last28',
      sort: '-publishedAt',
      format: 'all',
      pageSize: '50',
      visibility: 'public',
    })
  })

  test('a custom range names its start and end, and each range is a read of its own', () => {
    const range = { from: '2026-09-01', to: '2026-09-30' }
    const query = videoListQueryOf({ ...request, window: 'custom', range })
    expect(Object.fromEntries(new URLSearchParams(query))).toMatchObject({
      window: 'custom',
      from: '2026-09-01',
      to: '2026-09-30',
    })
    expect(
      videoListQueryOf({ ...request, window: 'custom', range: { ...range, to: '2026-09-29' } }),
    ).not.toBe(query)
  })

  test.each([
    ['page', { page: 2 }],
    ['window', { window: 'lifetime' }],
    ['sort', { sort: '-views' }],
    ['format', { format: 'short' }],
    ['page size', { pageSize: 25 }],
    ['visibility', { visibility: 'all' }],
  ] as const)('a %s change is a new read', (_, change) => {
    expect(videoListQueryOf({ ...request, ...change })).not.toBe(videoListQueryOf(request))
  })

  test('names the traffic source and the minimum impressions when the route has them, and neither when it has not (creator-analytics#944)', () => {
    const filtered = videoListQueryOf({
      ...request,
      trafficSource: 'YT_SEARCH',
      minImpressions: 500,
    })

    expect(Object.fromEntries(new URLSearchParams(filtered))).toMatchObject({
      trafficSource: 'YT_SEARCH',
      minImpressions: '500',
    })
    expect(new URLSearchParams(videoListQueryOf(request)).has('trafficSource')).toBe(false)
    expect(new URLSearchParams(videoListQueryOf(request)).has('minImpressions')).toBe(false)
  })

  test('the list read of an address with a traffic source and a minimum sends both, and keys a read of its own', () => {
    const channel: ListedChannel = {
      id: 'channel-filters',
      youtubeChannelId: 'UC-filters',
      title: 'A channel',
      handle: null,
      revenueConsentedAt: null,
    }
    const plain = listReadOf(defaultRoute, channel, {})
    const filtered = listReadOf(
      listRouteOf('?trafficSource=RELATED_VIDEO&minImpressions=100'),
      channel,
      {},
    )

    expect(Object.fromEntries(new URLSearchParams(filtered.query))).toMatchObject({
      trafficSource: 'RELATED_VIDEO',
      minImpressions: '100',
    })
    expect(filtered.key).not.toBe(plain.key)
  })

  test('a chart mode change is the same read, so the rows stay and no reread goes out', () => {
    const charted: Route = { ...defaultRoute, chart: 'aggregate' }
    expect(videoListQueryOf({ ...charted, pageSize: 50, visibility: 'public' })).toBe(
      videoListQueryOf(request),
    )
  })
})

// The rows memo lives as long as the test file, as it does the page, so each test names its own
// channel.
describe('how many rows the list expects for a read (creator-analytics#325)', () => {
  const page3Unsized: Route = { ...defaultRoute, window: 'first28', page: 3 }
  const page3: Route = { ...page3Unsized, pageSize: 25 }
  /** A channel `id` without revenue consent. */
  function channelOf(id: string): ListedChannel {
    return {
      id,
      youtubeChannelId: 'UC1',
      title: 'A channel',
      handle: null,
      revenueConsentedAt: null,
    }
  }
  /** Remembers `rows` for the read the list sends for `route` of `channel`. */
  function remember(channel: ListedChannel, route: Route, rows: number) {
    rememberListRowsOf(channel.id, listReadOf(route, channel, {}).query, rows)
  }

  test("with nothing remembered, the route's page size, or the saved one when the address names none", () => {
    const channel = channelOf('c-none')
    expect(listRowsExpectedFor(channel, page3, {})).toBe(25)
    expect(listRowsExpectedFor(channel, page3Unsized, { pageSize: 10 })).toBe(10)
    expect(listRowsExpectedFor(null, page3, {})).toBe(25)
  })

  test('after an answer of 7 rows for a page, that page expects 7', () => {
    const channel = channelOf('c-seven')
    remember(channel, page3, 7)
    expect(listRowsExpectedFor(channel, page3, {})).toBe(7)
    // The saved page size the address leaves out is the same read.
    expect(listRowsExpectedFor(channel, page3Unsized, { pageSize: 25 })).toBe(7)
  })

  test.each([
    ['another page', { page: 2 }, 25],
    ['another page size', { pageSize: 50 }, 50],
    ['another window', { window: 'first7' }, 25],
    ['another sort', { sort: '-views' }, 25],
  ] as const)('%s of the same channel still expects the page size', (_, change, pageSize) => {
    const channel = channelOf('c-other-read')
    remember(channel, page3, 7)
    expect(listRowsExpectedFor(channel, { ...page3, ...change }, {})).toBe(pageSize)
  })

  test('the same read of another channel, or of no channel yet, still expects the page size', () => {
    const one = channelOf('c-one')
    const two = channelOf('c-two')
    remember(one, page3, 7)
    expect(listRowsExpectedFor(two, page3, {})).toBe(25)
    expect(listRowsExpectedFor(null, page3, {})).toBe(25)
  })

  test('the chart mode leaves the read the same', () => {
    const channel = channelOf('c-mode')
    remember(channel, { ...page3, chart: 'daily' }, 4)
    expect(listRowsExpectedFor(channel, { ...page3, chart: 'aggregate' }, {})).toBe(4)
  })

  test('a later answer for the same read replaces the earlier one', () => {
    const channel = channelOf('c-later')
    remember(channel, page3, 7)
    remember(channel, page3, 25)
    expect(listRowsExpectedFor(channel, page3, {})).toBe(25)
  })

  // creator-analytics#376: the list reads these sorts newest first (listRouteFor), and remembers
  // its answer under the query it sends.
  test.each([
    ['watch time, with its column off', '-estimatedMinutesWatched', { watchTimeColumn: false }],
    ['revenue, on a channel without revenue consent', '-estimatedRevenue', {}],
  ] as const)(
    'a sort by %s, which the list reads newest first, expects the rows that read answered',
    (_, sort, saved) => {
      const channel: ListedChannel = {
        id: `c-rewritten${sort}`,
        youtubeChannelId: 'UC1',
        title: 'A channel',
        handle: null,
        revenueConsentedAt: null,
      }
      const sorted: Route = { ...page3, sort }
      // The list remembers its answer under the query it sends, through listRouteFor's rewrite.
      rememberListRowsOf(channel.id, listReadOf(sorted, channel, saved).query, 7)
      expect(listRowsExpectedFor(channel, sorted, saved)).toBe(7)
    },
  )
})

// The publish day top memo lives as long as the test file too, so each test names its own channel.
describe('how many bars the publish day top expects for a read (creator-analytics#510)', () => {
  const first1Unsized: Route = { ...defaultRoute, window: 'first1' }
  const first1: Route = { ...first1Unsized, pageSize: 25 }

  /** A channel `id` without revenue consent. */
  function channelOf(id: string): ListedChannel {
    return {
      id,
      youtubeChannelId: 'UC1',
      title: 'A channel',
      handle: null,
      revenueConsentedAt: null,
    }
  }
  /** Remembers `rows` publish day bars for the read the list sends for `route` of `channel`. */
  function remember(channel: ListedChannel, route: Route, rows: number) {
    rememberPublishDayTopRowsOf(channel.id, listReadOf(route, channel, {}).query, rows)
  }

  test('a top answered under one sort is expected under another sort and page size', () => {
    const two = channelOf('p-resort')
    remember(two, first1, 2)
    expect(publishDayTopRowsExpectedFor(two, { ...first1, sort: '-engagedViews' }, {})).toBe(2)
    expect(publishDayTopRowsExpectedFor(two, { ...first1, pageSize: 50 }, {})).toBe(2)
  })

  test('with nothing remembered, or no channel yet, the most the top holds: 10', () => {
    expect(publishDayTopRowsExpectedFor(channelOf('p-none'), first1, {})).toBe(10)
    expect(publishDayTopRowsExpectedFor(null, first1, {})).toBe(10)
  })

  test('after an answer of 4 bars for a read, that read expects 4, and an empty top 0', () => {
    const four = channelOf('p-four')
    remember(four, first1, 4)
    expect(publishDayTopRowsExpectedFor(four, first1, {})).toBe(4)
    // The saved page size the address leaves out is the same read.
    expect(publishDayTopRowsExpectedFor(four, first1Unsized, { pageSize: 25 })).toBe(4)
    const none = channelOf('p-empty')
    remember(none, first1, 0)
    expect(publishDayTopRowsExpectedFor(none, first1, {})).toBe(0)
  })

  test('another read of the same channel, or the same read of another, still expects 10', () => {
    const one = channelOf('p-one')
    remember(one, first1, 4)
    expect(publishDayTopRowsExpectedFor(one, { ...first1, format: 'short' }, {})).toBe(10)
    expect(publishDayTopRowsExpectedFor(channelOf('p-two'), first1, {})).toBe(10)
    expect(publishDayTopRowsExpectedFor(null, first1, {})).toBe(10)
  })

  test("the list's own rows memo leaves the top's alone", () => {
    const channel = channelOf('p-list')
    rememberListRowsOf(channel.id, listReadOf(first1, channel, {}).query, 3)
    expect(publishDayTopRowsExpectedFor(channel, first1, {})).toBe(10)
  })
})

describe('what the list shows while a read is in flight', () => {
  const key = 'page=1'
  const listKey = 'list'
  const query = 'page=1'
  const channelId = 'channel-1'
  const three = { ...answer, videos: [row, { ...row, id: 'video-2' }, { ...row, id: 'video-3' }] }
  /** The list read of `channel-1`'s first page at `pageSize`, which no test remembers rows for. */
  const readOf = (pageSize: PageSize) => ({ key, query, pageSize })

  test('before any read lands, it shows a placeholder row for each row of the page size', () => {
    expect(videoListStateOf(null, channelId, readOf(25))).toEqual({
      kind: 'loading',
      rows: 25,
      last: null,
    })
  })

  test("a read for the route's key shows its list", () => {
    expect(
      videoListStateOf(
        { channelId, key, listKey, view: { kind: 'list', answer } },
        channelId,
        readOf(50),
      ),
    ).toEqual({
      kind: 'list',
      answer,
    })
  })

  test("a refusal for the route's key replaces the placeholders with its message", () => {
    const refused = { kind: 'refused', message: 'Reading the videos failed: internal' } as const
    expect(
      videoListStateOf({ channelId, key, listKey, view: refused }, channelId, readOf(50)),
    ).toEqual(refused)
  })

  test('a read for another key holds a placeholder row for each of its videos, and keeps its answer', () => {
    expect(
      videoListStateOf(
        { channelId, key: 'page=2', listKey, view: { kind: 'list', answer: three } },
        channelId,
        readOf(50),
      ),
    ).toEqual({ kind: 'loading', rows: 3, last: three })
  })

  test('after a list with no videos, the next read holds no placeholder row', () => {
    const empty = { ...answer, videos: [], pageCount: 0 }
    expect(
      videoListStateOf(
        { channelId, key: 'format=short', listKey, view: { kind: 'list', answer: empty } },
        channelId,
        readOf(50),
      ),
    ).toEqual({ kind: 'loading', rows: 0, last: empty })
  })

  test('a refusal for another key shows the first-load placeholders, since it has no rows to keep', () => {
    expect(
      videoListStateOf(
        { channelId, key: 'page=2', listKey, view: { kind: 'refused', message: 'No.' } },
        channelId,
        readOf(50),
      ),
    ).toEqual({ kind: 'loading', rows: 50, last: null })
  })

  test('a read for another channel holds no place for this one: the first-load placeholders show', () => {
    expect(
      videoListStateOf(
        { channelId: 'channel-2', key, listKey, view: { kind: 'list', answer: three } },
        channelId,
        readOf(50),
      ),
    ).toEqual({ kind: 'loading', rows: 50, last: null })
  })

  // Back from a video remounts the list with no last read (creator-analytics#344). The rows memo
  // lives as long as the test file, so each test names its own channel.
  describe('with no last read, the rows the same read last answered on this page load', () => {
    const firstLoad = { kind: 'loading', rows: 25, last: null }

    test('after an answer of 3 rows for the same read, it holds 3 placeholder rows', () => {
      rememberListRowsOf('c-344-three', query, 3)
      expect(videoListStateOf(null, 'c-344-three', readOf(25))).toEqual({
        kind: 'loading',
        rows: 3,
        last: null,
      })
    })

    test("after an answer of no rows for the same read, it holds the empty text's place", () => {
      rememberListRowsOf('c-344-none', query, 0)
      const state = videoListStateOf(null, 'c-344-none', readOf(25))
      expect(state).toEqual({ kind: 'loading', rows: 0, last: null })
      expect(videoListShownOf(state, { format: 'all', visibility: 'all' }).body).toEqual({
        kind: 'placeholder-empty',
      })
    })

    test("another read's answer, or the same read's answer on another channel, still holds the page size", () => {
      rememberListRowsOf('c-344-other', 'page=2', 3)
      rememberListRowsOf('c-344-elsewhere', query, 3)
      expect(videoListStateOf(null, 'c-344-other', readOf(25))).toEqual(firstLoad)
      expect(videoListStateOf(null, 'c-344-other-channel', readOf(25))).toEqual(firstLoad)
    })

    test('a refusal for another key, or a read of another channel, holds the rows the same read last answered', () => {
      rememberListRowsOf('c-344-after', query, 3)
      const refused = { kind: 'refused', message: 'No.' } as const
      expect(
        videoListStateOf(
          { channelId: 'c-344-after', key: 'page=2', listKey, view: refused },
          'c-344-after',
          readOf(25),
        ),
      ).toEqual({ kind: 'loading', rows: 3, last: null })
      expect(
        videoListStateOf(
          { channelId: 'channel-2', key, listKey, view: { kind: 'list', answer } },
          'c-344-after',
          readOf(25),
        ),
      ).toEqual({ kind: 'loading', rows: 3, last: null })
    })

    test('with no channel yet, it holds the page size', () => {
      expect(videoListStateOf(null, null, readOf(25))).toEqual(firstLoad)
    })
  })
})

describe('what the list region shows for its state', () => {
  const lifetime = { format: 'all', visibility: 'all' } as const

  test('while a page is read, the region is busy and holds a placeholder row per row of the last answer, and keeps the last answer for its notes and pager', () => {
    expect(videoListShownOf({ kind: 'loading', rows: 1, last: answer }, lifetime)).toEqual({
      busy: true,
      answer,
      body: { kind: 'placeholder-rows', rows: 1 },
    })
  })

  test('after a list with no videos, the next read holds the empty text line', () => {
    const empty = { ...answer, videos: [], pageCount: 0 }
    expect(videoListShownOf({ kind: 'loading', rows: 0, last: empty }, lifetime)).toEqual({
      busy: true,
      answer: empty,
      body: { kind: 'placeholder-empty' },
    })
  })

  test('a list shows its videos, and is not busy', () => {
    expect(videoListShownOf({ kind: 'list', answer }, lifetime)).toEqual({
      busy: false,
      answer,
      body: { kind: 'videos', answer },
    })
  })

  test("a list with no videos shows the empty text for the route's format and the visibility", () => {
    const empty = { ...answer, videos: [], pageCount: 0 }
    expect(
      videoListShownOf({ kind: 'list', answer: empty }, { ...lifetime, format: 'short' }),
    ).toEqual({
      busy: false,
      answer: empty,
      body: { kind: 'empty', text: 'This channel has no uploads in this format.' },
    })
  })

  test('a list of a paid channel with no video at the minimum says none reaches it, and without a minimum says what it says today (creator-analytics#944)', () => {
    const empty = {
      ...answer,
      videos: [],
      pageCount: 0,
      history: { firstDay: '2026-09-01', newestDay: '2026-10-04' },
    }

    expect(
      videoListShownOf({ kind: 'list', answer: empty }, { ...lifetime, minImpressions: 500 }).body,
    ).toEqual({ kind: 'empty', text: 'No video in this list has 500 impressions or more.' })
    expect(videoListShownOf({ kind: 'list', answer: empty }, lifetime).body).toEqual({
      kind: 'empty',
      text: 'This channel has no uploads yet.',
    })
  })

  test('a list without the history, which a minimum hides nothing of, says the channel has no uploads', () => {
    const empty = { ...answer, videos: [], pageCount: 0 }

    expect(
      videoListShownOf({ kind: 'list', answer: empty }, { ...lifetime, minImpressions: 500 }).body,
    ).toEqual({ kind: 'empty', text: 'This channel has no uploads yet.' })
  })

  test('a refusal shows its message, with no answer for notes or a pager', () => {
    expect(videoListShownOf({ kind: 'refused', message: 'No.' }, lifetime)).toEqual({
      busy: false,
      answer: null,
      body: { kind: 'refused', message: 'No.' },
    })
  })
})

describe("the list the summary's place draws in a window after publish", () => {
  const first28 = { window: 'first28', format: 'all', visibility: 'all' } as const
  const placeOf = (state: Parameters<typeof videoListShownOf>[0], anotherPage = false) =>
    summaryPlaceListOf(videoListShownOf(state, first28), 'channel-1', anotherPage)

  test("while a page is read, it is reading, so the summary's place holds a placeholder", () => {
    expect(placeOf({ kind: 'loading', rows: 50, last: null })).toEqual({ kind: 'reading' })
    expect(placeOf({ kind: 'loading', rows: 1, last: answer })).toEqual({ kind: 'reading' })
    const launch = { ...answer, window: 'first28' } as const
    expect(placeOf({ kind: 'loading', rows: 1, last: launch }, true)).toEqual({ kind: 'reading' })
  })

  test('while another page is read under "Publish day", it keeps the last answer, whose publish day top ranks the whole list', () => {
    const publishDay = { ...answer, window: 'first1' } as const

    expect(placeOf({ kind: 'loading', rows: 1, last: publishDay }, true)).toEqual({
      kind: 'list',
      channelId: 'channel-1',
      answer: publishDay,
    })
    expect(placeOf({ kind: 'loading', rows: 1, last: publishDay }, false)).toEqual({
      kind: 'reading',
    })
  })

  test('a list with videos is the answer the launch chart and the publish day top draw, with the channel it is of', () => {
    expect(placeOf({ kind: 'list', answer })).toEqual({
      kind: 'list',
      channelId: 'channel-1',
      answer,
    })
  })

  test('with no channel yet, it is reading, as the list has no answer to give', () => {
    const shown = videoListShownOf({ kind: 'list', answer }, first28)

    expect(summaryPlaceListOf(shown, null, false)).toEqual({ kind: 'reading' })
  })

  test('a refused list or one with no videos is none, as the list says so itself', () => {
    expect(placeOf({ kind: 'refused', message: 'No.' })).toEqual({ kind: 'none' })
    expect(placeOf({ kind: 'list', answer: { ...answer, videos: [], pageCount: 0 } })).toEqual({
      kind: 'none',
    })
  })
})

describe('the video a mark marks', () => {
  const shown: SummaryPlaceList = { kind: 'list', channelId: 'channel-1', answer }

  test("is the hovered row's or selected line's video while the list it was made on shows", () => {
    expect(markedVideoOf({ videoId: 'a', list: shown, by: 'row' }, shown)).toBe('a')
    expect(markedVideoOf(null, shown)).toBeNull()
  })

  test('is none once the list shows anything else, as after a row click and Back or a channel or window switch, though no pointer left the row', () => {
    const mark: ListMark = { videoId: 'a', list: shown, by: 'chart' }

    expect(markedVideoOf(mark, { kind: 'reading' })).toBeNull()
    expect(markedVideoOf(mark, { kind: 'list', channelId: 'channel-1', answer })).toBeNull()
  })
})

describe("a list row's mark from the launch chart", () => {
  test('marks the row of the video whose line the chart selected, and no other', () => {
    const marked = (videoId: string, markedVideoId: string | null) =>
      listRowClassOf(videoId, markedVideoId).split(' ').includes('video-list-row-marked')

    expect(marked('a', 'a')).toBe(true)
    expect(marked('b', 'a')).toBe(false)
    expect(marked('a', null)).toBe(false)
  })
})

describe('the column switches', () => {
  test('offer revenue only with revenue consent, after views and watch hours', () => {
    expect(optionalColumnsOf(true)).toEqual(['views', 'watchTime', 'revenue'])
    expect(optionalColumnsOf(false)).toEqual(['views', 'watchTime'])
  })

  test.each([
    [true, 'on'],
    [false, 'off'],
  ] as const)(
    'switching each switch offered with revenue consent to %s sends only its column and the state %s',
    (on, state) => {
      expect(optionalColumnsOf(true).map((column) => columnToggledEvent(column, on))).toEqual([
        { name: 'list_column_toggled', column: 'views', state },
        { name: 'list_column_toggled', column: 'watchTime', state },
        { name: 'list_column_toggled', column: 'revenue', state },
      ])
    },
  )

  test.each([
    ['views', ['views']],
    ['watchTime', ['estimatedMinutesWatched']],
    ['revenue', ['estimatedRevenue', 'rpm']],
  ] as const)('the %s switch names the keys its headings sort by, %o', (column, keys) => {
    expect(sortKeysOfColumn(column)).toEqual(keys)
  })
})

describe('the route after a failed save lost column switches', () => {
  test('a lost switch-on of Watch hours sorts a watch hours sort newest first from the first page, as the list will', () => {
    const route = listRouteOf('?sort=-estimatedMinutesWatched&page=2')
    expect(routeAfterLostSwitches(route, { watchTimeColumn: true })).toEqual({
      ...route,
      sort: '-publishedAt',
      page: 1,
    })
  })

  test.each(['?sort=-rpm&page=2', '?sort=-estimatedRevenue&page=2'])(
    'a lost switch-on of Revenue sorts a revenue or RPM sort (%s) newest first from the first page',
    (search) => {
      const route = listRouteOf(search)
      expect(routeAfterLostSwitches(route, { revenueColumn: true })).toEqual({
        ...route,
        sort: '-publishedAt',
        page: 1,
      })
    },
  )

  test('a lost showing of the sources sorts a source sort newest first from the first page', () => {
    const route = listRouteOf('?sort=-estimatedAdRevenue&page=2')
    expect(routeAfterLostSwitches(route, { revenueSources: true })).toEqual({
      ...route,
      sort: '-publishedAt',
      page: 1,
    })
  })

  test('a video or Settings stays, as no list is on view to sort', () => {
    const list = listRouteOf('?sort=-estimatedMinutesWatched')
    const onVideo = routeToVideo(list, 'video-1')
    const onSettings = routeToSettings(list)
    expect(routeAfterLostSwitches(onVideo, { watchTimeColumn: true })).toBe(onVideo)
    expect(routeAfterLostSwitches(onSettings, { watchTimeColumn: true })).toBe(onSettings)
  })

  test('"What\'s new" stays, as no list is on view to sort (creator-analytics#577)', () => {
    const onWhatsNew = routeToWhatsNew(listRouteOf('?sort=-estimatedMinutesWatched&page=2'))
    expect(routeAfterLostSwitches(onWhatsNew, { watchTimeColumn: true })).toBe(onWhatsNew)
  })

  test.each([
    ['Watch hours', '-estimatedMinutesWatched', { watchTimeColumn: true }],
    ['Revenue', '-estimatedRevenue', { revenueColumn: true }],
    ['the sources', '-estimatedAdRevenue', { revenueSources: true }],
  ] as const)(
    'a lost switch-on of %s leaves the Audience screen as it was, as no list is on view to sort',
    (_switch, sort, lost) => {
      const onAudience = routeToAudience(listRouteOf(`?sort=${sort}&page=2`))
      expect(routeAfterLostSwitches(onAudience, lost)).toBe(onAudience)
    },
  )

  test('a failed save on the Audience screen does not move it, and its notice shows on the Audience address', () => {
    const onAudience = routeToAudience(listRouteOf('?sort=-estimatedMinutesWatched&page=2'))
    const navigate = vi.fn()
    const shownOn = revertAddressAfterFailedSave(
      onAudience,
      { watchTimeColumn: true },
      navigate,
      (route) => routeAfterLostSwitches(route, { watchTimeColumn: true }),
    )
    expect(navigate).not.toHaveBeenCalled()
    expect(shownOn).toBe(addressOf(onAudience))
  })

  test('a lost switch-off stays, as the column goes back on', () => {
    const route = listRouteOf('?sort=-estimatedMinutesWatched')
    expect(routeAfterLostSwitches(route, { watchTimeColumn: false })).toBe(route)
  })
})

describe('the route the list reads', () => {
  const allOn = { views: true, watchTime: true, revenue: true }
  const withoutConsent = { ...allOn, revenue: false }

  test.each([
    '?sort=-estimatedRevenue&page=3',
    '?sort=estimatedRevenue&page=2',
    '?sort=estimatedRevenue&window=first7',
    '?sort=-rpm&page=3',
    '?sort=rpm&window=first7',
  ])(
    'with the Revenue column off, as on a channel without revenue consent, a revenue or RPM sort from the address (%s) runs newest first from the first page',
    (search) => {
      const route = listRouteOf(search)
      expect(listRouteFor(route, withoutConsent, false)).toEqual({
        ...route,
        sort: '-publishedAt',
        page: 1,
      })
    },
  )

  test.each(['-estimatedAdRevenue', 'estimatedRedPartnerRevenue', '-otherSources'])(
    'with the Revenue column off, as on a channel without revenue consent, the source sort %s runs newest first from the first page',
    (sort) => {
      const route = listRouteOf(`?sort=${sort}&page=3`)
      expect(listRouteFor(route, withoutConsent, true)).toEqual({
        ...route,
        sort: '-publishedAt',
        page: 1,
      })
    },
  )

  test('with the Revenue column on, as on a channel with revenue consent, a revenue or RPM sort stays, and a source sort with the sources shown', () => {
    const route = listRouteOf('?sort=-estimatedRevenue&page=3')
    expect(listRouteFor(route, allOn, false)).toBe(route)
    const byRpm = listRouteOf('?sort=-rpm&page=3')
    expect(listRouteFor(byRpm, allOn, false)).toBe(byRpm)
    expect(listRouteFor(byRpm, allOn, true)).toBe(byRpm)
    const bySource = listRouteOf('?sort=-estimatedAdRevenue&page=3')
    expect(listRouteFor(bySource, allOn, true)).toBe(bySource)
  })

  test('with the sources hidden, a source sort runs newest first from the first page', () => {
    const route = listRouteOf('?sort=-otherSources&page=3')
    expect(listRouteFor(route, allOn, false)).toEqual({ ...route, sort: '-publishedAt', page: 1 })
  })

  test('with the Revenue column off, as on a channel without revenue consent, any other sort stays', () => {
    const route = listRouteOf('?sort=-views&page=2')
    expect(listRouteFor(route, withoutConsent, false)).toBe(route)
    expect(listRouteFor(defaultRoute, withoutConsent, false)).toBe(defaultRoute)
  })

  test('with the Watch hours column off, a watch hours sort from the address runs newest first from the first page', () => {
    const route = listRouteOf('?sort=-estimatedMinutesWatched&page=2')
    expect(listRouteFor(route, { ...allOn, watchTime: false }, true)).toEqual({
      ...route,
      sort: '-publishedAt',
      page: 1,
    })
  })

  test('with the Views column off, a views sort stays, since a narrow screen shows views whatever its switch', () => {
    const route = listRouteOf('?sort=-views&page=2')
    expect(listRouteFor(route, { ...allOn, views: false }, true)).toBe(route)
  })

  test('hiding the sources while the list is sorted by one runs newest first from the first page', () => {
    const route = listRouteOf('?sort=estimatedRedPartnerRevenue&page=2')
    expect(routeWithSourcesOff(route)).toEqual({ ...route, sort: '-publishedAt', page: 1 })
    const byViews = listRouteOf('?sort=-views&page=2')
    expect(routeWithSourcesOff(byViews)).toBe(byViews)
  })

  test("the list's own button hides the sources in place of the address on view, which the list would rewrite at once, so Back skips it", () => {
    const route = listRouteOf('?sort=estimatedRedPartnerRevenue&page=2')
    const navigated: [Route, { replace?: boolean } | undefined][] = []
    const navigate = (next: Route, options?: { replace?: boolean }) => {
      navigated.push([next, options])
    }

    hideSourcesOn(route, navigate)
    hideSourcesOn(listRouteOf('?sort=-views'), navigate)

    expect(navigated).toEqual([[routeWithSourcesOff(route), { replace: true }]])
  })
})

describe("the route once the list's answer lands", () => {
  test.for([
    ['outside the YouTube Partner Program', { ...answer, revenue: { refusal: 'not_monetized' } }],
    ['Google answered no revenue row for', unreported],
  ] as const)(
    'a source sort on a channel %s runs newest first from the first page, as its columns do not show',
    ([, landed]) => {
      const route = listRouteOf('?sort=-estimatedAdRevenue&page=2')
      expect(routeAfterListAnswerOf(route, landed)).toEqual({
        ...route,
        sort: '-publishedAt',
        page: 1,
      })
    },
  )

  test('a source sort stays on a channel with revenue, as does any other sort with none', () => {
    const route = listRouteOf('?sort=-estimatedAdRevenue&page=2')
    expect(routeAfterListAnswerOf(route, { ...answer, pageCount: 2 })).toBe(route)
    const byViews = listRouteOf('?sort=-views&page=2')
    expect(
      routeAfterListAnswerOf(byViews, {
        ...answer,
        pageCount: 2,
        revenue: { refusal: 'not_monetized' },
      }),
    ).toBe(byViews)
  })

  test.for([
    ['CTR', '-ctr'],
    ['impressions', 'impressions'],
  ] as const)(
    'a sort by %s on an answer without the history runs newest first from the first page, as its columns do not show',
    ([, sort]) => {
      const route = listRouteOf(`?sort=${sort}&page=2`)
      expect(routeAfterListAnswerOf(route, { ...answer, pageCount: 2 })).toEqual({
        ...route,
        sort: '-publishedAt',
        page: 1,
      })
    },
  )

  test('a CTR sort stays on an answer with the history', () => {
    const route = listRouteOf('?sort=-ctr&page=2')
    expect(
      routeAfterListAnswerOf(route, {
        ...answer,
        pageCount: 2,
        history: { firstDay: '2026-09-01', newestDay: '2026-10-04' },
      }),
    ).toBe(route)
  })

  test('a page past the last moves to the last', () => {
    const route = listRouteOf('?page=9')
    expect(routeAfterListAnswerOf(route, { ...answer, pageCount: 2 })).toEqual({
      ...route,
      page: 2,
    })
  })
})

describe('the note above a list with the Revenue column on', () => {
  const on = { views: false, watchTime: false, revenue: true }

  test('for a channel outside the YouTube Partner Program, says YouTube reports no revenue for it', () => {
    expect(revenueNoteOf({ ...answer, revenue: { refusal: 'not_monetized' } }, on)).toBe(
      'This channel is not in the YouTube Partner Program, so YouTube reports no revenue for it.',
    )
  })

  test('for a channel Google answered no revenue row for, says YouTube reports no revenue for the date range', () => {
    expect(revenueNoteOf(unreported, on)).toBe(
      'YouTube reports no revenue for this date range. That can happen when no revenue was earned during the date range, or when the channel is not in the YouTube Partner Program.',
    )
  })

  test('is none with the column off, with revenue, or without revenue consent', () => {
    expect(
      revenueNoteOf(
        { ...answer, revenue: { refusal: 'not_monetized' } },
        { ...on, revenue: false },
      ),
    ).toBeNull()
    expect(revenueNoteOf(unreported, { ...on, revenue: false })).toBeNull()
    expect(revenueNoteOf(reported, on)).toBeNull()
    expect(revenueNoteOf({ ...answer, revenue: { refusal: 'consent_missing' } }, on)).toBeNull()
  })
})

describe("the list's revenue sources button", () => {
  const on = { views: false, watchTime: false, revenue: true }

  test('shows with the Revenue column on, while the list is read and once its revenue answered', () => {
    expect(sourcesButtonShownOf(null, on)).toBe(true)
    expect(sourcesButtonShownOf(reported, on)).toBe(true)
  })

  test('is gone with the Revenue column off, or for a channel YouTube reports no revenue for', () => {
    expect(sourcesButtonShownOf(null, { ...on, revenue: false })).toBe(false)
    expect(sourcesButtonShownOf({ ...answer, revenue: { refusal: 'not_monetized' } }, on)).toBe(
      false,
    )
    expect(sourcesButtonShownOf(unreported, on)).toBe(false)
  })
})

describe("the list's traffic source select and minimum impressions field (creator-analytics#944)", () => {
  const withHistory = { ...answer, history: { firstDay: '2026-09-01', newestDay: '2026-10-04' } }

  test('show where the answer carries the history, and not where it does not, whatever the plan', () => {
    expect(historyFiltersShownOf(withHistory, 'filters-answered', false, {})).toBe(true)
    expect(historyFiltersShownOf(answer, 'filters-answered', true, {})).toBe(false)
  })

  test("before the channel's first answer, show for a paid channel, so the controls row holds still while the read lands", () => {
    expect(historyFiltersShownOf(null, 'filters-first-read', true, {})).toBe(true)
    expect(historyFiltersShownOf(null, 'filters-first-read', false, {})).toBe(false)
    expect(historyFiltersShownOf(null, null, true, {})).toBe(false)
  })

  test("with no answer shown, as after Back from a video or a refused read, keep what the channel's last answer on this page load said", () => {
    rememberListHistoryOf('filters-history', withHistory)
    rememberListHistoryOf('filters-no-history', answer)

    expect(historyFiltersShownOf(null, 'filters-history', false, {})).toBe(true)
    expect(historyFiltersShownOf(null, 'filters-no-history', true, {})).toBe(false)
  })

  test('with a traffic source or a minimum in the address, show whatever the channel, so a refused read can be cleared', () => {
    rememberListHistoryOf('filters-refused', answer)

    expect(
      historyFiltersShownOf(null, 'filters-refused', false, { trafficSource: 'YT_SEARCH' }),
    ).toBe(true)
    expect(historyFiltersShownOf(null, 'filters-refused', false, { minImpressions: 500 })).toBe(
      true,
    )
    expect(historyFiltersShownOf(answer, 'filters-refused', false, { minImpressions: 500 })).toBe(
      true,
    )
    expect(historyFiltersShownOf(null, null, false, { trafficSource: 'YT_SEARCH' })).toBe(false)
  })
})

describe('the source columns of the list', () => {
  const on = { views: false, watchTime: false, revenue: true }

  test('show with the Revenue column on and the sources shown in the saved choice, while the list is read and once its revenue answered', () => {
    expect(sourceColumnsShownOf(null, on, true)).toBe(true)
    expect(sourceColumnsShownOf(reported, on, true)).toBe(true)
    expect(sourceColumnsShownOf(reported, on, false)).toBe(false)
  })

  test('are gone for a channel YouTube reports no revenue for, whatever the saved choice', () => {
    expect(
      sourceColumnsShownOf({ ...answer, revenue: { refusal: 'not_monetized' } }, on, true),
    ).toBe(false)
    expect(sourceColumnsShownOf(unreported, on, true)).toBe(false)
  })
})

describe('the note on the currency under the list', () => {
  const on = { views: false, watchTime: false, revenue: true }
  const afterPublish = { ...reported, window: 'first7' } as const

  test('shows in a window after publish when the Revenue column shows and revenue answered', () => {
    expect(listCurrencyNoteOf(afterPublish, on)).toBe(
      'YouTube converts revenue at its daily exchange rate. Your final amount is in AdSense.',
    )
  })

  test('is none in a calendar window, where the summary carries it, with the column off, or without revenue', () => {
    expect(listCurrencyNoteOf({ ...afterPublish, window: 'last28' }, on)).toBeNull()
    expect(listCurrencyNoteOf(afterPublish, { ...on, revenue: false })).toBeNull()
    expect(
      listCurrencyNoteOf({ ...afterPublish, revenue: { refusal: 'not_monetized' } }, on),
    ).toBeNull()
    expect(
      listCurrencyNoteOf({ ...afterPublish, revenue: { currency: 'USD', reported: false } }, on),
    ).toBeNull()
  })
})

describe("the currency the list's Revenue cells are in", () => {
  const on = { views: false, watchTime: false, revenue: true }
  const revenueCellOf = (landed: VideoListAnswer) => {
    const cells = metricCellsOf({ ...row, estimatedRevenue: 0 }, on, {
      locale: 'en-US',
      currency: listRevenueCurrencyOf(landed),
    })
    return cells.kind === 'numbers'
      ? cells.cells.find(({ label }) => label === 'Revenue')?.text
      : undefined
  }

  test("is the answer's, so a monetized channel whose video earned nothing shows $0.00", () => {
    expect(revenueCellOf(reported)).toBe('$0.00')
  })

  test('is none for a channel Google answered no revenue row for, so its Revenue cells are empty, not $0.00', () => {
    expect(revenueCellOf(unreported)).toBe('')
  })

  test('is none for a channel outside the YouTube Partner Program or without revenue consent', () => {
    expect(
      listRevenueCurrencyOf({ ...answer, revenue: { refusal: 'not_monetized' } }),
    ).toBeUndefined()
    expect(
      listRevenueCurrencyOf({ ...answer, revenue: { refusal: 'consent_missing' } }),
    ).toBeUndefined()
  })
})

describe('the list read the video list and the detail screen share', () => {
  const consented: ListedChannel = {
    id: 'c-1',
    youtubeChannelId: 'UC1',
    title: 'A channel',
    handle: null,
    revenueConsentedAt: '2026-10-01T00:00:00Z',
  }
  const notConsented: ListedChannel = { ...consented, revenueConsentedAt: null }

  test('reads the page, window, sort and format of the address, with the saved page size and visibility', () => {
    const route: Route = {
      ...defaultRoute,
      page: 3,
      window: 'last90',
      sort: '-views',
      format: 'short',
    }

    const read = listReadOf(route, notConsented, {
      pageSize: 25,
      visibility: 'all',
      currency: 'EUR',
    })

    expect(read.route).toBe(route)
    expect(read.query).toBe(
      'page=3&window=last90&sort=-views&format=short&pageSize=25&visibility=all',
    )
  })

  test('keys the read by its query and the saved currency, so a change of either reads again', () => {
    const route: Route = { ...defaultRoute, page: 3 }
    const saved = { currency: 'EUR' } as const
    const { key } = listReadOf(route, notConsented, saved)

    expect(listReadOf({ ...route }, notConsented, { ...saved }).key).toBe(key)
    expect(listReadOf(route, notConsented, { currency: 'USD' }).key).not.toBe(key)
    expect(listReadOf({ ...route, page: 4 }, notConsented, saved).key).not.toBe(key)
  })

  // creator-analytics#357: the API's RPM sort reads the saved switch, so a change of it reads again.
  test('keys the read and the list by the saved RPM switch too', () => {
    const route: Route = { ...defaultRoute, page: 3 }
    const off = listReadOf(route, notConsented, { rpmAdsAndPremiumOnly: false })
    const on = listReadOf(route, notConsented, { rpmAdsAndPremiumOnly: true })

    expect(on.key).not.toBe(off.key)
    expect(on.listKey).not.toBe(off.listKey)
    expect(listReadOf(route, notConsented, {}).key).toBe(off.key)
  })

  test('keys the list a page is of by all of its read but the page, so only another page shares it', () => {
    const route: Route = { ...defaultRoute, page: 3 }
    const saved = { currency: 'EUR' } as const
    const { listKey } = listReadOf(route, notConsented, saved)

    expect(listReadOf({ ...route, page: 4 }, notConsented, saved).listKey).toBe(listKey)
    expect(listReadOf({ ...route, format: 'short' }, notConsented, saved).listKey).not.toBe(listKey)
    expect(listReadOf(route, notConsented, { currency: 'USD' }).listKey).not.toBe(listKey)
  })

  test('reads another page of a landed list of the channel when the read differs from it in its page alone', () => {
    const saved = { currency: 'EUR' } as const
    const at = (route: Route) => listReadOf(route, notConsented, saved)
    const page3 = at({ ...defaultRoute, page: 3 })
    const read = (view: LandedListView, channelId = consented.id) => ({
      channelId,
      key: page3.key,
      listKey: page3.listKey,
      view,
    })
    const list = read({ kind: 'list', answer })
    const page4 = at({ ...defaultRoute, page: 4 })

    expect(readsAnotherPageOf(list, consented.id, page4)).toBe(true)
    expect(readsAnotherPageOf(list, consented.id, page3)).toBe(false)
    expect(readsAnotherPageOf(list, consented.id, at({ ...defaultRoute, format: 'short' }))).toBe(
      false,
    )
    expect(
      readsAnotherPageOf(read({ kind: 'list', answer }, 'channel-2'), consented.id, page4),
    ).toBe(false)
    expect(readsAnotherPageOf(read({ kind: 'refused', message: 'No.' }), consented.id, page4)).toBe(
      false,
    )
    expect(readsAnotherPageOf(null, consented.id, page4)).toBe(false)
  })

  test("the address's page size and visibility win over the saved ones, and a custom range is read with its days", () => {
    const route: Route = {
      ...defaultRoute,
      window: 'custom',
      range: { from: '2026-09-01', to: '2026-09-30' },
      pageSize: 50,
      visibility: 'public',
    }

    expect(listReadOf(route, consented, { pageSize: 25, visibility: 'all' }).query).toBe(
      'page=1&window=custom&from=2026-09-01&to=2026-09-30&sort=-publishedAt&format=all&pageSize=50&visibility=public',
    )
  })

  test('a revenue sort without revenue consent is read newest first from page 1', () => {
    const route: Route = { ...defaultRoute, page: 2, sort: '-estimatedRevenue' }

    const read = listReadOf(route, notConsented, {})

    expect(read.route).toEqual({ ...defaultRoute, page: 1, sort: '-publishedAt' })
    expect(read.query).toBe(
      'page=1&window=last28&sort=-publishedAt&format=all&pageSize=10&visibility=public',
    )
  })

  test('a watch hours sort with its column off is read newest first from page 1, and with it on as the address says', () => {
    const route: Route = { ...defaultRoute, page: 4, sort: 'estimatedMinutesWatched' }

    expect(listReadOf(route, consented, {}).query).toBe(
      'page=1&window=last28&sort=-publishedAt&format=all&pageSize=10&visibility=public',
    )
    expect(listReadOf(route, consented, { watchTimeColumn: true }).query).toBe(
      'page=4&window=last28&sort=estimatedMinutesWatched&format=all&pageSize=10&visibility=public',
    )
  })

  test('with no channel yet, the address is read as it is', () => {
    const route: Route = { ...defaultRoute, sort: '-estimatedRevenue', page: 2 }

    expect(listReadOf(route, null, {}).route).toBe(route)
  })
})

describe("a paid channel's impressions and CTR columns (creator-analytics#785)", () => {
  const reaching: VideoRow = { ...row, impressions: 12_340, ctr: 0.0456 }

  test('with the history, Impressions and CTR follow Engaged views and sort the list (creator-analytics#943); without it, neither shows, so a free channel has no such heading to sort by', () => {
    const switches = { views: false, watchTime: false, revenue: false }
    const withHistory = listColumnsShownOf(switches, { window: 'last28', history: true })

    expect(withHistory.map(({ column }) => column.label).slice(2, 5)).toEqual([
      'Engaged views',
      'Impressions',
      'CTR',
    ])
    expect(withHistory.slice(3, 5).map(({ column }) => column.sortKey)).toEqual([
      'impressions',
      'ctr',
    ])
    for (const window of ['last28', 'first7'] as const) {
      const labels = listColumnsShownOf(switches, { window }).map(({ column }) => column.label)
      expect(labels).not.toContain('Impressions')
      expect(labels).not.toContain('CTR')
    }
  })

  test.each(['lifetime', 'last28', 'custom', 'first7', 'first365'] as const)(
    'in %s, the Impressions and CTR headings sort highest first, and a second click lowest first',
    (window) => {
      const shown = listColumnsShownOf(
        { views: false, watchTime: false, revenue: false },
        { window, history: true },
      )
      const heading = (label: string) => {
        const found = shown.find(({ column }) => column.label === label)?.column
        if (!found) throw new Error(`No column ${label}`)
        return found
      }

      expect(listHeadingSortOf(heading('CTR'), window, '-publishedAt')).toEqual({
        direction: 'none',
        next: '-ctr',
      })
      expect(listHeadingSortOf(heading('CTR'), window, '-ctr')).toEqual({
        direction: 'descending',
        next: 'ctr',
      })
      expect(listHeadingSortOf(heading('Impressions'), window, '-publishedAt')).toEqual({
        direction: 'none',
        next: '-impressions',
      })
      expect(listHeadingSortOf(heading('Impressions'), window, '-impressions')).toEqual({
        direction: 'descending',
        next: 'impressions',
      })
    },
  )

  test.each(['lifetime', 'first7'] as const)(
    'in %s, the CTR and Impressions sorts are announced by their headings',
    (window) => {
      expect(sortLabelOf(window, '-ctr')).toBe('CTR, highest first')
      expect(sortLabelOf(window, 'ctr')).toBe('CTR, lowest first')
      expect(sortLabelOf(window, '-impressions')).toBe('Impressions, highest first')
      expect(sortLabelOf(window, 'impressions')).toBe('Impressions, lowest first')
    },
  )

  test('a row shows its impressions and its CTR as a percentage with one decimal place, and an empty CTR with no impressions', () => {
    const cellsOf = (video: VideoRow) => {
      const cells = metricCellsOf(
        video,
        { views: true, watchTime: false, revenue: false },
        { locale: 'en-US', window: 'last28', history: true },
      )
      return cells.kind === 'numbers' ? cells.cells.slice(1, 3) : []
    }

    expect(cellsOf(reaching)).toEqual([
      { label: 'Impressions', text: '12,340', narrowOnly: false },
      { label: 'CTR', text: '4.6%', narrowOnly: false },
    ])
    expect(cellsOf({ ...reaching, impressions: 0, ctr: null }).map(({ text }) => text)).toEqual([
      '0',
      '',
    ])
  })

  test('the cells of a row whose days start before the history carry its "N of M days" label', () => {
    const cells = metricCellsOf(
      { ...reaching, historyPartial: { days: 24, of: 28 } },
      { views: true, watchTime: false, revenue: false },
      { locale: 'en-US', window: 'last28', history: true },
    )

    expect(cells.kind === 'numbers' && cells.cells.map(({ partial }) => partial)).toEqual([
      undefined,
      '24 of 28 days',
      '24 of 28 days',
      undefined,
      undefined,
      undefined,
    ])
  })
})
