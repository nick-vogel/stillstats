// The sample channel the homepage screenshot shows (creator-analytics#39). Every name, title and
// number here is made up: no creator's data reaches the marketing site (ADR 0009). The channel is
// a small, growing cooking channel, healthy and not viral. A fixed seed makes every run draw the
// same numbers, so a retaken screenshot shows the same channel.
//
// Each video has its own engaged views, views, watch minutes and revenue on each day since its
// publish day, and every answer adds those days up, so the channel's totals, its daily series and
// the video rows always agree with each other, and engaged views never pass views.
import {
  addDays,
  daysFrom,
  type ListedChannel,
  type MeAnswer,
  type SupportAnswer,
  type VideoFormat,
} from '@creator-analytics/api-types'

/** The last day Google has processed, three days before the 2026-10-16 capture. */
export const lastProcessedDay = '2026-10-13'
export const creationDay = '2024-08-19'
export const fetchedAt = '2026-10-16T07:42:00.000Z'

export const sampleUser: MeAnswer = {
  // Short enough to show whole in the sidebar's open account row at 1280px, which the browser walk
  // checks (creator-analytics#590): that row has about 119px for it.
  email: 'fen@example.com',
  name: 'Fennmoor Kitchen',
  // Before the web app's fixture releases, so the browser walk sees the "What's new" banner.
  createdAt: '2026-10-14T09:30:00.000Z',
}

/**
 * The sample creator's Tip link: shaped as a Stripe test-mode Payment Link with a user ID, neither
 * of them real.
 */
export const sampleSupport: SupportAnswer = {
  link: 'https://buy.stripe.com/test_sample?client_reference_id=sampleFennmoorKitchenUser39',
  prompt: true,
}

export const sampleChannel: ListedChannel = {
  id: '00000000-0000-4000-8000-000000000039',
  // Plainly not a real channel id: "UC" and 22 characters that spell the sample.
  youtubeChannelId: 'UCsampleFennmoorKitchen0',
  title: 'Fennmoor Kitchen',
  handle: '@fennmoorkitchen',
  revenueConsentedAt: '2026-03-02T15:20:00.000Z',
}

/**
 * A second made-up channel of the sample creator, which the browser walk's stub lists only in the
 * collapsed sidebar step, so the channel picker and its collapsed icon show there. Nothing reads
 * its numbers.
 */
export const sampleSecondChannel: ListedChannel = {
  id: '00000000-0000-4000-8000-000000000040',
  youtubeChannelId: 'UCsampleFennmoorShorts00',
  title: 'Fennmoor Shorts',
  handle: '@fennmoorshorts',
  revenueConsentedAt: null,
}

/** One video's numbers on one day. Revenue is in USD. */
export interface SampleDay {
  engagedViews: number
  views: number
  estimatedMinutesWatched: number
  subscribersGained: number
  estimatedRevenue: number
  estimatedAdRevenue: number
  estimatedRedPartnerRevenue: number
}

export interface SampleVideo {
  id: string
  title: string
  format: VideoFormat
  publishedAt: string
  /** YYYY-MM-DD, the publish day in Pacific Time. */
  publishDay: string
  durationSeconds: number
  /** Set on the one video whose detail answers it not embeddable. Absent: embeddable. */
  embeddable?: false
  /** Index 0 is the publish day, the last is `lastProcessedDay`. */
  days: SampleDay[]
}

/** mulberry32: a small seeded generator, so the sample is the same on every run. */
function randomFrom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const random = randomFrom(39)

function between(low: number, high: number): number {
  return low + (high - low) * random()
}

/** An amount rounded to whole cents, as YouTube reports revenue. */
export const cents = (amount: number) => Math.round(amount * 100) / 100

// The newest first. Older uploads take a title from the dishes and phrasings below.
const recentVideoTitles = [
  'Brown Butter Gnocchi in 20 Minutes',
  'Three Soups From One Pot of Stock',
  'The Only Pie Crust I Make Now',
  'Cooking a Week of Lunches for Under $30',
  'Why My Rice Was Always Mushy',
  'Roast Chicken, Then Four Meals From It',
  'Sourdough Without the Schedule',
  'A Better Weeknight Dal',
  'Fixing the Five Most Common Pasta Mistakes',
  'Slow Cooker Beans That Actually Taste Good',
  'I Cooked From a 1950s Cookbook for a Week',
  'Crispy Tofu, Tested Six Ways',
]

const recentShortTitles = [
  'The 10 Second Garlic Trick',
  'Stop Rinsing Your Pasta',
  'One Pan Eggs for Two',
  'How Thin Should Onions Be?',
  'Salt Your Water Like This',
  'Rescue a Split Sauce',
  'Toast Your Spices First',
  'Freezer Dumplings in 8 Minutes',
]

const dishes = [
  'Lentil Soup',
  'Focaccia',
  'Chicken Thighs',
  'Fried Rice',
  'Shakshuka',
  'Mushroom Risotto',
  'Black Bean Tacos',
  'Banana Bread',
  'Tomato Sauce',
  'Granola',
  'Stir Fry Noodles',
  'Potato Gratin',
  'Chickpea Curry',
  'Pancakes',
  'Minestrone',
  'Flatbread',
  'Baked Salmon',
  'Coleslaw',
  'Meatballs',
  'Apple Crumble',
]

const phrasings = [
  (dish: string) => `Weeknight ${dish}`,
  (dish: string) => `${dish} on a Budget`,
  (dish: string) => `My Everyday ${dish}`,
  (dish: string) => `${dish}, Three Ways`,
  (dish: string) => `Easy ${dish} for Beginners`,
]

const shortPhrasings = [(dish: string) => `${dish} in 60 Seconds`, (dish: string) => `${dish} Tip`]

function olderTitleOf(index: number, short: boolean): string {
  const forms = short ? shortPhrasings : phrasings
  const dish = dishes[index % dishes.length] ?? 'Soup'
  const phrase = forms[Math.floor(index / dishes.length) % forms.length] ?? ((name) => name)
  return phrase(dish)
}

const lastDayIndex = daysFrom(creationDay, lastProcessedDay)

/** How the channel's reach grows, from 1 at its creation to about 3.4 two years on. */
function growthOn(day: string): number {
  return Math.exp((0.62 * daysFrom(creationDay, day)) / 365)
}

/** Each video's share of its launch on its days after publish: a launch, then a long tail. */
function shapeOn(age: number, format: VideoFormat): number {
  return format === 'short'
    ? 0.9 * Math.exp(-age / 2.2) + 0.06 / (1 + age / 20)
    : 0.8 * Math.exp(-age / 3.5) + 0.2 / (1 + age / 25)
}

function sampleVideo(
  index: number,
  format: VideoFormat,
  publishDay: string,
  title: string,
): SampleVideo {
  const short = format === 'short'
  const durationSeconds = short ? Math.round(between(28, 58)) : Math.round(between(8.5, 17) * 60)
  // How well this video lands against the channel's usual: most near 1, none far off it.
  const quality = Math.min(2.3, Math.max(0.45, Math.exp(between(-0.55, 0.55))))
  const launch = (short ? 105 : 124) * growthOn(publishDay) * quality
  const engagedShare = short ? between(0.48, 0.6) : between(0.85, 0.92)
  const viewedShare = short ? between(0.74, 0.96) : between(0.36, 0.52)
  const rpm = short ? 0 : between(4.2, 6.4)
  const subscribeRate = short ? between(0.0015, 0.003) : between(0.008, 0.012)
  const days: SampleDay[] = []
  const age = daysFrom(publishDay, lastProcessedDay)
  for (let day = 0; day <= age; day++) {
    const weekday = new Date(Date.parse(addDays(publishDay, day))).getUTCDay()
    const weekend = weekday === 0 || weekday === 6 ? 1.12 : 1
    const engagedViews = Math.round(launch * shapeOn(day, format) * weekend * between(0.88, 1.12))
    const views = Math.round(engagedViews / engagedShare)
    const estimatedMinutesWatched = Math.round(
      (views * viewedShare * durationSeconds * between(0.95, 1.05)) / 60,
    )
    const estimatedRevenue = short
      ? cents(views * 0.00006)
      : cents((engagedViews * rpm * between(0.9, 1.1)) / 1000)
    const estimatedAdRevenue = cents(estimatedRevenue * 0.84)
    const estimatedRedPartnerRevenue = cents(estimatedRevenue * 0.11)
    days.push({
      engagedViews,
      views,
      estimatedMinutesWatched,
      subscribersGained: Math.round(engagedViews * subscribeRate * between(0.6, 1.4)),
      estimatedRevenue,
      estimatedAdRevenue,
      estimatedRedPartnerRevenue,
    })
  }
  const hour = short ? 14 : 15
  return {
    id: `fk${String(index).padStart(9, '0')}`,
    title,
    format,
    publishedAt: `${publishDay}T${hour + 7}:00:00.000Z`,
    publishDay,
    durationSeconds,
    days,
  }
}

function uploads(): SampleVideo[] {
  const schedule: { format: VideoFormat; publishDay: string }[] = []
  // A video every 9 days from the first, and a Short every 6 days from November 2025.
  for (let day = 14; day <= lastDayIndex; day += 9) {
    schedule.push({ format: 'video', publishDay: addDays(creationDay, day) })
  }
  for (let day = daysFrom(creationDay, '2025-11-03'); day <= lastDayIndex; day += 6) {
    schedule.push({ format: 'short', publishDay: addDays(creationDay, day) })
  }
  schedule.sort((a, b) => a.publishDay.localeCompare(b.publishDay))
  const counts = { video: 0, short: 0, live: 0 }
  const total = {
    video: schedule.filter(({ format }) => format === 'video').length,
    short: schedule.filter(({ format }) => format === 'short').length,
  }
  return schedule.map(({ format, publishDay }, index) => {
    const short = format === 'short'
    const fromNewest = (short ? total.short : total.video) - 1 - counts[format]
    counts[format] += 1
    const recent = short ? recentShortTitles : recentVideoTitles
    const title = recent[fromNewest] ?? olderTitleOf(fromNewest - recent.length, short)
    return sampleVideo(index + 1, format, publishDay, title)
  })
}

// The oldest video does not allow embedding, for the browser walk's step on a video that cannot
// play (creator-analytics#649). It is none of the videos the walk's player steps open.
export const sampleVideos: SampleVideo[] = uploads().map((video, index) =>
  index === 0 ? { ...video, embeddable: false } : video,
)

/**
 * Channel membership revenue, which YouTube ties to no video: about a dollar a day since
 * memberships opened in March 2026.
 */
export function noFormatRevenueOn(day: string): number {
  if (day < '2026-03-02') return 0
  return cents(0.85 + 0.35 * Math.sin(daysFrom(creationDay, day)))
}

/** The video's numbers on `day`, or none before its publish day or after the last processed day. */
export function videoDayOf(video: SampleVideo, day: string): SampleDay | undefined {
  return video.days[daysFrom(video.publishDay, day)]
}

/**
 * The first day of the sample's impressions and CTR history, the oldest report YouTube still held
 * when the channel subscribed. A 28-day window starts before it, so the history shows partial, and
 * lifetime is always partial.
 */
export const historyStartDay = '2026-09-26'

/**
 * The video's thumbnail impressions on `day` and the clicks on them, made up from its views with no
 * draw on the seeded generator, so the rest of the sample stays the same; none before the history
 * start or on a day the video has no numbers.
 */
export function videoReachOf(
  video: SampleVideo,
  day: string,
): { impressions: number; clicks: number } | undefined {
  const numbers = day >= historyStartDay ? videoDayOf(video, day) : undefined
  if (!numbers) return undefined
  const impressions = numbers.views * 9 + (daysFrom(video.publishDay, day) % 7) * 11
  // Between 4% and 7% of the impressions, a Short clicked on less often than a video.
  const share = (video.format === 'short' ? 0.04 : 0.05) + 0.02 * ((numbers.views % 5) / 5)
  return { impressions, clicks: Math.round(impressions * share) }
}
