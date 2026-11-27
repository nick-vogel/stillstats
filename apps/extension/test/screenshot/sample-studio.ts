// YouTube Studio's own numbers for the sample channel, for the store screenshots
// (creator-analytics#100): what each saved Studio page shows in place of the creator's data. The
// channel, its uploads and each upload's numbers by day are the homepage screenshot's
// (apps/site/test/screenshot/sample-channel.ts), so the figures the extension shows beside Studio's
// come from the same days, and Studio's views, counted to `capturedAt`, are never fewer than the
// engaged views the extension counts to `lastProcessedDayAtCapture`.
//
// The numbers the sample does not hold are made up here from each video's id, so they are the same
// on every run: likes and comments, as a small share of the video's engaged views, and the
// thumbnail click-through rate, between 4.2% and 6.6%.
import { addDays, daysFrom } from '@creator-analytics/api-types'
import {
  type SampleDay,
  type SampleVideo,
  sampleChannel,
  sampleVideos,
} from '../../../site/test/screenshot/sample-channel.ts'

/**
 * The moment the Studio pages show: 10:00 in Pacific Time on 2026-10-11, the reporting day Studio
 * counts in. The channel's newest upload then is "Brown Butter Gnocchi in 20 Minutes", a video: the
 * saved dashboard shows the latest video card of a video, not of a Short, and the sample's next
 * upload, a Short, publishes at 14:00 that day.
 */
export const capturedAt = '2026-10-11T17:00:00.000Z'
const today = '2026-10-11'
/** The hours of `today` gone by at `capturedAt`. */
const hoursToday = 10
/** The last day Google has processed at `capturedAt`, two days behind Studio's own numbers. */
export const lastProcessedDayAtCapture = '2026-10-09'
/** When the API read the answers at `capturedAt`. */
export const fetchedAtCapture = '2026-10-11T16:55:00.000Z'

/** The video the analytics page shows: about six weeks old, so its launch and tail fit in 90 days. */
export const analyticsVideo = (() => {
  const video = sampleVideos.find(({ title }) => title === 'Why My Rice Was Always Mushy')
  if (!video) throw new Error('The sample has no video for the analytics page')
  return video
})()

export const sampleAvatarUrl = 'https://yt3.ggpht.com/sample-fennmoor-kitchen=s88-c-k-no-rj'

/** A sample thumbnail at `size`, on YouTube's image host, which the capture answers itself. */
export function thumbnailUrlOf(id: string, size: 'mqdefault' | 'sddefault'): string {
  return `https://i.ytimg.com/vi/${id}/${size}.jpg`
}

/** A number between 0 and 1 drawn from `text` and `salt`, the same on every run. */
function hashOf(text: string, salt: number): number {
  let hash = 2166136261 ^ salt
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return (hash >>> 0) / 4294967296
}

const numberFormat = new Intl.NumberFormat('en-US')
const count = (value: number) => numberFormat.format(value)
const dollars = (value: number) => `$${value.toFixed(2)}`
const studioDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})
/** A YYYY-MM-DD day as Studio writes it, such as "Oct 7, 2026". */
const dateOf = (day: string) => studioDate.format(new Date(`${day}T00:00:00Z`))

function durationOf(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** Studio's short form of a count, such as "435" or "2.3K". */
function compactOf(value: number): string {
  return value < 1000 ? String(value) : `${(Math.floor(value / 100) / 10).toFixed(1)}K`
}

/**
 * The video's numbers summed over its days from `from` to `to`, and the share `partOfLast` of the
 * day after `to`: Studio counts the hours of today gone by.
 */
function sumOf(
  video: SampleVideo,
  key: keyof SampleDay,
  from: string,
  to: string,
  partOfLast = 0,
): number {
  let total = 0
  for (let day = from; day <= to; day = addDays(day, 1)) {
    total += video.days[daysFrom(video.publishDay, day)]?.[key] ?? 0
  }
  const next = video.days[daysFrom(video.publishDay, addDays(to, 1))]?.[key] ?? 0
  return total + Math.round(next * partOfLast)
}

/** Studio's views of the video from its publish day to `capturedAt`. */
function studioViewsOf(video: SampleVideo): number {
  return sumOf(video, 'views', video.publishDay, addDays(today, -1), hoursToday / 24)
}

function likesOf(video: SampleVideo): number {
  const engaged = sumOf(video, 'engagedViews', video.publishDay, addDays(today, -1))
  return Math.round(engaged * (0.035 + 0.02 * hashOf(video.id, 1)))
}

function commentsOf(video: SampleVideo): number {
  const engaged = sumOf(video, 'engagedViews', video.publishDay, addDays(today, -1))
  return Math.round(engaged * (0.002 + 0.004 * hashOf(video.id, 2)))
}

const descriptions = [
  'The full recipe, the shopping list and the timings are in the pinned comment.',
  "Cooking for two on a weeknight, with what's already in the cupboard.",
  'I tested this one six times so you only have to make it once.',
  'A slow Sunday cook that feeds the whole week. Recipe in the pinned comment.',
  'Small kitchen, one pan, no special kit. Here is how I do it.',
  "Questions from last week's comments, answered while the oven heats up.",
]

export interface ChannelData {
  /** The YouTube channel id the saved page carries, which the swap replaces everywhere. */
  savedChannelId: string
  channelId: string
  channelName: string
  avatarUrl: string
}

/** One upload as a Studio row or card shows it. */
export interface VideoData {
  id: string
  title: string
  thumbnailUrl: string
  duration: string
  description: string
  published: string
  views: string
  revenue: string
  comments: string
  likes: string
}

export interface DashboardData {
  page: 'dashboard'
  channel: ChannelData
  card: VideoData & {
    largeThumbnailUrl: string
    since: string
    ranking: string
    clickThroughRate: string
    averageViewDuration: string
    /** Studio's ranking tooltip: the newest 10 videos by views over the same hours. */
    top: { id: string; title: string; thumbnailUrl: string; views: string; latest: boolean }[]
  }
}

export interface ContentListData {
  page: 'content-list'
  channel: ChannelData
  rows: VideoData[]
}

export interface VideoAnalyticsData {
  page: 'video-analytics'
  channel: ChannelData
  /** The video id the saved page carries, which the swap replaces everywhere. */
  savedVideoId: string
  video: VideoData
  period: string
  headline: string
  views: string
  watchHours: string
  subscribers: string
  revenue: string
  /** Studio's views on each day of the period, oldest first. */
  dailyViews: number[]
  /** Each day of the period as the chart's axis writes it, such as "Jul 27, 2026". */
  axisDays: string[]
}

export type PageData = DashboardData | ContentListData | VideoAnalyticsData

function channelDataOf(savedChannelId: string): ChannelData {
  return {
    savedChannelId,
    channelId: sampleChannel.youtubeChannelId,
    channelName: sampleChannel.title ?? '',
    avatarUrl: sampleAvatarUrl,
  }
}

function videoDataOf(video: SampleVideo, index: number): VideoData {
  return {
    id: video.id,
    title: video.title,
    thumbnailUrl: thumbnailUrlOf(video.id, 'mqdefault'),
    duration: durationOf(video.durationSeconds),
    description: descriptions[index % descriptions.length] ?? '',
    published: dateOf(video.publishDay),
    views: count(studioViewsOf(video)),
    revenue: dollars(sumOf(video, 'estimatedRevenue', video.publishDay, lastProcessedDayAtCapture)),
    comments: String(commentsOf(video)),
    likes: String(likesOf(video)),
  }
}

/** The long-form uploads public at `capturedAt`, newest first, which Studio's Videos tab lists. */
function videosNewestFirst(published: SampleVideo[]): SampleVideo[] {
  return published.filter((video) => video.format === 'video').toReversed()
}

export function dashboardDataOf(savedChannelId: string, published: SampleVideo[]): DashboardData {
  const videos = videosNewestFirst(published)
  const latest = videos[0]
  if (!latest) throw new Error('The sample has no video')
  // The hours since the latest video was published, which Studio counts each of the newest videos
  // over: its publish day at 15:00, so days 1 to 3 whole and the hours of the fourth.
  const sinceHours = Math.round((Date.parse(capturedAt) - Date.parse(latest.publishedAt)) / 3.6e6)
  const days = Math.floor(sinceHours / 24)
  const hours = sinceHours % 24
  const fullDays = daysFrom(latest.publishDay, today)
  const viewsOver = (video: SampleVideo) =>
    sumOf(
      video,
      'views',
      video.publishDay,
      addDays(video.publishDay, fullDays - 1),
      hoursToday / 24,
    )
  const top = videos
    .slice(0, 10)
    .map((video) => ({ video, views: viewsOver(video) }))
    .sort((a, b) => b.views - a.views)
  const minutes = sumOf(latest, 'estimatedMinutesWatched', latest.publishDay, addDays(today, -1))
  const views = sumOf(latest, 'views', latest.publishDay, addDays(today, -1))
  const averageSeconds = Math.round((minutes * 60) / views)
  return {
    page: 'dashboard',
    channel: channelDataOf(savedChannelId),
    card: {
      ...videoDataOf(latest, 0),
      largeThumbnailUrl: thumbnailUrlOf(latest.id, 'sddefault'),
      since: `First ${days} days ${hours} hours`,
      ranking: `${top.findIndex(({ video }) => video === latest) + 1} of ${top.length}`,
      clickThroughRate: `${(4.2 + 2.4 * hashOf(latest.id, 3)).toFixed(1)}%`,
      averageViewDuration: durationOf(averageSeconds),
      top: top.map(({ video, views }) => ({
        id: video.id,
        title: video.title,
        thumbnailUrl: thumbnailUrlOf(video.id, 'mqdefault'),
        views: compactOf(views),
        latest: video === latest,
      })),
    },
  }
}

export function contentListDataOf(
  savedChannelId: string,
  published: SampleVideo[],
  rowCount: number,
): ContentListData {
  const rows = videosNewestFirst(published).slice(0, rowCount).map(videoDataOf)
  if (rows.length < rowCount) throw new Error(`The sample has fewer than ${rowCount} videos`)
  return { page: 'content-list', channel: channelDataOf(savedChannelId), rows }
}

/**
 * Studio's "Last 90 days" for `video`: the 90 days to yesterday, which Studio has numbers for two
 * days ahead of the API.
 */
export function videoAnalyticsDataOf(
  savedChannelId: string,
  savedVideoId: string,
  video: SampleVideo,
): VideoAnalyticsData {
  const lastDay = addDays(today, -1)
  const firstDay = addDays(lastDay, -89)
  const dailyViews: number[] = []
  const axisDays: string[] = []
  for (let day = firstDay; day <= lastDay; day = addDays(day, 1)) {
    dailyViews.push(video.days[daysFrom(video.publishDay, day)]?.views ?? 0)
    axisDays.push(dateOf(day))
  }
  const views = dailyViews.reduce((all, day) => all + day, 0)
  const minutes = sumOf(video, 'estimatedMinutesWatched', firstDay, lastDay)
  const subscribers = sumOf(video, 'subscribersGained', firstDay, lastDay)
  return {
    page: 'video-analytics',
    channel: channelDataOf(savedChannelId),
    savedVideoId,
    video: videoDataOf(video, 0),
    period: `${dateOf(firstDay).replace(/, \d{4}$/, '')} – ${dateOf(lastDay)}`,
    headline: `This video got ${count(views)} views in the last 90 days`,
    views: count(views),
    watchHours: (minutes / 60).toFixed(1),
    subscribers: `+${count(subscribers)}`,
    revenue: dollars(sumOf(video, 'estimatedRevenue', firstDay, lastDay)),
    dailyViews,
    axisDays,
  }
}
