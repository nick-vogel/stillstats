import type { ChartInteractionController, DomChartDefinition } from '@tanstack/charts'
import { createChartCursor } from '@tanstack/charts/cursor'
import { Chart } from '@tanstack/charts/react/tooltip'
import {
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { useChartSlider, useSliderGroup } from './ChartSlider.tsx'
import { cursorStateAt, fromPointer, selectionOf } from './chart-cursor.ts'
import { chartLabelOf, type HoverCard, keyStepOf } from './chart-slider.ts'
import type { PlayerSeekInput } from './video-player.ts'

/**
 * The plot height the library reads from its container: its CSS box, 10rem, or 6rem for a stacked
 * chart below engaged views (app.css).
 */
const fillPlot = { height: '100%' }

/** A hover card's lines under its title: a line with an empty value shows its label alone. */
function HoverCardValues({ card }: { card: HoverCard }) {
  return card.values.map(({ label, value }) =>
    value ? (
      <p key={label}>
        {label} <span className="chart-hover-value">{value}</span>
      </p>
    ) : (
      <p key={label}>{label}</p>
    ),
  )
}

/**
 * The TanStack Charts cursor a group of plots over the same points shares, as the stacked charts of
 * creator-analytics#82 and the audience retention pair of #370 do, with the slider group of their
 * keys (`useSliderGroup`). `xs` are the points' x values, in order, as every plot of the group
 * draws them. Called in the component that renders the group, so each mounted group has its own
 * cursor. The point the card shows is the cursor's (`selectionOf`), null with no card. The
 * library's own pointer moving the card empties the live region, as a tap and a hide do, so a key
 * step's values never outlive the card that showed them. A change in the point count hides the
 * card: on more points its index would name another day.
 */
export function useChartCursor(xs: readonly number[]) {
  const count = xs.length
  const [cursor] = useState(() => createChartCursor<number, number>())
  const group = useSliderGroup()
  const snapshot = () => selectionOf(cursor.getState(), xs)
  const index = useSyncExternalStore(cursor.subscribe, snapshot, snapshot)
  const quiet = useRef(group.quiet)
  quiet.current = group.quiet

  useEffect(
    () =>
      cursor.subscribe(() => {
        if (fromPointer(cursor.getState())) quiet.current()
      }),
    [cursor],
  )

  // Before paint, so no frame shows the card at its old index on the new points.
  const placedOn = useRef(count)
  useLayoutEffect(() => {
    if (placedOn.current === count) return
    placedOn.current = count
    cursor.setState(null)
    quiet.current()
  }, [cursor, count])

  /** The cursor state at the point of an index, or null for an index that is no point's. */
  function stateAt(at: number | null) {
    const x = at === null ? undefined : xs[at]
    return x === undefined ? null : cursorStateAt(x)
  }

  /** Shows the card at a point, or hides it with null, which also empties the live region. */
  function show(next: number | null) {
    const state = stateAt(next)
    cursor.setState(state)
    if (state === null) group.quiet()
  }

  /**
   * Shows the card at the point a tap selects and empties the live region. The state is the app's,
   * so the library's clear when the finger lifts leaves it, and the card stays until the next tap.
   * A finger's moves and the cancel that ends its pan never reach the library (`CursorPlot`), so
   * a scroll that starts on a plot keeps the card too (creator-analytics#396).
   */
  function tap(next: number) {
    cursor.setState(stateAt(next))
    group.quiet()
  }

  /** The index of the point at an x value the library resolved, or null for none. */
  function indexOf(xValue: number | null | undefined): number | null {
    return xValue == null ? null : selectionOf(cursorStateAt(xValue), xs)
  }

  return { cursor, group, index, show, tap, indexOf }
}

/** A group's cursor, which every plot of the group renders over. */
export type ChartCursorGroup = ReturnType<typeof useChartCursor>

/**
 * A chart's plot drawn by TanStack Charts, over the group's cursor: the library draws the lines,
 * the line at the cursor's point and the tooltip, which holds the card's own markup. A mouse or a
 * pen moves the card through the library's pointer and hides it on leaving; a tap places it, and
 * a new tap moves it. A finger's `pointermove` and the `pointercancel` that ends its pan stop at
 * the plot, before the library's container, so a scroll that starts on a plot neither moves nor
 * clears the card (creator-analytics#396). The plot is the app's slider (`useChartSlider`): the
 * arrow keys, Home, End and Escape move the cursor, and its live region reads the values after a
 * key step on this plot. The library's chart sits under `aria-hidden`, so its svg's second name and
 * its tooltip's own live region stay off the accessibility tree, and its keyboard is off
 * (`cursorPlotOf`), so its svg is no second tab stop. A press on the plot focuses the slider, so the svg never takes
 * focus under the wrapper. An overlay, such as the retention plots' playhead, sits in the plot's box
 * under the library's chart, so the crosshair and the card paint over it. With `onPick`, a mouse's
 * or a pen's click, a tap and Enter or Space pick the point, as the retention plots move the video
 * player, and the plot's live region says what `onPick` returns; a hover picks nothing.
 */
export function CursorPlot<Point>({
  heading,
  points,
  cardOf,
  definition,
  group: { group, index, show, tap, indexOf },
  overlay,
  onPick,
  labelMore,
}: {
  heading: string
  points: Point[]
  cardOf: (point: Point) => HoverCard
  definition: DomChartDefinition<unknown, number, number>
  group: ChartCursorGroup
  /** Drawn in the plot's box under the library's chart, or nothing. */
  overlay?: ReactNode
  /** What picking the point at an index does, returning the text to say, or null for none. */
  onPick?: (index: number, input: PlayerSeekInput) => string | null
  /** A sentence after the keys sentence in the plot's accessible name, on what picking does. */
  labelMore?: string
}) {
  const interaction = useRef<ChartInteractionController<unknown, number, number> | null>(null)
  const cardAt = (at: number | null) => {
    const point = at === null ? undefined : points[at]
    return point === undefined ? null : cardOf(point)
  }
  const label = chartLabelOf(heading, labelMore)
  const slider = useChartSlider<number>({
    group,
    label,
    selection: index,
    stepOf: (key, at) => {
      const step = keyStepOf(key, at, points.length)
      return step && { selection: step.index }
    },
    readingOf: cardAt,
    move: show,
    activate: onPick && ((at) => onPick(at, 'keyboard')),
    valueNow: index === null ? 1 : index + 1,
    valueMax: points.length,
  })

  /**
   * A press focuses the slider, never the library's svg inside it: its tab index of -1 takes focus
   * from a press, and Chrome drops the aria-hidden of a focused element's ancestors for good.
   */
  function onMouseDown(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
  }

  /**
   * Stops a finger's moves and the cancel that ends its pan in the capture phase, on the way down
   * to the library's container, which would move the card along the finger and then clear it. The
   * plot is the container's ancestor, so the library never sees them; a mouse's and a pen's pass.
   * The click a browser follows a tap with stops there too, and picks the point the press placed
   * the card at. The pick waits for it because only a tap sends it: a finger that lands on the plot
   * to scroll the page gets a pointercancel when the browser takes the pan, and no click, so it
   * moves nothing. Let through, the library would place a card of its own on the click, which it
   * clears when the mouse it emulates leaves the plot, as Chrome's does at once, back to where the
   * real mouse last was (the browser walk, creator-analytics#646). A browser whose click carries no
   * pointer type is told by the press before it.
   */
  /** The point a finger's press placed the card at, until the tap's click or the pan's cancel. */
  const fingerAt = useRef<number | null>(null)
  /** This render's pick, for the plot's own listeners, which are added once. */
  const pickLatest = useRef(pick)
  pickLatest.current = pick
  const keepTouchFromLibrary = useCallback((plot: HTMLDivElement) => {
    let pressedByFinger = false
    const notePress = (event: globalThis.PointerEvent) => {
      pressedByFinger = event.pointerType === 'touch'
    }
    const stopTouch = (event: globalThis.PointerEvent) => {
      if (event.pointerType === 'touch') event.stopPropagation()
    }
    const stopPan = (event: globalThis.PointerEvent) => {
      if (event.pointerType !== 'touch') return
      event.stopPropagation()
      fingerAt.current = null
    }
    const stopTapClick = (event: globalThis.MouseEvent) => {
      const byFinger =
        pressedByFinger || (event as Partial<globalThis.PointerEvent>).pointerType === 'touch'
      const at = fingerAt.current
      pressedByFinger = false
      fingerAt.current = null
      if (!byFinger) return
      event.stopPropagation()
      if (at !== null) pickLatest.current(at, 'touch')
    }
    plot.addEventListener('pointerdown', notePress, { capture: true })
    plot.addEventListener('pointermove', stopTouch, { capture: true })
    plot.addEventListener('pointercancel', stopPan, { capture: true })
    plot.addEventListener('click', stopTapClick, { capture: true })
    return () => {
      plot.removeEventListener('pointerdown', notePress, { capture: true })
      plot.removeEventListener('pointermove', stopTouch, { capture: true })
      plot.removeEventListener('pointercancel', stopPan, { capture: true })
      plot.removeEventListener('click', stopTapClick, { capture: true })
    }
  }, [])

  /** The index of the point under the pointer at a place on the page, or null for none. */
  const pointAt = (clientX: number, clientY: number) =>
    indexOf(interaction.current?.resolvePointer(clientX, clientY)?.point.xValue)

  function pick(at: number, input: PlayerSeekInput) {
    const text = onPick?.(at, input)
    if (text) slider.say(text)
  }

  /** A finger's press places the card; its tap's click picks (`keepTouchFromLibrary`). */
  function onPointerDown({ pointerType, clientX, clientY }: PointerEvent<HTMLDivElement>) {
    fingerAt.current = null
    if (pointerType !== 'touch') return
    const at = pointAt(clientX, clientY)
    if (at === null) return
    tap(at)
    fingerAt.current = at
  }

  /** A mouse's or a pen's click: a finger's never reaches here (`keepTouchFromLibrary`). */
  function onClick({ clientX, clientY }: MouseEvent<HTMLDivElement>) {
    if (!onPick) return
    const at = pointAt(clientX, clientY)
    if (at !== null) pick(at, 'pointer')
  }

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the plot is a slider, the role `plotProps` gives it. */}
      <div
        ref={keepTouchFromLibrary}
        className="chart-plot cursor-plot"
        {...slider.plotProps}
        onMouseDown={onMouseDown}
        onPointerDown={onPointerDown}
        onClick={onClick}
        // Named again beside the click: Enter and Space there do what the click does.
        onKeyDown={slider.plotProps.onKeyDown}
      >
        {overlay}
        <div className="cursor-plot-chart" aria-hidden="true">
          <Chart
            definition={definition}
            ariaLabel={label}
            style={fillPlot}
            onRender={(context) => {
              interaction.current = context.interaction
            }}
            renderTooltipBody={({ primaryPoint }) => {
              const card = cardAt(indexOf(primaryPoint?.xValue))
              return (
                card && (
                  <div className="chart-hover-card">
                    <p className="chart-hover-title">{card.title}</p>
                    <HoverCardValues card={card} />
                  </div>
                )
              )
            }}
          />
        </div>
      </div>
      {slider.liveRegion}
    </>
  )
}
