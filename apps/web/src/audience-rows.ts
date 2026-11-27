import type { AudienceView } from './audience.ts'
import { cityBarsOf } from './cities.ts'
import { countryBarsOf } from './countries.ts'
import { deviceBarsOf, operatingSystemBarsOf } from './devices.ts'
import { shownRows } from './top-bars.ts'
import { usStateBarsOf } from './us-states.ts'
import { ageGroupBarsOf, ageGroupCount, genderBarsOf, genderCount } from './viewer-shares.ts'

/** How many bars each bars section of the Audience screen draws, in the screen's order. */
export interface AudienceRows {
  countries: number
  usStates: number
  cities: number
  ageGroups: number
  genders: number
  devices: number
  operatingSystems: number
}

/**
 * The bars each section of `view` draws, from the builders the sections draw with, so a list cut
 * at 10 counts its "Other" bar, and Google's `OTHER` operating system its fold into the rest bar.
 */
export function audienceRowsOf(view: Extract<AudienceView, { kind: 'sections' }>): AudienceRows {
  return {
    countries: countryBarsOf(view.countries).length,
    usStates: usStateBarsOf(view.usStates).length,
    cities: cityBarsOf(view.cities).length,
    ageGroups: ageGroupBarsOf(view.ageGroups).length,
    genders: genderBarsOf(view.genders).length,
    devices: deviceBarsOf(view.devices).length,
    operatingSystems: operatingSystemBarsOf(view.operatingSystems).length,
  }
}

/**
 * The most bars each section draws, which its placeholder holds on a first read
 * (creator-analytics#510): the 10 bars and the "Other" bar of a list `topBarsOf` cuts, the seven
 * age groups, the three genders, and the eight device types Google answers (`Device`), which
 * `deviceBarsOf` draws one bar each with no "Other" bar.
 */
export const fullAudienceRows: AudienceRows = {
  countries: shownRows + 1,
  usStates: shownRows + 1,
  cities: shownRows + 1,
  ageGroups: ageGroupCount,
  genders: genderCount,
  devices: 8,
  operatingSystems: shownRows + 1,
}

// The bars each Audience read answered, by its channel and query, for as long as the page lives:
// the screen keeps only its last read, and a visit to another screen unmounts it.
const answeredRows = new Map<string, AudienceRows>()

/** The memo's key of the read `query` of `channelId`. */
function answeredRowsKeyOf(channelId: string, query: string): string {
  return JSON.stringify([channelId, query])
}

/** Remembers the bars the read `query` of `channelId` answered, replacing an earlier answer's. */
export function rememberAudienceRowsOf(channelId: string, query: string, rows: AudienceRows): void {
  answeredRows.set(answeredRowsKeyOf(channelId, query), rows)
}

/**
 * The bars the Audience placeholder holds for the read `query` of `channelId`: as many as the same
 * read last answered on this page load, else the full sizes, as with no channel yet.
 */
export function audienceRowsExpectedFor(channelId: string | null, query: string): AudienceRows {
  if (channelId === null) return fullAudienceRows
  return answeredRows.get(answeredRowsKeyOf(channelId, query)) ?? fullAudienceRows
}
