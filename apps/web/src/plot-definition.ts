/**
 * What every chart plot over a group's cursor shares as a TanStack Charts definition: the line at
 * the cursor's point, the focus on the nearest point across the whole width, the cursor binding,
 * and the tooltip that holds the card under the plot's top edge. The app owns the keys
 * (`useChartSlider`), so the library's keyboard is off, which also keeps its svg out of the tab
 * order. The app draws its own scale labels, so the library draws no guides and no margin. Every
 * colour is a `var()` of a visual system token, which chart-colours.test.ts holds.
 */
import { type ChartMark, crosshair, defineChart } from '@tanstack/charts'
import { type ChartCursorController, cursorHost } from '@tanstack/charts/cursor'
import type { LinearScale } from '@tanstack/charts/scales/linear'
import { tooltip } from '@tanstack/charts/tooltip'

/**
 * A plot's definition from its marks and its x and y scales, over the group's cursor, which names
 * a point by its x value.
 */
export function cursorPlotOf({
  marks,
  scales,
  cursor,
}: {
  marks: readonly ChartMark<unknown, number, number>[]
  scales: { x: LinearScale; y: LinearScale }
  cursor: ChartCursorController<number, number>
}) {
  return defineChart({
    marks: [
      ...marks,
      crosshair({ x: true, y: false, stroke: 'var(--ink-soft)', strokeWidth: 1, strokeOpacity: 1 }),
    ],
    scales: { x: { scale: scales.x }, y: { scale: scales.y } },
    guides: false,
    margin: 0,
    focus: 'group-x',
    focusRing: false,
    maxFocusDistance: Number.POSITIVE_INFINITY,
    cursor: { use: cursorHost, controller: cursor, mode: 'focus', match: 'x', pin: false },
    keyboard: false,
    tooltip: {
      use: tooltip,
      sticky: false,
      anchor: { x: 'value', y: 'plot-top' },
      placement: ['bottom-right', 'bottom-left'],
      offset: 8,
    },
    svgAnimation: false,
  })
}
