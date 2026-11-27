import type { ChannelDay, VideoDay } from '@creator-analytics/api-types'
import { createChartCursor } from '@tanstack/charts/cursor'
import { createChartScene } from '@tanstack/charts/scene'
import { describe, expect, test } from 'vitest'
import { metricPlotDefinitionOf, rpmSeriesOf, stackedSeries, yDomainOf } from './metric-plot.ts'
import type { ChartPoint } from './views-chart.ts'

const size = { width: 400, height: 160 }

const dayOf = (engagedViews: number, views: number, estimatedRevenue = 0): VideoDay => ({
  day: '2026-09-01',
  engagedViews,
  views,
  estimatedMinutesWatched: 0,
  estimatedRevenue,
  estimatedAdRevenue: 0,
  estimatedRedPartnerRevenue: 0,
})

const pointsOf = (days: (VideoDay | ChannelDay)[]): ChartPoint[] => days.map((day) => ({ day }))

type Polyline = { kind: 'polyline'; points: [number, number][]; style?: { stroke?: string } }

/** Every line the scene paints, as the points it runs through, by its stroke. */
function linesOf(nodes: readonly unknown[]): Polyline[] {
  return nodes.flatMap((node) => {
    const { kind, children } = node as { kind: string; children?: unknown[] }
    if (kind === 'polyline') return [node as Polyline]
    return children ? linesOf(children) : []
  })
}

type Dot = { kind: 'dot'; x: number; y: number; style?: { fill?: string } }

/** Every dot the scene paints, as its centre and its fill. */
function dotsOf(nodes: readonly unknown[]): { x: number; y: number; fill: string | undefined }[] {
  return nodes.flatMap((node) => {
    const { kind, children } = node as { kind: string; children?: unknown[] }
    if (kind === 'dot') {
      const { x, y, style } = node as Dot
      return [{ x, y, fill: style?.fill }]
    }
    return children ? dotsOf(children) : []
  })
}

function sceneOf(
  days: (VideoDay | ChannelDay)[],
  card: keyof typeof stackedSeries,
  domain: [number, number],
) {
  const definition = metricPlotDefinitionOf({
    points: pointsOf(days),
    series: stackedSeries[card],
    domain,
    cursor: createChartCursor<number, number>(),
  })
  return createChartScene(definition, size)
}

describe("a stacked chart's y domain", () => {
  test('runs from zero to the top', () => {
    expect(yDomainOf(120)).toEqual([0, 120])
  })

  test('runs from the lowest day when one is below zero, as revenue can after a refund', () => {
    expect(yDomainOf(3, -1.2)).toEqual([-1.2, 3])
  })

  test('has a height of one with only zeros, so the line lies on the bottom edge', () => {
    expect(yDomainOf(0)).toEqual([0, 1])
  })
})

describe("a stacked chart's plot", () => {
  test('draws each day at its index, the first at the left edge and the last at the right', () => {
    const scene = sceneOf([dayOf(0, 0), dayOf(5, 10), dayOf(10, 10)], 'engagedViews', [0, 10])

    expect(scene.points.filter(({ markId }) => markId === 'engagedViews')).toMatchObject([
      { xValue: 0, x: 0, y: size.height },
      { xValue: 1, x: size.width / 2, y: size.height / 2 },
      { xValue: 2, x: size.width, y: 0 },
    ])
  })

  test('draws the revenue line from its lowest day below zero', () => {
    const scene = sceneOf([dayOf(0, 0, -1), dayOf(0, 0, 3)], 'revenue', yDomainOf(3, -1))

    expect(scene.points).toMatchObject([
      { x: 0, y: size.height },
      { x: size.width, y: 0 },
    ])
  })

  test('lays an all-zero line on the bottom edge', () => {
    const scene = sceneOf([dayOf(0, 0), dayOf(0, 0)], 'watchTime', yDomainOf(0))

    expect(scene.points.map(({ y }) => y)).toEqual([size.height, size.height])
  })

  test('draws a single day across the whole width, its one point in the middle', () => {
    const scene = sceneOf([dayOf(4, 8)], 'engagedViews', [0, 8])

    expect(scene.points).toMatchObject([
      { markId: 'views', xValue: 0, x: size.width / 2, y: 0 },
      { markId: 'engagedViews', xValue: 0, x: size.width / 2, y: size.height / 2 },
    ])
    const across = linesOf(scene.nodes).filter(
      ({ points }) => points.at(0)?.[0] === 0 && points.at(-1)?.[0] === size.width,
    )
    expect(across.map(({ points }) => points.map(([, y]) => y))).toEqual([
      [0, 0],
      [size.height / 2, size.height / 2],
    ])
  })

  test('draws views dashed and engaged views solid', () => {
    const scene = sceneOf([dayOf(1, 2), dayOf(2, 3)], 'engagedViews', [0, 3])

    expect(linesOf(scene.nodes).map(({ style }) => style)).toMatchObject([
      { stroke: 'var(--ink-soft)', strokeDasharray: '6 4' },
      { stroke: 'var(--accent)', strokeDasharray: undefined },
    ])
  })
})

describe('the RPM plot', () => {
  // dayOf(engagedViews, views, revenue): an RPM of revenue over engaged views, times 1,000.
  const gapped = [dayOf(10, 10, 2), dayOf(0, 3, 0), dayOf(20, 20, 1)]
  const rpmLines = (nodes: readonly unknown[]) =>
    linesOf(nodes).filter(({ style }) => style?.stroke === 'var(--accent)')

  test('draws one accent line of the daily RPM', () => {
    const scene = sceneOf([dayOf(10, 10, 2), dayOf(20, 20, 1)], 'rpm', yDomainOf(200))

    expect(rpmLines(scene.nodes).map(({ points }) => points)).toEqual([
      [
        [0, 0],
        [size.width, size.height * 0.75],
      ],
    ])
  })

  // creator-analytics#357: $2 of revenue over 10 engaged views, $1 of it from ads and YouTube
  // Premium, an RPM of 100 with the switch on; $1 over 20, all of it, 50.
  test('with the RPM switch on, draws the ads and YouTube Premium RPM', () => {
    const sourcedDays = [
      { ...dayOf(10, 10, 2), estimatedAdRevenue: 0.75, estimatedRedPartnerRevenue: 0.25 },
      { ...dayOf(20, 20, 1), estimatedAdRevenue: 1 },
    ]
    const scene = createChartScene(
      metricPlotDefinitionOf({
        points: pointsOf(sourcedDays),
        series: rpmSeriesOf(true),
        domain: yDomainOf(200),
        cursor: createChartCursor<number, number>(),
      }),
      size,
    )

    expect(rpmLines(scene.nodes).map(({ points }) => points)).toEqual([
      [
        [0, size.height * 0.5],
        [size.width, size.height * 0.75],
      ],
    ])
  })

  test('breaks its line at a day with no RPM, so the line runs in two pieces', () => {
    const scene = sceneOf([...gapped, dayOf(40, 40, 2)], 'rpm', yDomainOf(200))

    // The days sit at a third of the width apart: 0, 133, 267 and 400.
    expect(rpmLines(scene.nodes).map(({ points }) => points.map(([x]) => Math.round(x)))).toEqual([
      [0],
      [267, 400],
    ])
  })

  test('marks a day whose neighbours have no RPM with a dot, as a one-point piece draws no line', () => {
    // RPM 200, none, 50, none, 50: every day with an RPM stands alone, the first and last too.
    const alone = [dayOf(10, 10, 2), dayOf(0, 3, 0), dayOf(20, 20, 1), dayOf(0, 3, 0)]
    const scene = sceneOf([...alone, dayOf(20, 20, 1)], 'rpm', yDomainOf(200))

    expect(dotsOf(scene.nodes)).toEqual([
      { x: 0, y: 0, fill: 'var(--accent)' },
      { x: size.width / 2, y: size.height * 0.75, fill: 'var(--accent)' },
      { x: size.width, y: size.height * 0.75, fill: 'var(--accent)' },
    ])
  })

  test('draws no dot where its line runs, nor on a single day across the width', () => {
    const pieces = sceneOf([...gapped, dayOf(40, 40, 2)], 'rpm', yDomainOf(200))
    const single = sceneOf([dayOf(10, 10, 1)], 'rpm', yDomainOf(200))

    expect(dotsOf(pieces.nodes)).toEqual([{ x: 0, y: 0, fill: 'var(--accent)' }])
    expect(dotsOf(single.nodes)).toEqual([])
  })

  test("leaves a lone day's focus to its line, so the dot adds no point", () => {
    const scene = sceneOf(gapped, 'rpm', yDomainOf(200))

    expect(new Set(scene.points.map(({ markId }) => markId))).toEqual(new Set(['every-day', 'rpm']))
  })

  test('holds a point at every day, a day with no RPM too, so the shared cursor shows its card there', () => {
    const scene = sceneOf(gapped, 'rpm', yDomainOf(200))

    expect([...new Set(scene.points.map(({ xValue }) => xValue))].sort()).toEqual([0, 1, 2])
  })

  test('draws no visible line when no day has an RPM, and still holds a point at every day', () => {
    const scene = sceneOf([dayOf(0, 1, 0), dayOf(0, 2, 0)], 'rpm', yDomainOf(0))

    expect(rpmLines(scene.nodes).flatMap(({ points }) => points)).toEqual([])
    expect([...new Set(scene.points.map(({ xValue }) => xValue))].sort()).toEqual([0, 1])
  })

  test('paints its point at every day without a stroke anyone sees', () => {
    const scene = sceneOf(gapped, 'rpm', yDomainOf(200))
    const unseen = linesOf(scene.nodes).filter(({ style }) => style?.stroke !== 'var(--accent)')

    expect(unseen.length).toBeGreaterThan(0)
    expect(unseen.map(({ style }) => (style as { strokeOpacity?: number }).strokeOpacity)).toEqual(
      unseen.map(() => 0),
    )
  })

  test('draws a single day across the whole width, as every stacked chart does', () => {
    const scene = sceneOf([dayOf(10, 10, 1)], 'rpm', yDomainOf(200))

    const across = rpmLines(scene.nodes).filter(
      ({ points }) => points.at(0)?.[0] === 0 && points.at(-1)?.[0] === size.width,
    )
    expect(across.map(({ points }) => points.map(([, y]) => y))).toEqual([
      [size.height / 2, size.height / 2],
    ])
  })
})

describe('the impressions and CTR plots', () => {
  // A range that starts two days before the history start, so its first two days hold no history.
  const days: ChannelDay[] = [
    dayOf(1, 1),
    dayOf(1, 1),
    { ...dayOf(1, 1), impressions: 100, ctr: 0.1 },
    { ...dayOf(1, 1), impressions: 300, ctr: 0.02 },
  ]

  test.each([
    ['impressions', yDomainOf(300)],
    ['ctr', yDomainOf(0.1)],
  ] as const)('the %s line draws no day before the history start', (card, domain) => {
    const lines = linesOf(sceneOf(days, card, domain).nodes).filter(
      ({ style }) => style?.stroke === 'var(--accent)',
    )

    // The days sit at a third of the width apart: 0, 133, 267 and 400.
    expect(lines.map(({ points }) => points.map(([x]) => Math.round(x)))).toEqual([[267, 400]])
  })
})
