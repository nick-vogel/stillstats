// Every colour a chart definition paints is a `var()` of a token the visual system declares, so a
// chart follows the light and dark schemes and the colour tests that hold the tokens. It renders
// each definition's scene without a DOM and walks every painted colour, including the guide the
// cursor draws.
import type { AudienceRetentionPoint, VideoDay, VideoRow } from '@creator-analytics/api-types'
import {
  declarationsIn,
  lightTokensIn,
  visualSystemSheet,
} from '@creator-analytics/visual-system/testing'
import { createChartCursor } from '@tanstack/charts/cursor'
import { createChartScene } from '@tanstack/charts/scene'
import { describe, expect, test } from 'vitest'
import { launchChartOf } from './launch-chart.ts'
import { launchPlotDefinitionOf } from './launch-plot.ts'
import { metricPlotDefinitionOf, stackedSeries, yDomainOf } from './metric-plot.ts'
import {
  comparisonPlotDefinitionOf,
  relativePlotDefinitionOf,
  watchingPlotDefinitionOf,
} from './retention-plot.ts'
import type { ChartPoint } from './views-chart.ts'

const dayOf = (day: string, n: number): VideoDay => ({
  day,
  engagedViews: n,
  views: n * 2,
  estimatedMinutesWatched: n * 30,
  estimatedRevenue: n - 1,
  estimatedAdRevenue: 0,
  estimatedRedPartnerRevenue: 0,
})

const pointsOf = (days: VideoDay[]): ChartPoint[] => days.map((day) => ({ day }))

const days = pointsOf([dayOf('2026-09-01', 1), dayOf('2026-09-02', 3), dayOf('2026-09-03', 2)])
const oneDay = pointsOf([dayOf('2026-09-01', 2)])

const stacked = (card: keyof typeof stackedSeries, points: ChartPoint[]) =>
  metricPlotDefinitionOf({
    points,
    series: stackedSeries[card],
    domain: yDomainOf(6, -1),
    cursor: createChartCursor<number, number>(),
  })

const retentionPoint = (
  elapsedVideoTimeRatio: number,
  audienceWatchRatio: number,
): AudienceRetentionPoint => ({
  elapsedVideoTimeRatio,
  audienceWatchRatio,
  relativeRetentionPerformance: audienceWatchRatio / 2,
})
const retention = [retentionPoint(0.01, 1), retentionPoint(0.5, 0.6), retentionPoint(1, 0.3)]
const rewatched = [retentionPoint(0.01, 0.9), retentionPoint(0.5, 1.25), retentionPoint(1, 0.3)]

const launchRow = (
  id: string,
  engagedViewsByDay: number[],
  partial?: VideoRow['partial'],
): VideoRow => ({
  id,
  title: id,
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
  ...(partial ? { partial } : {}),
})
// Ten lines, every row position's colour, the last partial, so its end dot is painted too.
const tenLines = Array.from({ length: 10 }, (_, i) =>
  i === 9
    ? launchRow(`v${i + 1}`, [i + 1, 2, 3], { days: 3, of: 7 })
    : launchRow(`v${i + 1}`, [i + 1, 2, 3, 4, 5, 6, 7]),
)
const launch = (videos: VideoRow[], accented: number) =>
  launchPlotDefinitionOf({
    chart: launchChartOf(videos, 'first7', 'daily'),
    accented,
    cursor: createChartCursor<number, number>(),
  })

/** Every chart definition the app draws, by name. */
const charts = {
  'engaged views': stacked('engagedViews', days),
  'watch hours': stacked('watchTime', days),
  revenue: stacked('revenue', days),
  RPM: stacked('rpm', days),
  // A day with no engaged views has no RPM: the line breaks, and the plot holds a point there.
  'RPM with a day of no engaged views': stacked(
    'rpm',
    pointsOf([dayOf('2026-09-01', 2), dayOf('2026-09-02', 0)]),
  ),
  'engaged views over one day': stacked('engagedViews', oneDay),
  'audience retention': watchingPlotDefinitionOf({
    points: retention,
    top: 1,
    cursor: createChartCursor<number, number>(),
  }),
  'audience retention with a rewatched part': watchingPlotDefinitionOf({
    points: rewatched,
    top: 1.25,
    cursor: createChartCursor<number, number>(),
  }),
  'relative retention': relativePlotDefinitionOf({
    points: retention,
    cursor: createChartCursor<number, number>(),
  }),
  'retention comparison, five curves, one rewatched': comparisonPlotDefinitionOf({
    curves: [retention, rewatched, retention, retention, retention].map((points, index) => ({
      videoId: `v${index + 1}`,
      position: index + 1,
      points: points.map(({ elapsedVideoTimeRatio, audienceWatchRatio }) => ({
        elapsedVideoTimeRatio,
        audienceWatchRatio,
      })),
    })),
    top: 1.25,
    cursor: createChartCursor<number, number>(),
  }),
  'launch, ten lines, one accented and one partial': launch(tenLines, 4),
  'launch, one partial line of one day': launch([launchRow('p', [5], { days: 1, of: 7 })], -1),
}

const colourKeys = new Set(['stroke', 'fill', 'color'])

interface Painted {
  key: string
  colour: string
}

/** Every colour-valued key and the string it holds anywhere under `value`, functions aside. */
function coloursUnder(value: unknown, seen = new Set<unknown>()): Painted[] {
  if (value === null || typeof value !== 'object' || seen.has(value)) return []
  seen.add(value)
  return Object.entries(value).flatMap(([key, held]) =>
    colourKeys.has(key) && typeof held === 'string'
      ? [{ key, colour: held }]
      : coloursUnder(held, seen),
  )
}

const sheet = await visualSystemSheet()
const writesAColour = new Set(
  declarationsIn(sheet)
    .filter(({ colours }) => colours.length > 0)
    .map(({ property }) => property),
)
const colourTokens = new Set(lightTokensIn(sheet).filter((token) => writesAColour.has(token)))

function straysAmong(painted: Painted[]): Painted[] {
  return painted.filter(({ key, colour }) => {
    // `none` is no colour: the library's own fill under a line.
    if (key === 'fill' && colour === 'none') return false
    const token = /^var\((--[\w-]+)\)$/.exec(colour)?.[1]
    return token === undefined || !colourTokens.has(token)
  })
}

describe("every chart's colours", () => {
  test.each(Object.entries(charts))('are visual system tokens on the %s chart', (_, chart) => {
    const scene = createChartScene(chart, { width: 400, height: 160 })
    const colours = coloursUnder({
      nodes: scene.nodes,
      points: scene.points,
      focusGuides: scene.focusGuides,
    })

    expect(colours.length).toBeGreaterThan(0)
    expect(straysAmong(colours)).toEqual([])
  })

  test.each([
    ['a spacing token', 'var(--gutter)'],
    ['a font token', 'var(--font-body)'],
    ['none', 'none'],
  ])('count a line stroked with %s as a stray', (_, stroke) => {
    const planted = coloursUnder({ nodes: [{ style: { stroke } }] })

    expect(straysAmong(planted)).toEqual([{ key: 'stroke', colour: stroke }])
  })

  test('include the line the cursor draws', () => {
    const scene = createChartScene(charts['watch hours'], { width: 400, height: 160 })

    expect(coloursUnder(scene.focusGuides).map(({ colour }) => colour)).toContain('var(--ink-soft)')
  })
})
