// No test runs this file: `pnpm typecheck` checks it, and each unused @ts-expect-error fails the
// check. It proves the answer types reject the slips the API's `satisfies` checks are there for.
import type { HeldChannel } from '@creator-analytics/accounts'
import type {
  ChannelSummaryAnswer,
  ChannelsAnswer,
  ListedChannel,
  MeAnswer,
  RefusalAnswer,
  VideoDetailAnswer,
  VideoListAnswer,
} from '@creator-analytics/api-types'

export const misnamedField = {
  email: 'creator@example.com',
  createdAt: '2026-11-10T12:00:00.000Z',
  // @ts-expect-error A misnamed field is not part of the answer.
  nom: 'Creator',
} satisfies MeAnswer

export const missingField = {
  window: 'lifetime',
  format: 'all',
  engagedViews: 1,
  estimatedMinutesWatched: 1,
  revenue: { refusal: 'consent_missing' },
  daily: [],
  uploads: [],
  lastProcessedDay: '2026-10-04',
  creationDay: '2019-02-28',
  fetchedAt: '2026-10-06T00:00:00.000Z',
  fromCache: false,
  // @ts-expect-error A missing field leaves the answer incomplete.
} satisfies ChannelSummaryAnswer

export const wrongType = {
  window: 'lifetime',
  format: 'all',
  engagedViews: 1,
  views: 1,
  estimatedMinutesWatched: 1,
  revenue: { refusal: 'consent_missing' },
  daily: [],
  uploads: [],
  lastProcessedDay: '2026-10-04',
  creationDay: '2019-02-28',
  // @ts-expect-error The web app reads a date as an ISO string, never a Date.
  fetchedAt: new Date(),
  fromCache: false,
} satisfies ChannelSummaryAnswer

export const unknownRefusal = {
  // @ts-expect-error The web app knows only the codes the package names.
  refusal: 'teapot',
} satisfies RefusalAnswer

export const rowWithoutScheduled = {
  videos: [
    // @ts-expect-error A row that does not say whether it is scheduled cannot be hidden.
    {
      id: 'v',
      title: 'A video',
      thumbnailUrl: null,
      thumbnails: [],
      durationSeconds: null,
      publishedAt: null,
      format: null,
      engagedViews: 0,
      views: 0,
      averageViewPercentage: 0,
      subscribersGained: 0,
      estimatedMinutesWatched: 0,
      awaitingProcessing: false,
    },
  ],
  page: 1,
  pageSize: 50,
  pageCount: 1,
  revenue: { refusal: 'consent_missing' },
  lastProcessedDay: '2026-10-04',
  creationDay: '2019-02-28',
  fetchedAt: '2026-10-07T00:00:00.000Z',
  fromCache: false,
} satisfies VideoListAnswer

export const googleFormatName = {
  videos: [
    {
      id: 'v',
      title: 'A video',
      thumbnailUrl: null,
      thumbnails: [],
      durationSeconds: null,
      publishedAt: null,
      scheduled: false,
      // @ts-expect-error The web app knows the product's formats, never Google's content types.
      format: 'shorts',
      engagedViews: 0,
      views: 0,
      averageViewPercentage: 0,
      subscribersGained: 0,
      estimatedMinutesWatched: 0,
      awaitingProcessing: false,
    },
  ],
  window: 'lifetime',
  page: 1,
  pageSize: 50,
  pageCount: 1,
  revenue: { refusal: 'consent_missing' },
  lastProcessedDay: '2026-10-04',
  creationDay: '2019-02-28',
  fetchedAt: '2026-10-07T00:00:00.000Z',
  fromCache: false,
} satisfies VideoListAnswer

export const unknownWindow = {
  videos: [],
  // @ts-expect-error The web app knows only the windows the package names.
  window: 'last30',
  page: 1,
  pageSize: 50,
  pageCount: 0,
  revenue: { refusal: 'consent_missing' },
  lastProcessedDay: '2026-10-04',
  creationDay: '2019-02-28',
  fetchedAt: '2026-10-07T00:00:00.000Z',
  fromCache: false,
} satisfies VideoListAnswer

export const listWithoutRevenue = {
  videos: [],
  window: 'lifetime',
  page: 1,
  pageSize: 50,
  pageCount: 0,
  lastProcessedDay: '2026-10-04',
  creationDay: '2019-02-28',
  fetchedAt: '2026-10-07T00:00:00.000Z',
  fromCache: false,
  // @ts-expect-error A list always says its revenue or why it carries none.
} satisfies VideoListAnswer

export const publishDayVideoWithoutTitle = {
  publishDayTop: [
    // @ts-expect-error A bar names its video, so each video in the publish day top carries its title.
    { id: 'v', publishedAt: null, engagedViews: 1 },
  ],
} satisfies Pick<VideoListAnswer, 'publishDayTop'>

export const listRevenueRefusedWithCurrency = {
  // @ts-expect-error A list's revenue never carries a refusal and a currency together.
  revenue: { refusal: 'not_monetized', currency: 'USD', reported: true },
} satisfies Pick<VideoListAnswer, 'revenue'>

export const summaryRevenueRefusedWithCurrency = {
  revenue: {
    refusal: 'not_monetized',
    // @ts-expect-error A channel summary's revenue never carries a refusal and a currency together.
    currency: 'USD',
    estimatedRevenue: 0,
    estimatedAdRevenue: 0,
    estimatedRedPartnerRevenue: 0,
    noFormatRevenue: 0,
    everyFormatRevenue: 0,
  },
} satisfies Pick<ChannelSummaryAnswer, 'revenue'>

export const detailRevenueRefusedWithCurrency = {
  revenue: {
    refusal: 'not_monetized',
    // @ts-expect-error A video detail's revenue never carries a refusal and a currency together.
    currency: 'USD',
    estimatedRevenue: 0,
    estimatedAdRevenue: 0,
    estimatedRedPartnerRevenue: 0,
  },
} satisfies Pick<VideoDetailAnswer, 'revenue'>

export const summaryAfterPublish = {
  // @ts-expect-error A channel has no publish date: the summary covers calendar windows and lifetime.
  window: 'first7',
  format: 'all',
  engagedViews: 0,
  views: 0,
  estimatedMinutesWatched: 0,
  revenue: { refusal: 'consent_missing' },
  daily: [],
  uploads: [],
  lastProcessedDay: '2026-10-04',
  creationDay: '2019-02-28',
  fetchedAt: '2026-10-07T00:00:00.000Z',
  fromCache: false,
} satisfies ChannelSummaryAnswer

export const revenueWithoutNoFormatAmount = {
  // @ts-expect-error Revenue that answered carries the amount tied to no format, so the note can show it.
  revenue: {
    estimatedRevenue: 42.8,
    estimatedAdRevenue: 30.5,
    estimatedRedPartnerRevenue: 4.25,
    everyFormatRevenue: 42.8,
  },
} satisfies Pick<ChannelSummaryAnswer, 'revenue'>

export const revenueWithoutCurrency = {
  // @ts-expect-error Revenue that answered names its currency, so the web app formats it in that one.
  revenue: {
    estimatedRevenue: 42.8,
    estimatedAdRevenue: 30.5,
    estimatedRedPartnerRevenue: 4.25,
    noFormatRevenue: 5.4,
    everyFormatRevenue: 42.8,
  },
} satisfies Pick<ChannelSummaryAnswer, 'revenue'>

export const detailTotalsWithoutPercentage = {
  // @ts-expect-error The detail's totals are Google's own, average percentage viewed included.
  totals: { engagedViews: 0, views: 0, subscribersGained: 0, estimatedMinutesWatched: 0 },
} satisfies Pick<VideoDetailAnswer, 'totals'>

export const wrongChannel = {
  channels: [
    // @ts-expect-error A channel without revenueConsentedAt leaves the web app guessing.
    { id: 'c', youtubeChannelId: 'UC' },
  ],
} satisfies ChannelsAnswer

// /channels answers accounts' HeldChannel with the channel's name added, so a field only one
// side has fails here.
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
export const channelRowsAgree: MutuallyAssignable<
  HeldChannel,
  Omit<ListedChannel, 'title' | 'handle'>
> = true
