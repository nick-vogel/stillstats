// Limits: these tests cover the retention comparison's scale, labels, shared hover card, view of
// the API's answer, pick rule and product event, as pure functions, as retention.test.ts covers the
// video page's pair. The lines TanStack Charts draws are tested in retention-plot.test.ts, and the
// page in app.test.ts. None shows the overlay's look, the legend at 375 pixels wide, or the cursor
// moving under a pointer in a real browser; the browser walk visits the page, and Nick checks its
// look at /app/retention.
import type { RetentionCurvesAnswer, StoredRetentionCurve } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import {
  backfillNoteOf,
  comparedEventOf,
  comparisonCardOf,
  comparisonChartsOf,
  comparisonSortOf,
  comparisonText,
  comparisonViewOf,
  comparisonXsOf,
  curvesQueryOf,
  isPickRefused,
  picksAfterToggleOf,
  readLabelOf,
} from './retention-comparison.ts'
import type { ComparedLine } from './retention-plot.ts'

function curve(
  id: string,
  points: [number, number][],
  readAt: string | null = '2026-11-18T12:00:00.000Z',
): StoredRetentionCurve {
  return {
    video: { id, title: `Title ${id}`, durationSeconds: 600, publishedAt: '2026-10-01T15:00:00Z' },
    readAt,
    points: points.map(([elapsedVideoTimeRatio, audienceWatchRatio]) => ({
      elapsedVideoTimeRatio,
      audienceWatchRatio,
    })),
  }
}

function answer(curves: StoredRetentionCurve[], unread: number | null = 0): RetentionCurvesAnswer {
  return { curves, unread }
}

function line(videoId: string, position: number, points: [number, number][]): ComparedLine {
  return { videoId, position, points: curve(videoId, points).points }
}

describe("the comparison's view of the curves read", () => {
  test('draws each picked curve with points at its pick position, and labels each with its title and its read date', () => {
    const view = comparisonViewOf(
      answer([
        curve('a', [
          [0.01, 1],
          [1, 0.2],
        ]),
        curve(
          'b',
          [
            [0.01, 0.9],
            [1, 0.3],
          ],
          '2026-11-20T09:00:05.000Z',
        ),
      ]),
      'en-US',
    )

    expect(view).toEqual({
      kind: 'compared',
      lines: [
        line('a', 1, [
          [0.01, 1],
          [1, 0.2],
        ]),
        line('b', 2, [
          [0.01, 0.9],
          [1, 0.3],
        ]),
      ],
      legend: [
        {
          videoId: 'a',
          title: 'Title a',
          position: 1,
          drawn: true,
          detail: expect.stringContaining('Nov 18, 2026'),
        },
        {
          videoId: 'b',
          title: 'Title b',
          position: 2,
          drawn: true,
          detail: expect.stringContaining('Nov 20, 2026'),
        },
      ],
      note: null,
    })
  })

  test('a video read with no curve, and one not read yet, say so in the legend and draw no line, the others keeping their positions', () => {
    const view = comparisonViewOf(
      answer([
        curve('none', []),
        curve('unread', [], null),
        curve('c', [
          [0.01, 1],
          [1, 0.5],
        ]),
      ]),
      'en-US',
    )
    if (view.kind !== 'compared') throw new Error('Refused')

    expect(view.lines.map(({ videoId, position }) => [videoId, position])).toEqual([['c', 3]])
    expect(view.legend.map(({ drawn, detail }) => [drawn, detail])).toEqual([
      [false, comparisonText.noCurve],
      [false, comparisonText.notRead],
      [true, expect.stringContaining('Nov 18, 2026')],
    ])
  })

  test('shows the backfill note while the refresh has uploads to read, and none once it has read them all', () => {
    const filling = comparisonViewOf(answer([], 12), 'en-US')
    const filled = comparisonViewOf(answer([], 0), 'en-US')

    expect(filling.kind === 'compared' && filling.note).toMatch(/\b12\b/)
    expect(filled.kind === 'compared' && filled.note).toBeNull()
  })

  test('with the refresh no longer reading the channel, an ended one, shows no note and promises no read', () => {
    const view = comparisonViewOf(answer([curve('unread', [], null)], null), 'en-US')
    if (view.kind !== 'compared') throw new Error('Refused')

    expect(view.note).toBeNull()
    expect(view.legend.map(({ detail }) => detail)).toEqual([comparisonText.notReadEnded])
  })

  test("the note counts the uploads to go in the locale's digits, one video in the singular", () => {
    expect(backfillNoteOf(1200, 'en-US')).toContain('1,200')
    expect(backfillNoteOf(1, 'en-US')).not.toBe(backfillNoteOf(2, 'en-US').replace('2', '1'))
    expect(backfillNoteOf(12, 'ar-EG')).not.toMatch(/[0-9]/)
  })

  test("a free channel's refusal says the comparison needs Pro, and any other refusal is the shared text", () => {
    expect(comparisonViewOf({ error: 'sort_without_history' })).toEqual({
      kind: 'refused',
      message: comparisonText.refused,
    })
    const shared = comparisonViewOf({ refusal: 'google_failed' })
    const unknown = comparisonViewOf({ error: 'invalid_ids' })
    if (shared.kind !== 'refused' || unknown.kind !== 'refused') throw new Error('Not refused')

    // The shared text, not the Pro refusal, and not the fallback that names the code.
    expect(shared.message).not.toBe(comparisonText.refused)
    expect(shared.message).not.toContain('google_failed')
    expect(unknown.message).not.toBe(comparisonText.refused)
    expect(unknown.message).toContain('invalid_ids')
  })

  test('the read date is the medium date the locale writes', () => {
    expect(readLabelOf('2026-11-18T12:00:00.000Z', 'en-GB')).toContain('18 Nov 2026')
  })

  test('no new text holds an em-dash', () => {
    const texts = [
      ...Object.values(comparisonText),
      backfillNoteOf(3),
      readLabelOf('2026-11-18T12:00:00.000Z'),
    ]

    expect(texts.filter((text) => text.includes('—'))).toEqual([])
  })
})

describe("the comparison chart's scale", () => {
  test('has its top at 1 with no point above it, and at the highest point of any drawn curve', () => {
    const low = [line('a', 1, [[0.01, 0.9]]), line('b', 2, [[0.01, 0.8]])]
    const rewatched = [...low, line('c', 3, [[0.5, 1.3]])]

    expect(comparisonChartsOf(low)?.top).toBe(1)
    expect(comparisonChartsOf(rewatched)).toMatchObject({ top: 1.3 })
  })

  test('is absent with no curve to draw', () => {
    expect(comparisonChartsOf([])).toBeNull()
  })
})

describe("the comparison's shared hover card", () => {
  const lines = [
    {
      ...line('a', 1, [
        [0.01, 1],
        [0.25, 0.7],
        [0.5, 0.554],
      ]),
      title: 'First',
    },
    {
      ...line('b', 2, [
        [0.02, 0.95],
        [0.3, 0.6],
      ]),
      title: 'Second',
    },
  ]

  test("the cursor's stops are every share of the video any curve has a point at, in order, once each", () => {
    expect(comparisonXsOf([...lines, line('c', 3, [[0.25, 0.4]])])).toEqual([
      0.01, 0.02, 0.25, 0.3, 0.5,
    ])
  })

  test("reads every drawn curve at the same share of the video, each at its nearest point at or before it, under that share as the card's title", () => {
    expect(comparisonCardOf(0.3, lines, 'en-US')).toEqual({
      title: '30%',
      values: [
        { label: 'First', value: '70%' },
        { label: 'Second', value: '60%' },
      ],
    })
    expect(comparisonCardOf(0.5, lines, 'en-US').values).toEqual([
      { label: 'First', value: '55.4%' },
      { label: 'Second', value: '60%' },
    ])
  })

  test('leaves out a curve that starts after the share', () => {
    expect(comparisonCardOf(0.01, lines, 'en-US')).toEqual({
      title: '1%',
      values: [{ label: 'First', value: '100%' }],
    })
  })

  test("writes the locale's own digits", () => {
    const card = comparisonCardOf(0.3, lines, 'ar-EG')

    expect([card.title, ...card.values.map(({ value }) => value)].join(' ')).not.toMatch(/[0-9]/)
  })
})

describe("the comparison's picks", () => {
  test('a toggle adds a video last and clears a picked one, the rest keeping their order', () => {
    expect(picksAfterToggleOf(['a', 'b'], 'c')).toEqual(['a', 'b', 'c'])
    expect(picksAfterToggleOf(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
  })

  test('a sixth pick is refused, and clearing one of the five is not', () => {
    const five = ['a', 'b', 'c', 'd', 'e']

    expect(picksAfterToggleOf(five, 'f')).toEqual(five)
    expect(isPickRefused(five, 'f')).toBe(true)
    expect(isPickRefused(five, 'c')).toBe(false)
    expect(isPickRefused(['a', 'b', 'c', 'd'], 'f')).toBe(false)
    expect(picksAfterToggleOf(five, 'c')).toEqual(['a', 'b', 'd', 'e'])
  })

  test('the read lists the picks in their order, and with none asks for no curve', () => {
    expect(curvesQueryOf(['b', 'a'])).toBe('ids=b,a')
    expect(curvesQueryOf([])).toBe('')
  })

  test('the picker sorts by publish date or average viewed in either direction, and any other sort reads as newest first', () => {
    expect(comparisonSortOf({ sort: 'publishedAt' })).toBe('publishedAt')
    expect(comparisonSortOf({ sort: '-averageViewPercentage' })).toBe('-averageViewPercentage')
    expect(comparisonSortOf({ sort: '-engagedViews' })).toBe('-publishedAt')
  })
})

describe('the retention_curves_compared event', () => {
  const drawn = (count: number) =>
    comparisonViewOf(
      answer(
        Array.from({ length: count }, (_, index) =>
          curve(`v${index}`, [
            [0.01, 1],
            [1, 0.3],
          ]),
        ),
      ),
    )

  test('carries how many curves are drawn, from 2', () => {
    expect(comparedEventOf(drawn(2))).toEqual({ name: 'retention_curves_compared', count: 2 })
    expect(comparedEventOf(drawn(5))).toEqual({ name: 'retention_curves_compared', count: 5 })
  })

  test('is not sent with fewer than 2 drawn, a picked video with no curve not counted, nor on a refusal', () => {
    const oneDrawn = comparisonViewOf(answer([curve('a', [[0.01, 1]]), curve('b', [])]))

    expect(comparedEventOf(drawn(1))).toBeNull()
    expect(comparedEventOf(oneDrawn)).toBeNull()
    expect(comparedEventOf({ kind: 'refused', message: comparisonText.refused })).toBeNull()
  })
})
