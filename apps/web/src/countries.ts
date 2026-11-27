import type { Country } from '@creator-analytics/api-types'
import { type TopBar, topBarsOf } from './top-bars.ts'

// "Unknown country" and "Other countries" are approved word for word in creator-analytics#158.

/**
 * The country's name in the locale's language. `ZZ` is a country YouTube could not identify, which
 * `Intl.DisplayNames` would name "Unknown Region". A code it cannot name, or throws on, shows as
 * the code.
 */
function countryNameOf(code: string, names: Intl.DisplayNames): string {
  if (code === 'ZZ') return 'Unknown country'
  try {
    return names.of(code) ?? code
  } catch {
    return code
  }
}

/**
 * One bar for each of the first 10 countries in the API's order, then, when there are more, one
 * "Other countries" bar adding up the rest, each keyed by the country's code.
 */
export function countryBarsOf(countries: Country[], locale?: string): TopBar[] {
  const names = new Intl.DisplayNames(locale, { type: 'region' })
  return topBarsOf(
    countries.map(({ code, engagedViews }) => ({
      key: code,
      name: countryNameOf(code, names),
      engagedViews,
    })),
    'Other countries',
    locale,
  )
}
