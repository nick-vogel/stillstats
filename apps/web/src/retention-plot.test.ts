import type { AudienceRetentionPoint } from '@creator-analytics/api-types'
import { createChartCursor } from '@tanstack/charts/cursor'
import { createChartScene } from '@tanstack/charts/scene'
import { describe, expect, test } from 'vitest'
import {
  type ComparedLine,
  comparisonPlotDefinitionOf,
  relativePlotDefinitionOf,
  watchingPlotDefinitionOf,
} from './retention-plot.ts'

const size = { width: 400, height: 160 }

function point(
  elapsedVideoTimeRatio: number,
  audienceWatchRatio: number,
  relativeRetentionPerformance = 0.5,
): AudienceRetentionPoint {
  return { elapsedVideoTimeRatio, audienceWatchRatio, relativeRetentionPerformance }
}

type Rule = {
  kind: 'rule'
  y1: number
  y2: number
  style?: { stroke?: string; strokeOpacity?: number; strokeDasharray?: string }
}

/** Every horizontal rule the scene paints. */
function rulesOf(nodes: readonly unknown[]): Rule[] {
  return nodes.flatMap((node) => {
    const { kind, children } = node as { kind: string; children?: unknown[] }
    if (kind === 'rule') return [node as Rule]
    return children ? rulesOf(children) : []
  })
}

/** The rule the scene paints at a height from its top edge, in pixels. */
function ruleAt(nodes: readonly unknown[], y: number): Rule | undefined {
  return rulesOf(nodes).find(({ y1, y2 }) => y1 === y && y2 === y)
}

const cursor = () => createChartCursor<number, number>()

function watchingScene(points: AudienceRetentionPoint[], top: number) {
  return createChartScene(watchingPlotDefinitionOf({ points, top, cursor: cursor() }), size)
}

function relativeScene(points: AudienceRetentionPoint[]) {
  return createChartScene(relativePlotDefinitionOf({ points, cursor: cursor() }), size)
}

describe("the audience retention chart's plot", () => {
  test('draws each point at its share of the video across the width', () => {
    const scene = watchingScene([point(0.01, 1), point(0.5, 0.6), point(1, 0.2)], 1)

    expect(scene.points.map(({ x }) => x)).toEqual([4, 200, 400])
  })

  test('draws unevenly spaced points at their own shares of the video', () => {
    const scene = watchingScene(
      [point(0.01, 1), point(0.02, 0.9), point(0.5, 0.6), point(1, 0.2)],
      1,
    )

    expect(scene.points.map(({ xValue, x }) => ({ xValue, x }))).toEqual([
      { xValue: 0.01, x: 4 },
      { xValue: 0.02, x: 8 },
      { xValue: 0.5, x: 200 },
      { xValue: 1, x: 400 },
    ])
  })

  test('with no point above 1, draws 100% at the top edge and 0% at the bottom', () => {
    const scene = watchingScene([point(0.01, 1), point(1, 0)], 1)

    expect(scene.points.map(({ y }) => y)).toEqual([0, size.height])
    expect(ruleAt(scene.nodes, 0)).toBeDefined()
    expect(ruleAt(scene.nodes, size.height)).toBeDefined()
  })

  test('raises its top to a rewatched part, so the highest point is the top edge and the 100% line sits below it', () => {
    const scene = watchingScene([point(0.01, 0.9), point(0.5, 1.25), point(1, 0.5)], 1.25)

    // 0.9 and 0.5 of a top of 1.25 sit at 72% and 40% of the height.
    expect(scene.points.map(({ y }) => Math.round(y * 10) / 10)).toEqual([44.8, 0, 96])
    expect(ruleAt(scene.nodes, size.height - size.height / 1.25)).toBeDefined()
  })

  // creator-analytics#119 W36, moved here from the web app's own sheet with creator-analytics#370.
  test('draws its 50% line as a solid grid line, fainter than the 100% line', () => {
    const scene = watchingScene([point(0.01, 1), point(1, 0.4)], 1)
    const full = ruleAt(scene.nodes, 0)
    const half = ruleAt(scene.nodes, size.height / 2)

    expect(half?.style?.stroke).toBe(full?.style?.stroke)
    expect(half?.style?.strokeOpacity).toBeLessThan(full?.style?.strokeOpacity ?? 0)
    expect(half?.style?.strokeDasharray).toBeUndefined()
  })
})

describe("the relative retention chart's plot", () => {
  test("draws Google's value from 0 at the bottom edge to 1 at the top edge", () => {
    const scene = relativeScene([point(0.01, 1, 0), point(0.5, 1, 0.25), point(1, 1, 1)])

    expect(scene.points.map(({ y }) => y)).toEqual([size.height, size.height * 0.75, 0])
  })

  test("draws the median line dashed at Google's 0.5, halfway up", () => {
    const scene = relativeScene([point(0.01, 1, 0.4), point(1, 1, 0.6)])

    expect(ruleAt(scene.nodes, size.height / 2)?.style?.strokeDasharray).toBe('4 4')
  })
})

test('both retention charts draw each point at the same x value, its share of the video, so one cursor names the same point on each', () => {
  const points = [point(0.01, 1, 0.3), point(0.02, 0.9, 0.5), point(0.5, 0.6, 0.7)]
  const xValues = ({ points: drawn }: { points: readonly { xValue: number }[] }) =>
    drawn.map(({ xValue }) => xValue)

  expect(xValues(watchingScene(points, 1))).toEqual([0.01, 0.02, 0.5])
  expect(xValues(relativeScene(points))).toEqual([0.01, 0.02, 0.5])
})

/** A stored curve the comparison draws, at a pick position, from its points' x and y. */
function compared(videoId: string, position: number, points: [number, number][]): ComparedLine {
  return {
    videoId,
    position,
    points: points.map(([elapsedVideoTimeRatio, audienceWatchRatio]) => ({
      elapsedVideoTimeRatio,
      audienceWatchRatio,
    })),
  }
}

function comparisonScene(curves: ComparedLine[], top: number) {
  return createChartScene(comparisonPlotDefinitionOf({ curves, top, cursor: cursor() }), size)
}

type Line = { kind: string; style?: { stroke?: string } }

/** Every line the scene paints, by its stroke. */
function lineStrokesOf(nodes: readonly unknown[]): string[] {
  return nodes.flatMap((node) => {
    const { kind, children, style } = node as Line & { children?: unknown[] }
    if (kind === 'polyline' && style?.stroke) return [style.stroke]
    return children ? lineStrokesOf(children) : []
  })
}

describe("the retention comparison's overlay plot (creator-analytics#951)", () => {
  test("draws one line per curve, each in its pick position's colour", () => {
    const scene = comparisonScene(
      [
        compared('a', 1, [
          [0.01, 1],
          [1, 0.2],
        ]),
        compared('b', 2, [
          [0.01, 0.9],
          [1, 0.4],
        ]),
        compared('c', 5, [
          [0.01, 0.8],
          [1, 0.1],
        ]),
      ],
      1,
    )

    expect(lineStrokesOf(scene.nodes)).toEqual([
      'var(--launch-line-1)',
      'var(--launch-line-2)',
      'var(--launch-line-5)',
    ])
  })

  test("draws each curve's points at their own shares of the whole video, so curves of different lengths and spacing share the axis", () => {
    const scene = comparisonScene(
      [
        compared('a', 1, [
          [0.01, 1],
          [0.5, 0.6],
          [1, 0.2],
        ]),
        compared('b', 2, [
          [0.02, 0.9],
          [0.25, 0.7],
        ]),
      ],
      1,
    )

    expect(scene.points.map(({ group, xValue, x }) => ({ group, xValue, x }))).toEqual([
      { group: 'a', xValue: 0.01, x: 4 },
      { group: 'a', xValue: 0.5, x: 200 },
      { group: 'a', xValue: 1, x: 400 },
      { group: 'b', xValue: 0.02, x: 8 },
      { group: 'b', xValue: 0.25, x: 100 },
    ])
  })

  test("raises its top to the highest point of any curve, with the watching chart's 100% and fainter 50% lines", () => {
    const scene = comparisonScene(
      [
        compared('a', 1, [
          [0.01, 0.9],
          [1, 0.5],
        ]),
        compared('b', 2, [
          [0.01, 1.25],
          [1, 0.3],
        ]),
      ],
      1.25,
    )
    const full = ruleAt(scene.nodes, size.height - size.height / 1.25)
    const half = ruleAt(scene.nodes, size.height - size.height / 1.25 / 2)

    expect(scene.points.find(({ group, xValue }) => group === 'b' && xValue === 0.01)?.y).toBe(0)
    expect(full).toBeDefined()
    expect(half?.style?.stroke).toBe(full?.style?.stroke)
    expect(half?.style?.strokeOpacity).toBeLessThan(full?.style?.strokeOpacity ?? 0)
    expect(ruleAt(scene.nodes, size.height)).toBeDefined()
  })

  test("draws a curve in its pick position's colour, while the video page draws the same curve in ink", () => {
    const points = [point(0.01, 1, 0.3), point(1, 0.4, 0.6)]
    const scene = comparisonScene(
      [
        compared('a', 1, [
          [0.01, 1],
          [1, 0.4],
        ]),
      ],
      1,
    )

    expect(lineStrokesOf(scene.nodes)).toEqual(['var(--launch-line-1)'])
    expect(lineStrokesOf(watchingScene(points, 1).nodes)).toEqual(['var(--ink)'])
    expect(lineStrokesOf(relativeScene(points).nodes)).toEqual(['var(--ink)'])
  })
})
