/**
 * The two audience retention charts, and the comparison's overlay of stored curves, as TanStack
 * Charts definitions, over what every cursor plot
 * shares (`cursorPlotOf`). Each point's x is its share of the video, `elapsedVideoTimeRatio`, on
 * an x domain of the whole video, so a point sits where it falls in the video however unevenly
 * Google spaces them, and the pair's one cursor names the same point on both. Every colour is a
 * `var()` of a visual system token, which chart-colours.test.ts holds.
 */
import type { AudienceRetentionPoint, StoredRetentionPoint } from '@creator-analytics/api-types'
import { lineY, ruleY } from '@tanstack/charts'
import type { ChartCursorController } from '@tanstack/charts/cursor'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { cursorPlotOf } from './plot-definition.ts'

/** One point as both charts draw it: where it falls in the video, and each chart's number. */
interface Row {
  at: number
  watching: number
  relative: number
}

/** A stored point as the comparison draws it: where it falls in the video, and its share watching. */
type WatchingRow = Pick<Row, 'at' | 'watching'>

function rowsOf(points: AudienceRetentionPoint[]): Row[] {
  return points.map(
    ({ elapsedVideoTimeRatio, audienceWatchRatio, relativeRetentionPerformance }) => ({
      at: elapsedVideoTimeRatio,
      watching: audienceWatchRatio,
      relative: relativeRetentionPerformance,
    }),
  )
}

/** A grid line, in the visual system's line colour. */
const guide = { stroke: 'var(--line)', strokeWidth: 1, strokeOpacity: 1 } as const

/** Each chart's line, in ink. */
const line = { x: 'at', stroke: 'var(--ink)', strokeWidth: 2 } as const

/** The whole video, from its start at the left edge to its end at the right. */
const wholeVideo = () => scaleLinear().domain([0, 1])

/**
 * The share of viewers still watching, from 0 at the bottom edge to `top` at the top: 1, or the
 * highest point where a rewatched part raises it (`retentionChartsOf`). Grid lines at 100%, at 50%,
 * solid and fainter (creator-analytics#119 W36), and at the bottom edge.
 */
export function watchingPlotDefinitionOf({
  points,
  top,
  cursor,
}: {
  points: AudienceRetentionPoint[]
  top: number
  cursor: ChartCursorController<number, number>
}) {
  return cursorPlotOf({
    marks: [
      ruleY([0, 1], guide),
      ruleY([0.5], { ...guide, strokeOpacity: 0.6 }),
      lineY(rowsOf(points), { ...line, y: 'watching', id: 'watching' }),
    ],
    scales: { x: wholeVideo(), y: scaleLinear().domain([0, top]) },
    cursor,
  })
}

/**
 * Google's relative retention, from 0 at the bottom edge to 1 at the top, with its median, 0.5,
 * dashed halfway up, and a grid line at the bottom edge.
 */
export function relativePlotDefinitionOf({
  points,
  cursor,
}: {
  points: AudienceRetentionPoint[]
  cursor: ChartCursorController<number, number>
}) {
  return cursorPlotOf({
    marks: [
      ruleY([0], guide),
      ruleY([0.5], {
        stroke: 'var(--ink-soft)',
        strokeWidth: 1,
        strokeOpacity: 1,
        strokeDasharray: '4 4',
      }),
      lineY(rowsOf(points), { ...line, y: 'relative', id: 'relative' }),
    ],
    scales: { x: wholeVideo(), y: scaleLinear().domain([0, 1]) },
    cursor,
  })
}

/** One stored curve the comparison draws, at its pick's position. */
export interface ComparedLine {
  videoId: string
  /** 1 to 5, the pick's place: the line's colour, `--launch-line-<position>`. */
  position: number
  points: StoredRetentionPoint[]
}

/**
 * The retention comparison's overlay: one line per stored curve, each in its pick position's
 * colour, on the watching chart's scale (`watchingPlotDefinitionOf`): 0 at the bottom edge to `top`
 * at the top, the same 100% and 50% grid lines, and an x domain of the whole video, so curves of
 * videos of different lengths share the axis. Each line's group is its video, and the one cursor
 * of the group names a share of the video on every line at once.
 */
export function comparisonPlotDefinitionOf({
  curves,
  top,
  cursor,
}: {
  curves: ComparedLine[]
  top: number
  cursor: ChartCursorController<number, number>
}) {
  return cursorPlotOf({
    marks: [
      ruleY([0, 1], guide),
      ruleY([0.5], { ...guide, strokeOpacity: 0.6 }),
      ...curves.map(({ videoId, position, points }) =>
        lineY(
          points.map(
            ({ elapsedVideoTimeRatio, audienceWatchRatio }): WatchingRow => ({
              at: elapsedVideoTimeRatio,
              watching: audienceWatchRatio,
            }),
          ),
          {
            x: 'at',
            y: 'watching',
            z: () => videoId,
            id: `compared-${videoId}`,
            stroke: `var(--launch-line-${position})`,
            strokeWidth: 2,
          },
        ),
      ),
    ],
    scales: { x: wholeVideo(), y: scaleLinear().domain([0, top]) },
    cursor,
  })
}
