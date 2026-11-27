import type {
  AgeGroup,
  AudienceAnswer,
  AudienceRequest,
  AudienceWindow,
  City,
  Country,
  Device,
  ErrorAnswer,
  Gender,
  OperatingSystem,
  RangeBounds,
  RefusalAnswer,
  SubscriberSplit,
  UsState,
  VideoFormatFilter,
} from '@creator-analytics/api-types'
import { defaultVideoWindow } from '@creator-analytics/api-types'
import { boundsOf } from './custom-range.ts'
import { isRangeRefusal, type RefusedRangeView, refusalMessageOf } from './refusals.ts'
import type { Route } from './route.ts'

// The heading is approved word for word in creator-analytics#274 on 2026-10-19. Change it only with
// Nick.
export const audienceHeading = 'Audience'

// Approved word for word in creator-analytics#268 on 2026-10-19. Change it only with Nick.
/** What an Audience section shows under its heading when Google answers it no rows. */
export const noNumbersText = 'YouTube has no numbers for this window.'

// Approved word for word in creator-analytics#268 on 2026-10-19. Change it only with Nick.
/** The note a section read for every format shows when a format is chosen. */
export const everyFormatText = 'These numbers count every format.'

const presetWindows = ['last7', 'last28', 'last90', 'last365'] as const satisfies readonly Exclude<
  AudienceWindow,
  'custom'
>[]

/**
 * The Audience answer a route reads: its calendar window or custom range, and its format. The
 * Audience route holds a calendar window only (`routeToAudience`); any other reads the last 28 days.
 */
export function audienceRequestOf({ window, range, format }: Route): AudienceRequest {
  if (window === 'custom') return { window, range, format }
  return { window: presetWindows.find((each) => each === window) ?? defaultVideoWindow, format }
}

/**
 * The Audience answer's query: a custom range's start and end after the window, and every format
 * leaves the format out, which the API reads as `all`.
 */
export function audienceQueryOf({ window, range, format }: AudienceRequest): URLSearchParams {
  const query = new URLSearchParams({ window, ...range })
  if (format !== 'all') query.set('format', format)
  return query
}

export type AudienceView =
  | {
      kind: 'sections'
      countries: Country[]
      usStates: UsState[]
      cities: City[]
      ageGroups: AgeGroup[]
      genders: Gender[]
      devices: Device[]
      operatingSystems: OperatingSystem[]
      subscriberSplit: SubscriberSplit | null
      /** The format the answer was read for, which the US states and cities are not narrowed to. */
      format: VideoFormatFilter
      bounds: RangeBounds
    }
  | { kind: 'refused'; message: string }
  | RefusedRangeView

/**
 * What the Audience screen shows for the API's answer: its sections and the bounds a custom range
 * takes, or a refusal's text and no section.
 */
export function audienceViewOf(body: AudienceAnswer | RefusalAnswer | ErrorAnswer): AudienceView {
  if (isRangeRefusal(body)) return { kind: 'invalid-range' }
  if ('refusal' in body || 'error' in body) {
    return { kind: 'refused', message: refusalMessageOf(body, "the channel's audience") }
  }
  const {
    countries,
    usStates,
    cities,
    ageGroups,
    genders,
    devices,
    operatingSystems,
    subscriberSplit,
    format,
  } = body
  return {
    kind: 'sections',
    countries,
    usStates,
    cities,
    ageGroups,
    genders,
    devices,
    operatingSystems,
    subscriberSplit,
    format,
    bounds: boundsOf(body),
  }
}
