import type { VideoListAnswer, VideoRow } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import type { VideosRead } from '../product-api.ts'
import { comparisonOf, daysProcessedOf, windowCovering } from './comparison.ts'

const newest: VideoRow = {
  id: 'newest',
  title: 'The newest upload',
  thumbnailUrl: null,
  thumbnails: [],
  durationSeconds: null,
  publishedAt: '2026-10-06T15:00:00Z',
  scheduled: false,
  privacy: 'public',
  format: 'short',
  engagedViews: 96,
  views: 120,
  averageViewPercentage: 41.2,
  subscribersGained: 3,
  estimatedMinutesWatched: 0,
  awaitingProcessing: false,
}

/** An older upload of the same format, with `engagedViewsByDay` from its publish day. */
const older = (id: string, engagedViews: number, engagedViewsByDay: number[]): VideoRow => ({
  ...newest,
  id,
  publishedAt: '2026-09-01T15:00:00Z',
  engagedViews,
  engagedViewsByDay,
})

/** The format read's answer in `first7`, newest first, as the API orders the newest uploads. */
function formatRead(videos: VideoRow[]): VideosRead {
  const answer: VideoListAnswer = {
    videos,
    window: 'first7',
    page: 1,
    pageSize: videos.length,
    pageCount: 1,
    revenue: { refusal: 'consent_missing' },
    lastProcessedDay: '2026-10-07',
    creationDay: null,
    fetchedAt: '2026-10-10T12:00:00Z',
    fromCache: false,
  }
  return { state: 'read', channelId: 'channel-1', answer }
}

describe('the days Google has processed for the newest upload, its publish day as day 1', () => {
  test.each([
    ['on the publish day', '2026-10-06T15:00:00Z', '2026-10-06', 1],
    ['the day after it', '2026-10-06T15:00:00Z', '2026-10-07', 2],
    ['a week on', '2026-10-06T15:00:00Z', '2026-10-12', 7],
    ['before the publish day', '2026-10-06T15:00:00Z', '2026-10-05', 0],
    ['well before it', '2026-10-06T15:00:00Z', '2026-09-20', 0],
    // 05:00 UTC on 7 Oct is 22:00 on 6 Oct in Pacific Time, the reporting day the API counts from.
    ['for a publish time late on a Pacific day', '2026-10-07T05:00:00Z', '2026-10-06', 1],
    [
      'for a publish time late on a Pacific day, the next day',
      '2026-10-07T05:00:00Z',
      '2026-10-07',
      2,
    ],
  ])('%s: published %s, processed through %s, is %i', (_, publishedAt, lastProcessedDay, days) => {
    expect(daysProcessedOf(publishedAt, lastProcessedDay)).toBe(days)
  })

  test('a video with no publish time has no processed day', () => {
    expect(daysProcessedOf(null, '2026-10-07')).toBe(0)
  })
})

describe('the window after publish the format read asks: the shortest that covers the days', () => {
  test.each([
    [1, 'first1'],
    [2, 'first7'],
    [7, 'first7'],
    [8, 'first28'],
    [28, 'first28'],
    [29, 'first90'],
    [90, 'first90'],
    [91, 'first365'],
    [365, 'first365'],
    // The longest window the API serves: past it, each upload's first 365 days.
    [400, 'first365'],
  ])('%i days reads %s', (days, window) => {
    expect(windowCovering(days)).toBe(window)
  })
})

describe("the card video's place over the same days since publish", () => {
  test('one processed day reads "Publish day"', () => {
    const card = { ...newest, engagedViewsByDay: [96] }
    const read = formatRead([card, older('a', 2_510, [40, 900, 800, 400, 200, 100, 70])])

    expect(comparisonOf(newest, read)).toEqual({
      place: '1 of 2 Shorts by engaged views',
      through: 'Publish day',
    })
  })

  test('three processed days read "First 3 days", each upload counted over its first 3', () => {
    const card = { ...newest, engagedViewsByDay: [30, 30, 30] }
    const read = formatRead([
      card,
      older('a', 2_510, [40, 40, 0, 900, 800, 400, 200]),
      older('b', 2_000, [50, 30, 20, 700, 600, 400, 200]),
    ])

    expect(comparisonOf(newest, read)).toEqual({
      place: '2 of 3 Shorts by engaged views',
      through: 'First 3 days',
    })
  })

  test('an upload with fewer processed days than the newest counts the days it has', () => {
    const card = { ...newest, engagedViewsByDay: [30, 30, 30] }
    const fewer = { ...older('a', 95, [80, 15]), publishedAt: '2026-10-07T15:00:00Z' }
    const read = formatRead([fewer, card])

    expect(comparisonOf(newest, read)?.place).toBe('2 of 2 Shorts by engaged views')
  })

  test('an upload with no daily figures counts 0', () => {
    const card = { ...newest, engagedViewsByDay: [1, 0] }
    const { engagedViewsByDay: _, ...none } = older('a', 2_510, [])
    const read = formatRead([card, none])

    expect(comparisonOf(newest, read)?.place).toBe('1 of 2 Shorts by engaged views')
  })

  test('uploads that tie over the first days place newest first, as the format read orders them', () => {
    const card = { ...newest, engagedViewsByDay: [50, 46] }
    const read = formatRead([
      older('newer', 3_000, [90, 6, 900]),
      card,
      older('older', 3_000, [10, 0, 900]),
    ])

    expect(comparisonOf(newest, read)?.place).toBe('2 of 3 Shorts by engaged views')
  })

  test('no processed day of the newest upload gives no comparison', () => {
    const card = { ...newest, engagedViewsByDay: [] }
    const read = formatRead([card, older('a', 2_510, [40, 30, 900, 800, 400, 200, 100])])

    expect(comparisonOf(newest, read)).toBeUndefined()
  })

  test('a format answer without the card video gives no comparison', () => {
    const read = formatRead([older('a', 2_510, [40, 30, 900, 800, 400, 200, 100])])

    expect(comparisonOf(newest, read)).toBeUndefined()
  })
})
