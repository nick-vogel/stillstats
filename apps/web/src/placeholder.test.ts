// Limits: these tests render the markup a component first mounts with, through React's server
// renderer, and run no effect and no browser. They show what the live region holds when it is
// established, not what a screen reader then says. Nick hears each loading text with VoiceOver at
// /app. They show which places a placeholder holds, by its shape's class, not any height, so not
// that the page keeps still when the answer lands; the one exception reads app.css's line counts
// for the awaiting paragraph's place, and states its own limits. Nick checks that at /app, the
// charts in running total mode included, with a throttled network.
import { readFileSync } from 'node:fs'
import type { ListedChannel, Preferences, VideoRow } from '@creator-analytics/api-types'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { Audience } from './Audience.tsx'
import { audienceQueryOf, audienceRequestOf } from './audience.ts'
import { fullAudienceRows, rememberAudienceRowsOf } from './audience-rows.ts'
import { LaunchChart } from './LaunchChart.tsx'
import { launchChartText } from './launch-chart.ts'
import {
  AfterPublishPlaceholder,
  LoadingStatus,
  MetricChartsPlaceholder,
  PlaceholderBarRows,
} from './Placeholder.tsx'
import { PreferencesContext } from './preferences.ts'
import { rememberAwaitingProcessingOf } from './processing.ts'
import { defaultRoute, type Route } from './route.ts'
import { rememberSincePublishOf } from './since-publish.ts'
import { VideoDetail } from './VideoDetail.tsx'
import { listReadOf, rememberListRowsOf, rememberPublishDayTopRowsOf } from './video-list.ts'

test('the loading status mounts empty, so a screen reader announces the text set after it', () => {
  expect(renderToStaticMarkup(createElement(LoadingStatus, { text: 'Loading videos' }))).toMatch(
    /^<p[^>]*\brole="status"[^>]*><\/p>$/,
  )
})

test('the bar rows placeholder holds as many bar rows as it is given, and three when given none (creator-analytics#510)', () => {
  const rowsOf = (markup: string) => markup.match(/class="placeholder-bar-row"/g)?.length ?? 0
  expect(rowsOf(renderToStaticMarkup(createElement(PlaceholderBarRows, { rows: 11 })))).toBe(11)
  expect(rowsOf(renderToStaticMarkup(createElement(PlaceholderBarRows, { rows: 0 })))).toBe(0)
  expect(rowsOf(renderToStaticMarkup(createElement(PlaceholderBarRows)))).toBe(3)
})

/** The charts placeholder's markup on `route`, with `saved` as the saved preferences. */
function chartsPlaceholderOn(route: Route, saved: Preferences = {}): string {
  return renderToStaticMarkup(
    createElement(
      PreferencesContext,
      { value: { saved, save: () => {}, settled: async () => {} } },
      createElement(MetricChartsPlaceholder, { route }),
    ),
  )
}

test('the charts placeholder holds the running total note in running total mode alone', () => {
  const note = 'placeholder-total-note'
  expect(chartsPlaceholderOn({ ...defaultRoute, chart: 'aggregate' })).toContain(note)
  expect(chartsPlaceholderOn({ ...defaultRoute, chart: 'daily' })).not.toContain(note)
  // With no mode in the address, the saved one, as the charts take it.
  expect(chartsPlaceholderOn(defaultRoute, { chartMode: 'aggregate' })).toContain(note)
})

test("the charts placeholder holds the numbers table's place at the same height in both modes, since the table stays daily", () => {
  const tableOn = (markup: string) =>
    /class="placeholder placeholder-table" style="--rows:(\d+)"/.exec(markup)?.[1]
  const daily = tableOn(chartsPlaceholderOn({ ...defaultRoute, chart: 'daily' }))

  expect(daily).toBeDefined()
  expect(tableOn(chartsPlaceholderOn({ ...defaultRoute, chart: 'aggregate' }))).toBe(daily)
})

test("below the stacked charts the charts placeholder holds the engaged views legend only when that card's chart is the one shown", () => {
  const legendOn = (markup: string) =>
    /class="placeholder placeholder-legend[^"]*"/.exec(markup)?.[0]
  const always = 'class="placeholder placeholder-legend"'
  const stackedOnly = 'class="placeholder placeholder-legend placeholder-stacked-only"'

  expect(legendOn(chartsPlaceholderOn(defaultRoute))).toBe(always)
  expect(legendOn(chartsPlaceholderOn({ ...defaultRoute, chartCard: 'engagedViews' }))).toBe(always)
  expect(legendOn(chartsPlaceholderOn({ ...defaultRoute, chartCard: 'watchTime' }))).toBe(
    stackedOnly,
  )
  expect(legendOn(chartsPlaceholderOn(defaultRoute, { chartCard: 'watchTime' }))).toBe(stackedOnly)
  expect(legendOn(chartsPlaceholderOn({ ...defaultRoute, chartCard: 'revenue' }))).toBe(stackedOnly)
})

test("the charts placeholder holds the revenue sources button's place once a revenue sources choice is saved, shown or hidden, and none with nothing saved", () => {
  const button = 'placeholder-button'
  expect(chartsPlaceholderOn(defaultRoute, { revenueSources: true })).toContain(button)
  expect(chartsPlaceholderOn(defaultRoute, { revenueSources: false })).toContain(button)
  expect(chartsPlaceholderOn(defaultRoute)).not.toContain(button)
})

test("the charts placeholder holds the other sources note's place under the numbers table once a revenue sources choice is saved, shown or hidden, and none with nothing saved (creator-analytics#509)", () => {
  const note = 'placeholder-other-sources-note'
  for (const revenueSources of [true, false]) {
    const markup = chartsPlaceholderOn(defaultRoute, { revenueSources })
    expect(markup).toContain(note)
    expect(markup.indexOf('placeholder-table')).toBeLessThan(markup.indexOf(note))
  }
  expect(chartsPlaceholderOn(defaultRoute)).not.toContain(note)
})

/** `element`'s markup under `saved` as the saved preferences. */
function markupWith(saved: Preferences, element: ReactElement): string {
  return renderToStaticMarkup(
    createElement(
      PreferencesContext,
      { value: { saved, save: () => {}, settled: async () => {} } },
      element,
    ),
  )
}

/**
 * The placeholder of the summary's place in a window after publish, on `route`, for `channel`,
 * by default no channel yet, so with no earlier answer.
 */
function afterPublishPlaceholderOn(
  route: Route,
  saved: Preferences = {},
  channel: ListedChannel | null = null,
): string {
  return markupWith(saved, createElement(AfterPublishPlaceholder, { route, channel }))
}

/** A list row with `engagedViewsByDay` as its processed days, none when empty. */
function launchRow(id: string, engagedViewsByDay: number[]): VideoRow {
  return {
    id,
    title: `Upload ${id}`,
    thumbnailUrl: null,
    thumbnails: [],
    durationSeconds: null,
    publishedAt: '2026-09-01T15:00:00Z',
    scheduled: false,
    privacy: 'public',
    format: 'video',
    engagedViews: 0,
    views: 0,
    subscribersGained: 0,
    estimatedMinutesWatched: 0,
    awaitingProcessing: false,
    engagedViewsByDay,
  }
}

/** A page of `size` rows, each processed when `processed`, else none of them. */
function pageOf(size: number, processed: boolean): VideoRow[] {
  return Array.from({ length: size }, (_, index) =>
    launchRow(`video${index + 1}`, processed ? [index + 1, index + 2] : []),
  )
}

/** The loaded launch chart's markup for `videos` on `route`, with `saved` as the saved preferences. */
function launchChartOn(route: Route, videos: VideoRow[], saved: Preferences = {}): string {
  return markupWith(
    saved,
    createElement(LaunchChart, {
      videos,
      window: 'first28',
      route,
      navigate: () => {},
      markedVideoId: null,
      markedBy: null,
      onMark: () => {},
      note: 'YouTube has processed data up to Sep 30.',
    }),
  )
}

/** React's markup of `text`, as it escapes it. */
function htmlOf(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll("'", '&#x27;').replaceAll('"', '&quot;')
}

const placeholderParts: Record<string, string> = {
  toolbar: 'toolbar',
  heading: 'heading',
  chart: 'plot',
  axis: 'axis',
  'first-rows-note': 'first-rows note',
  'launch-total-note': 'total note',
  'total-note': 'total note',
  note: 'note',
}

/**
 * The parts of a launch chart's markup, or of its placeholder's, in order, each named by its role
 * on the page, so the two compare: the mode buttons' toolbar, the heading, the plot, the axis, each
 * note under it by its text, and a bare sentence. A placeholder names each by its shape's class.
 */
function launchPartsOf(markup: string): string[] {
  const pattern =
    /class="placeholder placeholder-([a-z-]+)"|<fieldset class="metric-charts-modes"|<h2>|class="chart"|class="metric-charts-axis"|<p class="note">([^<]*)<\/p>|<p>/g
  return [...markup.matchAll(pattern)].map(([part, shape, note]) => {
    if (shape !== undefined) return placeholderParts[shape] ?? `placeholder ${shape}`
    if (note !== undefined) {
      if (note === htmlOf(launchChartText.firstRowsNote)) return 'first-rows note'
      if (note === htmlOf(launchChartText.runningTotalNote)) return 'total note'
      return 'note'
    }
    if (part.startsWith('<fieldset')) return 'toolbar'
    if (part === '<h2>') return 'heading'
    if (part === 'class="chart"') return 'plot'
    if (part === 'class="metric-charts-axis"') return 'axis'
    return 'text'
  })
}

// Limits: these compare the parts the placeholder and the loaded chart hold, in order, not their
// heights. With no earlier answer for the page, as here, the page size predicts the first-10 note,
// so a page of 10 rows or fewer at page size 25 or 50 holds a place that never fills, an accepted
// mis-prediction (creator-analytics#314) left only for a page the list has not answered on this
// page load (creator-analytics#325). Nick checks the page keeps still at /app with a throttled
// network.
test.each([
  { size: 10, chart: 'daily' },
  { size: 25, chart: 'daily' },
  { size: 50, chart: 'daily' },
  { size: 10, chart: 'aggregate' },
  { size: 25, chart: 'aggregate' },
  { size: 50, chart: 'aggregate' },
] as const)(
  "the launch chart placeholder holds the loaded chart's parts in order at page size $size, $chart",
  ({ size, chart }) => {
    const route: Route = { ...defaultRoute, window: 'first28', chart, pageSize: size }
    const placeholder = launchPartsOf(afterPublishPlaceholderOn(route))

    expect(placeholder).toEqual(launchPartsOf(launchChartOn(route, pageOf(size, true))))
    expect(placeholder).toContain('plot')
  },
)

test("the launch chart placeholder holds the first-10 note's place at the saved page size when the address names none", () => {
  const route: Route = { ...defaultRoute, window: 'first28', chart: 'daily' }
  const saved: Preferences = { pageSize: 25 }
  const placeholder = launchPartsOf(afterPublishPlaceholderOn(route, saved))

  expect(placeholder).toEqual(launchPartsOf(launchChartOn(route, pageOf(25, true), saved)))
  expect(placeholder).toContain('first-rows note')
})

// The rows memo lives as long as the test file, as it does the page, so each case names its own
// channel. The list remembers each answer under the query it read, which `listReadOf` builds.
describe('the launch chart placeholder after the list answered the same page (creator-analytics#325)', () => {
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
  /** Remembers that the list's read of `route` for `channel` answered `rows` rows. */
  function answered(channel: ListedChannel, route: Route, rows: number) {
    rememberListRowsOf(channel.id, listReadOf(route, channel, {}).query, rows)
  }

  test.each([
    { size: 25, rows: 7, chart: 'daily', firstRowsNote: false },
    { size: 25, rows: 7, chart: 'aggregate', firstRowsNote: false },
    { size: 50, rows: 10, chart: 'daily', firstRowsNote: false },
    { size: 25, rows: 25, chart: 'daily', firstRowsNote: true },
    { size: 50, rows: 11, chart: 'aggregate', firstRowsNote: true },
  ] as const)(
    "after an answer of $rows rows at page size $size, $chart, it holds the loaded chart's parts for $rows rows",
    ({ size, rows, chart, firstRowsNote }) => {
      const channel = channelOf(`c-answered-${size}-${rows}-${chart}`)
      const route: Route = { ...defaultRoute, window: 'first28', chart, page: 3, pageSize: size }
      answered(channel, route, rows)
      const placeholder = launchPartsOf(afterPublishPlaceholderOn(route, {}, channel))

      expect(placeholder).toEqual(launchPartsOf(launchChartOn(route, pageOf(rows, true))))
      expect(placeholder.includes('first-rows note')).toBe(firstRowsNote)
    },
  )

  test("an answer for another page of the channel leaves this page's placeholder to the page size", () => {
    const channel = channelOf('c-answered-other-page')
    const route: Route = {
      ...defaultRoute,
      window: 'first28',
      chart: 'daily',
      page: 3,
      pageSize: 25,
    }
    answered(channel, { ...route, page: 2 }, 7)

    expect(launchPartsOf(afterPublishPlaceholderOn(route, {}, channel))).toContain(
      'first-rows note',
    )
  })
})

// The accepted jump of the shape, which the PR for creator-analytics#314 names: when no row on the
// page is processed, the empty answer keeps the heading and the delay note in their order, and the
// toolbar, plot and axis places drop for its sentence, so what follows moves up. At page size 25 or
// 50 the first-10 note's place drops too, as creator-analytics#311 rules that note out under the
// empty state while the placeholder still predicts it from the page size. In running total mode the
// total note's place drops too, as the empty answer draws no running total and so holds no note on
// it.
test.each([
  { size: 10, chart: 'daily' },
  { size: 25, chart: 'daily' },
  { size: 10, chart: 'aggregate' },
  { size: 25, chart: 'aggregate' },
] as const)(
  "the launch chart's empty answer at page size $size, $chart drops the placeholder's toolbar, plot, axis, first-10 note and total note for its sentence and keeps the delay note, the accepted jump",
  ({ size, chart }) => {
    const route: Route = { ...defaultRoute, window: 'first28', chart, pageSize: size }
    const empty = launchPartsOf(launchChartOn(route, pageOf(size, false)))
    const placeholder = launchPartsOf(afterPublishPlaceholderOn(route))

    const firstRows = size > 10 ? ['first-rows note'] : []
    const total = chart === 'aggregate' ? ['total note'] : []
    expect(empty).toEqual(['heading', 'text', 'note'])
    expect(placeholder).toEqual([
      'toolbar',
      'heading',
      'plot',
      'axis',
      ...firstRows,
      ...total,
      'note',
    ])
  },
)

test("the launch chart placeholder holds the delay note's place last, under the axis and the running total note", () => {
  const daily = afterPublishPlaceholderOn({ ...defaultRoute, window: 'first28', chart: 'daily' })
  const total = afterPublishPlaceholderOn({
    ...defaultRoute,
    window: 'first28',
    chart: 'aggregate',
  })

  expect(daily.match(/placeholder-note/g)).toHaveLength(1)
  expect(daily.indexOf('placeholder-note')).toBeGreaterThan(daily.indexOf('placeholder-axis'))
  expect(total.indexOf('placeholder-note')).toBeGreaterThan(
    total.indexOf('placeholder-launch-total-note'),
  )
})

test("the launch chart placeholder in running total mode holds its own note's place, not the summary's (creator-analytics#324)", () => {
  const markup = afterPublishPlaceholderOn({
    ...defaultRoute,
    window: 'first28',
    chart: 'aggregate',
  })

  expect(markup).toContain('placeholder-launch-total-note')
  expect(markup).not.toContain('placeholder-total-note')
})

test("the publish day top placeholder holds the delay note's place under its bars", () => {
  const markup = afterPublishPlaceholderOn({ ...defaultRoute, window: 'first1' })

  expect(markup.match(/placeholder-note/g)).toHaveLength(1)
  expect(markup.indexOf('placeholder-note')).toBeGreaterThan(markup.lastIndexOf('placeholder-bar'))
})

describe("the publish day top placeholder's bars (creator-analytics#510)", () => {
  const first1: Route = { ...defaultRoute, window: 'first1' }
  const barRowsOf = (markup: string) => markup.match(/class="placeholder-bar-row"/g)?.length ?? 0
  /** A channel `id` without revenue consent. */
  const channelOf = (id: string): ListedChannel => ({
    id,
    youtubeChannelId: 'UC1',
    title: 'A channel',
    handle: null,
    revenueConsentedAt: null,
  })

  test('on a first read, and with no channel yet, it holds the most the top holds: 10 bars', () => {
    expect(barRowsOf(afterPublishPlaceholderOn(first1, {}, channelOf('pd-first')))).toBe(10)
    expect(barRowsOf(afterPublishPlaceholderOn(first1))).toBe(10)
  })

  test('after the same read answered 4 videos it holds 4, and an answer for another read leaves it at 10', () => {
    const channel = channelOf('pd-four')
    rememberPublishDayTopRowsOf(channel.id, listReadOf(first1, channel, {}).query, 4)
    expect(barRowsOf(afterPublishPlaceholderOn(first1, {}, channel))).toBe(4)
    expect(barRowsOf(afterPublishPlaceholderOn({ ...first1, format: 'short' }, {}, channel))).toBe(
      10,
    )
  })

  test("after the same read answered no video it holds the empty text's place in place of the bars, then the delay note's place", () => {
    const channel = channelOf('pd-empty')
    rememberPublishDayTopRowsOf(channel.id, listReadOf(first1, channel, {}).query, 0)
    const markup = afterPublishPlaceholderOn(first1, {}, channel)
    expect(barRowsOf(markup)).toBe(0)
    expect(markup.match(/placeholder-publish-day-empty-text/g)).toHaveLength(1)
    expect(markup.indexOf('placeholder-publish-day-empty-text')).toBeLessThan(
      markup.indexOf('placeholder-note'),
    )
  })
})

test("the video detail placeholder holds the delay note's place under the charts' axis, above their numbers table", () => {
  const markup = renderToStaticMarkup(
    createElement(
      PreferencesContext,
      { value: { saved: {}, save: () => {}, settled: async () => {} } },
      createElement(VideoDetail, {
        channel: null,
        video: 'dQw4w9WgXcQ',
        route: { ...defaultRoute, chart: 'daily' },
        navigate: () => {},
        onGiveRevenueConsent: () => {},
      }),
    ),
  )
  const note = markup.indexOf('placeholder-note')
  expect(note).toBeGreaterThan(markup.indexOf('placeholder-axis'))
  expect(note).toBeLessThan(markup.indexOf('placeholder-table'))
})

/** The video detail placeholder's markup for `video` on `route`, before its answer. */
function detailPlaceholderOf(video: string, route: Route = defaultRoute): string {
  return renderToStaticMarkup(
    createElement(
      PreferencesContext,
      { value: { saved: {}, save: () => {}, settled: async () => {} } },
      createElement(VideoDetail, {
        channel: null,
        video,
        route,
        navigate: () => {},
        onGiveRevenueConsent: () => {},
      }),
    ),
  )
}

test("the video detail placeholder holds the since publish table's place in its own shape, not the numbers table's, every row for a video the page knows nothing of", () => {
  const markup = detailPlaceholderOf('dQw4w9WgXcQ')
  expect(markup.match(/placeholder-table\b/g)).toHaveLength(1)
  expect(markup).toMatch(/class="placeholder placeholder-since-publish-table" style="--rows:7"/)
})

test('the video detail placeholder holds only the since publish rows a video the page has an answer for will show', () => {
  // Three processed days old: the heading row, the publish day and lifetime.
  rememberSincePublishOf([{ id: 'youngVideo1', publishedAt: '2026-10-01T15:00:00Z' }], '2026-10-03')

  expect(detailPlaceholderOf('youngVideo1')).toMatch(
    /class="placeholder placeholder-since-publish-table" style="--rows:3"/,
  )
})

// The answer draws a revenue card, or a message card for a revenue refusal, only when it carries
// revenue, which the API leaves out for a video with no publish day and for a window with no day of
// the video's. Where cards sit two to a row, a third card's place takes a second row that two cards
// do not fill, so the row would shrink when the answer lands (creator-analytics#439).
describe("the video detail placeholder's cards (creator-analytics#439)", () => {
  /** The card places the detail placeholder holds for `video` on `route`. */
  function cardPlacesOf(video: string, route: Route = defaultRoute): number {
    return detailPlaceholderOf(video, route).match(/placeholder-card\b/g)?.length ?? 0
  }

  test('it holds two card places for a video the page knows has no publish day, as its answer carries no revenue', () => {
    rememberSincePublishOf([{ id: 'noPublishDay1', publishedAt: null }], '2026-10-03')
    rememberAwaitingProcessingOf([{ id: 'noPublishDay1', awaitingProcessing: false }])

    expect(cardPlacesOf('noPublishDay1')).toBe(2)
  })

  test("it holds two card places for a custom range that ends before the video's publish day, as the range has no day of the video's", () => {
    rememberSincePublishOf(
      [{ id: 'publishedLater1', publishedAt: '2026-09-10T15:00:00Z' }],
      '2026-10-03',
    )
    rememberAwaitingProcessingOf([{ id: 'publishedLater1', awaitingProcessing: false }])
    const route: Route = {
      ...defaultRoute,
      window: 'custom',
      range: { from: '2026-08-01', to: '2026-09-09' },
    }

    expect(cardPlacesOf('publishedLater1', route)).toBe(2)
  })

  test('it holds three card places for a published video in the default window, and for a video the page knows nothing of', () => {
    rememberSincePublishOf(
      [{ id: 'publishedVideo1', publishedAt: '2026-09-10T15:00:00Z' }],
      '2026-10-03',
    )
    rememberAwaitingProcessingOf([{ id: 'publishedVideo1', awaitingProcessing: false }])

    expect(cardPlacesOf('publishedVideo1')).toBe(3)
    expect(cardPlacesOf('unknownVideo2')).toBe(3)
  })
})

test("the video detail placeholder holds traffic sources and the subscriber split in the breakdowns grid, in that order, with retention's place outside it and no countries (creator-analytics#192)", () => {
  const markup = detailPlaceholderOf('dQw4w9WgXcQ')
  const gridStart = markup.indexOf('<div class="video-detail-breakdowns">')
  const grid = markup.slice(gridStart)
  // The grid ends where the placeholders do, so each part after a section's tag is that section.
  const sections = grid.split('<div class="video-detail-section">').slice(1)

  expect(gridStart).toBeGreaterThan(-1)
  // Retention's place: its two charts, before the grid.
  expect(markup.lastIndexOf('placeholder-chart')).toBeLessThan(gridStart)
  expect(sections).toHaveLength(2)
  expect(sections.map((inner) => inner.match(/placeholder-bar-row/g)?.length ?? 0)).toEqual([3, 0])
  expect(grid).not.toContain('placeholder-note')
})

// "Subscribers and non-subscribers (engaged views)" wraps to two lines in a breakdowns column
// narrower than 372.91px, measured in Chrome by the repro script; "Traffic sources (engaged views)"
// and every other section heading on the page take one line from 320px to 2560px, so they keep the
// one-line heading's place (creator-analytics#512).
test("the video detail placeholder holds the subscriber split's heading place in a shape of its own, first in its breakdowns column, and every other section heading's place as one line (creator-analytics#512)", () => {
  const markup = detailPlaceholderOf('dQw4w9WgXcQ')
  const gridStart = markup.indexOf('<div class="video-detail-breakdowns">')
  const columns = markup.slice(gridStart).split('<div class="video-detail-section">').slice(1)
  const firstPlace = (inner: string) => /class="placeholder ([^"\s]+)"/.exec(inner)?.[1]
  // Every heading's place before the grid, the head's title's among them, which holds the h1's
  // lines through its own rule.
  const before = [...markup.slice(0, gridStart).matchAll(/placeholder-[a-z-]*heading\b/g)]

  expect(columns.map(firstPlace)).toEqual([
    'placeholder-heading',
    'placeholder-video-subscribers-heading',
  ])
  expect(before.length).toBeGreaterThan(0)
  expect(new Set(before.map(([shape]) => shape))).toEqual(new Set(['placeholder-heading']))
  expect(markup).not.toContain('placeholder-traffic-sources-heading')
  expect(markup).not.toMatch(/placeholder-subscribers-heading/)
})

/**
 * The places the Audience screen's placeholder holds while the answer for `format` of `channelId`,
 * by default one no test remembers an answer of, is read, one list
 * per section in the screen's order, each place named by its shape's class. A bar row's place is one
 * entry, since its line and bar are its own. The placeholder is one busy container packed into
 * the landed screen's columns (creator-analytics#350, #711), and each section's place sits in a
 * card of its own, as each section does; a card's own classes are its look, not a place, so they
 * stay out of the list.
 */
function audiencePlacesOn(format: Route['format'], channelId = 'c-1'): string[][] {
  const markup = renderToStaticMarkup(
    createElement(Audience, {
      channelId,
      route: audienceRouteOf(format),
      navigate: () => {},
      bounds: null,
      onBounds: () => {},
    }),
  )
  // Before any layout the cards render in one column in DOM order (Audience.tsx), as SSR markup
  // has none.
  const busy = '<div class="audience-grid" aria-busy="true"><div class="audience-column">'
  const busyStart = markup.indexOf(busy)
  expect(busyStart).toBeGreaterThan(-1)
  // The placeholder ends the screen's markup, so each part after a card's tag is that card, and
  // the column holds nothing but the cards.
  const [beforeCards, ...cards] = markup
    .slice(busyStart + busy.length)
    .split('<div data-slot="card"')
  expect(beforeCards).toBe('')
  return cards
    .map((card) => {
      const section = '<div class="video-detail-section">'
      const inner = card.replace(/^[^>]*>/, '')
      expect(inner.startsWith(section)).toBe(true)
      return inner.slice(section.length)
    })
    .map((section) =>
      [
        ...section
          .replaceAll(
            /<div class="placeholder-bar-row">(?:<div[^>]*><\/div>)*<\/div>/g,
            '<div class="placeholder-bar-row"></div>',
          )
          .matchAll(/class="([^"]+)"/g),
      ].map(([, classes]) => classes?.split(' ').at(-1) ?? ''),
    )
}

/** The Audience route of `format`, in the last 28 days. */
function audienceRouteOf(format: Route['format']): Route {
  return { ...defaultRoute, audience: true, format }
}

/** `count` bar rows' places, as `audiencePlacesOn` names them. */
const barRows = (count: number) => Array<string>(count).fill('placeholder-bar-row')

test("the Audience screen's placeholder, while its answer is read, holds every section's place in the screen's order, each in that section's shape and in a card of its own in the screen's columns", () => {
  // On a first read each section holds the most bars it draws (creator-analytics#510).
  expect(audiencePlacesOn('all')).toEqual([
    ['placeholder-countries-heading', ...barRows(11), 'placeholder-countries-note'],
    ['placeholder-us-states-heading', ...barRows(11), 'placeholder-us-states-note'],
    ['placeholder-cities-heading', ...barRows(11), 'placeholder-cities-note'],
    ['placeholder-age-heading', ...barRows(7)],
    ['placeholder-gender-heading', ...barRows(3), 'placeholder-gender-note'],
    ['placeholder-devices-heading', ...barRows(8)],
    ['placeholder-operating-systems-heading', ...barRows(11)],
    [
      'placeholder-subscribers-heading',
      'figures',
      'placeholder-figure',
      'placeholder-figure',
      'placeholder-bar',
    ],
  ])
})

test("the Audience screen's placeholder holds the US states' and the cities' every format note places, after their own notes, only when the route chooses a format", () => {
  for (const format of ['short', 'video', 'live'] as const) {
    const [, usStates, cities, ...rest] = audiencePlacesOn(format)
    expect(usStates?.slice(-2)).toEqual([
      'placeholder-us-states-note',
      'placeholder-every-format-note',
    ])
    expect(cities?.slice(-2)).toEqual(['placeholder-cities-note', 'placeholder-every-format-note'])
    expect(rest.flat()).not.toContain('placeholder-every-format-note')
  }
  expect(audiencePlacesOn('all').flat()).not.toContain('placeholder-every-format-note')
})

describe("the Audience screen's placeholder after the same read answered (creator-analytics#510)", () => {
  const answered = {
    ...fullAudienceRows,
    countries: 4,
    usStates: 2,
    ageGroups: 6,
    genders: 0,
    devices: 1,
  }
  /** Remembers `answered` for the read of `format` of `channelId`, as the screen does. */
  function remember(channelId: string, format: Route['format']) {
    const query = audienceQueryOf(audienceRequestOf(audienceRouteOf(format))).toString()
    rememberAudienceRowsOf(channelId, query, answered)
  }

  test("holds the bars each section answered, and for an empty section the heading's and the empty text's places alone", () => {
    remember('aud-same', 'short')
    expect(audiencePlacesOn('short', 'aud-same').slice(0, 7)).toEqual([
      ['placeholder-countries-heading', ...barRows(4), 'placeholder-countries-note'],
      [
        'placeholder-us-states-heading',
        ...barRows(2),
        'placeholder-us-states-note',
        'placeholder-every-format-note',
      ],
      [
        'placeholder-cities-heading',
        ...barRows(11),
        'placeholder-cities-note',
        'placeholder-every-format-note',
      ],
      ['placeholder-age-heading', ...barRows(6)],
      ['placeholder-gender-heading', 'placeholder-audience-empty-text'],
      ['placeholder-devices-heading', ...barRows(1)],
      ['placeholder-operating-systems-heading', ...barRows(11)],
    ])
  })

  test("an answer for another read, or another channel's, leaves the full sizes", () => {
    remember('aud-other', 'short')
    const full = audiencePlacesOn('all', 'c-1')
    expect(audiencePlacesOn('all', 'aud-other')).toEqual(full)
    expect(
      audiencePlacesOn('short', 'aud-unread').map(
        (places) => places.filter((place) => place === 'placeholder-bar-row').length,
      ),
    ).toEqual([11, 11, 11, 7, 3, 8, 11, 0])
  })
})

/** The places of the sections a processed video's answer fills, which an awaiting one does not. */
const sectionPlaces = [
  'placeholder-card',
  'placeholder-figure',
  'placeholder-chart',
  'placeholder-axis',
  'placeholder-since-publish-table',
  'video-detail-breakdowns',
]

test("the video detail placeholder for a video the page knows Google has not processed holds only the awaiting answer's paragraph and note, under the head's place", () => {
  rememberAwaitingProcessingOf([{ id: 'awaitingVideo1', awaitingProcessing: true }])
  const markup = detailPlaceholderOf('awaitingVideo1')

  expect(markup).toContain('<div class="placeholders" aria-busy="true">')
  expect(markup.match(/placeholder-not-processed\b/g)).toHaveLength(1)
  expect(markup.match(/placeholder-note\b/g)).toHaveLength(1)
  expect(markup.indexOf('placeholder-not-processed')).toBeLessThan(
    markup.indexOf('placeholder-note'),
  )
  // The head's place, since no list row heads the screen.
  expect(markup).toContain('placeholder-thumbnail')
  for (const place of sectionPlaces) expect(markup).not.toContain(place)
})

test('the video detail placeholder holds every section for a video the page knows nothing of, or knows Google has processed', () => {
  rememberAwaitingProcessingOf([{ id: 'processedVideo1', awaitingProcessing: false }])

  for (const video of ['unknownVideo1', 'processedVideo1']) {
    const markup = detailPlaceholderOf(video)
    expect(markup).not.toContain('placeholder-not-processed')
    for (const place of sectionPlaces) expect(markup).toContain(place)
  }
})

/**
 * The lines `notProcessedText` wraps to in the signed-in screen `width` px wide, the container
 * app.css's rules for its place query. Measured in headless Chrome with Switzer and the built
 * stylesheet on 2026-11-06, with no scrollbar taking width, at every window width from 320px to
 * 2560px beside the open sidebar, the collapsed one and none, a screen from 280px to 2432px wide
 * (docs/reviews/creator-analytics-268/repro/collapsed-sidebar-placeholders.sh). From the 44rem
 * reading width the paragraph stops widening, so it keeps two lines (creator-analytics issues 166,
 * 326 and 477).
 */
function notProcessedLinesAt(width: number): number {
  if (width >= 413) return 2
  if (width >= 283) return 3
  return 4
}

const appCss = readFileSync(new URL('./app.css', import.meta.url), 'utf8')

/** The lines app.css gives the paragraph's place in a screen `width` px wide, its rules in order. */
function notProcessedPlaceLinesAt(width: number): number {
  const base = appCss.match(/^\.placeholder-not-processed \{\s*--lines: (\d+);/m)
  let lines = Number(base?.[1])
  const queries =
    /@container signed-in-screen \(min-width: ([\d.]+)rem\) \{\s*\.placeholder-not-processed \{\s*--lines: (\d+);/g
  for (const [, rem, count] of appCss.matchAll(queries)) {
    if (Number(rem) * 16 <= width) lines = Number(count)
  }
  return lines
}

// Limits: this reads app.css's rules for the place against widths measured once in Chrome. It runs
// no browser, so a change to the text, the font or the reading width needs the widths measured
// again with the repro script, and Nick's walk on a just-uploaded video at /app checks the page
// keeps still.
test("the place of the awaiting answer's paragraph holds as many lines as the paragraph wraps to, at every width the screen takes from a 320px window to a 2560px one", () => {
  const widths = Array.from({ length: 2432 - 280 + 1 }, (_, i) => 280 + i)
  const mismatched = widths.filter((w) => notProcessedPlaceLinesAt(w) !== notProcessedLinesAt(w))
  expect(mismatched).toEqual([])
})

/**
 * The lines an empty section's text wraps to in the box `width` px wide that its place's rules
 * query: "YouTube has no numbers for this window." in an Audience card's content box, and "YouTube
 * has not processed a publish day for any video yet." in the signed-in screen. Measured in headless
 * Chrome with Switzer and the built stylesheet on 2026-11-08, with no scrollbar taking width, at
 * every window width from 320px to 2560px beside the open sidebar and the collapsed one, a card's
 * content box from 238px to 549.56px and a screen from 280px to 2432px
 * (docs/reviews/creator-analytics-268/repro/collapsed-sidebar-placeholders.sh). The Audience text
 * takes 2 lines up to 315.5px and 1 from 315.63px, the publish day text 2 up to 447px and 1 from
 * 448px (creator-analytics#510).
 */
const emptyTexts = [
  {
    shape: 'audience-empty-text',
    container: 'audience-card',
    from: 238,
    to: 550,
    oneLineFrom: 315.63,
  },
  {
    shape: 'publish-day-empty-text',
    container: 'signed-in-screen',
    from: 280,
    to: 2432,
    oneLineFrom: 448,
  },
]

/** The lines app.css gives `shape`'s place in a `container` `width` px wide, its rules in order. */
function placeLinesAt(shape: string, container: string, width: number): number {
  const base = appCss.match(new RegExp(`^\\.placeholder-${shape} \\{\\s*--lines: (\\d+);`, 'm'))
  let lines = Number(base?.[1])
  const queries = new RegExp(
    `@container ${container} \\(min-width: ([\\d.]+)rem\\) \\{\\s*\\.placeholder-${shape} \\{\\s*--lines: (\\d+);`,
    'g',
  )
  for (const [, rem, count] of appCss.matchAll(queries)) {
    if (Number(rem) * 16 <= width) lines = Number(count)
  }
  return lines
}

// Limits: as the awaiting paragraph's test above, this reads app.css's rules against widths
// measured once in Chrome; a change to either text or the font needs them measured again.
test.each(emptyTexts)(
  "the place of an empty section's text, $shape, holds as many lines as the text wraps to at every width its box takes",
  ({ shape, container, from, to, oneLineFrom }) => {
    const widths = Array.from({ length: (to - from) * 4 + 1 }, (_, i) => from + i / 4)
    const mismatched = widths.filter(
      (w) => placeLinesAt(shape, container, w) !== (w >= oneLineFrom ? 1 : 2),
    )
    expect(mismatched).toEqual([])
  },
)
