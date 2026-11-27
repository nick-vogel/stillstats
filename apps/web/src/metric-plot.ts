/**
 * One stacked metric chart as a TanStack Charts definition: its lines over the drawn days and the
 * guide rules at its bottom and top, over what every cursor plot shares (`cursorPlotOf`). Each
 * day's x is its index, so the group's one cursor names the same day on every plot. A line can
 * have a gap, as RPM does at a day with no engaged views (creator-analytics#356). Every colour is
 * a `var()` of a visual system token, which chart-colours.test.ts holds.
 */
import type { ChartCard } from '@creator-analytics/api-types'
import { dot, lineY, ruleY } from '@tanstack/charts'
import type { ChartCursorController } from '@tanstack/charts/cursor'
import { decorative } from '@tanstack/charts/mark/decorative'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { dayCtrOf, impressionsOf } from './history.ts'
import { dayRpmOf, revenueOf } from './metric-charts.ts'
import { cursorPlotOf } from './plot-definition.ts'
import type { ChartDay, ChartPoint } from './views-chart.ts'

/** How a series' line looks: the accent, or soft ink dashed, so neither reads by colour alone. */
type SeriesLook = 'accent' | 'soft-dashed'

/**
 * One line of a chart: its key, its number on a day as the chart draws it, and its look. A null
 * number is no point: the line breaks there.
 */
export interface MetricSeries {
  key: string
  numberOf: (day: ChartDay) => number | null
  look: SeriesLook
}

/** The stroke of each look, from the visual system's tokens. */
const strokes: Record<SeriesLook, { stroke: string; strokeDasharray?: string }> = {
  accent: { stroke: 'var(--accent)' },
  'soft-dashed': { stroke: 'var(--ink-soft)', strokeDasharray: '6 4' },
}

/**
 * The RPM chart's one line: the whole estimated revenue's RPM, or with the RPM switch on
 * (`adsAndPremiumOnly`), the ads and YouTube Premium RPM.
 */
export function rpmSeriesOf(adsAndPremiumOnly: boolean): MetricSeries[] {
  return adsAndPremiumOnly ? rpmSeries.adsAndPremiumOnly : rpmSeries.all
}

// One array for each, so a plot's definition, whose identity is the library's update boundary,
// keeps it across renders.
const rpmSeries = {
  all: [{ key: 'rpm', numberOf: (day) => dayRpmOf(day, false), look: 'accent' }],
  adsAndPremiumOnly: [{ key: 'rpm', numberOf: (day) => dayRpmOf(day, true), look: 'accent' }],
} satisfies Record<string, MetricSeries[]>

/** The lines of each stacked chart, views first so engaged views draws over it. */
export const stackedSeries: Record<ChartCard, MetricSeries[]> = {
  engagedViews: [
    { key: 'views', numberOf: ({ views }) => views, look: 'soft-dashed' },
    { key: 'engagedViews', numberOf: ({ engagedViews }) => engagedViews, look: 'accent' },
  ],
  watchTime: [
    {
      key: 'minutes',
      numberOf: ({ estimatedMinutesWatched }) => estimatedMinutesWatched,
      look: 'accent',
    },
  ],
  revenue: [{ key: 'revenue', numberOf: revenueOf, look: 'accent' }],
  rpm: rpmSeriesOf(false),
  // No point on a day the history does not hold, so neither line draws a day before its start.
  impressions: [{ key: 'impressions', numberOf: impressionsOf, look: 'accent' }],
  ctr: [{ key: 'ctr', numberOf: dayCtrOf, look: 'accent' }],
}

/**
 * A chart's y domain from the numbers at its bottom and top edges, as its scale labels read them:
 * from zero, or the lowest day below zero, to the top, with a height of one when the two meet, so
 * a line of zeros lies on the bottom edge.
 */
export function yDomainOf(top: number, bottom = 0): [number, number] {
  return [bottom, top > bottom ? top : bottom + 1]
}

type Row = { i: number } & Record<string, number | null>

function rowOf(series: MetricSeries[], day: ChartDay, i: number): Row {
  return Object.assign({ i }, ...series.map(({ key, numberOf }) => ({ [key]: numberOf(day) })))
}

/**
 * The definition of one stacked chart over the drawn points, with the group's cursor. A single
 * day sits in the middle of a flat line across the whole width, as the hand-drawn line had it:
 * the library draws nothing for a one-point line, so a decorative line through the plot's two
 * edges draws it, and the one point, which owns the focus, sits between them.
 * A line with a gap has no point at the gap's days, and the focus snaps to the nearest point, so
 * the shared cursor would show no card on this plot there, and a pointer would jump to a neighbour
 * day. So a plot with a gap also holds a line no one sees along its bottom edge, a point at every
 * day, which owns the focus at the gap: the card then shows the day with no value. A day whose
 * neighbours both fall in a gap is a line of one point, which the library draws as nothing, so a
 * decorative dot marks it, and its one point keeps the focus.
 */
export function metricPlotDefinitionOf({
  points,
  series,
  domain,
  cursor,
}: {
  points: ChartPoint[]
  series: MetricSeries[]
  domain: [number, number]
  cursor: ChartCursorController<number, number>
}) {
  const rows = points.map(({ day }, i) => rowOf(series, day, i))
  const [bottom, top] = domain
  const single = points.length === 1 ? points[0] : undefined
  const edges = single ? [rowOf(series, single.day, -1), rowOf(series, single.day, 1)] : []
  const lines = series.flatMap(({ key, look }) => {
    const options = { x: 'i', y: key, strokeWidth: 2, ...strokes[look] } as const
    const line = lineY(rows, { ...options, id: key })
    if (single) return [decorative(lineY(edges, { ...options, id: `${key}-across` })), line]
    const alone = rows.filter(
      (row, i) => row[key] !== null && rows[i - 1]?.[key] == null && rows[i + 1]?.[key] == null,
    )
    const dots = alone.length
      ? [
          decorative(
            dot(alone, { id: `${key}-alone`, x: 'i', y: key, r: 2, fill: strokes[look].stroke }),
          ),
        ]
      : []
    return [line, ...dots]
  })
  const gapped = rows.some((row) => series.some(({ key }) => row[key] === null))
  const everyDay = gapped
    ? [
        lineY(
          rows.map(({ i }) => ({ i, bottom })),
          { id: 'every-day', x: 'i', y: 'bottom', stroke: 'var(--line)', strokeOpacity: 0 },
        ),
      ]
    : []
  return cursorPlotOf({
    marks: [
      ruleY([bottom, top], { stroke: 'var(--line)', strokeWidth: 1, strokeOpacity: 1 }),
      ...everyDay,
      ...lines,
    ],
    scales: {
      x: scaleLinear().domain(single ? [-1, 1] : [0, Math.max(1, rows.length - 1)]),
      y: scaleLinear().domain([bottom, top]),
    },
    cursor,
  })
}
