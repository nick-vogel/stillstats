// A stand-in for the API, for the homepage screenshot (creator-analytics#39) and the browser walk
// (creator-analytics#361). It serves the built web app under /app and the site's build at every
// other path outside /api, each as the API does, and on the same origin answers each route the
// signed-in screens read, the Audience screen and a video's detail included, with the sample
// channel's numbers in the shapes `@creator-analytics/api-types` defines. The web app runs
// unchanged: only its answers are made up. A request it has no answer for, an API route or a file
// neither build holds, answers 404 and is kept in `unanswered`, so the capture fails rather than
// shoot a screen that is missing something. A path under /app with no file extension is a
// client-side route, and gets the web app's entry page, as the API serves it.
//
// It lives under test/ so the API image, whose .dockerignore drops every test directory, never
// holds it, and the site's build, which reads only its page folders' pages, never ships it.
import { readFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type AdminFeedbackAnswer,
  type AdminFeedbackMessage,
  type AudienceAnswer,
  type AudienceRetentionPoint,
  addDays,
  type ChannelDay,
  type ChannelSummaryAnswer,
  type ChannelsAnswer,
  type ClientSettingsAnswer,
  type CustomRange,
  daysFrom,
  type EntitlementsAnswer,
  type Freshness,
  lastDaysOf,
  otherSourcesOf,
  type PartialWindow,
  type Preferences,
  type PublishDayVideo,
  publishDayTopSize,
  type RangeBounds,
  type RetentionCurvesAnswer,
  type SincePublish,
  type SincePublishRow,
  type SummaryUpload,
  type SummaryWindow,
  type UpgradeAnswer,
  type UpgradeComparison,
  upgradeWindows,
  type VideoDay,
  type VideoDetailAnswer,
  type VideoFormatFilter,
  type VideoListAnswer,
  type VideoRow,
  type VideoSortKey,
  videoFormatFilters,
  videoSortKeys,
  videoWindowDays,
  type WindowAfterPublish,
  windowsAfterPublish,
} from '@creator-analytics/api-types'
import {
  cents,
  creationDay,
  fetchedAt,
  historyStartDay,
  lastProcessedDay,
  noFormatRevenueOn,
  type SampleDay,
  type SampleVideo,
  sampleChannel,
  sampleSecondChannel,
  sampleSupport,
  sampleUser,
  sampleVideos,
  videoDayOf,
  videoReachOf,
} from './sample-channel.ts'

const webRoot = fileURLToPath(new URL('../../../web/dist/', import.meta.url))
const siteRoot = fileURLToPath(new URL('../../dist/', import.meta.url))
const favicon = fileURLToPath(new URL('../../public/favicon.svg', import.meta.url))
/** The browser walk's fake YouTube player script, which its build points the web app at. */
const fakeYouTubeIframeApi = fileURLToPath(new URL('./fake-youtube-iframe-api.js', import.meta.url))

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

const rangeBounds: RangeBounds = { lastProcessedDay, creationDay }

// Production's answer with a made-up version and commit, and no OpenPanel client ID, so the walk
// and the capture send no event.
const clientSettings: ClientSettingsAnswer = {
  environment: 'production',
  version: '2026.11.9',
  commit: 'abc1234',
  releasePath: '/releases/2026.11.9',
  openPanelClientId: null,
}
const freshness: Freshness = { fetchedAt, fromCache: false }

/** Every day from `from` to `to`, both included. */
function daysOf({ from, to }: CustomRange): string[] {
  const days: string[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day)
  return days
}

type CalendarWindow = Exclude<SummaryWindow, 'custom' | 'lifetime'>

const calendarWindows = ['last7', 'last28', 'last90', 'last365'] as const

/** The window a query asks for and its days, or none for a window the sample does not answer. */
function windowOf(query: URLSearchParams): { window: SummaryWindow; range: CustomRange } | null {
  const window = query.get('window') ?? 'last28'
  if (window === 'lifetime') return { window, range: { from: creationDay, to: lastProcessedDay } }
  if (window === 'custom') {
    const from = query.get('from')
    const to = query.get('to')
    if (!from || !to || to < from) return null
    return { window, range: { from, to } }
  }
  const calendar = calendarWindows.find((each): each is CalendarWindow => each === window)
  if (!calendar) return null
  return {
    window: calendar,
    range: lastDaysOf(videoWindowDays[calendar], lastProcessedDay, creationDay),
  }
}

function formatOf(query: URLSearchParams): VideoFormatFilter | null {
  const format = query.get('format') ?? 'all'
  return videoFormatFilters.find((each) => each === format) ?? null
}

function ofFormat(video: SampleVideo, format: VideoFormatFilter): boolean {
  return format === 'all' || video.format === format
}

/**
 * The summary's uploads: each sample video of the format published on a day of the range, newest
 * first, ties by id, as the API answers them. Every sample video is public, so the visibility
 * changes nothing. A video every 9 days and a Short every 6 meet every 18 days, so a window of 28
 * days or more holds a day of two uploads, which shows as a tile.
 */
function summaryUploadsOf(range: CustomRange, format: VideoFormatFilter): SummaryUpload[] {
  return sampleVideos
    .filter(
      (video) =>
        ofFormat(video, format) && video.publishDay >= range.from && video.publishDay <= range.to,
    )
    .toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id))
    .map(({ id, title, publishDay, format: videoFormat }) => ({
      id,
      title,
      publishDay,
      format: videoFormat,
    }))
}

/** The click-through rate of impressions and their clicks, null with no impressions. */
function ctrOf({ impressions, clicks }: { impressions: number; clicks: number }): number | null {
  return impressions === 0 ? null : clicks / impressions
}

/**
 * A paid channel's history over the summary's days, as the API answers it: each day from the
 * history start carries its impressions and CTR, and the answer carries the range's totals, the
 * history start and its newest day, the last processed day.
 */
function withHistory(answer: ChannelSummaryAnswer, videos: SampleVideo[]): ChannelSummaryAnswer {
  const total = { impressions: 0, clicks: 0 }
  const daily = answer.daily.map((channelDay) => {
    if (channelDay.day < historyStartDay) return channelDay
    const reach = { impressions: 0, clicks: 0 }
    for (const video of videos) {
      const videoReach = videoReachOf(video, channelDay.day)
      reach.impressions += videoReach?.impressions ?? 0
      reach.clicks += videoReach?.clicks ?? 0
    }
    total.impressions += reach.impressions
    total.clicks += reach.clicks
    return { ...channelDay, impressions: reach.impressions, ctr: ctrOf(reach) }
  })
  return {
    ...answer,
    daily,
    history: {
      impressions: total.impressions,
      ctr: ctrOf(total),
      firstDay: historyStartDay,
      newestDay: lastProcessedDay,
    },
  }
}

/** The sample history's two ends: its start, and the last processed day, its newest. */
const historyEnds = { firstDay: historyStartDay, newestDay: lastProcessedDay }

/**
 * A video's impressions, clicks and CTR over the days from `from` to `to`, as the API answers a
 * row's, and the history's "N of M days" when the days start before the history start.
 */
function countedReachOf(
  video: SampleVideo,
  { from, to }: CustomRange,
): { impressions: number; clicks: number; ctr: number | null; historyPartial?: PartialWindow } {
  const days = from <= to ? daysOf({ from, to }) : []
  const reach = { impressions: 0, clicks: 0 }
  for (const day of days) {
    const videoReach = videoReachOf(video, day)
    reach.impressions += videoReach?.impressions ?? 0
    reach.clicks += videoReach?.clicks ?? 0
  }
  const held = days.filter((day) => day >= historyStartDay && day <= lastProcessedDay).length
  return {
    ...reach,
    ctr: ctrOf(reach),
    ...(days.length > 0 && from < historyStartDay
      ? { historyPartial: { days: held, of: days.length } }
      : {}),
  }
}

/** A list row with its impressions, CTR and "N of M days" over its counted days. */
function withRowReach(row: VideoRow, video: SampleVideo, counted: CustomRange): VideoRow {
  const { clicks: _, ...reach } = countedReachOf(video, counted)
  return { ...row, ...reach }
}

function summaryOf(query: URLSearchParams, history: boolean): ChannelSummaryAnswer | null {
  const chosen = windowOf(query)
  const format = formatOf(query)
  if (!chosen || !format) return null
  const videos = sampleVideos.filter((video) => ofFormat(video, format))
  const daily: ChannelDay[] = daysOf(chosen.range).map((day) => {
    const rows = videos.flatMap((video) => videoDayOf(video, day) ?? [])
    const sum = (key: keyof (typeof rows)[number]) => rows.reduce((all, row) => all + row[key], 0)
    const noFormat = format === 'all' ? noFormatRevenueOn(day) : 0
    return {
      day,
      engagedViews: sum('engagedViews'),
      views: sum('views'),
      estimatedMinutesWatched: sum('estimatedMinutesWatched'),
      estimatedRevenue: cents(sum('estimatedRevenue') + noFormat),
      estimatedAdRevenue: cents(sum('estimatedAdRevenue')),
      estimatedRedPartnerRevenue: cents(sum('estimatedRedPartnerRevenue')),
    }
  })
  const total = (key: 'engagedViews' | 'views' | 'estimatedMinutesWatched') =>
    daily.reduce((all, day) => all + day[key], 0)
  const revenue = (key: 'estimatedRevenue' | 'estimatedAdRevenue' | 'estimatedRedPartnerRevenue') =>
    cents(daily.reduce((all, day) => all + (day[key] ?? 0), 0))
  const noFormatRevenue = cents(
    daysOf(chosen.range).reduce((all, day) => all + noFormatRevenueOn(day), 0),
  )
  const everyFormatRevenue = cents(
    daysOf(chosen.range).reduce(
      (all, day) =>
        all +
        noFormatRevenueOn(day) +
        sampleVideos.reduce(
          (sum, video) => sum + (videoDayOf(video, day)?.estimatedRevenue ?? 0),
          0,
        ),
      0,
    ),
  )
  const answer: ChannelSummaryAnswer = {
    window: chosen.window,
    format,
    engagedViews: total('engagedViews'),
    views: total('views'),
    estimatedMinutesWatched: total('estimatedMinutesWatched'),
    revenue: {
      currency: 'USD',
      estimatedRevenue: revenue('estimatedRevenue'),
      estimatedAdRevenue: revenue('estimatedAdRevenue'),
      estimatedRedPartnerRevenue: revenue('estimatedRedPartnerRevenue'),
      noFormatRevenue,
      everyFormatRevenue,
    },
    daily,
    uploads: summaryUploadsOf(chosen.range, format),
    ...rangeBounds,
    ...freshness,
  }
  return history ? withHistory(answer, videos) : answer
}

function thumbnailPathOf(video: SampleVideo): string {
  return `/sample/thumbnails/${video.id}.svg`
}

/**
 * One upload's row over `days`, its own days of the window in order. In a window after publish of
 * `afterPublishDays`, the row carries no average view percentage, which is never added up, and
 * carries its engaged views by day, and the days it has when it has fewer than the window's. The
 * Studio extension's store screenshots build their rows here too (creator-analytics#100).
 */
export function videoRowOf(
  video: SampleVideo,
  days: SampleDay[],
  {
    thumbnailUrl,
    lastProcessedDay: lastDay,
    afterPublishDays,
  }: { thumbnailUrl: string; lastProcessedDay: string; afterPublishDays?: number },
): VideoRow {
  const sum = (key: keyof SampleDay) => days.reduce((all, day) => all + day[key], 0)
  const views = sum('views')
  const minutes = sum('estimatedMinutesWatched')
  return {
    id: video.id,
    title: video.title,
    thumbnailUrl,
    thumbnails: [{ url: thumbnailUrl, width: 320 }],
    durationSeconds: video.durationSeconds,
    publishedAt: video.publishedAt,
    scheduled: false,
    privacy: 'public',
    format: video.format,
    engagedViews: sum('engagedViews'),
    views,
    ...(afterPublishDays === undefined
      ? {
          averageViewPercentage:
            views === 0
              ? 0
              : Math.round(((minutes * 60) / (views * video.durationSeconds)) * 1000) / 10,
        }
      : {}),
    subscribersGained: sum('subscribersGained'),
    estimatedMinutesWatched: minutes,
    estimatedRevenue: cents(sum('estimatedRevenue')),
    estimatedAdRevenue: cents(sum('estimatedAdRevenue')),
    estimatedRedPartnerRevenue: cents(sum('estimatedRedPartnerRevenue')),
    awaitingProcessing: daysFrom(video.publishDay, lastDay) < 0,
    ...(afterPublishDays !== undefined && days.length < afterPublishDays
      ? { partial: { days: days.length, of: afterPublishDays } }
      : {}),
    ...(afterPublishDays !== undefined && days.length > 0
      ? { engagedViewsByDay: days.map((day) => day.engagedViews) }
      : {}),
  }
}

function rowOf(video: SampleVideo, range: CustomRange): VideoRow {
  const days = daysOf(range).flatMap((day) => videoDayOf(video, day) ?? [])
  return videoRowOf(video, days, { thumbnailUrl: thumbnailPathOf(video), lastProcessedDay })
}

/** One page of `rows`, already in the list's order, as the video list answers it. */
export function videoListAnswerOf(
  rows: VideoRow[],
  {
    window,
    page,
    pageSize,
    bounds,
    fresh,
  }: {
    window: VideoListAnswer['window']
    page: number
    pageSize: number
    bounds: RangeBounds
    fresh: Freshness
  },
): VideoListAnswer {
  return {
    videos: rows.slice((page - 1) * pageSize, page * pageSize),
    window,
    page,
    pageSize,
    pageCount: Math.ceil(rows.length / pageSize),
    revenue: { currency: 'USD', reported: true },
    ...bounds,
    ...fresh,
  }
}

/** A row's value for a sort. RPM is the revenue per 1,000 engaged views, 0 with none. */
function sortValueOf(row: VideoRow, key: VideoSortKey): number | string {
  if (key === 'publishedAt') return row.publishedAt ?? ''
  if (key === 'rpm') {
    return row.engagedViews > 0 ? ((row.estimatedRevenue ?? 0) / row.engagedViews) * 1000 : 0
  }
  if (key === 'otherSources') {
    return otherSourcesOf({
      estimatedRevenue: row.estimatedRevenue ?? 0,
      estimatedAdRevenue: row.estimatedAdRevenue ?? 0,
      estimatedRedPartnerRevenue: row.estimatedRedPartnerRevenue ?? 0,
    })
  }
  return row[key] ?? 0
}

/**
 * A window after publish, which the list answers from each video's own first days: the launch
 * chart's (creator-analytics#371), and the publish day, `first1`, whose answer also carries the
 * publish day top (creator-analytics#469).
 */
function windowAfterPublishOf(query: URLSearchParams): WindowAfterPublish | null {
  const window = query.get('window')
  return windowsAfterPublish.find((each) => each === window) ?? null
}

/**
 * The publish day top as the API answers it: the up to `publishDayTopSize` listed videos with the
 * most engaged views on their publish day, most first, ties newest first, leaving out a video with
 * no processed day.
 */
function publishDayTopOf(rows: VideoRow[]): PublishDayVideo[] {
  return rows
    .flatMap((row) => {
      const engagedViews = row.engagedViewsByDay?.[0]
      return engagedViews === undefined
        ? []
        : [{ id: row.id, title: row.title, publishedAt: row.publishedAt, engagedViews }]
    })
    .sort(
      (a, b) =>
        b.engagedViews - a.engagedViews ||
        (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '') ||
        a.id.localeCompare(b.id),
    )
    .slice(0, publishDayTopSize)
}

/** One upload's row over its first `of` days after publish, or as many as it has. */
function rowAfterPublishOf(video: SampleVideo, of: number): VideoRow {
  return videoRowOf(video, video.days.slice(0, of), {
    thumbnailUrl: thumbnailPathOf(video),
    lastProcessedDay,
    afterPublishDays: of,
  })
}

/**
 * The days a row's history numbers count: its whole window after publish, or the calendar window's
 * days from the later of its first day and the publish day, as the API counts them.
 */
function countedDaysOf(
  video: SampleVideo,
  window: { afterPublish: WindowAfterPublish } | { range: CustomRange },
): CustomRange {
  if ('afterPublish' in window) {
    const days = videoWindowDays[window.afterPublish]
    return { from: video.publishDay, to: addDays(video.publishDay, days - 1) }
  }
  const { from, to } = window.range
  return { from: from > video.publishDay ? from : video.publishDay, to }
}

function videoListOf(query: URLSearchParams, history: boolean): VideoListAnswer | null {
  const afterPublish = windowAfterPublishOf(query)
  const chosen = afterPublish ? null : windowOf(query)
  const window = afterPublish ?? chosen?.window
  const baseRowFor = afterPublish
    ? (video: SampleVideo) => rowAfterPublishOf(video, videoWindowDays[afterPublish])
    : chosen && ((video: SampleVideo) => rowOf(video, chosen.range))
  const countedWindow = afterPublish ? { afterPublish } : chosen && { range: chosen.range }
  const rowFor =
    baseRowFor &&
    countedWindow &&
    (history
      ? (video: SampleVideo) =>
          withRowReach(baseRowFor(video), video, countedDaysOf(video, countedWindow))
      : baseRowFor)
  const format = formatOf(query)
  const sort = query.get('sort') ?? '-publishedAt'
  const descending = sort.startsWith('-')
  const key = videoSortKeys.find((each) => each === sort.replace(/^-/, ''))
  if (!window || !rowFor || !format || !key) return null
  const ids = query.get('ids')?.split(',')
  const listed = sampleVideos.filter((video) =>
    ids ? ids.includes(video.id) : ofFormat(video, format),
  )
  const rows = listed.map(rowFor).sort((a, b) => {
    // An RPM sort puts zero engaged views last in either direction, as the API does.
    const noRpm = (row: VideoRow) => Number(key === 'rpm' && !(row.engagedViews > 0))
    if (noRpm(a) !== noRpm(b)) return noRpm(a) - noRpm(b)
    const [left, right] = [sortValueOf(a, key), sortValueOf(b, key)]
    const order = left < right ? -1 : left > right ? 1 : 0
    if (order !== 0) return descending ? -order : order
    // Ties run newest first, then by id, as the API orders them.
    return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '') || a.id.localeCompare(b.id)
  })
  const answer = videoListAnswerOf(rows, {
    window,
    page: Number(query.get('page') ?? 1),
    pageSize: Math.min(50, Number(query.get('pageSize') ?? 50)),
    bounds: rangeBounds,
    fresh: freshness,
  })
  const withHistory = history ? { ...answer, history: historyEnds } : answer
  return afterPublish === 'first1'
    ? { ...withHistory, publishDayTop: publishDayTopOf(rows) }
    : withHistory
}

/** A plain thumbnail: a warm backdrop and a plate, coloured from the video's id. */
export function thumbnailOf(id: string): string {
  const seed = [...id].reduce((all, char) => all * 31 + char.charCodeAt(0), 7) >>> 0
  const hue = 18 + (seed % 34)
  const accent = (hue + 150 + (seed % 60)) % 360
  const x = 120 + (seed % 80)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${hue} 55% 62%)"/><stop offset="1" stop-color="hsl(${hue + 12} 48% 38%)"/>
</linearGradient></defs>
<rect width="320" height="180" fill="url(#g)"/>
<circle cx="${x}" cy="96" r="62" fill="hsl(40 30% 94%)"/>
<circle cx="${x}" cy="96" r="44" fill="hsl(${accent} 42% 52%)"/>
<circle cx="${x + 18}" cy="82" r="14" fill="hsl(${(accent + 40) % 360} 50% 66%)"/>
<rect x="${x + 86}" y="38" width="10" height="110" rx="5" fill="hsl(40 20% 88%)"/>
</svg>`
}

// Made up, as every number of the sample is: where a small English-language cooking channel's
// viewers are, what they watch on, and where they find a video. Largest first, so each list is in
// the API's order. The smallest rows carry the longest names YouTube answers, so the browser walk
// sees whether a name wraps past its one-line place (creator-analytics#511): the longest region
// name Intl.DisplayNames gives in English, the longest names in us-states.ts, a city as Google's
// geo targets name it, and the longest traffic source name in traffic-sources.ts. The countries
// stay at 10 rows, so no "Other countries" bar shows.
const countryShares: [string, number][] = [
  ['US', 0.41],
  ['GB', 0.13],
  ['CA', 0.09],
  ['AU', 0.07],
  ['DE', 0.04],
  ['IN', 0.035],
  ['NL', 0.025],
  ['GS', 0.02],
  ['IO', 0.015],
  ['ZZ', 0.005],
]
const usStateShares: [string, number][] = [
  ['US-CA', 0.06],
  ['US-TX', 0.04],
  ['US-NY', 0.035],
  ['US-FL', 0.03],
  ['US-WA', 0.02],
  ['US-UM', 0.015],
  ['US-MP', 0.012],
]
const cityShares: [string, number][] = [
  ['London', 0.03],
  ['Los Angeles', 0.018],
  ['Toronto', 0.016],
  ['New York', 0.014],
  ['Sydney', 0.012],
  ['Melbourne', 0.009],
  ['Rancho Santa Margarita', 0.006],
]
const deviceShares: [string, number][] = [
  ['MOBILE', 0.57],
  ['DESKTOP', 0.21],
  ['TV', 0.15],
  ['TABLET', 0.07],
]
const operatingSystemShares: [string, number][] = [
  ['ANDROID', 0.33],
  ['IOS', 0.29],
  ['WINDOWS', 0.16],
  ['MACINTOSH', 0.09],
  ['SMART_TV', 0.08],
]
const trafficShares: Record<SampleVideo['format'], [string, number][]> = {
  video: [
    ['YT_SEARCH', 0.34],
    ['RELATED_VIDEO', 0.27],
    ['SUBSCRIBER', 0.16],
    ['EXT_URL', 0.08],
    ['PLAYLIST', 0.06],
    ['NO_LINK_OTHER', 0.04],
  ],
  short: [
    ['SHORTS', 0.81],
    ['YT_CHANNEL', 0.08],
    ['YT_SEARCH', 0.06],
    ['SUBSCRIBER', 0.03],
  ],
  live: [['SUBSCRIBER', 1]],
}
const subscribedShare = 0.24

/** A share of `engagedViews` and of `views`, each rounded to a whole number. */
function shareOf(
  { engagedViews, views }: { engagedViews: number; views: number },
  share: number,
): { engagedViews: number; views: number } {
  return { engagedViews: Math.round(engagedViews * share), views: Math.round(views * share) }
}

function subscriberSplitOf(numbers: { engagedViews: number; views: number }) {
  return {
    subscribed: shareOf(numbers, subscribedShare),
    unsubscribed: shareOf(numbers, 1 - subscribedShare),
  }
}

/** The engaged views and views of `videos` over `days`. */
function reachOf(videos: SampleVideo[], days: string[]): { engagedViews: number; views: number } {
  const total = (key: 'engagedViews' | 'views') =>
    days.reduce(
      (all, day) =>
        all + videos.reduce((sum, video) => sum + (videoDayOf(video, day)?.[key] ?? 0), 0),
      0,
    )
  return { engagedViews: total('engagedViews'), views: total('views') }
}

/** The Audience answer: every breakdown a share of the window's engaged views and views. */
function audienceOf(query: URLSearchParams): AudienceAnswer | null {
  const chosen = windowOf(query)
  const format = formatOf(query)
  if (!chosen || chosen.window === 'lifetime' || !format) return null
  const days = daysOf(chosen.range)
  const reach = reachOf(
    sampleVideos.filter((video) => ofFormat(video, format)),
    days,
  )
  // The US states and cities are read for every format, as the API reads them.
  const everyFormat = reachOf(sampleVideos, days)
  return {
    window: chosen.window,
    format,
    countries: countryShares.map(([code, share]) => ({ code, ...shareOf(reach, share) })),
    usStates: usStateShares.map(([code, share]) => ({ code, ...shareOf(everyFormat, share) })),
    cities: cityShares.map(([name, share]) => ({ name, ...shareOf(everyFormat, share) })),
    ageGroups: [
      { ageGroup: 'age18-24', viewerPercentage: 14.2 },
      { ageGroup: 'age25-34', viewerPercentage: 33.8 },
      { ageGroup: 'age35-44', viewerPercentage: 26.1 },
      { ageGroup: 'age45-54', viewerPercentage: 14.9 },
      { ageGroup: 'age55-64', viewerPercentage: 7.6 },
      { ageGroup: 'age65-', viewerPercentage: 3.4 },
    ],
    genders: [
      { gender: 'female', viewerPercentage: 54.3 },
      { gender: 'male', viewerPercentage: 45.1 },
      { gender: 'user_specified', viewerPercentage: 0.6 },
    ],
    devices: deviceShares.map(([deviceType, share]) => ({ deviceType, ...shareOf(reach, share) })),
    operatingSystems: operatingSystemShares.map(([operatingSystem, share]) => ({
      operatingSystem,
      ...shareOf(reach, share),
    })),
    subscriberSplit: subscriberSplitOf(reach),
    ...rangeBounds,
    ...freshness,
  }
}

/** A retention curve of a hundred points: a drop over the opening, then a slow decline. */
function retentionOf(video: SampleVideo): AudienceRetentionPoint[] {
  const short = video.format === 'short'
  const rounded = (value: number) => Math.round(value * 1000) / 1000
  return Array.from({ length: 100 }, (_, index) => {
    const ratio = (index + 1) / 100
    const watch = short
      ? 0.95 * Math.exp(-0.25 * ratio) + 0.1 * Math.exp(-ratio * 30)
      : 0.42 + 0.5 * Math.exp(-ratio * 9) - 0.12 * ratio
    return {
      elapsedVideoTimeRatio: ratio,
      audienceWatchRatio: rounded(watch),
      relativeRetentionPerformance: rounded(0.56 + 0.06 * Math.sin(ratio * Math.PI * 3)),
    }
  })
}

/**
 * The stored retention curves read (creator-analytics#951): each listed sample video's curve, as
 * `retentionOf` draws it on the video's page, without Google's relative retention performance
 * (ADR 0004), read at the sample's fetch time, and 3 uploads left to read, so the backfill note
 * shows (creator-analytics#1044). An id of no sample video answers null, as the API refuses a video
 * the channel does not hold.
 */
function retentionCurvesOf(query: URLSearchParams): RetentionCurvesAnswer | null {
  const ids = query.get('ids')?.split(',') ?? []
  const videos = ids.map((id) => sampleVideos.find((video) => video.id === id))
  if (videos.some((video) => video === undefined)) return null
  return {
    curves: videos.flatMap((video) =>
      video
        ? [
            {
              video: {
                id: video.id,
                title: video.title,
                durationSeconds: video.durationSeconds,
                publishedAt: video.publishedAt,
              },
              readAt: fetchedAt,
              points: retentionOf(video).map(({ elapsedVideoTimeRatio, audienceWatchRatio }) => ({
                elapsedVideoTimeRatio,
                audienceWatchRatio,
              })),
            },
          ]
        : [],
    ),
    unread: 3,
  }
}

/** The video's stages since publish, each the sum of its own days, then lifetime. */
function sincePublishOf(video: SampleVideo): SincePublish {
  const stageOf = (days: SampleDay[]) => {
    const sum = (key: keyof SampleDay) => days.reduce((all, day) => all + day[key], 0)
    return {
      engagedViews: sum('engagedViews'),
      views: sum('views'),
      estimatedMinutesWatched: sum('estimatedMinutesWatched'),
      estimatedRevenue: cents(sum('estimatedRevenue')),
    }
  }
  const rows: SincePublishRow[] = windowsAfterPublish.map((stage) => {
    const of = videoWindowDays[stage]
    const days = video.days.slice(0, of)
    return {
      stage,
      ...stageOf(days),
      ...(days.length < of ? { partial: { days: days.length, of } } : {}),
    }
  })
  rows.push({ stage: 'lifetime', ...stageOf(video.days) })
  return { rows, revenueCurrency: 'USD', daysSincePublish: video.days.length }
}

/**
 * One video's detail over a calendar window or lifetime, counted from the later of the window's
 * first day and the publish day, with its revenue in USD, as the video list answers it.
 */
/**
 * The detail's traffic sources, and with the history each one's impressions and CTR, the video's
 * own split over its sources by the same shares as its engaged views, and the history of the
 * video's range.
 */
function trafficOf(
  video: SampleVideo,
  row: VideoRow,
  counted: CustomRange,
  history: boolean,
): Pick<VideoDetailAnswer, 'trafficSources' | 'history'> {
  const shares = trafficShares[video.format]
  if (!history) {
    return { trafficSources: shares.map(([type, share]) => ({ type, ...shareOf(row, share) })) }
  }
  const { historyPartial, ...reach } = countedReachOf(video, counted)
  return {
    trafficSources: shares.map(([type, share]) => {
      const part = {
        impressions: Math.round(reach.impressions * share),
        clicks: Math.round(reach.clicks * share),
      }
      return { type, ...shareOf(row, share), impressions: part.impressions, ctr: ctrOf(part) }
    }),
    history: {
      impressions: reach.impressions,
      ctr: reach.ctr,
      ...historyEnds,
      ...(historyPartial ? { partial: historyPartial } : {}),
    },
  }
}

function videoDetailOf(
  video: SampleVideo,
  query: URLSearchParams,
  history: boolean,
): VideoDetailAnswer | null {
  const chosen = windowOf(query)
  if (!chosen) return null
  const from = chosen.range.from > video.publishDay ? chosen.range.from : video.publishDay
  const counted = from <= chosen.range.to ? daysOf({ from, to: chosen.range.to }) : []
  const days: VideoDay[] = counted.map((day) => {
    const numbers = videoDayOf(video, day)
    return {
      day,
      engagedViews: numbers?.engagedViews ?? 0,
      views: numbers?.views ?? 0,
      estimatedMinutesWatched: numbers?.estimatedMinutesWatched ?? 0,
      estimatedRevenue: numbers?.estimatedRevenue ?? 0,
      estimatedAdRevenue: numbers?.estimatedAdRevenue ?? 0,
      estimatedRedPartnerRevenue: numbers?.estimatedRedPartnerRevenue ?? 0,
    }
  })
  const row = rowOf(video, chosen.range)
  const {
    id,
    title,
    thumbnailUrl,
    thumbnails,
    durationSeconds,
    publishedAt,
    scheduled,
    format,
    privacy,
  } = row
  return {
    video: {
      id,
      title,
      thumbnailUrl,
      thumbnails,
      durationSeconds,
      publishedAt,
      scheduled,
      format,
      privacy,
      embeddable: video.embeddable ?? true,
      madeForKids: false,
    },
    window: chosen.window,
    totals: {
      engagedViews: row.engagedViews,
      views: row.views,
      averageViewPercentage: row.averageViewPercentage ?? 0,
      subscribersGained: row.subscribersGained,
      estimatedMinutesWatched: row.estimatedMinutesWatched,
    },
    days,
    audienceRetention: retentionOf(video),
    ...trafficOf(video, row, countedDaysOf(video, { range: chosen.range }), history),
    subscriberSplit: subscriberSplitOf(row),
    revenue: {
      currency: 'USD',
      estimatedRevenue: row.estimatedRevenue ?? 0,
      estimatedAdRevenue: row.estimatedAdRevenue ?? 0,
      estimatedRedPartnerRevenue: row.estimatedRedPartnerRevenue ?? 0,
    },
    sincePublish: sincePublishOf(video),
    awaitingProcessing: row.awaitingProcessing,
    ...rangeBounds,
    ...freshness,
  }
}

/**
 * The payloads the browser walk finds as text on the admin feedback screen (creator-analytics#583):
 * a script in one message's text and an image with an error handler in its reply address, and the
 * reverse in the other. Neither may run, load or break the page's content security policy.
 */
export const scriptPayload = '<script>alert(1)</script>'
export const imagePayload = '<img src=x onerror=alert(1)>@example.com'

/** The admin feedback screen's messages, newest first, for the sample user on the allowlist. */
function sampleFeedbackMessages(): AdminFeedbackMessage[] {
  return [
    {
      id: '11111111-1111-4111-8111-111111111111',
      type: 'something_wrong',
      text: scriptPayload,
      screen: 'audience',
      appVersion: '2026.11.9',
      replyTo: imagePayload,
      createdAt: '2026-11-15T12:05:00.000Z',
      doneAt: null,
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      type: 'idea',
      text: imagePayload,
      screen: 'video_list',
      appVersion: null,
      replyTo: scriptPayload,
      createdAt: '2026-11-14T09:30:00.000Z',
      doneAt: '2026-11-14T10:00:00.000Z',
    },
  ]
}

const doneRoutePattern = /^\/api\/admin\/feedback\/([^/]+)\/done$/

/**
 * The upgrade screen's prices, and its comparisons for the sample's uploads, if it subscribed with the history from
 * 56 days before the last processed day to that day: every sample upload is public, so its
 * uploads of the format whose whole window falls in those days, at most 10, and with fewer than 2
 * the day a second one's window is 4 days back.
 */
function upgradeOf(query: URLSearchParams): UpgradeAnswer {
  const format = videoFormatFilters.find((each) => each === query.get('format')) ?? 'all'
  const historyStart = addDays(lastProcessedDay, -56)
  const comparisons = upgradeWindows.map((window): UpgradeComparison => {
    const ends = sampleVideos
      .filter(
        (video) =>
          (format === 'all' || video.format === format) && video.publishDay >= historyStart,
      )
      .map((video) => addDays(video.publishDay, videoWindowDays[window] - 1))
      .toSorted()
    const count = Math.min(ends.filter((end) => end <= lastProcessedDay).length, 10)
    const second = ends[1]
    return {
      window,
      count,
      availableOn: count < 2 && second ? addDays(second, 4) : null,
    }
  })
  // The prices ADR 0022 sets, as the configured Stripe prices hold them.
  const prices: UpgradeAnswer['prices'] = {
    monthly: { amount: 700, currency: 'usd' },
    annual: { amount: 7000, currency: 'usd' },
  }
  return { historyStart, newestDay: lastProcessedDay, comparisons, prices }
}

/**
 * Which tier the sample channel answers as: `paid`, with its impressions and CTR history, or
 * `free`, with none, on a product that offers Pro and to its owner, so the web app shows the
 * free tier's own numbers, the sidebar's "Upgrade" item and the upgrade screen's pricing cards
 * (creator-analytics#788, creator-analytics#915).
 */
export type StubTier = 'free' | 'paid'

export interface StubApi {
  origin: string
  /** Every request the stub had no answer for, as `METHOD /path?query`. */
  unanswered: string[]
  /** Lists the sample's second channel after the first from now on, or stops listing it. */
  listSecondChannel(listed: boolean): void
  /** Answers as the tier from now on. */
  setTier(tier: StubTier): void
  /**
   * Keeps the sample user signed in from now on, as it starts, or signs it out: while off,
   * GET /api/me answers 401, as the API does for a request with no session.
   */
  signedIn(on: boolean): void
  /** How many times GET /api/me has been asked so far, signed in or not. */
  sessionReads(): number
  close(): Promise<void>
}

function send(response: ServerResponse, status: number, type: string, body: string | Buffer) {
  response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
  response.end(body)
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  send(response, status, 'application/json; charset=utf-8', JSON.stringify(body))
}

async function bodyOf(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

/** Serves a file of the web app's build, or `missing` when the build holds no such file. */
async function serveWebApp(path: string, response: ServerResponse, missing: () => void) {
  const relative = normalize(path.slice('/app/'.length))
  if (relative.startsWith('..')) return missing()
  if (!extname(relative)) {
    return send(
      response,
      200,
      contentTypes['.html'] ?? '',
      await readFile(join(webRoot, 'index.html')),
    )
  }
  let file: Buffer
  try {
    file = await readFile(join(webRoot, relative))
  } catch {
    return missing()
  }
  send(response, 200, contentTypes[extname(relative)] ?? 'application/octet-stream', file)
}

/**
 * Serves a page or a file of the site's build at the path the API answers it at, or `missing` when
 * the build holds none: a file's own path, else a folder's `index.html`, else the path's `.html`
 * page. A page's file path, `/index` and `/404` name no page, as at the API.
 */
async function serveSite(path: string, response: ServerResponse, missing: () => void) {
  if (path.endsWith('.html') || path === '/index' || path === '/404') return missing()
  const relative = normalize(`.${path}`)
  if (relative.startsWith('..')) return missing()
  for (const candidate of [relative, join(relative, 'index.html'), `${relative}.html`]) {
    let file: Buffer
    try {
      file = await readFile(join(siteRoot, candidate))
    } catch {
      continue
    }
    return send(response, 200, contentTypes[extname(candidate)] ?? 'application/octet-stream', file)
  }
  missing()
}

/**
 * Starts the stub on 127.0.0.1, on `port`, or a free one when it is 0. With `history`, the channel
 * summary, the video list and a video's detail answer a paid channel's impressions and CTR
 * history; without it, the free tier's with Pro not offered, which the homepage
 * screenshot shows until the site shows Pro (#790). `setTier` changes it at run time.
 */
export async function startStubApi(
  port = 0,
  { history: paidAtStart = false }: { history?: boolean } = {},
): Promise<StubApi> {
  let history = paidAtStart
  // Pro offered: set only by `setTier('free')`, so the homepage screenshot shows no "Upgrade" item.
  let paidTierOffered = false
  let preferences: Preferences = {}
  let feedbackMessages = sampleFeedbackMessages()
  let secondChannelListed = false
  let sessionOn = true
  let sessionReads = 0
  const unanswered: string[] = []
  const channelPath = `/api/channels/${sampleChannel.id}`

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    const route = `${request.method} ${url.pathname}`
    const missing = () => {
      unanswered.push(`${route}${url.search}`)
      sendJson(response, 404, { error: 'not_found' })
    }
    if (route === 'GET /app') return serveWebApp('/app/', response, missing)
    if (request.method === 'GET' && url.pathname.startsWith('/app/')) {
      return serveWebApp(url.pathname, response, missing)
    }
    if (route === 'GET /favicon.svg')
      return send(response, 200, 'image/svg+xml', await readFile(favicon))
    const thumbnail = /^\/sample\/thumbnails\/([\w-]+)\.svg$/.exec(url.pathname)?.[1]
    if (request.method === 'GET' && thumbnail) {
      return send(response, 200, 'image/svg+xml', thumbnailOf(thumbnail))
    }
    if (route === 'GET /sample/youtube-iframe-api.js') {
      return send(response, 200, contentTypes['.js'] ?? '', await readFile(fakeYouTubeIframeApi))
    }
    if (route === 'GET /api/client-settings') return sendJson(response, 200, clientSettings)
    if (route === 'GET /api/me') {
      sessionReads += 1
      return sessionOn
        ? sendJson(response, 200, sampleUser)
        : sendJson(response, 401, { error: 'unauthenticated' })
    }
    if (route === 'GET /api/channels') {
      const channels = secondChannelListed ? [sampleChannel, sampleSecondChannel] : [sampleChannel]
      return sendJson(response, 200, { channels } satisfies ChannelsAnswer)
    }
    if (route === 'GET /api/me/preferences') return sendJson(response, 200, preferences)
    if (route === 'GET /api/me/support') return sendJson(response, 200, sampleSupport)
    // Every channel the sample user's own and free, with no block. Unless Pro is offered
    // (`setTier('free')`), none to subscribe, as with Pro not configured, so Settings draws as it
    // did before Pro, with no Pro section.
    if (route === 'GET /api/me/entitlements') {
      const listed = secondChannelListed ? [sampleChannel, sampleSecondChannel] : [sampleChannel]
      return sendJson(response, 200, {
        paidTierOffered,
        canSubscribe: paidTierOffered,
        canManage: false,
        canAddBlock: false,
        blocks: 0,
        slotsInUse: 0,
        channels: listed.map(({ id }) => ({
          channelId: id,
          tier: 'free',
          owner: true,
          picked: false,
          purgeDate: null,
          canSubscribe: paidTierOffered,
          canManage: false,
        })),
      } satisfies EntitlementsAnswer)
    }
    if (route === 'PUT /api/me/preferences') {
      preferences = { ...preferences, ...((await bodyOf(request)) as Preferences) }
      return sendJson(response, 200, preferences)
    }
    if (route === 'DELETE /api/me/preferences') {
      preferences = {}
      return sendJson(response, 200, {})
    }
    if (route === 'POST /api/feedback') {
      response.writeHead(201)
      return response.end()
    }
    if (route === 'GET /api/admin/feedback') {
      const open = url.searchParams.get('open') === 'true'
      const messages = feedbackMessages.filter((message) => !open || message.doneAt === null)
      return sendJson(response, 200, { messages, pageCount: 1 } satisfies AdminFeedbackAnswer)
    }
    const doneId = doneRoutePattern.exec(url.pathname)?.[1]
    const doneMessage = feedbackMessages.find((message) => message.id === doneId)
    if ((request.method === 'PUT' || request.method === 'DELETE') && doneMessage) {
      const doneAt =
        request.method === 'PUT' ? (doneMessage.doneAt ?? new Date().toISOString()) : null
      const changed = { ...doneMessage, doneAt }
      feedbackMessages = feedbackMessages.map((each) => (each === doneMessage ? changed : each))
      return sendJson(response, 200, changed)
    }
    if (route === `GET ${channelPath}/summary`) {
      const answer = summaryOf(url.searchParams, history)
      return answer ? sendJson(response, 200, answer) : missing()
    }
    if (route === `GET ${channelPath}/videos`) {
      const answer = videoListOf(url.searchParams, history)
      return answer ? sendJson(response, 200, answer) : missing()
    }
    if (route === `GET ${channelPath}/upgrade` && paidTierOffered) {
      return sendJson(response, 200, upgradeOf(url.searchParams))
    }
    // The free tier is refused, as the API refuses a channel whose history is not readable.
    if (route === `GET ${channelPath}/retention-curves`) {
      if (!history) return sendJson(response, 403, { error: 'sort_without_history' })
      const answer = retentionCurvesOf(url.searchParams)
      return answer ? sendJson(response, 200, answer) : missing()
    }
    if (route === `GET ${channelPath}/audience`) {
      const answer = audienceOf(url.searchParams)
      return answer ? sendJson(response, 200, answer) : missing()
    }
    const detail = sampleVideos.find(
      (video) => url.pathname === `${channelPath}/videos/${encodeURIComponent(video.id)}`,
    )
    if (request.method === 'GET' && detail) {
      const answer = videoDetailOf(detail, url.searchParams, history)
      return answer ? sendJson(response, 200, answer) : missing()
    }
    if (request.method === 'GET' && !url.pathname.startsWith('/api/')) {
      return serveSite(url.pathname, response, missing)
    }
    return missing()
  })

  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))
  const { port: chosen } = server.address() as AddressInfo
  return {
    origin: `http://127.0.0.1:${chosen}`,
    unanswered,
    listSecondChannel: (listed) => {
      secondChannelListed = listed
    },
    setTier: (tier) => {
      history = tier === 'paid'
      paidTierOffered = tier === 'free'
    },
    signedIn: (on) => {
      sessionOn = on
    },
    sessionReads: () => sessionReads,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}
