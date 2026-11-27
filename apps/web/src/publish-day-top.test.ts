// Limits: these tests cover the publish day top's bars and text, as pure functions. No test here
// draws the SVG, so none shows the bars, the titles beside them, or the layout at 375 pixels wide.
// Nick checks those at /app in a real browser.
import { describe, expect, test } from 'vitest'
import { publishDayTopBarsOf } from './publish-day-top.ts'

describe('the publish day top', () => {
  test("gives the video with the most publish day engaged views the full width, the rest their share, in the API's order", () => {
    const bars = publishDayTopBarsOf(
      [
        { id: 'a', title: 'First', publishedAt: '2026-09-01T15:00:00.000Z', engagedViews: 1600 },
        { id: 'b', title: 'Second', publishedAt: '2026-09-02T15:00:00.000Z', engagedViews: 400 },
        { id: 'c', title: 'Third', publishedAt: '2026-09-03T15:00:00.000Z', engagedViews: 0 },
      ],
      'en-US',
    )

    expect(bars).toEqual([
      { id: 'a', title: 'First', engagedViews: '1,600', width: 100 },
      { id: 'b', title: 'Second', engagedViews: '400', width: 25 },
      { id: 'c', title: 'Third', engagedViews: '0', width: 0 },
    ])
  })

  test('with no engaged view on any publish day, draws every bar empty', () => {
    expect(
      publishDayTopBarsOf([
        { id: 'a', title: 'First', publishedAt: '2026-09-01T15:00:00.000Z', engagedViews: 0 },
      ]).map(({ width }) => width),
    ).toEqual([0])
  })
})
