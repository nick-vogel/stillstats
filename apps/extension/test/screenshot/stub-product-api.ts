// The product API's answers to the extension, for the store screenshots only (creator-analytics#100):
// the routes the background script calls on stillstats.com, answered from the sample channel the
// homepage's screenshot shows (apps/site/test/screenshot/sample-channel.ts), in the shapes
// `@creator-analytics/api-types` defines. The extension runs unchanged, background and all: only the
// network's answers are made up. A request the stub has no answer for answers 404 and is kept in
// `unanswered`, so the capture fails rather than shoot a surface showing "Try again later".
//
// The answers are as of `capturedAt`, the moment the Studio pages show: uploads published after it
// are not listed, and Google has processed the days up to `lastProcessedDayAtCapture`. Each row and
// answer is built as the homepage's stub builds its own (`videoRowOf`, `videoListAnswerOf`).
import {
  addDays,
  type ChannelsAnswer,
  type CustomRange,
  lastDaysOf,
  type VideoListAnswer,
  type VideoRow,
  type VideoWindow,
  videoFormatFilters,
  videoWindowDays,
  videoWindows,
  windowsAfterPublish,
} from '@creator-analytics/api-types'
import {
  creationDay,
  type SampleDay,
  type SampleVideo,
  sampleChannel,
  sampleVideos,
  videoDayOf,
} from '../../../site/test/screenshot/sample-channel.ts'
import { videoListAnswerOf, videoRowOf } from '../../../site/test/screenshot/stub-api.ts'
import {
  capturedAt,
  fetchedAtCapture,
  lastProcessedDayAtCapture,
  thumbnailUrlOf,
} from './sample-studio.ts'

/** The uploads published by `capturedAt`, the newest last. */
export const publishedVideos = sampleVideos.filter((video) => video.publishedAt <= capturedAt)

/** The video's days in `range` that Google has processed, publish day first. */
function processedDaysOf(video: SampleVideo, range: CustomRange): SampleDay[] {
  const days: SampleDay[] = []
  const to = range.to < lastProcessedDayAtCapture ? range.to : lastProcessedDayAtCapture
  for (let day = range.from; day <= to; day = addDays(day, 1)) {
    const numbers = videoDayOf(video, day)
    if (numbers) days.push(numbers)
  }
  return days
}

function rowOf(video: SampleVideo, window: VideoWindow): VideoRow {
  const afterPublish = windowsAfterPublish.find((each) => each === window)
  const range: CustomRange =
    window === 'lifetime'
      ? { from: creationDay, to: lastProcessedDayAtCapture }
      : afterPublish
        ? {
            from: video.publishDay,
            to: addDays(video.publishDay, videoWindowDays[afterPublish] - 1),
          }
        : lastDaysOf(
            videoWindowDays[window as keyof typeof videoWindowDays],
            lastProcessedDayAtCapture,
            creationDay,
          )
  return videoRowOf(video, processedDaysOf(video, range), {
    thumbnailUrl: thumbnailUrlOf(video.id, 'mqdefault'),
    lastProcessedDay: lastProcessedDayAtCapture,
    ...(afterPublish ? { afterPublishDays: videoWindowDays[afterPublish] } : {}),
  })
}

/** The answer to a video list query, or none for a query the extension never makes. */
function videoListOf(query: URLSearchParams): VideoListAnswer | null {
  const window = videoWindows.find((each) => each === query.get('window'))
  const format = videoFormatFilters.find((each) => each === (query.get('format') ?? 'all'))
  const sort = query.get('sort') ?? '-publishedAt'
  const visibility = query.get('visibility') ?? 'public'
  if (!window || window === 'custom' || !format || sort !== '-publishedAt') return null
  if (visibility !== 'public') return null
  const ids = query.get('ids')?.split(',')
  const listed = publishedVideos.filter((video) =>
    ids ? ids.includes(video.id) : format === 'all' || video.format === format,
  )
  // Newest first; the sample has no two uploads at the same time.
  const rows = listed.toReversed().map((video) => rowOf(video, window))
  return videoListAnswerOf(rows, {
    window,
    page: Number(query.get('page') ?? 1),
    pageSize: Math.min(50, Number(query.get('pageSize') ?? 50), ids?.length ?? 50),
    bounds: { lastProcessedDay: lastProcessedDayAtCapture, creationDay },
    fresh: { fetchedAt: fetchedAtCapture, fromCache: false },
  })
}

export interface StubAnswer {
  status: number
  /** The JSON body, or none. */
  body: unknown
}

export interface StubProductApi {
  answer(request: { method: string; url: string; postData?: string }): StubAnswer
  /** Every request the stub had no answer for, as `METHOD /path?query`. */
  unanswered: string[]
  /** The names of the usage events the extension sent. */
  events: string[]
}

export function stubProductApi(): StubProductApi {
  const unanswered: string[] = []
  const events: string[] = []
  const videosPath = `/api/channels/${sampleChannel.id}/videos`
  return {
    unanswered,
    events,
    answer({ method, url: href, postData }) {
      const url = new URL(href)
      const route = `${method} ${url.pathname}`
      if (route === 'GET /api/channels') {
        return { status: 200, body: { channels: [sampleChannel] } satisfies ChannelsAnswer }
      }
      if (route === `GET ${videosPath}`) {
        const answer = videoListOf(url.searchParams)
        if (answer) return { status: 200, body: answer }
      }
      // The usage events relay, which answers an event it relays with no body, as the API does.
      if (route === 'POST /api/events') {
        events.push(JSON.parse(postData ?? '{}').name)
        return { status: 204, body: null }
      }
      unanswered.push(`${route}${url.search}`)
      return { status: 404, body: { error: 'not_found' } }
    },
  }
}
