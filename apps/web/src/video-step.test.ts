// Limits: these tests cover the choices the detail screen's previous and next video links make, as
// pure functions. None renders the screen or follows a link, so none shows the links' place in the
// head and at the bottom, that the screen reads the adjacent page, or that a step moves focus to
// the new title. `components.test.ts` holds the links' markup; Nick checks the rest at /app in a
// real browser.
import type { VideoListAnswer, VideoRow } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import { defaultRoute, type Route } from './route.ts'
import type { LandedListView } from './video-list.ts'
import {
  adjacentPagesOf,
  headRowOf,
  type ListPages,
  stepLabelOf,
  stepperOf,
  stepRouteOf,
  stepTextOf,
  videoSteppedEvent,
} from './video-step.ts'

function row(n: number): VideoRow {
  return {
    id: `video-${n}`,
    title: `Upload ${n}`,
    thumbnailUrl: null,
    thumbnails: [],
    durationSeconds: 754,
    publishedAt: '2026-10-01T16:00:00.000Z',
    scheduled: false,
    privacy: 'public',
    format: 'video',
    engagedViews: 0,
    views: 0,
    averageViewPercentage: 0,
    subscribersGained: 0,
    estimatedMinutesWatched: 0,
    awaitingProcessing: false,
  }
}

/** Page `page` of a list of `pageCount` pages, holding the videos numbered `ns`. */
function pageOf(page: number, pageCount: number, ns: number[]): LandedListView {
  const answer: VideoListAnswer = {
    videos: ns.map(row),
    window: 'last28',
    page,
    pageSize: 3,
    pageCount,
    revenue: { refusal: 'consent_missing' },
    lastProcessedDay: '2026-10-04',
    creationDay: '2019-02-28',
    fetchedAt: '2026-10-07T09:00:00.000Z',
    fromCache: false,
  }
  return { kind: 'list', answer }
}

/** Three pages of three videos: 1 to 3, 4 to 6 and 7 to 9. */
const first = pageOf(1, 3, [1, 2, 3])
const middle = pageOf(2, 3, [4, 5, 6])
const last = pageOf(3, 3, [7, 8, 9])

function pages(entries: [number, LandedListView][]): ListPages {
  return new Map(entries)
}

const neighbour = (n: number, page: number) => ({ id: `video-${n}`, title: `Upload ${n}`, page })

describe('the previous and next video', () => {
  test("of a video inside its page are the videos either side of it on the address's page", () => {
    expect(stepperOf('video-5', 2, pages([[2, middle]]))).toEqual({
      previous: neighbour(4, 2),
      next: neighbour(6, 2),
    })
  })

  test("of a page's first video is the last video of the page before, once that page is read", () => {
    expect(stepperOf('video-4', 2, pages([[2, middle]]))).toEqual({
      previous: 'reading',
      next: neighbour(5, 2),
    })
    expect(
      stepperOf(
        'video-4',
        2,
        pages([
          [1, first],
          [2, middle],
        ]),
      ),
    ).toEqual({ previous: neighbour(3, 1), next: neighbour(5, 2) })
  })

  test("of a page's last video is the first video of the page after, once that page is read", () => {
    expect(stepperOf('video-6', 2, pages([[2, middle]]))).toEqual({
      previous: neighbour(5, 2),
      next: 'reading',
    })
    expect(
      stepperOf(
        'video-6',
        2,
        pages([
          [2, middle],
          [3, last],
        ]),
      ),
    ).toEqual({ previous: neighbour(5, 2), next: neighbour(7, 3) })
  })

  test("at the whole list's first video there is no previous video, and at its last no next", () => {
    expect(stepperOf('video-1', 1, pages([[1, first]]))).toEqual({
      previous: null,
      next: neighbour(2, 1),
    })
    expect(stepperOf('video-9', 3, pages([[3, last]]))).toEqual({
      previous: neighbour(8, 3),
      next: null,
    })
  })

  test("a page of one video takes both neighbours from the pages either side, and a one-page list's only video has none", () => {
    const lone = pageOf(2, 3, [4])

    expect(stepperOf('video-4', 2, pages([[2, lone]]))).toEqual({
      previous: 'reading',
      next: 'reading',
    })
    expect(
      stepperOf(
        'video-4',
        2,
        pages([
          [1, first],
          [2, lone],
          [3, last],
        ]),
      ),
    ).toEqual({ previous: neighbour(3, 1), next: neighbour(7, 3) })
    expect(stepperOf('video-1', 1, pages([[1, pageOf(1, 1, [1])]]))).toEqual({
      previous: null,
      next: null,
    })
  })

  test("both hold their place while the address's page is read", () => {
    expect(stepperOf('video-5', 2, pages([]))).toEqual({ previous: 'reading', next: 'reading' })
  })

  test("there is no stepper for a video not on the address's page", () => {
    expect(stepperOf('video-5', 1, pages([[1, first]]))).toBeNull()
    expect(stepperOf('video-5', 4, pages([[4, pageOf(4, 3, [])]]))).toBeNull()
  })

  test("a refused address's page is the whole stepper's failure, naming that page", () => {
    expect(stepperOf('video-5', 2, pages([[2, { kind: 'refused', message: 'No.' }]]))).toEqual({
      refused: 2,
    })
  })

  test('an adjacent page that is refused is a failed place naming that page, not an end of the list', () => {
    const refused: LandedListView = { kind: 'refused', message: 'No.' }

    expect(
      stepperOf(
        'video-6',
        2,
        pages([
          [2, middle],
          [3, refused],
        ]),
      ),
    ).toEqual({ previous: neighbour(5, 2), next: { refused: 3 } })
    expect(
      stepperOf(
        'video-4',
        2,
        pages([
          [1, refused],
          [2, middle],
        ]),
      ),
    ).toEqual({ previous: { refused: 1 }, next: neighbour(5, 2) })
  })
})

describe('the adjacent pages the detail screen reads', () => {
  test("are the page before for a page's first video and the page after for its last", () => {
    expect(adjacentPagesOf('video-4', 2, pages([[2, middle]]))).toEqual([1])
    expect(adjacentPagesOf('video-6', 2, pages([[2, middle]]))).toEqual([3])
  })

  test("are read one video before a page's edge, so a step to the edge video keeps its link", () => {
    const wide = pageOf(2, 3, [4, 5, 6, 7, 8])

    expect(adjacentPagesOf('video-5', 2, pages([[2, wide]]))).toEqual([1])
    expect(adjacentPagesOf('video-7', 2, pages([[2, wide]]))).toEqual([3])
  })

  test('are both for a page of one video, and none inside a page or past either end of the list', () => {
    expect(adjacentPagesOf('video-4', 2, pages([[2, pageOf(2, 3, [4])]]))).toEqual([1, 3])
    expect(adjacentPagesOf('video-6', 2, pages([[2, pageOf(2, 3, [4, 5, 6, 7, 8])]]))).toEqual([])
    expect(adjacentPagesOf('video-1', 1, pages([[1, first]]))).toEqual([])
    expect(adjacentPagesOf('video-9', 3, pages([[3, last]]))).toEqual([])
  })

  test("are none while the address's page is read, for a video not on it, or for a refused page", () => {
    expect(adjacentPagesOf('video-4', 2, pages([]))).toEqual([])
    expect(adjacentPagesOf('video-1', 2, pages([[2, middle]]))).toEqual([])
    expect(
      adjacentPagesOf('video-4', 2, pages([[2, { kind: 'refused', message: 'No.' }]])),
    ).toEqual([])
  })
})

describe("a step's route", () => {
  const listRoute: Route = {
    ...defaultRoute,
    page: 2,
    window: 'last90',
    sort: '-views',
    format: 'short',
    chart: 'aggregate',
    chartCard: 'watchTime',
    pageSize: 25,
    visibility: 'all',
  }

  test('keeps the page inside a page, and every control of the list', () => {
    expect(stepRouteOf(listRoute, neighbour(6, 2))).toEqual({ ...listRoute, video: 'video-6' })
  })

  test("moves the address's page across a page's edge, so Back to videos returns to the new video's page", () => {
    expect(stepRouteOf(listRoute, neighbour(7, 3))).toEqual({
      ...listRoute,
      page: 3,
      video: 'video-7',
    })
    expect(stepRouteOf(listRoute, neighbour(3, 1))).toEqual({
      ...listRoute,
      page: 1,
      video: 'video-3',
    })
  })

  test("takes the video from the neighbour, not the route's", () => {
    expect(stepRouteOf({ ...listRoute, video: 'video-5' }, neighbour(4, 2)).video).toBe('video-4')
  })
})

describe("the steps' text", () => {
  test('in the newest first date sort is Newer video in the previous place and Older video in the next', () => {
    expect(stepTextOf('-publishedAt')).toEqual({ previous: 'Newer video', next: 'Older video' })
  })

  test('in the oldest first date sort is Older video in the previous place and Newer video in the next', () => {
    expect(stepTextOf('publishedAt')).toEqual({ previous: 'Older video', next: 'Newer video' })
  })

  test.each(['-views', 'views', '-engagedViews', 'estimatedRevenue'] as const)(
    'in the %s sort is Previous in list and Next in list',
    (sort) => {
      expect(stepTextOf(sort)).toEqual({ previous: 'Previous in list', next: 'Next in list' })
    },
  )

  test("the accessible name adds the neighbour's title to the step's text in the list's sort", () => {
    expect(stepLabelOf('previous', '-publishedAt', 'My title')).toBe('Newer video: My title')
    expect(stepLabelOf('next', '-publishedAt', 'My title')).toBe('Older video: My title')
    expect(stepLabelOf('previous', 'publishedAt', 'My title')).toBe('Older video: My title')
    expect(stepLabelOf('next', 'publishedAt', 'My title')).toBe('Newer video: My title')
    expect(stepLabelOf('previous', '-views', 'My title')).toBe('Previous in list: My title')
    expect(stepLabelOf('next', 'views', 'My title')).toBe('Next in list: My title')
  })
})

describe('a step', () => {
  test('sends video_stepped with its direction and nothing else', () => {
    expect(videoSteppedEvent('previous')).toEqual({ name: 'video_stepped', direction: 'previous' })
    expect(videoSteppedEvent('next')).toEqual({ name: 'video_stepped', direction: 'next' })
  })
})

describe("the video's list row, which heads the screen while its detail is read", () => {
  test('is found on any page read', () => {
    const found = pages([
      [2, middle],
      [3, last],
    ])

    expect(headRowOf(found, 'video-7')).toEqual(row(7))
    expect(headRowOf(found, 'video-5')).toEqual(row(5))
  })

  test('is found past a refused page read before the page that holds it', () => {
    const found = pages([
      [1, { kind: 'refused', message: 'No.' }],
      [2, middle],
    ])

    expect(headRowOf(found, 'video-5')).toEqual(row(5))
  })

  test('is none for a video on no page read, or with only refused pages', () => {
    expect(headRowOf(pages([[2, middle]]), 'video-1')).toBeNull()
    expect(headRowOf(pages([[2, { kind: 'refused', message: 'No.' }]]), 'video-5')).toBeNull()
  })
})
