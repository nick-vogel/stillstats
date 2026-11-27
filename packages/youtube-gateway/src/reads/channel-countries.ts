import { type BreakdownNumbers, channelBreakdownRead } from './channel-breakdowns.ts'

/** By Google's `country`, ISO 3166-1 alpha-2, `ZZ` for a country YouTube could not identify. */
export type CountryNumbers = BreakdownNumbers

/**
 * The whole channel's engaged views and views by country over the range, or one format's. Google
 * leaves out countries with few views, at limits it does not publish. A live check on Nick's
 * channel on 2026-10-19 answered no Shorts rows for the last 28 days, and full counts for long
 * form.
 */
export const channelCountries = channelBreakdownRead('channelCountries', 'country')
