// @vitest-environment happy-dom
// Limits: this test renders `AudienceRetention` alone, not App. happy-dom lays nothing out and
// finds no element under a pointer, so the cursor is placed by the app's own key handler (focus,
// then `ArrowRight`), not by the library's pointer; the browser walk is where that pointer is
// exercised, in Chrome. It pins the point count rule in `useChartCursor` on a mounted pair, a state
// no screen reaches today: the video detail screen and every read remount the charts
// (`preferences.ts`'s `setView(null)` before a read, `VideoDetail.tsx`'s placeholder), which the
// app test of a date range with another day count pins from the creator's side
// (creator-analytics#391). The pointer events here go to the library's svg: a finger's carry the
// coordinates of the watching line's points, so a move that reached the library would move the
// card, and the mouse's and the pen's carry none, so they show only which pointer types reach the
// library. The browser walk's drag steps are where a real finger scroll is exercised
// (creator-analytics#400).
import type { AudienceRetentionPoint } from '@creator-analytics/api-types'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, test } from 'vitest'
import { AudienceRetention } from './AudienceRetention.tsx'
import { chartLabelOf, sliderTextOf } from './chart-slider.ts'
import { relativeName } from './retention.ts'

let root: Root | null = null
let container: HTMLElement | null = null

afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

const fourPoints: AudienceRetentionPoint[] = [
  { elapsedVideoTimeRatio: 0.01, audienceWatchRatio: 1, relativeRetentionPerformance: 0.3 },
  { elapsedVideoTimeRatio: 0.02, audienceWatchRatio: 0.9, relativeRetentionPerformance: 0.5 },
  { elapsedVideoTimeRatio: 0.5, audienceWatchRatio: 0.6, relativeRetentionPerformance: 0.7 },
  { elapsedVideoTimeRatio: 1, audienceWatchRatio: 0.4, relativeRetentionPerformance: 0.6 },
]

function show(points: AudienceRetentionPoint[]) {
  act(() =>
    root?.render(
      createElement(AudienceRetention, {
        retention: { points, durationSeconds: 600 },
        player: null,
      }),
    ),
  )
}

function renderRetention(points: AudienceRetentionPoint[]) {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  show(points)
  const plotNamed = (heading: string) => {
    const plot = container?.querySelector<HTMLElement>(
      `[role="slider"][aria-label="${chartLabelOf(heading)}"]`,
    )
    if (!plot) throw new Error(`No plot named for ${heading}`)
    return plot
  }
  const plots = [plotNamed('Audience retention'), plotNamed(relativeName)]
  const press = (plot: HTMLElement, key: string) =>
    act(() => {
      plot.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    })
  const shown = () =>
    plots.map((plot) => [plot.getAttribute('aria-valuenow'), plot.getAttribute('aria-valuetext')])
  // The app's own live region beside each plot: the library's tooltip carries one too, off the
  // accessibility tree.
  const spoken = () =>
    plots.map(
      (plot) =>
        plot.parentElement?.querySelector('p.visually-hidden[aria-live="polite"] > span')
          ?.textContent ?? '',
    )
  return { plots, press, shown, spoken }
}

describe('the chart cursor', () => {
  test('hides the card on both retention plots and empties the live region when the same mounted pair gets another point count', () => {
    const { plots, press, shown, spoken } = renderRetention(fourPoints)
    const [watching] = plots
    if (!watching) throw new Error('No audience retention plot')
    act(() => watching.focus())
    press(watching, 'ArrowRight')
    press(watching, 'ArrowRight')
    expect(shown().map(([valueNow]) => valueNow)).toEqual(['2', '2'])
    expect(shown().every(([, valueText]) => valueText !== sliderTextOf(null))).toBe(true)
    expect(spoken()[0]).not.toBe('')

    // The new points keep the card's x, 0.02: the card resolves by x value (`selectionOf`), so
    // points without it would hide the card with or without the rule.
    show([
      ...fourPoints.slice(0, 3),
      { elapsedVideoTimeRatio: 0.75, audienceWatchRatio: 0.5, relativeRetentionPerformance: 0.6 },
      ...fourPoints.slice(3),
    ])

    expect(shown().map(([, valueText]) => valueText)).toEqual([
      sliderTextOf(null),
      sliderTextOf(null),
    ])
    expect(spoken()).toEqual(['', ''])
  })
})

// creator-analytics#337: with the numbers table gone, the relative plot's live region is the only
// place a screen reader reads Google's value, so a key step on it has to speak that value.
test("a key step on the relative retention plot reads the point's relative retention in its live region", () => {
  const { plots, press, shown, spoken } = renderRetention(fourPoints)
  const [, relative] = plots
  if (!relative) throw new Error('No relative retention plot')
  act(() => relative.focus())
  press(relative, 'ArrowRight')
  press(relative, 'ArrowRight')

  expect(shown()[1]).toEqual(['2', '0:12'])
  expect(spoken()[1]).toMatch(new RegExp(`^${relativeName} 0\\.50\\b`))
})

describe('a pointer on a retention plot', () => {
  // happy-dom's `getScreenCTM` is the identity, so a pointer's client coordinates are the library
  // svg's own (viewBox 0 0 640 320). The watching line's first, third and last points sit here,
  // from its path; the keys' first step places the card on the first.
  const watchingPoint = {
    first: { clientX: 6.4, clientY: 0 },
    third: { clientX: 320, clientY: 128 },
    last: { clientX: 640, clientY: 192 },
  }

  function sendTo(
    plot: HTMLElement,
    pointerType: string,
    events: [type: string, at?: { clientX: number; clientY: number }][],
  ) {
    const svg = plot.querySelector('.cursor-plot-chart svg')
    if (!svg) throw new Error('No library svg in the plot')
    for (const [type, at] of events) {
      act(() => {
        svg.dispatchEvent(new PointerEvent(type, { pointerType, bubbles: true, ...at }))
      })
    }
  }

  function placedOnWatching() {
    const retention = renderRetention(fourPoints)
    const [watching] = retention.plots
    if (!watching) throw new Error('No audience retention plot')
    act(() => watching.focus())
    retention.press(watching, 'ArrowRight')
    const placed = retention.shown()
    expect(placed.every(([, valueText]) => valueText !== sliderTextOf(null))).toBe(true)
    return { watching, placed, shown: retention.shown }
  }

  test('keeps the card on both plots when a finger lands on one, moves, and its pan cancels it', () => {
    const { watching, placed, shown } = placedOnWatching()

    sendTo(watching, 'touch', [
      ['pointerdown', watchingPoint.first],
      ['pointermove', watchingPoint.third],
      ['pointermove', watchingPoint.last],
    ])
    expect(shown()).toEqual(placed)

    sendTo(watching, 'touch', [['pointercancel', watchingPoint.last]])
    expect(shown()).toEqual(placed)
  })

  test.each(['mouse', 'pen'])(
    "lets a %s's move and cancel reach the library, which hides the card on both plots",
    (pointerType) => {
      const { watching, shown } = placedOnWatching()

      sendTo(watching, pointerType, [['pointermove'], ['pointercancel']])

      expect(shown().map(([, valueText]) => valueText)).toEqual([
        sliderTextOf(null),
        sliderTextOf(null),
      ])
    },
  )
})
