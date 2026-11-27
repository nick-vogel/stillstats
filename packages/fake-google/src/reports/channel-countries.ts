import { channelBreakdownReport } from './channel-breakdowns.ts'
import type { Report } from './report.ts'

/**
 * The whole channel's engaged views and views by `country`, or one format's, as every channel
 * breakdown report answers them. A live check on Nick's channel on 2026-10-19 answered no Shorts
 * rows for the last 28 days, and full counts for long form.
 */
export const channelCountries: Report = channelBreakdownReport('country', 'countries')
