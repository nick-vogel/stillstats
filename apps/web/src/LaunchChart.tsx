import type { VideoRow, WindowAfterPublish } from '@creator-analytics/api-types'
import type { ChartInteractionController } from '@tanstack/charts'
import { createChartCursor } from '@tanstack/charts/cursor'
import { Chart } from '@tanstack/charts/react/tooltip'
import {
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ChartModes, useChartMode } from './ChartModes.tsx'
import { useChartSlider, useSliderGroup } from './ChartSlider.tsx'
import {
  type LaunchDayCard,
  type LaunchSelection,
  launchAccentOf,
  launchChartEmpty,
  launchChartOf,
  launchChartText,
  launchDayCardOf,
  launchKeyStepOf,
  launchReadingOf,
  rowsPastLaunchChart,
} from './launch-chart.ts'
import {
  type LaunchRow,
  launchCursorStateOf,
  launchPlotDefinitionOf,
  launchSelectionOf,
} from './launch-plot.ts'
import type { Navigate, Route } from './route.ts'
import { type ListMark, noDataLabel } from './video-list.ts'
import { axisCountTextOf } from './views-chart.ts'

/** The plot height the library reads from its container: its CSS box, 10rem (app.css). */
const fillPlot = { height: '100%' }

/**
 * A list row's swatch of its launch chart line's color, by color position, so the list is the
 * chart's legend. An SVG rect takes the fill, as no background may name a warm-hued token, and the
 * row's title already names the video, so a screen reader skips it.
 */
export function LaunchSwatch({ position }: { position: number }) {
  return (
    <svg
      className="launch-swatch"
      data-launch-position={position}
      viewBox="0 0 1 1"
      aria-hidden="true"
    >
      <rect width="1" height="1" />
    </svg>
  )
}

/**
 * The launch chart's card at a day: its heading, then one row per drawn line with its swatch, its
 * title and its number on the day, the selected video's row bold.
 */
function LaunchDayCardContent({ card }: { card: LaunchDayCard }) {
  return (
    <>
      <p className="chart-hover-title">{card.heading}</p>
      <ol className="launch-card-rows">
        {card.rows.map(({ videoId, title, position, value, selected }) => (
          <li
            key={videoId}
            className={`launch-card-row${selected ? ' launch-card-row-selected' : ''}`}
          >
            <LaunchSwatch position={position} />
            <span className="launch-card-title">{title}</span>
            <span
              className={`chart-hover-value${value === noDataLabel ? ' launch-card-no-data' : ''}`}
            >
              {value}
            </span>
          </li>
        ))}
      </ol>
    </>
  )
}

/**
 * The selection on the chart, kept with the lines it was made on: a new page, sort or mode draws
 * other lines, where its indexes would name another video or day, so it clears.
 */
function useLaunchSelection(linesKey: string) {
  const [held, setHeld] = useState<{ key: string; selection: LaunchSelection }>({
    key: linesKey,
    selection: null,
  })
  return [
    held.key === linesKey ? held.selection : null,
    (selection: LaunchSelection) => setHeld({ key: linesKey, selection }),
  ] as const
}

/**
 * The launch chart: each of the first 10 videos of the list's page with a processed day, wherever
 * they sit, as one line of its engaged views from its publish day, daily or as a running total
 * under the shared "Show numbers as" toggle, with the note on the first 10 rows under it when the
 * page holds more than 10 rows, the running total sentence in that mode, and the processed note
 * (`note`) last, as under the summary's charts it takes the place of. TanStack Charts draws the
 * plot (`launchPlotDefinitionOf`): each line, and a partial line's end dot, in its color
 * position's colour token; the accented one (`launchAccentOf`) draws heavier and on top, so it
 * does not depend on colour alone; the line at the selected day; and the tooltip that holds the
 * card. The selection is the app's, and it drives the chart's own cursor
 * (`launchCursorStateOf`), so the cursor shows only what the app selected. The pointer is the
 * app's too: a mouse or a pen selects the nearest line and day, which the library resolves
 * (`launchSelectionOf`), and clears it on leaving; a tap places it, and it stays when the finger
 * lifts. With focus, left and right step the day, up and down the video, and Escape clears it.
 * The card lists every drawn line at the selected day (`launchDayCardOf`), while the plot's value
 * text and a polite live region, after each step, read the selected video only: its title, then its
 * day and number (`launchReadingOf`). A selection on the chart marks the video's list row through
 * `onMark`, and the row the list marks (`markedVideoId`) accents its line with no card. The chart
 * shows its own selection only while the mark is the chart's (`markedBy`), so a list row hover
 * replaces it, and the pointer leaving the row clears a mark the row made, never one the chart
 * made: the accented line and the marked row always name one video. The plot is a slider
 * (`useChartSlider`), a group of one. The live region empties whenever the chart's selection ends,
 * a row hover included, and whenever a pointer selects, as a pointer step announces nothing; the
 * next key step announces again. No accented line or marked row outlives the card. The library's
 * chart sits under `aria-hidden`, so its svg's second name and its tooltip's own live region stay
 * off the accessibility tree, and a press on the plot focuses the slider, never the svg. When no
 * row on the page has a processed day (`launchChartEmpty`), the heading and the empty sentence
 * take the place of the plot, its axis, the toggle, the running total sentence, the live region
 * and the note on the first 10 rows, with the processed note still under it.
 */
export function LaunchChart({
  videos,
  window,
  route,
  navigate,
  markedVideoId,
  markedBy,
  onMark,
  note,
}: {
  videos: VideoRow[]
  window: Exclude<WindowAfterPublish, 'first1'>
  route: Route
  navigate: Navigate
  markedVideoId: string | null
  markedBy: ListMark['by'] | null
  onMark: (videoId: string | null) => void
  /** How current the numbers are: "YouTube has processed data up to ...". */
  note: string
}) {
  const { mode, changeMode } = useChartMode(route, navigate)
  const chart = useMemo(() => launchChartOf(videos, window, mode), [videos, window, mode])
  const linesKey = JSON.stringify([mode, chart.lines.map(({ videoId }) => videoId)])
  const [held, setSelection] = useLaunchSelection(linesKey)
  // The chart shows its own selection only while the mark is the chart's, so a row hover hides it.
  const selection = markedBy === 'chart' ? held : null
  const group = useSliderGroup()
  // When the shown selection ends any way, a row hover included, the live region empties with it.
  const [selectionShown, setSelectionShown] = useState(false)
  if (selectionShown !== (selection !== null)) {
    setSelectionShown(selection !== null)
    if (selection === null) group.quiet()
  }
  // A new page or sort ends the chart's mark through the list it was made on (`markedVideoOf`); a
  // mode change drops the held selection, and this effect ends its mark, so no accented line or
  // marked row outlives the card.
  const markOutlivesSelection = markedBy === 'chart' && held === null
  useEffect(() => {
    if (markOutlivesSelection) onMark(null)
  }, [markOutlivesSelection, onMark])

  /** Selects a line and a day, or clears the selection with null, and marks its list row. */
  function select(next: LaunchSelection) {
    setSelection(next)
    onMark(next === null ? null : (chart.lines[next.line]?.videoId ?? null))
  }

  const selectedPoint =
    selection === null ? undefined : chart.lines[selection.line]?.points[selection.point]
  const accented = launchAccentOf(chart, selection, markedVideoId)
  const [cursor] = useState(() => createChartCursor<number, number>())
  const definition = useMemo(
    () => launchPlotDefinitionOf({ chart, accented, cursor }),
    [chart, accented, cursor],
  )
  const interaction = useRef<ChartInteractionController<LaunchRow, number, number> | null>(null)
  // Before paint, the chart's cursor takes the shown selection whenever it changes, however it
  // changed, so the cursor only ever holds the app's state.
  const cursorState = launchCursorStateOf(chart, selection)
  useLayoutEffect(() => {
    // Only the app writes the cursor, so an equal state holds the same fields in the same order.
    if (JSON.stringify(cursor.getState()) !== JSON.stringify(cursorState)) {
      cursor.setState(cursorState)
    }
  })
  // The pointer leaving the plot clears the selection, by the browser's own event: React's
  // onPointerLeave misses it when the element under the pointer is gone, as the library draws its
  // svg anew whenever the accent moves. A touch leaves when the finger lifts, so a tapped card
  // stays until the next tap.
  const leave = useRef(() => {})
  leave.current = () => select(null)
  const listenForLeave = useCallback((plot: HTMLDivElement) => {
    const onLeave = ({ pointerType }: globalThis.PointerEvent) => {
      if (pointerType !== 'touch') leave.current()
    }
    plot.addEventListener('pointerleave', onLeave)
    return () => plot.removeEventListener('pointerleave', onLeave)
  }, [])
  const slider = useChartSlider<NonNullable<LaunchSelection>>({
    group,
    label: launchChartText.label,
    selection,
    stepOf: (key, at) => launchKeyStepOf(key, at, chart),
    readingOf: (at) => launchReadingOf(chart, at),
    sameAs: (a, b) => a.line === b.line && a.point === b.point,
    move: select,
    valueNow: selectedPoint?.day ?? 1,
    valueMax: chart.lines[selection?.line ?? 0]?.points.length ?? 1,
  })

  // After every hook, which must run on each render.
  if (launchChartEmpty(videos)) {
    return (
      <section className="video-detail-section metric-charts launch-chart">
        <h2>{launchChartText.heading}</h2>
        <p>{launchChartText.empty}</p>
        <p className="note">{note}</p>
      </section>
    )
  }

  const dayCard = launchDayCardOf(chart, selection)

  /** Selects the line and day nearest a pointer, as the library resolves it. */
  function pointAt({ clientX, clientY }: PointerEvent<HTMLDivElement>) {
    const next = launchSelectionOf(
      chart,
      interaction.current?.resolvePointer(clientX, clientY)?.point,
    )
    if (next === null) return
    select(next)
    // A pointer step writes no announcement, so a key step's text would outlive its selection.
    group.quiet()
  }

  /**
   * A press focuses the slider, never the library's svg inside it: its tab index of -1 takes focus
   * from a press, and Chrome drops the aria-hidden of a focused element's ancestors for good.
   */
  function onMouseDown(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
  }

  return (
    <section className="video-detail-section metric-charts launch-chart">
      <ChartModes mode={mode} onChange={changeMode} />
      <div className="metric-chart">
        <h2>{launchChartText.heading}</h2>
        <div className="chart">
          <span className="chart-label" style={{ top: '0%' }}>
            {axisCountTextOf(chart.top)}
          </span>
          <span className="chart-label" style={{ top: '100%' }}>
            {axisCountTextOf(0)}
          </span>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: the plot is a slider, the role `plotProps` gives it. */}
          <div
            ref={listenForLeave}
            className="chart-plot cursor-plot"
            {...slider.plotProps}
            onMouseDown={onMouseDown}
            onPointerMove={(event) => {
              if (event.pointerType !== 'touch') pointAt(event)
            }}
            onPointerDown={(event) => {
              if (event.pointerType === 'touch') pointAt(event)
            }}
          >
            <div className="cursor-plot-chart" aria-hidden="true">
              <Chart
                definition={definition}
                ariaLabel={launchChartText.label}
                style={fillPlot}
                onRender={(context) => {
                  interaction.current = context.interaction
                }}
                renderTooltipBody={() =>
                  dayCard && (
                    <div className="chart-hover-card">
                      <LaunchDayCardContent card={dayCard} />
                    </div>
                  )
                }
              />
            </div>
          </div>
        </div>
      </div>
      <div className="metric-charts-axis" aria-hidden="true">
        <span>{chart.axis[0]}</span>
        <span>{chart.axis[1]}</span>
      </div>
      {rowsPastLaunchChart(videos) && <p className="note">{launchChartText.firstRowsNote}</p>}
      {mode === 'aggregate' && <p className="note">{launchChartText.runningTotalNote}</p>}
      <p className="note">{note}</p>
      {slider.liveRegion}
    </section>
  )
}
