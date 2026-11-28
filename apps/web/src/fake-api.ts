// Test only: `app.test.ts` renders App against this stand-in for the API. No production file
// imports it.

import { CSPProvider } from '@base-ui/react/csp-provider'
import {
  type AdminFeedbackMessage,
  type AgeGroup,
  type AudienceAnswer,
  type AudienceRetentionPoint,
  type AudienceWindow,
  adminFeedbackPageSize,
  type BlockPreviewAnswer,
  type ChannelSummaryAnswer,
  type City,
  type ClientSettingsAnswer,
  type Country,
  type Device,
  type EntitlementsAnswer,
  type Gender,
  type ListedChannel,
  type MeAnswer,
  type OperatingSystem,
  type Preferences,
  type PublishDayVideo,
  type RangeBounds,
  type RetentionCurvesAnswer,
  type SponsorReportAnswer,
  type SponsorReportFigure,
  type StoredRetentionCurve,
  type SubscriberSplit,
  type SummaryWindow,
  type SupportAnswer,
  sponsorFigures,
  sponsorHistoryFigures,
  type UpgradeAnswer,
  type UsState,
  type VideoDetailAnswer,
  type VideoFormatFilter,
  type VideoListAnswer,
  type VideoRow,
  type VideoWindow,
  videoFormatFilters,
  videoWindows,
  windowsAfterPublish,
} from '@creator-analytics/api-types'
import { act, createElement, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { vi } from 'vitest'
import { App } from './App.tsx'
import { readClientSettings } from './client-settings.ts'
import { boundsOf } from './custom-range.ts'

export const fakeChannel: ListedChannel = {
  id: 'c-1',
  youtubeChannelId: 'UC1234567890',
  title: 'Nick Vogel',
  handle: '@nick_vogel',
  revenueConsentedAt: null,
}

export const fakeVideo: VideoRow = {
  id: 'video-1',
  title: 'A video',
  thumbnailUrl: null,
  thumbnails: [],
  durationSeconds: 754,
  publishedAt: '2026-10-01T16:00:00.000Z',
  scheduled: false,
  privacy: 'public',
  format: 'video',
  engagedViews: 1200,
  views: 1500,
  averageViewPercentage: 42.5,
  subscribersGained: 7,
  estimatedMinutesWatched: 738,
  awaitingProcessing: false,
}

// The name starts with another letter than the email, so a test can tell which field the avatar
// letter comes from. The account is created after every fixture release (apps/web/test/fixtures/),
// so a test sees no "What's new" banner unless it sets an earlier creation.
const me: MeAnswer = {
  email: 'nick@example.com',
  name: 'Ada',
  createdAt: '2026-11-10T12:00:00.000Z',
}

/** The nine figures over a window, each from `n`. */
function sponsorNumbersOf(n: number): SponsorReportAnswer['windows'][number]['numbers'] {
  return {
    views: n,
    engagedViews: n - 300,
    estimatedMinutesWatched: n / 2,
    averageViewDuration: 184,
    averageViewPercentage: 42.5,
    likes: n / 20,
    comments: n / 100,
    shares: n / 300,
    subscribersGained: n / 150,
  }
}

/**
 * The sponsor report every video's report answers: `fakeVideo`, published on 2026-10-01, with the
 * last processed day 2026-10-10, so its first 7 days are whole and its first 14 and 30 hold 10.
 */
export const fakeSponsorReport: SponsorReportAnswer = {
  video: {
    id: fakeVideo.id,
    title: fakeVideo.title,
    thumbnailUrl: fakeVideo.thumbnailUrl,
    thumbnails: fakeVideo.thumbnails,
    publishedAt: fakeVideo.publishedAt,
    scheduled: fakeVideo.scheduled,
  },
  figures: [...sponsorFigures],
  windows: [
    { days: 7, numbers: sponsorNumbersOf(1500) },
    { days: 14, numbers: sponsorNumbersOf(2100), partial: { days: 10, of: 14 } },
    { days: 30, numbers: sponsorNumbersOf(2400), partial: { days: 10, of: 30 } },
  ],
  lastProcessedDay: '2026-10-10',
  awaitingProcessing: false,
  fetchedAt: '2026-10-13T09:00:00.000Z',
  fromCache: false,
}

const freshness = {
  lastProcessedDay: '2026-10-04',
  creationDay: '2019-02-28',
  fetchedAt: '2026-10-07T09:00:00.000Z',
  fromCache: false,
}

/** The bounds the fake's answers give its one channel: its creation day and last processed day. */
export const fakeBounds: RangeBounds = boundsOf(freshness)

function windowOf<W extends VideoWindow>(
  query: URLSearchParams,
  windows: readonly W[],
): W | 'last28' {
  const window = query.get('window')
  return windows.find((each) => each === window) ?? 'last28'
}

const summaryWindows = videoWindows.filter(
  (window): window is SummaryWindow => !windowsAfterPublish.some((each) => each === window),
)

function summaryOf(
  {
    summaryRevenue,
    summaryDays,
    summaryUploads,
    summaryHistory,
    fromCache,
  }: Pick<
    FakeApi,
    'summaryRevenue' | 'summaryDays' | 'summaryUploads' | 'summaryHistory' | 'fromCache'
  >,
  query: URLSearchParams,
): ChannelSummaryAnswer {
  return {
    window: windowOf(query, summaryWindows),
    format: 'all',
    engagedViews: 1200,
    views: 1500,
    estimatedMinutesWatched: 738,
    revenue: summaryRevenue,
    daily: summaryDays,
    uploads: summaryUploads,
    ...(summaryHistory ? { history: summaryHistory } : {}),
    ...freshness,
    fromCache,
  }
}

const audienceWindows = summaryWindows.filter(
  (window): window is AudienceWindow => window !== 'lifetime',
)

function audienceOf(
  {
    countries,
    usStates,
    cities,
    ageGroups,
    genders,
    devices,
    operatingSystems,
    subscriberSplit,
    fromCache,
  }: FakeApi,
  query: URLSearchParams,
): AudienceAnswer {
  const format = videoFormatFilters.find((each) => each === query.get('format'))
  return {
    window: windowOf(query, audienceWindows),
    format: format ?? ('all' satisfies VideoFormatFilter),
    countries,
    usStates,
    cities,
    ageGroups,
    genders,
    devices,
    operatingSystems,
    subscriberSplit,
    ...freshness,
    fromCache,
  }
}

function videoListOf(
  {
    videos,
    pageCount,
    listRevenue,
    publishDayTop,
    listHistory,
    newestHistoryAverage,
    fromCache,
  }: FakeApi,
  query: URLSearchParams,
): VideoListAnswer {
  const listWindow = windowOf(query, videoWindows)
  const isAfterPublish = windowsAfterPublish.some((each) => each === listWindow)
  return {
    videos,
    window: listWindow,
    page: Number(query.get('page') ?? 1),
    pageSize: 10,
    pageCount,
    revenue: listRevenue,
    ...(isAfterPublish ? { publishDayTop } : {}),
    ...(listHistory ? { history: listHistory } : {}),
    ...(listHistory && isAfterPublish && newestHistoryAverage ? { newestHistoryAverage } : {}),
    ...freshness,
    fromCache,
  }
}

function videoDetailOf(
  video: VideoRow,
  {
    days,
    retention,
    detailRevenue,
    playability,
    trafficSources,
    detailHistory,
    fromCache,
  }: Pick<
    FakeApi,
    | 'days'
    | 'retention'
    | 'detailRevenue'
    | 'playability'
    | 'trafficSources'
    | 'detailHistory'
    | 'fromCache'
  >,
  query: URLSearchParams,
): VideoDetailAnswer {
  const detailWindow = windowOf(query, videoWindows)
  const isAfterPublish = windowsAfterPublish.some((each) => each === detailWindow)
  // The API answers the newest average in a window after publish only.
  const history = detailHistory && (isAfterPublish ? detailHistory : withoutAverage(detailHistory))
  const {
    id,
    title,
    thumbnailUrl,
    thumbnails,
    publishedAt,
    scheduled,
    durationSeconds,
    format,
    privacy,
  } = video
  return {
    video: {
      id,
      title,
      thumbnailUrl,
      thumbnails,
      publishedAt,
      scheduled,
      durationSeconds,
      format,
      privacy,
      embeddable: playability[id]?.embeddable ?? true,
      madeForKids: playability[id]?.madeForKids ?? false,
    },
    window: detailWindow,
    totals: {
      engagedViews: 1200,
      views: 1500,
      averageViewPercentage: 42.5,
      subscribersGained: 7,
      estimatedMinutesWatched: 738,
    },
    days,
    audienceRetention: retention,
    trafficSources,
    subscriberSplit: {
      subscribed: { engagedViews: 300, views: 400 },
      unsubscribed: { engagedViews: 900, views: 1100 },
    },
    sincePublish: { rows: [] },
    awaitingProcessing: video.awaitingProcessing,
    ...(detailRevenue ? { revenue: detailRevenue } : {}),
    ...(history ? { history } : {}),
    ...freshness,
    fromCache,
  }
}

/** A video's history without its newest average, as a calendar window answers it. */
function withoutAverage({
  newestAverage: _,
  ...history
}: NonNullable<VideoDetailAnswer['history']>): VideoDetailAnswer['history'] {
  return history
}

/**
 * The curves read's answer: each listed id's stored curve, or a video of the list not read yet,
 * and the count still to read. An id of no video in `videos` or `retentionCurves` is refused, as
 * the API refuses a video the channel does not hold.
 */
function retentionCurvesOf(
  { retentionCurves, retentionUnread, retentionRefusal, videos }: FakeApi,
  query: URLSearchParams,
): Answer {
  if (retentionRefusal) return { status: 403, body: retentionRefusal }
  const ids = query.get('ids')?.split(',') ?? []
  const curves = ids.map((id): StoredRetentionCurve | undefined => {
    const stored = retentionCurves.find(({ video }) => video.id === id)
    if (stored) return stored
    const listed = videos.find((video) => video.id === id)
    return (
      listed && {
        video: {
          id,
          title: listed.title,
          durationSeconds: listed.durationSeconds,
          publishedAt: listed.publishedAt,
        },
        readAt: null,
        points: [],
      }
    )
  })
  if (curves.some((curve) => curve === undefined)) {
    return { status: 404, body: { refusal: 'video_not_found' } }
  }
  return {
    status: 200,
    body: {
      curves: curves.filter((curve) => curve !== undefined),
      unread: retentionUnread,
    } satisfies RetentionCurvesAnswer,
  }
}

/** A request the app made: its method, path, query string and JSON body, if any. */
export interface FakeRequest {
  method: string
  path: string
  query: URLSearchParams
  body: unknown
}

/**
 * How a request fails: the API answers 500, or the answer given, such as a 429 with its error, or
 * the connection drops and `fetch` rejects.
 */
export type Failure = 'status' | 'network' | { status: number; body: unknown }

/** A request held until the test lets it through or fails it. */
export interface Held {
  release(): void
  fail(how?: Failure): void
}

export interface FakeApi {
  /** The signed-in account `GET /api/me` answers: created 2026-11-10 unless set. */
  me: MeAnswer
  /** The preferences the server holds, which a save changes and a reset clears. */
  preferences: Preferences
  /**
   * The channels `GET /api/channels` answers: `fakeChannel` alone unless set. A disconnect removes
   * the channel, as the server does.
   */
  channels: ListedChannel[]
  /** The channel's videos, on one page, each with its detail: `fakeVideo` unless set. */
  videos: VideoRow[]
  /** How many pages the list answers it has, each listing `videos`: 1 unless set. */
  pageCount: number
  /** The days every video's detail answers in every window: two unless set. */
  days: VideoDetailAnswer['days']
  /** The retention points every video's detail answers: none unless set, so no chart draws. */
  retention: AudienceRetentionPoint[]
  /**
   * Whether a video's detail answers it embeddable and made for kids, by video id: embeddable and
   * not made for kids unless set.
   */
  playability: Record<string, { embeddable?: boolean; madeForKids?: boolean }>
  /**
   * The revenue every video's detail answers, or why it carries none: absent unless set, so the
   * detail shows no revenue card and no revenue chart. Set `days` with the revenue fields along
   * with it, as the API puts them on every day exactly when the revenue answered.
   */
  detailRevenue?: VideoDetailAnswer['revenue']
  /**
   * The channel summary's revenue, or why it carries none: `consent_missing` unless set, as
   * `fakeChannel` has no revenue consent. Set `channels` to a channel with consent, and
   * `summaryDays` with the revenue fields, along with a revenue, as the API answers.
   */
  summaryRevenue: ChannelSummaryAnswer['revenue']
  /** The days the channel summary answers in every window: none unless set, so no chart draws. */
  summaryDays: ChannelSummaryAnswer['daily']
  /** The uploads the channel summary answers in every window: none unless set, so no marker draws. */
  summaryUploads: ChannelSummaryAnswer['uploads']
  /**
   * A paid channel's stored history, which the channel summary answers in every window: absent
   * unless set, as for a free channel; with `purgeDate`, an ended channel's. Set `summaryDays` with
   * the history fields on the days it holds along with it, as the API answers.
   */
  summaryHistory?: ChannelSummaryAnswer['history']
  /**
   * A paid channel's history ends, which the list answers in every window: absent unless set, as
   * for a free channel. Set `videos` with the history fields on every row along with it, as the
   * API answers.
   */
  listHistory?: VideoListAnswer['history']
  /**
   * The newest uploads' average impressions and CTR, which the list answers with `listHistory` in
   * a window after publish only, as the API does: absent unless set.
   */
  newestHistoryAverage?: VideoListAnswer['newestHistoryAverage']
  /**
   * The stored retention curves the curves read answers, by video: none unless set, so a picked
   * video of `videos` answers as not read yet.
   */
  retentionCurves: StoredRetentionCurve[]
  /** The published uploads the curves read counts as never read: 0 unless set. */
  retentionUnread: number
  /**
   * The refusal the curves read answers with a 403, such as a free channel's
   * `sort_without_history`, and with it the video list read with `withRetentionCurve` answers
   * `filter_without_history`: none unless set, a paid channel's answer.
   */
  retentionRefusal?: { error: 'sort_without_history' }
  /**
   * The sponsor report every video in `videos` answers: `fakeSponsorReport` unless set, narrowed
   * to `sponsorChoice` when one is stored.
   */
  sponsorReport: SponsorReportAnswer
  /**
   * The channel's stored sponsor report figures, which a PUT of the choice sets: none unless set.
   * The report then answers only them, impressions and CTR only when `sponsorReport.history` is
   * set, as the API does.
   */
  sponsorChoice?: SponsorReportFigure[]
  /** The traffic sources every video's detail answers in every window: none unless set. */
  trafficSources: VideoDetailAnswer['trafficSources']
  /**
   * A paid channel's history every video's detail answers, its newest average in a window after
   * publish only, as the API does: absent unless set, as for a free channel. Set
   * `trafficSources` with the history fields along with it.
   */
  detailHistory?: VideoDetailAnswer['history']
  /**
   * The list's revenue, or why it carries none: `consent_missing` unless set, as `fakeChannel` has
   * no revenue consent. Set `channels` to a channel with consent along with a revenue, as the API
   * answers.
   */
  listRevenue: VideoListAnswer['revenue']
  /**
   * The publish day top the list answers in a window after publish, as the API does, and in no
   * other window: none unless set. A video here has no detail unless it is in `videos` too.
   */
  publishDayTop: PublishDayVideo[]
  /** The countries the Audience answer holds in every window and format: three unless set. */
  countries: Country[]
  /** The US states the Audience answer holds in every window and format: three unless set. */
  usStates: UsState[]
  /** The cities the Audience answer holds in every window and format: three unless set. */
  cities: City[]
  /** The age groups the Audience answer holds in every window and format: three unless set. */
  ageGroups: AgeGroup[]
  /** The genders the Audience answer holds in every window and format: three unless set. */
  genders: Gender[]
  /** The devices the Audience answer holds in every window and format: three unless set. */
  devices: Device[]
  /**
   * The operating systems the Audience answer holds in every window and format: three unless set.
   */
  operatingSystems: OperatingSystem[]
  /** The subscriber split the Audience answer holds in every window and format: one unless set. */
  subscriberSplit: SubscriberSplit | null
  /**
   * The support answer: no link and no prompt unless set, as with Stripe not configured. Its
   * prompt is off while `preferences` hold a dismissal, as the server answers.
   */
  support: SupportAnswer
  /**
   * The entitlements answer: Pro not offered, no blocks, each channel the creator's own and free,
   * and nothing they may subscribe or manage, unless set, as with Pro not configured. The user's
   * Checkout, `POST /api/me/checkout`, answers `fakeCheckoutUrl`, and their Customer Portal,
   * `POST /api/me/portal`, `fakePortalUrl`. A pick, `PUT /api/channels/:channelId/pro-pick`, makes
   * an owned channel paid and picked while a slot is free and answers 409 `no_free_slot` while
   * none is; an unpick, `DELETE`, makes it free and unpicked with `fakePurgeDate`. Both answer the
   * changed entitlements. The block preview, `GET /api/me/block-preview`, answers
   * `fakeBlockPreviewOf` one block more while `canAddBlock`, and 409 `not_subscribed` otherwise;
   * an add, `POST /api/me/blocks`, of one block more raises `blocks` and answers it, and of any
   * other count answers 409 `blocks_changed`.
   */
  entitlements: EntitlementsAnswer
  /**
   * What the channel's upgrade route answers: the comparisons a subscription today would have.
   * Unset, the route answers 404, as with Pro not configured.
   */
  upgrade?: UpgradeAnswer
  /**
   * The client settings, public as the API answers them: production's, with a version, its
   * release page, a commit and an OpenPanel client ID, unless set.
   */
  clientSettings: ClientSettingsAnswer
  /**
   * The feedback messages the admin routes answer, newest first, for a creator on the allowlist:
   * unset, every admin route answers 404, as it does for anyone not on it. A set of "Done" keeps an
   * earlier time, else takes `fakeDoneAt`, and a clear empties it, as the server does.
   */
  adminFeedback?: AdminFeedbackMessage[]
  /**
   * Whether the summary, the list, a video's detail and Audience answer from the API's cache:
   * false, as a read from Google, unless set.
   */
  fromCache: boolean
  /** Every request the app made, oldest first. A feedback message's body is among them. */
  requests: FakeRequest[]
  /**
   * Holds the next request to `route`, such as `PUT /api/me/preferences`, until the test settles
   * it.
   */
  hold(route: string): Held
  /** Fails the next request to `route`. */
  failNext(route: string, how?: Failure): void
}

interface Answer {
  status: number
  body: unknown
}

/** The plans' prices an upgrade answer carries: $7 a month and $70 a year (ADR 0022). */
export const fakePrices: UpgradeAnswer['prices'] = {
  monthly: { amount: 700, currency: 'usd' },
  annual: { amount: 7000, currency: 'usd' },
}

/** Where the fake API's Checkout sends the creator. */
export const fakeCheckoutUrl = 'https://checkout.stripe.com/c/pay/cs_test_fake'

/** Where the fake API's Customer Portal sends the creator. */
export const fakePortalUrl = 'https://billing.stripe.com/p/session/test_fake'

/**
 * What the fake API's block preview answers for the count after the add: $7 a month, and $3.50
 * for the rest of the period, on the invoice of 2026-12-17.
 */
export function fakeBlockPreviewOf(blocks: number): BlockPreviewAnswer {
  return {
    blocks,
    plan: 'monthly',
    price: { amount: 700, currency: 'usd' },
    prorated: { amount: 350, currency: 'usd' },
    periodEnd: '2026-12-17T12:00:00.000Z',
  }
}

/** The block routes' answer, or undefined for any other route. */
function blockAnswerOf(api: FakeApi, { method, path, body }: FakeRequest): Answer | undefined {
  const route = `${method} ${path}`
  if (route !== 'GET /api/me/block-preview' && route !== 'POST /api/me/blocks') return undefined
  const entitlements = api.entitlements
  if (!entitlements.canAddBlock) return { status: 409, body: { refusal: 'not_subscribed' } }
  const next = entitlements.blocks + 1
  if (method === 'GET') return { status: 200, body: fakeBlockPreviewOf(next) }
  if ((body as { blocks?: unknown } | null)?.blocks !== next) {
    return { status: 409, body: { refusal: 'blocks_changed' } }
  }
  api.entitlements = { ...entitlements, blocks: next }
  return { status: 200, body: { blocks: next } }
}

/** The purge date the fake API's unpick gives the channel it takes out of Pro. */
export const fakePurgeDate = '2026-12-26T12:00:00.000Z'

const proPickPattern = /^\/api\/channels\/([^/]+)\/pro-pick$/

/** The pick routes' answer, or undefined for any other route. */
function proPickAnswerOf(api: FakeApi, { method, path }: FakeRequest): Answer | undefined {
  const channelId = proPickPattern.exec(path)?.[1]
  if (!channelId || (method !== 'PUT' && method !== 'DELETE')) return undefined
  const entitlements = api.entitlements
  const channel = entitlements.channels.find((each) => each.channelId === channelId)
  if (!channel) return { status: 404, body: { refusal: 'not_connected' } }
  if (!channel.owner) return { status: 403, body: { refusal: 'not_owner' } }
  const pick = method === 'PUT'
  if (channel.picked === pick) return { status: 200, body: entitlements }
  if (pick && entitlements.slotsInUse >= entitlements.blocks * 4) {
    return { status: 409, body: { refusal: 'no_free_slot' } }
  }
  const changed = pick
    ? { ...channel, tier: 'paid' as const, picked: true, purgeDate: null }
    : { ...channel, tier: 'free' as const, picked: false, purgeDate: fakePurgeDate }
  api.entitlements = {
    ...entitlements,
    slotsInUse: entitlements.slotsInUse + (pick ? 1 : -1),
    channels: entitlements.channels.map((each) => (each === channel ? changed : each)),
  }
  return { status: 200, body: api.entitlements }
}

/** The Google page the fake API answers a sign-in or a connect with. */
export const fakeGoogleUrl = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=fake'

/** The time the fake API's admin routes set as a message's "Done" time. */
export const fakeDoneAt = '2026-11-15T13:00:00.000Z'

const doneRoutePattern = /^\/api\/admin\/feedback\/([^/]+)\/done$/

/** The admin routes' answer, or undefined for any other route. */
function adminAnswerOf(api: FakeApi, { method, path, query }: FakeRequest): Answer | undefined {
  const messages = api.adminFeedback
  if (!messages || !path.startsWith('/api/admin/')) return undefined
  if (method === 'GET' && path === '/api/admin/feedback') {
    const kept = query.get('open') === 'true' ? messages.filter((m) => m.doneAt === null) : messages
    const page = Number(query.get('page') ?? 1)
    const start = (page - 1) * adminFeedbackPageSize
    return {
      status: 200,
      body: {
        messages: kept.slice(start, start + adminFeedbackPageSize),
        pageCount: Math.ceil(kept.length / adminFeedbackPageSize),
      },
    }
  }
  const id = doneRoutePattern.exec(path)?.[1]
  const index = messages.findIndex((message) => message.id === id)
  const message = messages[index]
  if ((method === 'PUT' || method === 'DELETE') && message) {
    const doneAt = method === 'PUT' ? (message.doneAt ?? fakeDoneAt) : null
    const changed = { ...message, doneAt }
    api.adminFeedback = messages.map((each, place) => (place === index ? changed : each))
    return { status: 200, body: changed }
  }
  return undefined
}

function answerOf(api: FakeApi, { method, path, query, body }: FakeRequest): Answer {
  const route = `${method} ${path}`
  const ok = (answer: unknown): Answer => ({ status: 200, body: answer })
  if (route === 'GET /api/client-settings') return ok(api.clientSettings)
  if (route === 'GET /api/me') return ok(api.me)
  if (route === 'DELETE /api/me') return ok({ revokedAtGoogle: true })
  if (route === 'GET /api/channels') return ok({ channels: api.channels })
  if (route === 'GET /api/me/preferences') return ok(api.preferences)
  if (route === 'GET /api/me/support') {
    const dismissed = api.preferences.supportPromptDismissed === true
    return ok(dismissed ? { ...api.support, prompt: false } : api.support)
  }
  if (route === 'GET /api/me/entitlements') return ok(api.entitlements)
  if (route === 'POST /api/me/checkout') return ok({ url: fakeCheckoutUrl })
  if (route === 'POST /api/me/portal') return ok({ url: fakePortalUrl })
  const pickAnswer = proPickAnswerOf(api, { method, path, query, body })
  if (pickAnswer) return pickAnswer
  const blockAnswer = blockAnswerOf(api, { method, path, query, body })
  if (blockAnswer) return blockAnswer
  if (route === 'PUT /api/me/preferences') {
    api.preferences = { ...api.preferences, ...(body as Preferences) }
    return ok(api.preferences)
  }
  if (route === 'DELETE /api/me/preferences') {
    api.preferences = {}
    return ok({})
  }
  if (route === 'POST /api/auth/sign-out') return ok({})
  if (route === 'POST /api/auth/sign-in/google' || route === 'POST /api/channels/connect') {
    return ok({ url: fakeGoogleUrl })
  }
  if (route === 'POST /api/feedback') return { status: 201, body: null }
  const admin = adminAnswerOf(api, { method, path, query, body })
  if (admin) return admin
  const disconnected = api.channels.find(({ id }) => path === `/api/channels/${id}/disconnect`)
  if (method === 'POST' && disconnected) {
    api.channels = api.channels.filter((channel) => channel !== disconnected)
    return ok({ revokedAtGoogle: true })
  }
  const channelPath = `/api/channels/${fakeChannel.id}`
  if (route === `GET ${channelPath}/summary`) return ok(summaryOf(api, query))
  if (route === `GET ${channelPath}/audience`) return ok(audienceOf(api, query))
  if (route === `GET ${channelPath}/retention-curves`) return retentionCurvesOf(api, query)
  if (
    route === `GET ${channelPath}/videos` &&
    api.retentionRefusal &&
    query.get('withRetentionCurve') === 'true'
  ) {
    return { status: 403, body: { error: 'filter_without_history' } }
  }
  if (route === `GET ${channelPath}/videos`) return ok(videoListOf(api, query))
  if (route === `GET ${channelPath}/upgrade` && api.upgrade) return ok(api.upgrade)
  const reported = api.videos.some(
    ({ id }) => path === `${channelPath}/videos/${id}/sponsor-report`,
  )
  if (method === 'GET' && reported) return ok(sponsorReportOf(api))
  if (route === `PUT ${channelPath}/sponsor-figures`) {
    api.sponsorChoice = (body as { figures: SponsorReportFigure[] }).figures
    return ok({ figures: api.sponsorChoice })
  }
  const video = api.videos.find(({ id }) => path === `${channelPath}/videos/${id}`)
  if (method === 'GET' && video) return ok(videoDetailOf(video, api, query))
  return { status: 404, body: { error: 'not_found' } }
}

/** The sponsor report narrowed to the stored choice, as the API answers it. */
function sponsorReportOf({ sponsorReport, sponsorChoice }: FakeApi): SponsorReportAnswer {
  if (!sponsorChoice) return sponsorReport
  const figures = sponsorChoice.filter(
    (figure) =>
      sponsorReport.history !== undefined ||
      !(sponsorHistoryFigures as readonly string[]).includes(figure),
  )
  return {
    ...sponsorReport,
    figures,
    windows: sponsorReport.windows.map((window) => ({
      ...window,
      numbers: Object.fromEntries(
        Object.entries(window.numbers).filter(([figure]) =>
          (figures as readonly string[]).includes(figure),
        ),
      ),
    })),
  }
}

function responseOf({ status, body }: Answer): Response {
  // A plain object, not a Response, so the body is read in a microtask the test's `act` flushes.
  return { ok: status < 400, status, json: async () => body } as Response
}

/**
 * Puts the fake API in place of `fetch`, answering as the server does for a signed-in creator with
 * one channel and `preferences` saved. The test's `afterEach` undoes it with `vi.unstubAllGlobals`.
 */
export function installFakeApi(preferences: Preferences = {}): FakeApi {
  const settles = new Map<string, Array<(request: FakeRequest) => Promise<Answer>>>()
  function nextFor(route: string, settle: (request: FakeRequest) => Promise<Answer>) {
    settles.set(route, [...(settles.get(route) ?? []), settle])
  }
  const failed = (how: Failure): Answer => {
    if (how === 'network') throw new TypeError('Failed to fetch')
    return how === 'status' ? { status: 500, body: { error: 'internal' } } : how
  }
  const api: FakeApi = {
    me,
    preferences,
    channels: [fakeChannel],
    videos: [fakeVideo],
    pageCount: 1,
    days: [
      { day: '2026-10-03', engagedViews: 600, views: 700, estimatedMinutesWatched: 300 },
      { day: '2026-10-04', engagedViews: 600, views: 800, estimatedMinutesWatched: 438 },
    ],
    retention: [],
    retentionCurves: [],
    retentionUnread: 0,
    sponsorReport: fakeSponsorReport,
    trafficSources: [],
    playability: {},
    summaryRevenue: { refusal: 'consent_missing' },
    summaryDays: [],
    summaryUploads: [],
    listRevenue: { refusal: 'consent_missing' },
    publishDayTop: [],
    fromCache: false,
    countries: [
      { code: 'US', engagedViews: 2772, views: 3900 },
      { code: 'IN', engagedViews: 1704, views: 2500 },
      { code: 'DE', engagedViews: 793, views: 1100 },
    ],
    usStates: [
      { code: 'US-CA', engagedViews: 557, views: 800 },
      { code: 'US-TX', engagedViews: 310, views: 400 },
      { code: 'US-NY', engagedViews: 290, views: 380 },
    ],
    cities: [
      { name: 'Mumbai', engagedViews: 300, views: 600 },
      { name: 'Chicago', engagedViews: 120, views: 200 },
      { name: 'London', engagedViews: 90, views: 150 },
    ],
    ageGroups: [
      { ageGroup: 'age18-24', viewerPercentage: 31.4 },
      { ageGroup: 'age25-34', viewerPercentage: 40.3 },
      { ageGroup: 'age35-44', viewerPercentage: 28.3 },
    ],
    genders: [
      { gender: 'female', viewerPercentage: 18.4 },
      { gender: 'male', viewerPercentage: 81.2 },
      { gender: 'user_specified', viewerPercentage: 0.4 },
    ],
    devices: [
      { deviceType: 'MOBILE', engagedViews: 2400, views: 3300 },
      { deviceType: 'DESKTOP', engagedViews: 1900, views: 2600 },
      { deviceType: 'TV', engagedViews: 300, views: 400 },
    ],
    operatingSystems: [
      { operatingSystem: 'ANDROID', engagedViews: 1500, views: 2000 },
      { operatingSystem: 'WINDOWS', engagedViews: 1300, views: 1800 },
      { operatingSystem: 'IOS', engagedViews: 800, views: 1000 },
    ],
    subscriberSplit: {
      subscribed: { engagedViews: 1300, views: 1700 },
      unsubscribed: { engagedViews: 3300, views: 4600 },
    },
    support: { link: null, prompt: false },
    entitlements: {
      paidTierOffered: false,
      canSubscribe: false,
      canManage: false,
      canAddBlock: false,
      blocks: 0,
      slotsInUse: 0,
      channels: [
        {
          channelId: fakeChannel.id,
          tier: 'free',
          owner: true,
          picked: false,
          purgeDate: null,
          canSubscribe: false,
          canManage: false,
        },
      ],
    },
    clientSettings: {
      environment: 'production',
      version: '2026.11.9',
      commit: 'abc1234',
      releasePath: '/releases/2026.11.9',
      openPanelClientId: 'a-client-id',
    },
    requests: [],
    hold(route) {
      let settle: (how: Failure | null) => void = () => {}
      const settled = new Promise<Failure | null>((resolve) => {
        settle = resolve
      })
      nextFor(route, async (request) => {
        const how = await settled
        return how === null ? answerOf(api, request) : failed(how)
      })
      return { release: () => settle(null), fail: (how = 'status') => settle(how) }
    },
    failNext(route, how = 'status') {
      nextFor(route, async () => failed(how))
    },
  }
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = new URL(input, 'http://localhost')
    const method = init.method ?? 'GET'
    const request: FakeRequest = {
      method,
      path: url.pathname,
      query: url.searchParams,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    }
    api.requests.push(request)
    const route = `${method} ${url.pathname}`
    const [settle, ...rest] = settles.get(route) ?? []
    settles.set(route, rest)
    return responseOf(settle ? await settle(request) : answerOf(api, request))
  })
  return api
}

/** Lets every answer the fake API has given, and the renders they cause, land. */
export async function settle(): Promise<void> {
  for (let round = 0; round < 5; round += 1) {
    await act(async () => {
      for (let tick = 0; tick < 20; tick += 1) await Promise.resolve()
    })
  }
}

export interface RenderedApp {
  container: HTMLElement
  /** The address on view under the web app's base, path and query string. */
  address(): string
  unmount(): void
}

/**
 * Renders App, as `main.tsx` does with the client settings it reads, under StrictMode and Base UI's CSPProvider, on `address` under
 * the base Vitest gives (`/`), and lets the reads it starts land.
 */
export async function renderApp(address = ''): Promise<RenderedApp> {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  window.history.replaceState(null, '', `/${address}`)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  // Read before the render, as main.tsx reads it.
  const clientSettings = await readClientSettings()
  await act(async () => {
    root.render(
      createElement(
        StrictMode,
        null,
        createElement(
          CSPProvider,
          { disableStyleElements: true },
          createElement(App, { landingMessage: null, clientSettings }),
        ),
      ),
    )
  })
  await settle()
  return {
    container,
    address: () => `${window.location.pathname.slice(1)}${window.location.search}`,
    unmount() {
      act(() => root.unmount())
      container.remove()
    },
  }
}
