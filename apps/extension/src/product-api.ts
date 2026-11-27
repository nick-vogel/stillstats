import type {
  ChannelsAnswer,
  ExtensionEvent,
  ListedChannel,
  Refusal,
  RefusalAnswer,
  VideoFormat,
  VideoListAnswer,
  VideoRow,
  VideoWindow,
} from '@creator-analytics/api-types'
import { signedInReadKeptMs } from './kept.ts'

/**
 * How long the background waits for the API to answer one request, a read or an event send, before
 * it gives up and answers failed. A video read with no kept channels is two requests in a row, so
 * it can wait twice this. Long enough for a cold video list read, which the API answers only after
 * its own calls to the YouTube Data and Analytics APIs, each bounded at 10 seconds
 * (`googleCallTimeoutMs`) but unbounded in number (paging a large channel's uploads), and for an
 * event send, which the API's relay holds up to 3 seconds for OpenPanel (`defaultSendTimeoutMs` in
 * `packages/event-relay/src/index.ts`). Short enough that a stalled API frees the tab's surfaces,
 * which the watch runs one pass at a time, within a few of Studio's draws.
 */
export const apiAnswerWithinMs = 15_000

/** The video list's largest page, which an uploads read pages in. */
const uploadsPageSize = 50

export type ChannelsRead =
  | { state: 'signed-in'; channels: ListedChannel[] }
  | { state: 'signed-out' }
  | { state: 'failed' }

/**
 * The videos of the Stillstats channel a Studio channel id matches: those of `ids`, or the `newest`
 * public uploads of `format`, newest first.
 */
export type VideosQuery =
  | { youtubeChannelId: string; ids: string[]; window: VideoWindow }
  | { youtubeChannelId: string; format: VideoFormat; newest: number; window: VideoWindow }

/**
 * A query's parameters on the wire. With the Studio channel id, they are the key its read is kept
 * under.
 */
function parametersOf(query: VideosQuery): [string, string][] {
  if ('ids' in query)
    return [
      ['ids', query.ids.join(',')],
      ['window', query.window],
    ]
  // Visibility and sort are sent, not left to the API's defaults, so a change of default never
  // changes which uploads the answer holds or their order.
  return [
    ['window', query.window],
    ['format', query.format],
    ['pageSize', String(query.newest)],
    ['visibility', 'public'],
    ['sort', '-publishedAt'],
  ]
}

export type VideosRead =
  /** `channelId` is the matched Stillstats channel's id, which the web app's links carry. */
  | { state: 'read'; channelId: string; answer: VideoListAnswer }
  | { state: 'signed-out' }
  | { state: 'channel-not-in-stillstats' }
  | { state: 'refused'; refusal: Refusal }
  | { state: 'failed' }
  /**
   * The creator withholds the extension's host access to stillstats.com. The background answers it
   * before any API read, so the product API itself never does.
   */
  | { state: 'host-access-withheld' }

/** What the product API answers a videos read: every state but withheld host access. */
type ApiVideosRead = Exclude<VideosRead, { state: 'host-access-withheld' }>

/**
 * Every upload of the Stillstats channel a YouTube channel id matches, read through the video list
 * page by page, lifetime: what a public page matches its tiles against, so no id from the page is
 * sent (creator-analytics#520). `lastProcessedDay` is the oldest of its pages', as the video list's
 * freshness is that of its oldest read, and `fromCache` is true only when every page was. Any other
 * state is one of a videos read's, and no partial list is ever answered.
 */
export type UploadsRead =
  | {
      state: 'read'
      channelId: string
      videos: VideoRow[]
      lastProcessedDay: string
      fromCache: boolean
    }
  | Exclude<VideosRead, { state: 'read' }>

/** What the product API answers an uploads read: every state but withheld host access. */
export type ApiUploadsRead = Exclude<UploadsRead, { state: 'host-access-withheld' }>

/**
 * The uploads read's query, but its page. Every visibility, scheduled uploads included, as the read
 * of ids it replaces answered, so the creator's unlisted or private video keeps its pill on its own
 * watch page. Sort and visibility are sent, not left to the API's defaults, as `parametersOf` does.
 */
const uploadsParameters: [string, string][] = [
  ['window', 'lifetime'],
  ['format', 'all'],
  ['visibility', 'all'],
  ['includeScheduled', 'true'],
  ['sort', '-publishedAt'],
  ['pageSize', String(uploadsPageSize)],
]

export interface ProductApi {
  readChannels(): Promise<ChannelsRead>
  /**
   * The videos `query` asks, kept `signedInReadKeptMs` once read. A kept read sends no request, so
   * its answer is from the cache, whatever the API answered when it was read.
   */
  readVideos(query: VideosQuery): Promise<ApiVideosRead>
  /**
   * Every upload of the channel `youtubeChannelId` names, kept `signedInReadKeptMs` per channel
   * once read, and from the cache while kept. Two reads while one paging is out share it, and its
   * cache result.
   */
  readUploads(youtubeChannelId: string): Promise<ApiUploadsRead>
  /** True when the relay accepted the event. */
  sendEvent(event: ExtensionEvent): Promise<boolean>
}

/** The older of two last processed days, YYYY-MM-DD, which sort as text. */
const olderDay = (day: string, other: string): string => (other < day ? other : day)

function isVideoListAnswer(body: unknown): body is VideoListAnswer {
  return typeof body === 'object' && body !== null && Array.isArray(Reflect.get(body, 'videos'))
}

function isChannelsAnswer(body: unknown): body is ChannelsAnswer {
  return typeof body === 'object' && body !== null && Array.isArray(Reflect.get(body, 'channels'))
}

function isRefusalAnswer(body: unknown): body is RefusalAnswer {
  return (
    typeof body === 'object' && body !== null && typeof Reflect.get(body, 'refusal') === 'string'
  )
}

/**
 * The extension's only caller of the Stillstats API. Every request carries the creator's
 * stillstats.com session cookie, which the extension's host access lets the browser send, and
 * `headers`, the staging build's Access service token.
 */
export function createProductApi({
  origin,
  fetch,
  now,
  answerWithinMs = apiAnswerWithinMs,
  headers = {},
}: {
  origin: string
  fetch: typeof globalThis.fetch
  now: () => number
  /** How long a request may go unanswered before it is given up as failed. */
  answerWithinMs?: number
  /** Sent on every request: the staging build's Access headers, none in any other build. */
  headers?: Readonly<Record<string, string>>
}): ProductApi {
  let keptChannels: { read: ChannelsRead; at: number } | null = null
  const keptVideos = new Map<string, { read: ApiVideosRead; at: number }>()
  /** Per YouTube channel id: a read uploads list, or the paging still out. */
  const keptUploads = new Map<string, { read: Promise<ApiUploadsRead>; at?: number }>()

  const isFresh = (at: number) => now() - at < signedInReadKeptMs

  /**
   * A GET carrying the session cookie: a 401 is signed out, a dropped or unanswered request is
   * failed.
   */
  async function readSignedIn<Read>(
    path: string,
    readOf: (response: Response) => Promise<Read>,
  ): Promise<Read | { state: 'signed-out' } | { state: 'failed' }> {
    try {
      const response = await fetch(`${origin}${path}`, {
        credentials: 'include',
        headers,
        signal: AbortSignal.timeout(answerWithinMs),
      })
      if (response.status === 401) {
        keptChannels = null
        keptVideos.clear()
        keptUploads.clear()
        return { state: 'signed-out' }
      }
      return await readOf(response)
    } catch {
      return { state: 'failed' }
    }
  }

  async function readChannels(): Promise<ChannelsRead> {
    if (keptChannels && isFresh(keptChannels.at)) return keptChannels.read
    const read = await readSignedIn('/api/channels', async (response): Promise<ChannelsRead> => {
      if (!response.ok) return { state: 'failed' }
      const body: unknown = await response.json().catch(() => null)
      return isChannelsAnswer(body)
        ? { state: 'signed-in', channels: body.channels }
        : { state: 'failed' }
    })
    // Only a signed-in read is kept: a creator who has just signed in sees it on the next read.
    keptChannels = read.state === 'signed-in' ? { read, at: now() } : null
    return read
  }

  /** The listed channel a YouTube channel id matches, or the read that found none. */
  async function listedChannelOf(
    youtubeChannelId: string,
  ): Promise<ListedChannel | Exclude<ApiVideosRead, { state: 'read' }>> {
    const channels = await readChannels()
    if (channels.state !== 'signed-in') return channels
    const channel = channels.channels.find((listed) => listed.youtubeChannelId === youtubeChannelId)
    return channel ?? { state: 'channel-not-in-stillstats' }
  }

  /** One read of the channel's video list. */
  function readVideoList(channel: ListedChannel, parameters: [string, string][]) {
    return readSignedIn(
      `/api/channels/${channel.id}/videos?${new URLSearchParams(parameters)}`,
      async (response): Promise<ApiVideosRead> => {
        const body: unknown = await response.json().catch(() => null)
        if (response.ok) {
          return isVideoListAnswer(body)
            ? { state: 'read', channelId: channel.id, answer: body }
            : { state: 'failed' }
        }
        if (isRefusalAnswer(body)) return { state: 'refused', refusal: body.refusal }
        return { state: 'failed' }
      },
    )
  }

  async function askForVideos(query: VideosQuery): Promise<ApiVideosRead> {
    const channel = await listedChannelOf(query.youtubeChannelId)
    if ('state' in channel) return channel
    return readVideoList(channel, parametersOf(query))
  }

  /** Pages 1 to the first page's `pageCount` in turn; the first page that holds no list ends it. */
  async function askForUploads(youtubeChannelId: string): Promise<ApiUploadsRead> {
    const channel = await listedChannelOf(youtubeChannelId)
    if ('state' in channel) return channel
    const first = await readVideoList(channel, [...uploadsParameters, ['page', '1']])
    if (first.state !== 'read') return first
    const videos = [...first.answer.videos]
    let { lastProcessedDay, fromCache } = first.answer
    for (let page = 2; page <= first.answer.pageCount; page += 1) {
      const read = await readVideoList(channel, [...uploadsParameters, ['page', String(page)]])
      if (read.state !== 'read') return read
      videos.push(...read.answer.videos)
      lastProcessedDay = olderDay(lastProcessedDay, read.answer.lastProcessedDay)
      fromCache &&= read.answer.fromCache
    }
    return { state: 'read', channelId: channel.id, videos, lastProcessedDay, fromCache }
  }

  /** A read answered from the background's own keep: no request left the browser. */
  const keptVideosRead = (read: ApiVideosRead): ApiVideosRead =>
    read.state === 'read' ? { ...read, answer: { ...read.answer, fromCache: true } } : read
  const keptUploadsRead = (read: ApiUploadsRead): ApiUploadsRead =>
    read.state === 'read' ? { ...read, fromCache: true } : read

  return {
    readChannels,
    async readVideos(query) {
      const key = JSON.stringify([query.youtubeChannelId, parametersOf(query)])
      for (const [heldKey, { at }] of keptVideos) {
        if (!isFresh(at)) keptVideos.delete(heldKey)
      }
      const held = keptVideos.get(key)
      if (held) return keptVideosRead(held.read)
      const read = await askForVideos(query)
      if (read.state === 'read') keptVideos.set(key, { read, at: now() })
      return read
    },
    readUploads(youtubeChannelId) {
      const held = keptUploads.get(youtubeChannelId)
      // A paging still out answers its own result; a settled one, kept, is from the cache.
      if (held && held.at === undefined) return held.read
      if (held?.at !== undefined && isFresh(held.at)) return held.read.then(keptUploadsRead)
      const kept: { read: Promise<ApiUploadsRead>; at?: number } = {
        read: askForUploads(youtubeChannelId).then((read) => {
          // Only a read list is kept, and only while this paging is still the one held: a 401
          // meanwhile cleared it.
          if (keptUploads.get(youtubeChannelId) !== kept) return read
          if (read.state === 'read') kept.at = now()
          else keptUploads.delete(youtubeChannelId)
          return read
        }),
      }
      keptUploads.set(youtubeChannelId, kept)
      return kept.read
    },
    async sendEvent(event) {
      try {
        const response = await fetch(`${origin}/api/events`, {
          method: 'POST',
          credentials: 'include',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify(event),
          signal: AbortSignal.timeout(answerWithinMs),
        })
        return response.ok
      } catch {
        return false
      }
    },
  }
}
