/**
 * The launch chart as a TanStack Charts definition: one line per drawn video in its row
 * position's colour, the accented one last and heavier, a dot at a partial line's end, the guide
 * rules at the plot's bottom and top, and the line at the selected day. The app owns the selection
 * (`LaunchSelection`), so this module also turns it into the cursor state the chart shows and turns
 * a point the library resolves under a pointer back into a selection. Every colour is a `var()` of
 * a visual system token, which chart-colours.test.ts holds.
 */
import {
  type ChartFocusStrategy,
  type ChartPoint,
  crosshair,
  defineChart,
  dot,
  lineY,
  ruleY,
} from '@tanstack/charts'
import {
  type ChartCursorController,
  type ChartCursorState,
  cursorHost,
} from '@tanstack/charts/cursor'
import { decorative } from '@tanstack/charts/mark/decorative'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { tooltip } from '@tanstack/charts/tooltip'
import type { LaunchChart, LaunchSelection } from './launch-chart.ts'
import { yDomainOf } from './metric-plot.ts'

/** A day of a line as the library draws it: 1 on the publish day, and its number. */
export interface LaunchRow {
  day: number
  engagedViews: number
}

/** One video's line as the library draws it. */
export interface LaunchSeries {
  videoId: string
  /** The line's mark id. */
  id: string
  rows: LaunchRow[]
  /** Its color position's colour (`launchPositionsOf`). */
  stroke: string
  strokeWidth: number
  /** A partial line's last processed day, where its dot sits, or null for a complete line. */
  end: LaunchRow | null
}

/** The width of a line, and of the accented one, which does not depend on colour alone. */
const lineWidth = 1
const accentedWidth = 2.5

/**
 * The chart's lines in draw order: the page's order, with the accented line (`launchAccentOf`, -1
 * for none) moved last so it draws over the others.
 */
export function launchSeriesOf(chart: LaunchChart, accented: number): LaunchSeries[] {
  const series = chart.lines.map((line, index): LaunchSeries => {
    const rows = line.points.map(({ day, engagedViews }) => ({ day, engagedViews }))
    return {
      videoId: line.videoId,
      id: `launch-line-${line.videoId}`,
      rows,
      stroke: `var(--launch-line-${line.position})`,
      strokeWidth: index === accented ? accentedWidth : lineWidth,
      end: line.partial ? (rows.at(-1) ?? null) : null,
    }
  })
  const top = series[accented]
  return top ? [...series.filter((each) => each !== top), top] : series
}

/**
 * The point nearest a pointer, by its distance in the plot's pixels in both directions, so a
 * partial line stays reachable past its end at its last point, however far a complete line runs on
 * beside it. The library's own `'nearest'` weighs a line's x range first, which drops a partial
 * line once the pointer passes its end. A tie goes to the line painted last, the accented one.
 */
const launchPointerFocus: ChartFocusStrategy<LaunchRow, number, number> = {
  resolve(points, { x, y, maxDistance }) {
    let nearest: ChartPoint<LaunchRow, number, number> | undefined
    let distance = Math.max(0, maxDistance) ** 2
    for (const point of points) {
      const away = (point.x - x) ** 2 + (point.y - y) ** 2
      if (away <= distance) {
        nearest = point
        distance = away
      }
    }
    return nearest ? [nearest] : []
  },
  group: (_points, { point }) => [point],
  navigation: (points) => [...points].sort((a, b) => a.x - b.x || a.y - b.y),
}

/** A partial line's end dot's radius: 6px across, as the hand-drawn round cap was. */
const endRadius = 3

/**
 * The launch chart's definition over its own cursor. The app owns the pointer and the keys, so the
 * library's are off, which also keeps its svg out of the tab order; the library still resolves the
 * nearest point in both directions for the app's pointer (`launchPointerFocus`, read back through
 * `launchSelectionOf`), and draws the line
 * at the selected day and the tooltip that holds the card, under the plot, as ten rows are taller
 * than it. The cursor names a point by its day, its number and its line's video (`group`), so two
 * lines with the same number on a day stay apart. The end dots are decorative, so a line's last
 * day is one point to focus. The app draws its own scale labels, so the library draws no guides
 * and no margin. The guide rules and the y scale share one domain (`yDomainOf`): with only zeros,
 * its height is one, so every line lies on the bottom edge and the top guide stays on the top edge.
 */
export function launchPlotDefinitionOf({
  chart,
  accented,
  cursor,
}: {
  chart: LaunchChart
  accented: number
  cursor: ChartCursorController<number, number>
}) {
  const series = launchSeriesOf(chart, accented)
  const [bottom, top] = yDomainOf(chart.top)
  return defineChart({
    marks: [
      ruleY([bottom, top], { stroke: 'var(--line)', strokeWidth: 1, strokeOpacity: 1 }),
      ...series.map(({ videoId, id, rows, stroke, strokeWidth }) =>
        lineY(rows, { x: 'day', y: 'engagedViews', z: () => videoId, id, stroke, strokeWidth }),
      ),
      ...series.flatMap(({ id, end, stroke }) =>
        end
          ? [
              decorative(
                dot([end], {
                  x: 'day',
                  y: 'engagedViews',
                  r: endRadius,
                  fill: stroke,
                  id: `${id}-end`,
                }),
              ),
            ]
          : [],
      ),
      crosshair({ x: true, y: false, stroke: 'var(--ink-soft)', strokeWidth: 1, strokeOpacity: 1 }),
    ],
    scales: {
      x: { scale: scaleLinear().domain([1, chart.days]) },
      y: { scale: scaleLinear().domain([bottom, top]) },
    },
    guides: false,
    margin: 0,
    focus: launchPointerFocus,
    focusRing: false,
    maxFocusDistance: Number.POSITIVE_INFINITY,
    pointer: false,
    keyboard: false,
    cursor: { use: cursorHost, controller: cursor, mode: 'focus', match: 'xy', pin: false },
    tooltip: {
      use: tooltip,
      sticky: false,
      anchor: { x: 'value', y: 'plot-bottom' },
      placement: ['bottom-right', 'bottom-left'],
      offset: 8,
    },
    svgAnimation: false,
  })
}

/**
 * The cursor state that shows a selection: anchored on its day and number, its line's video the
 * preferred group, unpinned, and from a source other than the pointer, so the library's own clear
 * never takes it. Null with no selection, or one that names no point.
 */
export function launchCursorStateOf(
  chart: LaunchChart,
  selection: LaunchSelection,
): ChartCursorState<number, number> | null {
  if (selection === null) return null
  const line = chart.lines[selection.line]
  const point = line?.points[selection.point]
  if (!line || !point) return null
  return {
    anchor: 'value',
    value: { x: point.day, y: point.engagedViews },
    group: line.videoId,
    pinned: false,
    source: 'programmatic',
  }
}

/**
 * The selection a point the library resolved names: its line by the video its group holds, and its
 * day by its index on that line. Null with no point, or one on no drawn line or past its line.
 */
export function launchSelectionOf(
  chart: LaunchChart,
  point: Pick<ChartPoint, 'group' | 'datumIndex'> | null | undefined,
): LaunchSelection {
  if (!point) return null
  const line = chart.lines.findIndex(({ videoId }) => videoId === point.group)
  const points = chart.lines[line]?.points.length ?? 0
  return point.datumIndex >= 0 && point.datumIndex < points
    ? { line, point: point.datumIndex }
    : null
}
