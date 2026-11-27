import type {
  AgeGroup,
  AudienceAnswer,
  AudienceRequest,
  City,
  Country,
  Device,
  EngagedViewsAndViews,
  Gender,
  OperatingSystem,
  SubscriberSplit,
  UsState,
} from '@creator-analytics/api-types'
import type { Scoped } from '@creator-analytics/database'
import type { ReadRefusal, YouTubeGateway } from '@creator-analytics/youtube-gateway'
import { channelRangeOf } from './calendar-range.ts'
import { contentTypeOfFormat } from './channel-summary.ts'
import { freshnessTracker } from './freshness.ts'

/**
 * Who watches the whole channel, or one format of it, over a calendar window: each breakdown read
 * with the format's content type filter, but the US states and the cities, which are read for every
 * format whatever the format, as Google answers them wrong numbers under a format filter (live
 * check, 2026-10-19). A custom range outside its bounds is refused with
 * `invalid_range` before any breakdown read, and a refused read of any breakdown refuses the whole
 * answer, so the screen never shows a breakdown as empty when Google failed it.
 */
export async function audienceOf(
  gateway: YouTubeGateway,
  tx: Scoped<'user'>,
  channelId: string,
  audience: AudienceRequest,
): Promise<
  | { ok: true; answer: AudienceAnswer }
  | { ok: false; refusal: ReadRefusal }
  | { ok: false; error: 'invalid_range' }
> {
  const { read, freshness } = freshnessTracker(gateway)
  const channelRange = await channelRangeOf(read, tx, channelId, audience)
  if (!channelRange.ok) return channelRange
  const { range, processedThrough, creationDay } = channelRange
  const { window, format } = audience

  const creatorContentType = contentTypeOfFormat[format]
  const request = creatorContentType ? { ...range, creatorContentType } : range
  const countries = await read(tx, channelId, 'channelCountries', request)
  if (!countries.ok) return countries
  // One after another, so a failed read refuses the answer before the next query is sent.
  const usStates = await read(tx, channelId, 'channelUsStates', range)
  if (!usStates.ok) return usStates
  const cities = await read(tx, channelId, 'channelCities', range)
  if (!cities.ok) return cities
  const ageGroups = await read(tx, channelId, 'channelAgeGroups', request)
  if (!ageGroups.ok) return ageGroups
  const genders = await read(tx, channelId, 'channelGenders', request)
  if (!genders.ok) return genders
  const devices = await read(tx, channelId, 'channelDevices', request)
  if (!devices.ok) return devices
  const operatingSystems = await read(tx, channelId, 'channelOperatingSystems', request)
  if (!operatingSystems.ok) return operatingSystems
  const subscribedStatuses = await read(tx, channelId, 'channelSubscriberSplit', request)
  if (!subscribedStatuses.ok) return subscribedStatuses

  return {
    ok: true,
    answer: {
      window,
      format,
      countries: Object.entries(countries.value)
        .map(([code, numbers]): Country => ({ code, ...numbers }))
        .sort(byMostEngagedViews(({ code }) => code)),
      usStates: Object.entries(usStates.value)
        .map(([code, numbers]): UsState => ({ code, ...numbers }))
        .sort(byMostEngagedViews(({ code }) => code)),
      cities: cities.value.toSorted(byMostEngagedViews(({ name }: City) => name)),
      ageGroups: byGoogleValue(ageGroups.value).map(
        ([ageGroup, viewerPercentage]): AgeGroup => ({ ageGroup, viewerPercentage }),
      ),
      genders: byGoogleValue(genders.value).map(
        ([gender, viewerPercentage]): Gender => ({ gender, viewerPercentage }),
      ),
      devices: Object.entries(devices.value)
        .map(([deviceType, numbers]): Device => ({ deviceType, ...numbers }))
        .sort(byMostEngagedViews(({ deviceType }) => deviceType)),
      operatingSystems: Object.entries(operatingSystems.value)
        .map(([operatingSystem, numbers]): OperatingSystem => ({ operatingSystem, ...numbers }))
        .sort(byMostEngagedViews(({ operatingSystem }) => operatingSystem)),
      subscriberSplit: subscriberSplitOf(subscribedStatuses.value),
      lastProcessedDay: processedThrough,
      creationDay,
      ...freshness(),
    },
  }
}

/** Most engaged views first, then most views, then by the row's code, name or Google's value. */
function byMostEngagedViews<T extends EngagedViewsAndViews>(keyOf: (row: T) => string) {
  return (a: T, b: T) =>
    b.engagedViews - a.engagedViews || b.views - a.views || keyOf(a).localeCompare(keyOf(b))
}

/** Google's shares by its value, in its value's order, which for age groups is age order. */
function byGoogleValue(shares: Record<string, number>): [string, number][] {
  return Object.entries(shares).sort(([a], [b]) => a.localeCompare(b))
}

const noNumbers: EngagedViewsAndViews = { engagedViews: 0, views: 0 }

/**
 * The split of Google's `SUBSCRIBED` and `UNSUBSCRIBED` rows, a side with no row 0 and 0 as on a
 * video's screen, or none when Google answers neither.
 */
function subscriberSplitOf(statuses: Record<string, EngagedViewsAndViews>): SubscriberSplit | null {
  const { SUBSCRIBED, UNSUBSCRIBED } = statuses
  if (!SUBSCRIBED && !UNSUBSCRIBED) return null
  return { subscribed: SUBSCRIBED ?? noNumbers, unsubscribed: UNSUBSCRIBED ?? noNumbers }
}
