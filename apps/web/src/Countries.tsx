import type { Country } from '@creator-analytics/api-types'
import { countryBarsOf } from './countries.ts'
import { TopBarsSection } from './TopBarsSection.tsx'

/**
 * The countries the channel's engaged views came from, most engaged views first, then the note.
 * With no country, the heading and the empty state alone.
 */
export function Countries({ countries }: { countries: Country[] }) {
  return (
    // The heading, the rest bar's name and the name of ZZ are approved word for word in
    // creator-analytics#158, the note in creator-analytics#179 on 2026-10-19.
    <TopBarsSection
      heading="Countries (engaged views)"
      bars={countryBarsOf(countries)}
      notes={[
        "YouTube leaves out countries with few views, so the countries can add up to less than the channel's total.",
      ]}
    />
  )
}
