// Limits: these tests cover the launch chart's lines, its scale, its running total, which line and
// day a key selects, the day card's heading and rows, and what the value text and the live region
// read at a selection, as pure functions. Where each line and day sits in the plot is
// launch-plot.test.ts's, and which line and day a pointer selects is the browser walk's, as
// TanStack Charts resolves it from the drawn plot. No test here draws the SVG, so none shows how
// ten colored lines and the selected one read over each other, the end dot's size, the card over
// the lines, the layout at 375 pixels wide, or what a screen reader reads from the plot. Nick
// checks those at /app in a real browser.
import type { VideoRow } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import { announcementAfter, silence, sliderTextOf } from './chart-slider.ts'
import {
  launchAccentOf,
  launchChartEmpty,
  launchChartOf,
  launchDayCardOf,
  launchKeyStepOf,
  launchPositionsOf,
  launchReadingOf,
  launchSwatchesShown,
  rowsPastLaunchChart,
} from './launch-chart.ts'

function row(
  id: string,
  engagedViewsByDay: number[] | undefined,
  partial?: VideoRow['partial'],
): VideoRow {
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
    ...(engagedViewsByDay ? { engagedViewsByDay } : {}),
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

describe('the launch chart', () => {
  test("draws one line per row with a processed day, in the page's order, and none for a video with no processed day", () => {
    const chart = launchChartOf([partial, unprocessed, complete], 'first28', 'daily')

    expect(chart.lines.map(({ videoId, title }) => [videoId, title])).toEqual([
      ['b', 'Title b'],
      ['a', 'Title a'],
    ])
  })

  test("runs each line from day 1 through its last processed day, so a partial line ends short of the window's last day", () => {
    const chart = launchChartOf([complete, partial], 'first28', 'daily')

    const [first, second] = chart.lines
    expect(first?.points.at(0)).toEqual({ day: 1, engagedViews: 40 })
    expect(first?.points.at(-1)).toEqual({ day: 28, engagedViews: 20 })
    expect(second?.points).toHaveLength(10)
    expect(second?.points.at(-1)).toEqual({ day: 10, engagedViews: 5 })
  })

  test('draws every line on one scale, its top the highest drawn day', () => {
    expect(launchChartOf([complete, partial], 'first28', 'daily').top).toBe(40)
  })

  test('with only zeros, has a top of zero', () => {
    expect(launchChartOf([row('z', [0, 0, 0])], 'first7', 'daily').top).toBe(0)
  })

  test('as a running total, each day adds the days before it, and the scale follows the totals', () => {
    const chart = launchChartOf([complete, partial], 'first28', 'aggregate')

    expect(chart.top).toBe(70)
    expect(chart.lines[0]?.points.slice(0, 3).map(({ engagedViews }) => engagedViews)).toEqual([
      40, 50, 50,
    ])
    expect(chart.lines[0]?.points.at(-1)?.engagedViews).toBe(70)
    expect(chart.lines[1]?.points.at(-1)?.engagedViews).toBe(15)
  })

  test("draws only the page's first 10 rows, as rows 1 to 10 in order, whatever the page size", () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(`v${i + 1}`, [i + 1]))

    const chart = launchChartOf(rows, 'first7', 'daily')

    expect(chart.lines.map(({ videoId }) => videoId)).toEqual([
      'v1',
      'v2',
      'v3',
      'v4',
      'v5',
      'v6',
      'v7',
      'v8',
      'v9',
      'v10',
    ])
    expect(chart.lines.map(({ position }) => position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  test('gives each line its color position, so a row with no processed day takes none and leaves no gap', () => {
    const chart = launchChartOf(
      [row('a', [1]), row('b', [], { days: 0, of: 7 }), row('c', [2])],
      'first7',
      'daily',
    )

    expect(chart.lines.map(({ videoId, position }) => [videoId, position])).toEqual([
      ['a', 1],
      ['c', 2],
    ])
  })

  test('draws the first 10 rows of the page with a processed day, wherever they sit, in color positions 1 to 10 in order', () => {
    const processed = new Set([3, 5, ...Array.from({ length: 19 }, (_, i) => i + 12)])
    const rows = Array.from({ length: 30 }, (_, i) =>
      processed.has(i + 1) ? row(`v${i + 1}`, [i + 1]) : row(`v${i + 1}`, [], { days: 0, of: 7 }),
    )

    const chart = launchChartOf(rows, 'first7', 'daily')

    expect(chart.lines.map(({ videoId, position }) => [videoId, position])).toEqual([
      ['v3', 1],
      ['v5', 2],
      ['v12', 3],
      ['v13', 4],
      ['v14', 5],
      ['v15', 6],
      ['v16', 7],
      ['v17', 8],
      ['v18', 9],
      ['v19', 10],
    ])
  })

  test('sets its scale from the drawn lines only, so a row past the 10th never stretches it', () => {
    const rows = [...Array.from({ length: 10 }, (_, i) => row(`v${i + 1}`, [5])), row('v11', [500])]

    expect(launchChartOf(rows, 'first7', 'daily').top).toBe(5)
  })

  test('labels the axis from "Day 1" to the window\'s length', () => {
    expect(launchChartOf([complete], 'first28', 'daily').axis).toEqual(['Day 1', 'Day 28'])
    expect(launchChartOf([], 'first365', 'daily').axis).toEqual(['Day 1', 'Day 365'])
  })

  test("spans the window's length in days, however few days a line has", () => {
    expect(launchChartOf([partial], 'first28', 'daily').days).toBe(28)
    expect(launchChartOf([], 'first7', 'daily').days).toBe(7)
  })
})

describe('the launch chart line that takes the accent', () => {
  const chart = launchChartOf([complete, partial], 'first28', 'daily')

  test("is the selection's line, over the line of the video the list marks", () => {
    expect(launchAccentOf(chart, { line: 1, point: 3 }, 'a')).toBe(1)
  })

  test("is the marked video's line with no selection", () => {
    expect(launchAccentOf(chart, null, 'b')).toBe(1)
  })

  test('is none with no selection and no mark, or a mark on a video with no line', () => {
    expect(launchAccentOf(chart, null, null)).toBe(-1)
    expect(launchAccentOf(chart, null, 'c')).toBe(-1)
  })
})

describe('the launch chart keys', () => {
  const chart = launchChartOf([complete, partial, row('d', [1, 2, 3])], 'first28', 'daily')

  test("left and right step the day, and stop at the line's last processed day", () => {
    expect(launchKeyStepOf('ArrowRight', null, chart)).toEqual({ selection: { line: 0, point: 0 } })
    expect(launchKeyStepOf('ArrowRight', { line: 1, point: 8 }, chart)).toEqual({
      selection: { line: 1, point: 9 },
    })
    expect(launchKeyStepOf('ArrowRight', { line: 1, point: 9 }, chart)).toEqual({
      selection: { line: 1, point: 9 },
    })
    expect(launchKeyStepOf('ArrowLeft', { line: 1, point: 0 }, chart)).toEqual({
      selection: { line: 1, point: 0 },
    })
    expect(launchKeyStepOf('End', { line: 1, point: 0 }, chart)).toEqual({
      selection: { line: 1, point: 9 },
    })
  })

  test("up and down step to the previous and next video in the page's order, keeping the day when it has it", () => {
    expect(launchKeyStepOf('ArrowDown', { line: 0, point: 5 }, chart)).toEqual({
      selection: { line: 1, point: 5 },
    })
    expect(launchKeyStepOf('ArrowUp', { line: 1, point: 5 }, chart)).toEqual({
      selection: { line: 0, point: 5 },
    })
    expect(launchKeyStepOf('ArrowUp', { line: 0, point: 5 }, chart)).toEqual({
      selection: { line: 0, point: 5 },
    })
    expect(launchKeyStepOf('ArrowDown', { line: 2, point: 1 }, chart)).toEqual({
      selection: { line: 2, point: 1 },
    })
  })

  test("up or down to a video without the day takes that video's last processed day", () => {
    expect(launchKeyStepOf('ArrowDown', { line: 0, point: 20 }, chart)).toEqual({
      selection: { line: 1, point: 9 },
    })
    expect(launchKeyStepOf('ArrowDown', { line: 1, point: 9 }, chart)).toEqual({
      selection: { line: 2, point: 2 },
    })
  })

  test('with nothing selected, down takes the first video and up the last', () => {
    expect(launchKeyStepOf('ArrowDown', null, chart)).toEqual({ selection: { line: 0, point: 0 } })
    expect(launchKeyStepOf('ArrowUp', null, chart)).toEqual({ selection: { line: 2, point: 0 } })
  })

  test('Escape clears the selection, and any other key or a chart with no line is left to the page', () => {
    expect(launchKeyStepOf('Escape', { line: 1, point: 2 }, chart)).toEqual({ selection: null })
    expect(launchKeyStepOf('Escape', null, chart)).toBeUndefined()
    expect(launchKeyStepOf('a', { line: 1, point: 2 }, chart)).toBeUndefined()
    const empty = launchChartOf([], 'first28', 'daily')
    expect(launchKeyStepOf('ArrowRight', null, empty)).toBeUndefined()
  })
})

describe('what the launch chart reads at its selection', () => {
  const chart = launchChartOf([row('a', days28(0, { 12: 1234 })), partial], 'first28', 'daily')

  test('is the video title, its day, and its engaged views, three lines in all', () => {
    expect(launchReadingOf(chart, { line: 0, point: 11 }, 'en-US')).toEqual({
      title: 'Title a',
      values: [
        { label: 'Day 12', value: '' },
        { label: 'Engaged views', value: '1,234' },
      ],
    })
  })

  test("at a partial video's last point, says how many days YouTube has processed", () => {
    expect(launchReadingOf(chart, { line: 1, point: 9 }, 'en-US')?.values[0]).toEqual({
      label: 'Day 10 (10 of 28 days)',
      value: '',
    })
    expect(launchReadingOf(chart, { line: 1, point: 8 }, 'en-US')?.values[0]?.label).toBe('Day 9')
  })

  test('is none with nothing selected', () => {
    expect(launchReadingOf(chart, null)).toBeNull()
  })

  test("on a chart of three lines, the value text and the live region read the selected video only, never another line's title or number", () => {
    const three = launchChartOf(
      [row('a', days28(0, { 12: 1234 })), row('b', days28(0, { 12: 5678 })), row('d', days28(7))],
      'first28',
      'daily',
    )
    const reading = launchReadingOf(three, { line: 0, point: 11 }, 'en-US')

    expect(sliderTextOf(reading)).toBe('Title a')
    const { text } = reading ? announcementAfter(silence, reading) : silence
    expect(text).toBe('Day 12, Engaged views 1,234')
    for (const other of ['Title b', 'Title d', '5,678', '7']) expect(text).not.toContain(other)
  })
})

describe("the launch chart's day card", () => {
  /** The card's rows at a selection, as title and value, in the card's order. */
  const rowsAt = (chart: ReturnType<typeof launchChartOf>, line: number, point: number) =>
    launchDayCardOf(chart, { line, point }, 'en-US')?.rows.map(({ title, value }) => [title, value])

  test("lists one row per drawn line at the selected day, with its color position, title and number, most first, the selected video's row flagged", () => {
    const chart = launchChartOf(
      [row('a', [5, 1234]), row('u', []), row('b', [10, 5000]), row('d', [2, 20])],
      'first28',
      'daily',
    )

    expect(launchDayCardOf(chart, { line: 0, point: 1 }, 'en-US')).toEqual({
      heading: 'Day 2',
      rows: [
        { videoId: 'b', title: 'Title b', position: 2, value: '5,000', selected: false },
        { videoId: 'a', title: 'Title a', position: 1, value: '1,234', selected: true },
        { videoId: 'd', title: 'Title d', position: 3, value: '20', selected: false },
      ],
    })
  })

  test("keeps the list's order for a tie", () => {
    const chart = launchChartOf(
      [row('b', [1, 10]), row('a', [1, 10]), row('d', [1, 20])],
      'first28',
      'daily',
    )

    expect(rowsAt(chart, 0, 1)).toEqual([
      ['Title d', '20'],
      ['Title b', '10'],
      ['Title a', '10'],
    ])
  })

  test('puts a video younger than the day and a partial video past its last processed day last, as "No data", in list order, below a video with 0 on the day', () => {
    const chart = launchChartOf(
      [
        row('y', [40], { days: 1, of: 28 }),
        row('a', days28(1, { 3: 9 })),
        row('p', [30, 30], { days: 2, of: 28 }),
        row('b', days28(1, { 3: 4 })),
        row('z', days28(1, { 3: 0 })),
      ],
      'first28',
      'daily',
    )

    expect(rowsAt(chart, 1, 2)).toEqual([
      ['Title a', '9'],
      ['Title b', '4'],
      ['Title z', '0'],
      ['Title y', 'No data'],
      ['Title p', 'No data'],
    ])
  })

  test('sorts by the running total in running total mode, where it differs from the daily order', () => {
    const videos = [row('a', [1, 30]), row('b', [50, 1])]

    expect(rowsAt(launchChartOf(videos, 'first28', 'daily'), 0, 1)).toEqual([
      ['Title a', '30'],
      ['Title b', '1'],
    ])
    expect(rowsAt(launchChartOf(videos, 'first28', 'aggregate'), 0, 1)).toEqual([
      ['Title b', '51'],
      ['Title a', '31'],
    ])
  })

  test("heads the card with the day, with the partial wording only at the selected partial video's last day", () => {
    const chart = launchChartOf([complete, partial], 'first28', 'daily')

    expect(launchDayCardOf(chart, { line: 1, point: 9 })?.heading).toBe('Day 10 (10 of 28 days)')
    expect(launchDayCardOf(chart, { line: 0, point: 9 })?.heading).toBe('Day 10')
    expect(launchDayCardOf(chart, { line: 1, point: 8 })?.heading).toBe('Day 9')
  })

  test("flags the selected video's row only, wherever it sorts", () => {
    const chart = launchChartOf([complete, partial], 'first28', 'daily')

    const card = launchDayCardOf(chart, { line: 1, point: 9 })
    expect(card?.rows.map(({ videoId, selected }) => [videoId, selected])).toEqual([
      ['b', true],
      ['a', false],
    ])
  })

  test('is none with nothing selected, or a selection that names no point', () => {
    const chart = launchChartOf([complete, partial], 'first28', 'daily')

    expect(launchDayCardOf(chart, null)).toBeNull()
    expect(launchDayCardOf(chart, { line: 1, point: 12 })).toBeNull()
    expect(launchDayCardOf(chart, { line: 5, point: 0 })).toBeNull()
  })
})

describe("the launch chart's positions in the list", () => {
  test("map the page's first 10 rows with a processed day to color positions 1 to 10, wherever they sit, a row of all zeros included", () => {
    const rows = [
      row('a', [1]),
      row('b', [], { days: 0, of: 7 }),
      row('c', [0, 0], { days: 2, of: 7 }),
      ...Array.from({ length: 7 }, (_, i) => row(`u${i + 4}`, undefined)),
      ...Array.from({ length: 10 }, (_, i) => row(`v${i + 11}`, [1])),
    ]

    const positions = launchPositionsOf(rows)

    expect([...positions]).toEqual([
      ['a', 1],
      ['c', 2],
      ['v11', 3],
      ['v12', 4],
      ['v13', 5],
      ['v14', 6],
      ['v15', 7],
      ['v16', 8],
      ['v17', 9],
      ['v18', 10],
    ])
  })

  test('show as swatches in the windows the launch chart draws in, and not on the publish day or in a calendar window', () => {
    expect(launchSwatchesShown('first7')).toBe(true)
    expect(launchSwatchesShown('first28')).toBe(true)
    expect(launchSwatchesShown('first90')).toBe(true)
    expect(launchSwatchesShown('first365')).toBe(true)
    expect(launchSwatchesShown('first1')).toBe(false)
    expect(launchSwatchesShown('last28')).toBe(false)
    expect(launchSwatchesShown('lifetime')).toBe(false)
  })
})

describe("the note on the launch chart's first 10 rows", () => {
  test('shows with more than 10 rows on the page, processed or not, and not with 10', () => {
    const rows = (count: number) =>
      Array.from({ length: count }, (_, i) => row(`v${i}`, [], { days: 0, of: 7 }))

    expect(rowsPastLaunchChart(rows(11))).toBe(true)
    expect(rowsPastLaunchChart(rows(25))).toBe(true)
    expect(rowsPastLaunchChart(rows(10))).toBe(false)
    expect(rowsPastLaunchChart(rows(0))).toBe(false)
  })
})

describe("the launch chart's empty state", () => {
  test('shows when no row on the page has a processed day', () => {
    expect(launchChartEmpty([row('a', [], { days: 0, of: 28 }), row('b', undefined)])).toBe(true)
    expect(launchChartEmpty([])).toBe(true)
  })

  test('does not show when a row on the page has a processed day, even all zeros', () => {
    expect(launchChartEmpty([row('a', []), row('b', [12, 3])])).toBe(false)
    expect(launchChartEmpty([row('a', []), row('b', [0, 0], { days: 2, of: 7 })])).toBe(false)
  })

  test('does not show when only rows past the first 10 have a processed day, as the chart draws them', () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      i < 10 ? row(`v${i + 1}`, [], { days: 0, of: 7 }) : row(`v${i + 1}`, [4]),
    )

    expect(launchChartEmpty(rows)).toBe(false)
  })
})
