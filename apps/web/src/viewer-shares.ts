import type { AgeGroup, Gender } from '@creator-analytics/api-types'
import { percentLabelOf, shareOf } from './share.ts'

export interface ViewerShareBar {
  /** Google's value, such as `age18-24` or `user_specified`. */
  key: string
  name: string
  /** Google's own share of signed-in viewers' views, such as "31%". */
  share: string
  /** The bar's length, as a percentage of the longest bar shown. */
  width: number
}

// The labels are approved word for word in creator-analytics#268 on 2026-10-19, in this order.

const ageGroupNames: Record<string, string> = {
  'age13-17': '13 to 17',
  'age18-24': '18 to 24',
  'age25-34': '25 to 34',
  'age35-44': '35 to 44',
  'age45-54': '45 to 54',
  'age55-64': '55 to 64',
  'age65-': '65 and over',
}

const genderNames: Record<string, string> = {
  female: 'Female',
  male: 'Male',
  user_specified: 'Self-described',
}

/** How many age groups Google answers at most, one bar each. */
export const ageGroupCount = Object.keys(ageGroupNames).length

/** How many genders Google answers at most, one bar each. */
export const genderCount = Object.keys(genderNames).length

/**
 * One bar per row Google answered, in the label table's order, then any value with no label under
 * Google's value, in the API's order. Each carries Google's own share, never re-normalized over
 * the rows answered, and its length against the longest bar shown.
 */
function barsOf(
  names: Record<string, string>,
  rows: { key: string; viewerPercentage: number }[],
): ViewerShareBar[] {
  const order = Object.keys(names)
  const rank = (key: string) => {
    const at = order.indexOf(key)
    return at === -1 ? order.length : at
  }
  const sorted = rows.toSorted((a, b) => rank(a.key) - rank(b.key))
  const longest = Math.max(0, ...rows.map(({ viewerPercentage }) => viewerPercentage))
  return sorted.map(({ key, viewerPercentage }) => ({
    key,
    name: names[key] ?? key,
    share: percentLabelOf(viewerPercentage),
    width: shareOf(viewerPercentage, longest),
  }))
}

/** The age bars, in age order: "13 to 17" through "65 and over". */
export function ageGroupBarsOf(ageGroups: AgeGroup[]): ViewerShareBar[] {
  return barsOf(
    ageGroupNames,
    ageGroups.map(({ ageGroup, viewerPercentage }) => ({ key: ageGroup, viewerPercentage })),
  )
}

/** The gender bars, in the order Female, Male, Self-described. */
export function genderBarsOf(genders: Gender[]): ViewerShareBar[] {
  return barsOf(
    genderNames,
    genders.map(({ gender, viewerPercentage }) => ({ key: gender, viewerPercentage })),
  )
}
