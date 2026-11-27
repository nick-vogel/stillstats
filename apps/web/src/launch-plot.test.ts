import type { VideoRow } from '@creator-analytics/api-types'
import { createChartCursor } from '@tanstack/charts/cursor'
import { resolveChartCursorFocus, resolveChartPointerFocus } from '@tanstack/charts/cursor/host'
import { createChartScene, findNearestPoint } from '@tanstack/charts/scene'
import { describe, expect, test } from 'vitest'
import { type LaunchChart, launchChartOf } from './launch-chart.ts'
import {
  launchCursorStateOf,
  launchPlotDefinitionOf,
  launchSelectionOf,
  launchSeriesOf,
} from './launch-plot.ts'

const size = { width: 540, height: 160 }

function sceneOf(chart: LaunchChart, accented = -1) {
  const cursor = createChartCursor<number, number>()
  return createChartScene(launchPlotDefinitionOf({ chart, accented, cursor }), size)
}

type Dot = { kind: 'dot'; x: number; y: number; radius: number; style?: { fill?: string } }

/** Every dot the scene paints. */
function dotsOf(nodes: readonly unknown[]): Dot[] {
  return nodes.flatMap((node) => {
    const { kind, children } = node as { kind: string; children?: unknown[] }
    if (kind === 'dot') return [node as Dot]
    return children ? dotsOf(children) : []
  })
}

type Rule = { kind: 'rule'; y1: number; y2: number }

/** Every rule the scene paints. */
function rulesOf(nodes: readonly unknown[]): Rule[] {
  return nodes.flatMap((node) => {
    const { kind, children } = node as { kind: string; children?: unknown[] }
    if (kind === 'rule') return [node as Rule]
    return children ? rulesOf(children) : []
  })
}

function row(id: string, engagedViewsByDay: number[], partial?: VideoRow['partial']): VideoRow {
  return {
    id,
    title: `Title ${id}`,
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
  }
}

/** Twenty-eight days of `value`, with `overrides` at their day (1 the publish day). */
function days28(value: number, overrides: Record<number, number> = {}): number[] {
  return Array.from({ length: 28 }, (_, i) => overrides[i + 1] ?? value)
}

const complete = row('a', days28(0, { 1: 40, 2: 10, 28: 20 }))
const partial = row('b', [10, 0, 0, 0, 0, 0, 0, 0, 0, 5], { days: 10, of: 28 })
const unprocessed = row('c', [], { days: 0, of: 28 })

describe("the launch chart's lines", () => {
  test("are one per drawn row, in the page's order, each in its color position's colour, thin", () => {
    const chart = launchChartOf([complete, unprocessed, partial], 'first28', 'daily')

    expect(
      launchSeriesOf(chart, -1).map(({ videoId, id, stroke, strokeWidth }) => ({
        videoId,
        id,
        stroke,
        strokeWidth,
      })),
    ).toEqual([
      { videoId: 'a', id: 'launch-line-a', stroke: 'var(--launch-line-1)', strokeWidth: 1 },
      { videoId: 'b', id: 'launch-line-b', stroke: 'var(--launch-line-2)', strokeWidth: 1 },
    ])
  })

  test('draw the accented line last, over the others, and heavier', () => {
    const chart = launchChartOf([complete, partial, row('d', [1, 2])], 'first28', 'daily')

    expect(
      launchSeriesOf(chart, 0).map(({ videoId, strokeWidth }) => [videoId, strokeWidth]),
    ).toEqual([
      ['b', 1],
      ['d', 1],
      ['a', 2.5],
    ])
  })

  test("run from day 1 through each line's last processed day, so a partial line ends short of the window", () => {
    const chart = launchChartOf([complete, partial], 'first28', 'daily')
    const [lineA, lineB] = launchSeriesOf(chart, -1)

    expect(lineA?.rows).toHaveLength(28)
    expect(lineA?.rows.slice(0, 3)).toEqual([
      { day: 1, engagedViews: 40 },
      { day: 2, engagedViews: 10 },
      { day: 3, engagedViews: 0 },
    ])
    expect(lineB?.rows).toHaveLength(10)
    expect(lineB?.rows.at(-1)).toEqual({ day: 10, engagedViews: 5 })
  })

  test('end a partial line with a dot at its last processed day, and a complete line with none', () => {
    const chart = launchChartOf([complete, partial], 'first28', 'daily')

    expect(launchSeriesOf(chart, -1).map(({ end }) => end)).toEqual([
      null,
      { day: 10, engagedViews: 5 },
    ])
  })
})

describe("the launch chart's plot", () => {
  test("puts day 1 at the left edge and the window's last day at the right, every line on one scale from zero to the highest drawn day", () => {
    const scene = sceneOf(launchChartOf([complete, partial], 'first28', 'daily'))
    const pointsOf = (markId: string) =>
      scene.points
        .filter((point) => point.markId === markId)
        .map(({ group, x, y }) => ({ group, x, y }))

    const lineA = pointsOf('launch-line-a')
    expect(lineA.slice(0, 2)).toEqual([
      { group: 'a', x: 0, y: 0 },
      { group: 'a', x: 20, y: 120 },
    ])
    expect(lineA.at(-1)).toEqual({ group: 'a', x: size.width, y: 80 })
    expect(pointsOf('launch-line-b').at(-1)).toEqual({ group: 'b', x: 180, y: 140 })
  })

  test("draws a partial line's end dot at its last processed day, in its line's colour, and adds no point to focus", () => {
    const scene = sceneOf(launchChartOf([complete, partial], 'first28', 'daily'))

    expect(dotsOf(scene.nodes)).toMatchObject([
      { x: 180, y: 140, radius: 3, style: { fill: 'var(--launch-line-2)' } },
    ])
    expect(scene.points).toHaveLength(28 + 10)
  })

  test('with only zeros, lays every line on the bottom edge', () => {
    const scene = sceneOf(launchChartOf([row('z', [0, 0, 0])], 'first7', 'daily'))

    expect(scene.points.map(({ y }) => y)).toEqual([size.height, size.height, size.height])
  })

  test('as a running total, scales to the highest total', () => {
    const scene = sceneOf(launchChartOf([complete, partial], 'first28', 'aggregate'))

    // Line a's running total reaches 70 on its last day, the top edge.
    const lineA = scene.points.filter(({ markId }) => markId === 'launch-line-a')
    expect(lineA.at(-1)?.y).toBe(0)
    expect(lineA.at(0)?.y).toBeCloseTo(size.height * (1 - 40 / 70))
  })
})

describe("the launch chart's guides", () => {
  test('with only zeros, draws the top guide on the top edge, not on the bottom one', () => {
    const chart = launchChartOf([row('z', [0, 0, 0]), row('y', [0, 0])], 'first7', 'daily')
    expect(chart.top).toBe(0)
    const scene = sceneOf(chart)

    const [bottom, top] = rulesOf(scene.nodes)
    expect(bottom?.y1).toBe(size.height)
    expect(top?.y1).not.toBe(bottom?.y1)
    expect(top?.y1).toBe(0)
  })

  test('draws the bottom guide on the bottom edge and the top guide on the top edge', () => {
    const scene = sceneOf(launchChartOf([complete, partial], 'first28', 'daily'))

    expect(rulesOf(scene.nodes)).toMatchObject([
      { y1: size.height, y2: size.height },
      { y1: 0, y2: 0 },
    ])
  })
})

describe("the launch chart's cursor", () => {
  const chart = launchChartOf(
    [complete, partial, row('d', [10, 3, 0, 0, 0, 0, 0, 0, 0, 5])],
    'first28',
    'daily',
  )

  test('names the selected day, its number and its video, and is none with no selection or one that names no point', () => {
    expect(launchCursorStateOf(chart, { line: 1, point: 9 })).toEqual({
      anchor: 'value',
      value: { x: 10, y: 5 },
      group: 'b',
      pinned: false,
      source: 'programmatic',
    })
    expect(launchCursorStateOf(chart, null)).toBeNull()
    expect(launchCursorStateOf(chart, { line: 1, point: 10 })).toBeNull()
    expect(launchCursorStateOf(chart, { line: 3, point: 0 })).toBeNull()
  })

  /** The point the chart shows for a selection, as the library resolves its cursor state. */
  function shownAt(selection: { line: number; point: number }, accented = -1) {
    const definition = launchPlotDefinitionOf({
      chart,
      accented,
      cursor: createChartCursor<number, number>(),
    })
    const scene = createChartScene(definition, size)
    const binding = definition.cursor
    if (binding?.mode !== 'focus') throw new Error('No focus cursor')
    return resolveChartCursorFocus(scene.points, binding, launchCursorStateOf(chart, selection))[0]
  }

  test("shows the selection's own point, so two lines with the same number on the same day stay apart", () => {
    // Lines b and d are both 10 on day 1 and 5 on day 10.
    for (const selection of [
      { line: 1, point: 0 },
      { line: 2, point: 0 },
      { line: 1, point: 9 },
      { line: 2, point: 9 },
      { line: 0, point: 27 },
    ]) {
      expect(launchSelectionOf(chart, shownAt(selection))).toEqual(selection)
      expect(launchSelectionOf(chart, shownAt(selection, 1))).toEqual(selection)
    }
  })

  test("reads the selection a resolved point names: its line's video and its day's index", () => {
    const scene = createChartScene(
      launchPlotDefinitionOf({ chart, accented: 0, cursor: createChartCursor<number, number>() }),
      size,
    )
    const pointOf = (group: string, day: number) =>
      scene.points.find((point) => point.group === group && point.xValue === day)

    expect(launchSelectionOf(chart, pointOf('d', 3))).toEqual({ line: 2, point: 2 })
    expect(launchSelectionOf(chart, pointOf('a', 28))).toEqual({ line: 0, point: 27 })
  })

  test('reads no selection from no point, a point on no drawn line, or one past its line', () => {
    const scene = createChartScene(
      launchPlotDefinitionOf({ chart, accented: -1, cursor: createChartCursor<number, number>() }),
      size,
    )
    const [first] = scene.points
    if (!first) throw new Error('No point')

    expect(launchSelectionOf(chart, undefined)).toBeNull()
    expect(launchSelectionOf(chart, { ...first, group: 'z' })).toBeNull()
    expect(launchSelectionOf(chart, { ...first, group: 'b', datumIndex: 10 })).toBeNull()
  })
})

describe("the launch chart's pointer", () => {
  const chart = launchChartOf([complete, partial], 'first28', 'daily')
  // A desktop plot: about 960 pixels wide and 160 high.
  const plot = { width: 960, height: 160 }
  const xOf = (day: number) => ((day - 1) / 27) * plot.width
  const yOf = (engagedViews: number) => plot.height * (1 - engagedViews / chart.top)

  /** The selection a pointer at (x, y) in the plot makes, resolved as the library's renderer does. */
  function selectedAt(x: number, y: number) {
    const definition = launchPlotDefinitionOf({
      chart,
      accented: -1,
      cursor: createChartCursor<number, number>(),
    })
    const scene = createChartScene(definition, plot)
    const maxDistance = definition.maxFocusDistance ?? Number.POSITIVE_INFINITY
    const focused = resolveChartPointerFocus(scene, definition.focus, x, y, maxDistance)
    return launchSelectionOf(
      chart,
      focused ? focused[0] : findNearestPoint(scene, x, y, maxDistance),
    )
  }

  test('reaches a partial line past its end only at its last point', () => {
    // Line b ends at day 10, 5 high; line a lies at zero from day 3 to day 27.
    expect(selectedAt(xOf(10) + 2, yOf(5))).toEqual({ line: 1, point: 9 })
    expect(selectedAt(xOf(10) + 9.6, yOf(5))).toEqual({ line: 1, point: 9 })
    expect(selectedAt(xOf(22), yOf(5))).toEqual({ line: 0, point: 21 })
  })
})
