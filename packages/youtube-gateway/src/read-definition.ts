import type { ScopeName } from '@creator-analytics/token-vault'
import type { youtube_v3 } from '@googleapis/youtube'
import type { youtubeAnalytics_v2 } from '@googleapis/youtubeanalytics'
import type { youtubereporting_v1 } from '@googleapis/youtubereporting'

export const hourMs = 60 * 60 * 1000

export interface DateRange {
  /** YYYY-MM-DD, a reporting day in Pacific Time, as the Analytics API takes it. */
  startDate: string
  endDate: string
}

/**
 * The Google calls a read makes. Each call checks the quota before it goes, and records its units
 * whatever Google answers. A refused call, an error answer, or an unanswered call ends the read
 * with a refusal.
 */
export interface GoogleCalls {
  /** One Data API call, at its cost in units from Google's quota calculator. */
  data<T>(cost: number, call: (api: youtube_v3.Youtube) => Promise<T>): Promise<T>
  /** One Analytics API query. The Analytics API counts queries, not units, so each costs one. */
  analytics<T>(call: (api: youtubeAnalytics_v2.Youtubeanalytics) => Promise<T>): Promise<T>
  /** One Reporting API call, recorded as one unit and never refused to keep the reserve. */
  reporting<T>(call: (api: youtubereporting_v1.Youtubereporting) => Promise<T>): Promise<T>
}

/** One catalogue entry for each read. */
export interface ReadDefinition<R, V> {
  needs: ScopeName[]
  cacheKey(request: R): string
  /** Inside the 24-hour retention window, which the read cache's constraint enforces. */
  cacheWindowMs: number
  fetch(google: GoogleCalls, request: R): Promise<V>
}
