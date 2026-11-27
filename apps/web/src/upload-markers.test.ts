// Limits: these tests cover the upload markers as pure functions: where each marker sits, which
// uploads share a tile, each marker's shape and text alternative, a tile's rows, and where a key
// moves focus. No test here draws a marker or hears VoiceOver read one; components.test.ts renders
// the row's markup, app.test.ts drives its keys and its card in happy-dom, the browser walk draws it
// in Chrome, and Nick's VoiceOver pass covers the reading.
import type { SummaryUpload } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import {
  holdTrackWidthOn,
  markerKeyStepOf,
  markerSpanOf,
  uploadDayPlacesOf,
  uploadMarkersOf,
  uploadTextOf,
} from './upload-markers.ts'

/** Each day of a window, oldest first, as the summary's daily series runs. */
function daysOf(...days: string[]): { day: string }[] {
  return days.map((day) => ({ day }))
}

const week = daysOf(
  '2026-09-28',
  '2026-09-29',
  '2026-09-30',
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
  '2026-10-04',
)

function upload(
  id: string,
  publishDay: string,
  format: SummaryUpload['format'] = 'video',
): SummaryUpload {
  return { id, title: `Title ${id}`, publishDay, format }
}

describe("an upload's text alternative", () => {
  test.each([
    ['video', 'Video: Title a'],
    ['short', 'Short: Title a'],
    ['live', 'Live: Title a'],
    [null, 'Upload: Title a'],
  ] as const)('a %s upload reads "%s"', (format, text) => {
    expect(uploadTextOf(upload('a', '2026-10-01', format))).toBe(text)
  })
})

describe('where the upload markers sit', () => {
  test("each marker sits at its publish day's index in the days, its place across the plot that index over the last index", () => {
    const markers = uploadMarkersOf(
      [upload('c', '2026-10-04'), upload('b', '2026-10-01'), upload('a', '2026-09-28')],
      week,
    )

    expect(markers.map(({ index, place }) => [index, place])).toEqual([
      [0, 0],
      [3, 0.5],
      [6, 1],
    ])
  })

  test('the markers run oldest first, the order the left and right keys move through', () => {
    const markers = uploadMarkersOf(
      [upload('newest', '2026-10-03'), upload('oldest', '2026-09-29')],
      week,
    )

    expect(markers.map(({ day }) => day)).toEqual(['2026-09-29', '2026-10-03'])
  })

  test('a window of one day draws its marker at the middle, where the plots draw its point', () => {
    const markers = uploadMarkersOf([upload('a', '2026-10-04')], daysOf('2026-10-04'))

    expect(markers).toMatchObject([{ index: 0, place: 0.5 }])
  })

  test('an upload on a day the days do not hold has no marker', () => {
    expect(uploadMarkersOf([upload('a', '2026-10-05')], week)).toEqual([])
  })

  test('no uploads draw no markers', () => {
    expect(uploadMarkersOf([], week)).toEqual([])
  })
})

describe('a single upload on its day', () => {
  test.each([
    ['video', 'video'],
    ['short', 'short'],
    ['live', 'live'],
    [null, 'none'],
  ] as const)('a %s upload draws the %s shape, with its text and its video', (format, shape) => {
    const [marker] = uploadMarkersOf([upload('a', '2026-10-01', format)], week)

    expect(marker).toEqual({
      kind: 'single',
      day: '2026-10-01',
      index: 3,
      place: 0.5,
      shape,
      text: uploadTextOf(upload('a', '2026-10-01', format)),
      videoId: 'a',
    })
  })
})

describe('more uploads on one day', () => {
  test('uploads on one day share one tile with their count, which reads "2 uploads"', () => {
    const markers = uploadMarkersOf(
      [
        upload('late', '2026-10-01', 'short'),
        upload('early', '2026-10-01', 'video'),
        upload('other', '2026-09-29'),
      ],
      week,
    )

    expect(markers).toHaveLength(2)
    expect(markers[1]).toMatchObject({
      kind: 'tile',
      day: '2026-10-01',
      index: 3,
      place: 0.5,
      count: 2,
      text: '2 uploads',
    })
  })

  test("a tile's rows are its uploads in the answer's order, newest first, each with its shape, its text, its video and its publish date as the axis writes it", () => {
    const [tile] = uploadMarkersOf(
      [
        upload('late', '2026-10-01', 'short'),
        upload('middle', '2026-10-01', null),
        upload('early', '2026-10-01', 'live'),
      ],
      week,
      { locale: 'en-US' },
    )

    expect(tile).toMatchObject({ kind: 'tile', count: 3, text: '3 uploads' })
    expect(tile && 'rows' in tile ? tile.rows : []).toEqual([
      { videoId: 'late', shape: 'short', text: 'Short: Title late', date: 'Oct 1, 2026' },
      { videoId: 'middle', shape: 'none', text: 'Upload: Title middle', date: 'Oct 1, 2026' },
      { videoId: 'early', shape: 'live', text: 'Live: Title early', date: 'Oct 1, 2026' },
    ])
  })
})

describe("markers whose boxes would overlap at the track's width", () => {
  // `span` is how many marker widths fit across the track. Over the week's 7 days, neighbouring
  // days sit 1/6 of the track apart: under one marker width at a span of 4, two widths at 12.
  test('markers on nearby days that overlap at a narrow width join into one tile with their count', () => {
    const markers = uploadMarkersOf(
      [upload('b', '2026-09-29', 'short'), upload('a', '2026-09-28')],
      week,
      { span: 4 },
    )

    expect(markers).toHaveLength(1)
    expect(markers[0]).toMatchObject({ kind: 'tile', count: 2, text: '2 uploads' })
  })

  test('the same markers at a wider width stay single', () => {
    const markers = uploadMarkersOf(
      [upload('b', '2026-09-29', 'short'), upload('a', '2026-09-28')],
      week,
      { span: 12 },
    )

    expect(markers.map(({ kind, day }) => [kind, day])).toEqual([
      ['single', '2026-09-28'],
      ['single', '2026-09-29'],
    ])
  })

  test('markers exactly one marker width apart touch without overlapping, so they stay single', () => {
    // Days 0 and 3 of the week sit half the track apart: one marker width at a span of 2.
    const markers = uploadMarkersOf([upload('b', '2026-10-01'), upload('a', '2026-09-28')], week, {
      span: 2,
    })

    expect(markers.map(({ kind }) => kind)).toEqual(['single', 'single'])
  })

  test('a joined tile sits at the middle of the days it covers and reports its first and last day', () => {
    // Days 0 and 2 sit a third of the track apart, two thirds of a marker width at a span of 2.
    const markers = uploadMarkersOf([upload('b', '2026-09-30'), upload('a', '2026-09-28')], week, {
      span: 2,
    })

    expect(markers).toEqual([
      expect.objectContaining({
        kind: 'tile',
        day: '2026-09-28',
        lastDay: '2026-09-30',
        index: 0,
        place: 1 / 6,
      }),
    ])
  })

  test('a tile of one day reports that day as its last', () => {
    const [tile] = uploadMarkersOf([upload('b', '2026-10-01'), upload('a', '2026-10-01')], week, {
      span: 12,
    })

    expect(tile).toMatchObject({ kind: 'tile', day: '2026-10-01', lastDay: '2026-10-01' })
  })

  test("a day's tile and a nearby single join into one tile counting both", () => {
    const markers = uploadMarkersOf(
      [upload('c', '2026-10-02'), upload('b', '2026-10-01'), upload('a', '2026-10-01')],
      week,
      { span: 4 },
    )

    expect(markers).toEqual([
      expect.objectContaining({
        kind: 'tile',
        day: '2026-10-01',
        lastDay: '2026-10-02',
        count: 3,
        text: '3 uploads',
      }),
    ])
  })

  test('of two pairs equally close, the leftmost joins first, and a tile that no longer overlaps its neighbour leaves it single', () => {
    // Days 0, 1 and 2 sit two thirds of a marker width apart at a span of 4. Days 0 and 1 join,
    // and their tile, at day 0.5, sits exactly one marker width from day 2.
    const markers = uploadMarkersOf(
      [upload('c', '2026-09-30'), upload('b', '2026-09-29'), upload('a', '2026-09-28')],
      week,
      { span: 4 },
    )

    expect(markers.map(({ kind, day }) => [kind, day])).toEqual([
      ['tile', '2026-09-28'],
      ['single', '2026-09-30'],
    ])
  })

  test('a joined tile that still overlaps a further neighbour joins it too, until no two markers overlap', () => {
    // At a span of 3, days 0 and 1 join, and their tile, at day 0.5, sits three quarters of a
    // marker width from day 2.
    const markers = uploadMarkersOf(
      [upload('c', '2026-09-30'), upload('b', '2026-09-29'), upload('a', '2026-09-28')],
      week,
      { span: 3 },
    )

    expect(markers).toEqual([
      expect.objectContaining({
        kind: 'tile',
        day: '2026-09-28',
        lastDay: '2026-09-30',
        count: 3,
        place: 1 / 6,
      }),
    ])
  })

  test.each([null, 0])(
    'a track not laid out (span %s) joins only the uploads of one day',
    (span) => {
      const markers = uploadMarkersOf(
        [upload('c', '2026-09-29'), upload('b', '2026-09-28'), upload('a', '2026-09-28')],
        week,
        { span },
      )

      expect(markers.map(({ kind, day }) => [kind, day])).toEqual([
        ['tile', '2026-09-28'],
        ['single', '2026-09-29'],
      ])
    },
  )

  test("a joined tile's rows are its uploads newest first, each dated by its own publish day", () => {
    const [tile] = uploadMarkersOf(
      [
        upload('short', '2026-10-04', 'short'),
        upload('stream', '2026-10-04', 'live'),
        upload('video', '2026-10-03', 'video'),
      ],
      week,
      { span: 4, locale: 'en-US' },
    )

    expect(tile && 'rows' in tile ? tile.rows : []).toEqual([
      { videoId: 'short', shape: 'short', text: 'Short: Title short', date: 'Oct 4, 2026' },
      { videoId: 'stream', shape: 'live', text: 'Live: Title stream', date: 'Oct 4, 2026' },
      { videoId: 'video', shape: 'video', text: 'Video: Title video', date: 'Oct 3, 2026' },
    ])
  })
})

describe('markers at the 1.5rem box (creator-analytics#763)', () => {
  // Over the week's 7 days, neighbouring days sit 1/6 of the track apart. At a 16px root the box is
  // 24px: 20px apart at a 120px track, under one box, and 28px apart at a 168px track.
  const neighbours = [upload('b', '2026-09-29', 'short'), upload('a', '2026-09-28')]

  test('markers on neighbouring days 20px apart overlap the 24px box and join into one tile', () => {
    const markers = uploadMarkersOf(neighbours, week, { span: markerSpanOf(120, 16) })

    expect(markers).toHaveLength(1)
    expect(markers[0]).toMatchObject({ kind: 'tile', count: 2, text: '2 uploads' })
  })

  test('the same markers 28px apart at a wider track stay single', () => {
    const markers = uploadMarkersOf(neighbours, week, { span: markerSpanOf(168, 16) })

    expect(markers.map(({ kind, day }) => [kind, day])).toEqual([
      ['single', '2026-09-28'],
      ['single', '2026-09-29'],
    ])
  })

  test.each([
    [0, 16],
    [120, 0],
  ])('a track %spx wide at a %spx root is not laid out, so it has no span', (width, rem) => {
    expect(markerSpanOf(width, rem)).toBeNull()
  })
})

describe("the upload days' lines on every plot (creator-analytics#763)", () => {
  test('two uploads on one day draw one line, at that day across the plot', () => {
    expect(uploadDayPlacesOf([upload('b', '2026-10-01'), upload('a', '2026-10-01')], week)).toEqual(
      [0.5],
    )
  })

  test('uploads on neighbouring days, which a narrow track joins into one tile, each draw their own line, oldest first', () => {
    expect(
      uploadDayPlacesOf(
        [upload('c', '2026-10-04'), upload('b', '2026-09-29'), upload('a', '2026-09-28')],
        week,
      ),
    ).toEqual([0, 1 / 6, 1])
  })

  test('an upload on a day the days do not hold draws no line', () => {
    expect(uploadDayPlacesOf([upload('a', '2026-10-05'), upload('b', '2026-09-28')], week)).toEqual(
      [0],
    )
  })

  test('a window of one day draws its line at the middle, where the plots draw its point', () => {
    expect(uploadDayPlacesOf([upload('a', '2026-10-01')], daysOf('2026-10-01'))).toEqual([0.5])
  })
})

/** A track whose width the test sets, the widths the hold writes, and the observers made. */
function heldTrack(width: number) {
  const track = {
    width,
    getBoundingClientRect() {
      return { width: this.width }
    },
  }
  const writes: number[] = []
  const observers: { onResize: () => void; targets: unknown[]; connected: boolean }[] = []
  const release = holdTrackWidthOn(
    track,
    class {
      private readonly observer: (typeof observers)[number]
      constructor(onResize: () => void) {
        this.observer = { onResize, targets: [], connected: true }
        observers.push(this.observer)
      }
      observe(target: unknown) {
        this.observer.targets.push(target)
      }
      disconnect() {
        this.observer.connected = false
      }
    },
    (written) => writes.push(written),
  )
  const resize = () => {
    for (const observer of observers.filter(({ connected }) => connected)) observer.onResize()
  }
  return { track, writes, observers, release, resize }
}

describe("holding the marker track's width", () => {
  test("writes the track's width at once", () => {
    const { writes } = heldTrack(320)
    expect(writes).toEqual([320])
  })

  test('writes the new width when the track resizes, so the row joins or splits its markers again', () => {
    const { track, writes, observers, resize } = heldTrack(320)
    expect(observers.flatMap(({ targets }) => targets)).toEqual([track])

    track.width = 1024
    resize()
    expect(writes).toEqual([320, 1024])
  })

  test('writes nothing when a resize leaves the width as it was', () => {
    const { writes, resize } = heldTrack(320)
    resize()
    expect(writes).toEqual([320])
  })

  test('stops on release: no observer left to write', () => {
    const { track, writes, observers, release, resize } = heldTrack(320)
    release()
    expect(observers.map(({ connected }) => connected)).toEqual([false])

    track.width = 1024
    resize()
    expect(writes).toEqual([320])
  })
})

describe('a key on the marker row', () => {
  test('the right arrow moves to the next marker and the left arrow to the one before', () => {
    expect(markerKeyStepOf('ArrowRight', 1, 4)).toBe(2)
    expect(markerKeyStepOf('ArrowLeft', 1, 4)).toBe(0)
  })

  test('the arrows stop at the first and the last marker', () => {
    expect(markerKeyStepOf('ArrowLeft', 0, 4)).toBe(0)
    expect(markerKeyStepOf('ArrowRight', 3, 4)).toBe(3)
  })

  test('Home moves to the first marker and End to the last', () => {
    expect(markerKeyStepOf('Home', 2, 4)).toBe(0)
    expect(markerKeyStepOf('End', 1, 4)).toBe(3)
  })

  test('any other key moves nothing', () => {
    expect(markerKeyStepOf('Enter', 1, 4)).toBeNull()
    expect(markerKeyStepOf('ArrowUp', 1, 4)).toBeNull()
    expect(markerKeyStepOf('Tab', 1, 4)).toBeNull()
  })
})
