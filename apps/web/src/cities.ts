import type { City } from '@creator-analytics/api-types'
import { type TopBar, topBarsOf } from './top-bars.ts'

// "Other cities" is approved word for word in creator-analytics#268 on 2026-10-19.

/**
 * One bar for each of the first 10 cities in the API's order, by the name Google answers, then,
 * when there are more, one "Other cities" bar adding up the rest. Two cities can share a name, so
 * each bar is keyed by its place in the list.
 */
export function cityBarsOf(cities: City[], locale?: string): TopBar[] {
  return topBarsOf(
    cities.map(({ name, engagedViews }, i) => ({ key: `${i}-${name}`, name, engagedViews })),
    'Other cities',
    locale,
  )
}
