import {
  type ChartMode,
  type PartialWindow,
  type VideoRow,
  type VideoWindow,
  videoWindowDays,
  type WindowAfterPublish,
} from '@creator-analytics/api-types'
import type { HoverCard } from './chart-slider.ts'
import { keyStepOf } from './chart-slider.ts'
import { partialLabelOf } from './processing.ts'
import { isWindowAfterPublish } from './route.ts'
import { noDataLabel } from './video-list.ts'
import { seriesNames } from './views-chart.ts'

// The text is approved word for word in creator-analytics#85. Change it only with Nick.
export const launchChartText = {
  heading: "Engaged views in each video's first days",
  label:
    "Engaged views in each video's first days. Use the left and right arrow keys to read each day, and the up and down arrow keys to choose a video.",
  runningTotalNote:
    'The running total adds the daily numbers, so its last point can differ from the totals in the list.',
  // Approved word for word in creator-analytics#311 on 2026-11-05. Change it only with Nick.
  firstRowsNote: 'The chart shows the first 10 videos on this page that have data.',
  // Approved word for word in creator-analytics#311 on 2026-11-05, each sentence its own approved
  // text. Change it only with Nick.
  empty:
    'YouTube has not processed a day of any video on this page yet. If you have videos with data, show more videos in the table below.',
}

/** How many of the page's rows with a processed day the chart draws, whatever the page size. */
export const launchChartRows = 10

/**
 * The color position of each row the launch chart draws a line for, by video id: the page's first
 * 10 rows with a processed day, wherever they sit on the page, numbered 1 to 10 in the page's
 * order. A row with no processed day draws no line, takes no position and leaves no gap. A row
 * whose processed days are all zero still has a processed day, and draws a flat line. The chart's
 * lines and the list's swatches both take their color from here, which is how the list is the
 * chart's legend.
 */
export function launchPositionsOf(videos: VideoRow[]): Map<string, number> {
  return new Map(
    videos
      .filter((video) => (video.engagedViewsByDay ?? []).length > 0)
      .slice(0, launchChartRows)
      .map((video, index) => [video.id, index + 1] as const),
  )
}

/**
 * Whether the launch chart draws no line, so its empty sentence takes the plot's place: no row on
 * the page has a processed day. A row whose processed days are all zero still draws, a flat line.
 * Built on `launchPositionsOf`, so the chart, the swatches and the empty state agree.
 */
export function launchChartEmpty(videos: VideoRow[]): boolean {
  return launchPositionsOf(videos).size === 0
}

/**
 * Whether the page holds more than 10 rows, processed or not, so the note on the launch chart's
 * first 10 rows shows under the drawn chart. The page size alone decides it, so the loading
 * placeholder can predict it. It does not show under the empty state.
 */
export function rowsPastLaunchChart(videos: VideoRow[]): boolean {
  return videos.length > launchChartRows
}

/**
 * Whether the list shows each drawn row's swatch: in the windows after publish the launch chart
 * draws in. On the publish day (`first1`) the publish day top 10 takes the chart's place and draws
 * no line, so a swatch would name a color nothing on screen uses.
 */
export function launchSwatchesShown(window: VideoWindow): boolean {
  return isWindowAfterPublish(window) && window !== 'first1'
}

/**
 * The list's swatch positions for a page of rows in a window, by video id: the launch chart's
 * positions where the list shows swatches (`launchSwatchesShown`), else none.
 */
export function launchSwatchPositionsOf(
  window: VideoWindow,
  videos: VideoRow[],
): Map<string, number> {
  return launchSwatchesShown(window) ? launchPositionsOf(videos) : new Map()
}

/** A day of a video's line: its day after publish and its number. */
export interface LaunchPoint {
  /** 1 on the publish day. */
  day: number
  /** The day's engaged views, or in running total mode those of every day up to it. */
  engagedViews: number
}

/** One video's line over the days of its window Google has processed. */
export interface LaunchLine {
  videoId: string
  title: string
  /** Its color position, 1 to 10, from `launchPositionsOf`, which names its color. */
  position: number
  points: LaunchPoint[]
  partial?: PartialWindow
}

export interface LaunchChart {
  lines: LaunchLine[]
  /** The number at the top edge: the highest drawn day of any line, so every line shares a scale. */
  top: number
  /** The x axis's labels, at its left and right edges. */
  axis: [string, string]
  /** The window's length in days, the day at the right edge. */
  days: number
}

/** The line and the point a pointer or a key selected, by index, or null with none. */
export type LaunchSelection = { line: number; point: number } | null

/** A day's place on the x axis, in the form the other charts' days after publish take. */
function dayLabelOf(day: number): string {
  return `Day ${day}`
}

/** Each day with every day before it added. */
function runningTotalOf(values: number[]): number[] {
  let sum = 0
  return values.map((value) => {
    sum += value
    return sum
  })
}

/**
 * The launch chart of a page of a window after publish's rows: one line for each of the page's
 * first 10 rows with a processed day, wherever they sit, in the page's order, each with its color
 * position, its day 1 the video's publish day, daily or as a running total. Every line shares the
 * x axis of the window's length (`days`), so a partial video's line ends short of the right edge,
 * and one scale, from zero to the highest drawn day (`top`). The plot draws it (launch-plot.ts).
 */
export function launchChartOf(
  videos: VideoRow[],
  window: WindowAfterPublish,
  mode: ChartMode,
): LaunchChart {
  const length = videoWindowDays[window]
  const positions = launchPositionsOf(videos)
  const drawn = videos.flatMap((video) => {
    const position = positions.get(video.id)
    if (position === undefined) return []
    const days = video.engagedViewsByDay ?? []
    return [{ video, position, values: mode === 'aggregate' ? runningTotalOf(days) : days }]
  })
  const top = Math.max(0, ...drawn.flatMap(({ values }) => values))
  const lines = drawn.map(
    ({ video, position, values }): LaunchLine => ({
      videoId: video.id,
      title: video.title,
      position,
      points: values.map((engagedViews, index) => ({ day: index + 1, engagedViews })),
      ...(video.partial ? { partial: video.partial } : {}),
    }),
  )
  return { lines, top, axis: [dayLabelOf(1), dayLabelOf(length)], days: length }
}

/**
 * The index of the line the chart accents, drawn on top and heavier: the selection's line, else
 * the line of the video the list marks, else -1 for none.
 */
export function launchAccentOf(
  chart: LaunchChart,
  selection: LaunchSelection,
  markedVideoId: string | null,
): number {
  return selection?.line ?? chart.lines.findIndex(({ videoId }) => videoId === markedVideoId)
}

/** The selection a handled key moves to: null clears it. */
export interface LaunchKeyStep {
  selection: LaunchSelection
}

/**
 * Where a key takes the selection on the chart. Left and right step the day, and Home and End jump
 * to the line's ends, as on the other charts, stopping at the line's last processed day. Up and down
 * step to the previous and next video in the page's order, stopping at the ends, keeping the day
 * when the new line has it, else taking its last day. With nothing selected, a day key starts on the
 * first video, down on the first and up on the last. Escape clears the selection. Undefined for any
 * other key, for Escape with nothing selected, and for every key on a chart with no line.
 */
export function launchKeyStepOf(
  key: string,
  selection: LaunchSelection,
  chart: LaunchChart,
): LaunchKeyStep | undefined {
  const lastLine = chart.lines.length - 1
  if (lastLine < 0) return undefined
  const pointsOf = (line: number) => chart.lines[line]?.points.length ?? 0
  switch (key) {
    case 'ArrowUp':
    case 'ArrowDown': {
      const step = key === 'ArrowUp' ? -1 : 1
      const line =
        selection === null
          ? step === 1
            ? 0
            : lastLine
          : Math.min(lastLine, Math.max(0, selection.line + step))
      const point = Math.min(selection?.point ?? 0, pointsOf(line) - 1)
      return { selection: { line, point } }
    }
    case 'Escape':
      return selection === null ? undefined : { selection: null }
    default: {
      const line = selection?.line ?? 0
      const step = keyStepOf(key, selection?.point ?? null, pointsOf(line))
      if (!step || step.index === null) return undefined
      return { selection: { line, point: step.index } }
    }
  }
}

/**
 * A point's day as the selection names it, "Day 12". At a partial video's last point, it says how
 * many days of the window YouTube has processed, "Day 10 (10 of 28 days)".
 */
function selectedDayOf(line: LaunchLine, point: LaunchPoint): string {
  const partial = point === line.points.at(-1) ? partialLabelOf(line) : null
  const day = dayLabelOf(point.day)
  return partial ? `${day} (${partial})` : day
}

/**
 * What the plot's value text and its polite live region read at the selection: the selected
 * video's title, its day, and its engaged views as drawn, never another line's. The card that shows
 * lists every drawn line (`launchDayCardOf`); this is only what a screen reader hears. The day line
 * has no value of its own, so its value is empty.
 */
export function launchReadingOf(
  chart: LaunchChart,
  selection: LaunchSelection,
  locale?: string,
): HoverCard | null {
  if (selection === null) return null
  const line = chart.lines[selection.line]
  const point = line?.points[selection.point]
  if (!line || !point) return null
  return {
    title: line.title,
    values: [
      { label: selectedDayOf(line, point), value: '' },
      { label: seriesNames.engagedViews, value: point.engagedViews.toLocaleString(locale) },
    ],
  }
}

/** One drawn line's row on the day card. */
export interface LaunchDayCardRow {
  videoId: string
  title: string
  /** The line's color position, 1 to 10 (`launchPositionsOf`), which names its swatch's color. */
  position: number
  /** The line's number on the day, as drawn, or the list's label for a missing value. */
  value: string
  /** Whether this is the selected video's row. */
  selected: boolean
}

/** The hover card that shows at a selection: the selected day, and every drawn line's row on it. */
export interface LaunchDayCard {
  heading: string
  rows: LaunchDayCardRow[]
}

/**
 * The card that shows at the selection, so one hover compares the videos at the same day of their
 * launch: the selected day as its heading, with the partial wording at the selected video's last
 * processed day, then one row per drawn line with its number on that day as drawn, daily or the
 * running total. Rows sort most first, a tie in the list's order, and a line with no number on the
 * day, younger than it or partial past its last processed day, goes last as "No data". Null with no
 * selection, as the reading (`launchReadingOf`).
 */
export function launchDayCardOf(
  chart: LaunchChart,
  selection: LaunchSelection,
  locale?: string,
): LaunchDayCard | null {
  if (selection === null) return null
  const selected = chart.lines[selection.line]
  const point = selected?.points[selection.point]
  if (!selected || !point) return null
  const rows = chart.lines.map((line) => ({
    line,
    engagedViews: line.points[point.day - 1]?.engagedViews,
  }))
  // A stable sort, so a tie keeps the list's order, and every "No data" row keeps it after the rest.
  rows.sort((a, b) => (b.engagedViews ?? -1) - (a.engagedViews ?? -1))
  return {
    heading: selectedDayOf(selected, point),
    rows: rows.map(({ line, engagedViews }) => ({
      videoId: line.videoId,
      title: line.title,
      position: line.position,
      value: engagedViews === undefined ? noDataLabel : engagedViews.toLocaleString(locale),
      selected: line === selected,
    })),
  }
}
