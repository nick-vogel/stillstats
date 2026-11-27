// Limits: these tests cover the retention charts' scale and its 100% and 50% labels, their time
// axis and their hover cards' text, as pure functions. The curves TanStack Charts draws are tested
// in retention-plot.test.ts. No test here draws a chart, so none shows how the curves look, the
// axis lined up under them, the cards over them, the layout at 375 pixels wide, or what a screen
// reader reads from their sliders. The browser walk (apps/site/test/screenshot/browser-walk.ts,
// `pnpm test:browser`) drives the pair in Chrome; Nick checks their look at /app. Each of Google's
// points is the end of a 1% slice of the video, so a point's time is close to, not exactly, where
// it falls.
import type { AudienceRetentionPoint } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import {
  relativeCardOf,
  retentionAxisOf,
  retentionChartsOf,
  retentionScaleLabelsOf,
  timeLabelOf,
  watchingCardOf,
} from './retention.ts'

function point(
  elapsedVideoTimeRatio: number,
  audienceWatchRatio: number,
  relativeRetentionPerformance = 0.5,
): AudienceRetentionPoint {
  return { elapsedVideoTimeRatio, audienceWatchRatio, relativeRetentionPerformance }
}

describe('the audience retention chart', () => {
  test('with no point above 1, draws the 100% line at the top edge', () => {
    expect(retentionChartsOf([point(0.01, 1), point(1, 0.4)])?.fullLineY).toBe(0)
  })

  test('raises its top to the highest point above 1, so a rewatched part stays on the chart', () => {
    const charts = retentionChartsOf([point(0.01, 0.9), point(0.5, 1.25), point(1, 0.5)])

    expect(charts).toEqual({ top: 1.25, fullLineY: 20, halfLineY: 60 })
  })

  test('draws the 50% line at half the height of the 100% line, at the middle with no point above 1', () => {
    expect(retentionChartsOf([point(0.01, 1), point(1, 0.4)])?.halfLineY).toBe(50)
  })

  test('keeps the 50% line at half the height of the 100% line when a rewatched part raises the top', () => {
    expect(retentionChartsOf([point(0.01, 0.9), point(0.5, 1.25), point(1, 0.5)])?.halfLineY).toBe(
      60,
    )
  })

  test('has its top at 1 with no point above 1, and at the highest point a rewatched part raises', () => {
    expect(retentionChartsOf([point(0.01, 1), point(1, 0.4)])?.top).toBe(1)
    expect(retentionChartsOf([point(0.01, 0.9), point(0.5, 1.25), point(1, 0.5)])?.top).toBe(1.25)
  })

  test('is absent when Google has too few views to draw the curve', () => {
    expect(retentionChartsOf([])).toBeNull()
  })
})

describe("the audience retention chart's 100% and 50% labels", () => {
  test('are percentages as the locale writes them', () => {
    expect(retentionScaleLabelsOf('en-US')).toEqual({ full: '100%', half: '50%' })
  })

  test.each([
    // Each ends in the Arabic letter mark ar-EG writes after its percent sign.
    ['ar-EG', '\u0661\u0660\u0660\u066a\u061c', '\u0665\u0660\u066a\u061c'],
    ['hi-IN-u-nu-deva', '\u0967\u0966\u0966%', '\u096b\u0966%'],
  ])('are written in the digits %s writes', (locale, full, half) => {
    expect(retentionScaleLabelsOf(locale)).toEqual({ full, half })
  })
})

describe('a time label', () => {
  test('reads minutes and seconds under an hour', () => {
    expect(timeLabelOf(0, 'en-US')).toBe('0:00')
    expect(timeLabelOf(59, 'en-US')).toBe('0:59')
    expect(timeLabelOf(270, 'en-US')).toBe('4:30')
  })

  test('reads hours, minutes and seconds from an hour', () => {
    expect(timeLabelOf(3600, 'en-US')).toBe('1:00:00')
    expect(timeLabelOf(3723, 'en-US')).toBe('1:02:03')
  })

  test("writes the locale's own digits", () => {
    expect(timeLabelOf(754, 'ar-EG')).toBe('١٢:٣٤')
    expect(timeLabelOf(3723, 'ar-EG')).toBe('١:٠٢:٠٣')
    expect(timeLabelOf(754, 'hi-IN-u-nu-deva')).toBe('१२:३४')
    expect(timeLabelOf(3723, 'hi-IN-u-nu-deva')).toBe('१:०२:०३')
  })

  test('keeps Latin digits in a locale that writes them', () => {
    expect(timeLabelOf(3723, 'fr-FR')).toBe('1:02:03')
  })
})

describe('the time axis under the retention charts', () => {
  test('runs from the start of the video to its length', () => {
    expect(retentionAxisOf(3723, 'en-US')).toEqual({ first: '0:00', last: '1:02:03' })
  })

  test("writes the locale's own digits", () => {
    expect(retentionAxisOf(754, 'ar-EG')).toEqual({ first: '٠:٠٠', last: '١٢:٣٤' })
  })

  test('is absent when the video has no duration', () => {
    expect(retentionAxisOf(null)).toBeNull()
  })
})

describe("the retention charts' hover cards", () => {
  test("the watching card shows the point's time in the video and the share still watching", () => {
    expect(watchingCardOf(point(0.5, 0.54, 0.62), 540, 'en-US')).toEqual({
      title: '4:30',
      values: [{ label: 'Watching', value: '54%' }],
    })
  })

  test("the relative card shows the point's time and Google's value beside the median", () => {
    expect(relativeCardOf(point(0.5, 0.54, 0.62), 540, 'en-US')).toEqual({
      title: '4:30',
      values: [{ label: 'Relative retention', value: '0.62 (0.5 is the median)' }],
    })
  })

  test("the relative card shows Google's value to two decimals", () => {
    expect(relativeCardOf(point(1, 0.2, 0.5), 600, 'en-US').values[0]?.value).toBe(
      '0.50 (0.5 is the median)',
    )
    expect(relativeCardOf(point(1, 0.2, 0.0712), 600, 'en-US').values[0]?.value).toBe(
      '0.07 (0.5 is the median)',
    )
  })

  test("with no duration, each card's title is the point's place in the video as a percentage", () => {
    expect(watchingCardOf(point(0.5, 0.54, 0.62), null, 'en-US').title).toBe('50%')
    expect(relativeCardOf(point(0.5, 0.54, 0.62), null, 'en-US').title).toBe('50%')
  })

  test("each card's time title is in the locale's own digits", () => {
    expect(watchingCardOf(point(1, 0.2, 0.5), 754, 'ar-EG').title).toBe('١٢:٣٤')
    expect(relativeCardOf(point(1, 0.2, 0.5), 754, 'ar-EG').title).toBe('١٢:٣٤')
  })

  test("each card's values are in the locale's own digits", () => {
    expect(watchingCardOf(point(1, 0.2, 0.5), 754, 'ar-EG').values[0]?.value).not.toMatch(/[0-9]/)
    // The median note after Google's value is fixed text, so only the value is checked.
    const [relative] =
      relativeCardOf(point(1, 0.2, 0.5), 754, 'ar-EG').values[0]?.value.split(' ') ?? []
    expect(relative).toBeDefined()
    expect(relative).not.toMatch(/[0-9]/)
  })

  test('the watching card shows the share still watching to one decimal', () => {
    expect(watchingCardOf(point(0.01, 1.124), 600, 'en-US').values).toEqual([
      { label: 'Watching', value: '112.4%' },
    ])
  })
})
